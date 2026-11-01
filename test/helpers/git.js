// test/helpers/git.js
// Repositórios temporários herméticos para os testes.
// O runner do GitHub não tem ~/.gitconfig nem identidade de git: por isso
// a identidade e a branch padrão são definidas LOCALMENTE, em cada repo
// temporário, e nada aqui depende da máquina de quem roda.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporarias = [];

/** Pasta temporária registrada para limpeza (chamar limparPastasTemporarias). */
export function pastaTemporaria(prefixo = 'snakit-test-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

/**
 * Cria um repositório git temporário pronto para commitar:
 * `git init` + `user.email` + `user.name` + `init.defaultBranch=main`,
 * tudo configurado LOCALMENTE no próprio repositório.
 */
export function criarRepoTemporario(prefixo = 'snakit-repo-') {
  const pasta = pastaTemporaria(prefixo);
  const git = (argumentos) =>
    execFileSync('git', argumentos, { cwd: pasta, stdio: 'pipe' });

  git(['init', '-q']);
  git(['config', 'user.email', 'teste@snakit.dev']);
  git(['config', 'user.name', 'Snakit Teste']);
  git(['config', 'init.defaultBranch', 'main']);

  // O `git init` já criou a branch com o default da máquina; alinhamos
  // para `main` (ignorando se já for main, para não falhar).
  const atual = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
    cwd: pasta,
    encoding: 'utf8',
  }).trim();
  if (atual !== 'main') git(['branch', '-m', 'main']);

  return pasta;
}

/** Apaga todas as pastas temporárias criadas pelos helpers (usar no after()). */
export function limparPastasTemporarias() {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
  temporarias.length = 0;
}
