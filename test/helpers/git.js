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

/**
 * Ambiente SEM identidade de git, isolado da máquina de quem roda:
 * - HOME/USERPROFILE/XDG apontam para `pasta` (sem ~/.gitconfig);
 * - GIT_CONFIG_GLOBAL para um arquivo que não existe;
 * - GIT_CONFIG_NOSYSTEM=1 (ignora o /etc/gitconfig ou equivalente);
 * - GIT_AUTHOR_ e GIT_COMMITTER_ removidos (na frente na resolução do git).
 * Cada teste que estuda identidade usa isto — nada depende da config real.
 */
export function envSemIdentidade(pasta) {
  const env = { ...process.env };
  env.HOME = pasta;
  env.USERPROFILE = pasta;
  env.XDG_CONFIG_HOME = path.join(pasta, '.config');
  env.GIT_CONFIG_GLOBAL = path.join(pasta, 'gitconfig-ausente');
  env.GIT_CONFIG_NOSYSTEM = '1';
  for (const chave of [
    'GIT_AUTHOR_NAME',
    'GIT_AUTHOR_EMAIL',
    'GIT_COMMITTER_NAME',
    'GIT_COMMITTER_EMAIL',
  ]) {
    delete env[chave];
  }
  return env;
}

/**
 * Repositório git SEM identidade nenhuma (nem local), com o ambiente
 * isolado — exatamente o cenário do usuário novo descrito na missão.
 * Devolve { pasta, env } para os testes rodarem a CLI e o git por lá.
 */
export function criarRepoSemIdentidade(prefixo = 'snakit-repo-sem-identidade-') {
  const pasta = pastaTemporaria(prefixo);
  const env = envSemIdentidade(pasta);
  const git = (argumentos) =>
    execFileSync('git', argumentos, { cwd: pasta, stdio: 'pipe', env });

  git(['init', '-q']);
  git(['config', 'init.defaultBranch', 'main']);

  const atual = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
    cwd: pasta,
    encoding: 'utf8',
    env,
  }).trim();
  if (atual !== 'main') git(['branch', '-m', 'main']);

  return { pasta, env };
}
