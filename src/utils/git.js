// src/utils/git.js
// Camada fina em torno do comando `git`.
// Regra de ouro daqui: nenhuma função decide NADA sobre commits — elas só
// executam comandos e devolvem dados. A lógica fica em rules.js.

import { execSync } from 'node:child_process';

/**
 * Executa um comando git e devolve a saída como texto.
 *
 * `execSync` roda o comando de forma SÍNCRONA: o Node fica "travado" nesta
 * linha até o processo terminar e então devolve a saída. Por isso ele só
 * deve ser usado em operações curtas, como as do git.
 *
 * Parâmetros usados:
 * - cwd:     pasta de onde o comando roda (para rodar git em outro projeto)
 * - input:   texto enviado ao stdin do processo (usado pelo `git commit -F -`)
 * - encoding: faz a saída virar string em vez de Buffer
 * - stdio:   guardamos stderr em vez de deixar ele vazar no terminal
 */
function executarGit(argumentos, { dir = process.cwd(), input = '' } = {}) {
  try {
    const saida = execSync(`git ${argumentos}`, {
      cwd: dir,
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10 MB: evita estourar em diffs grandes
    });
    return saida.trim();
  } catch (erro) {
    // O erro do execSync vem com o stderr do git dentro dele. Reprocessamos
    // para deixar a mensagem curta e útil para quem usa a CLI.
    const stderr = typeof erro.stderr === 'string' ? erro.stderr.trim() : '';
    const novoErro = new Error(stderr || erro.message);
    novoErro.status = erro.status;
    novoErro.stderr = stderr;
    throw novoErro;
  }
}

/** Diz se o git está instalado e acessível no PATH. */
export function isGitInstalled() {
  try {
    const saida = execSync('git --version', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return saida.includes('git version');
  } catch {
    return false;
  }
}

/** Diz se a pasta atual (ou a informada) está dentro de um repositório git. */
export function isGitRepo(dir = process.cwd()) {
  try {
    return executarGit('rev-parse --is-inside-work-tree', { dir }) === 'true';
  } catch {
    return false;
  }
}

/**
 * Lista o que está no stage, lendo `git diff --staged --name-status`.
 * Devolve um array de objetos: { status: 'A' | 'M' | 'D' | ..., file: 'caminho' }
 * - A = added (arquivo novo)
 * - M = modified
 * - D = deleted
 * - R = renamed (nesta o git manda 3 colunas: R100  antigo  novo)
 */
export function getStagedFiles(dir = process.cwd()) {
  const saida = executarGit('diff --staged --name-status', { dir });
  if (!saida) return [];

  return saida
    .split(/\r?\n/)
    .map((linha) => {
      const [token, ...resto] = linha.split('\t');
      // Em renomeados pegamos a última coluna, que é o caminho novo.
      const caminho = resto[resto.length - 1] ?? '';
      return { status: token.charAt(0), file: caminho };
    })
    .filter((item) => item.file !== '');
}

/** Devolve o diff completo do stage como texto (vazio se não há nada staged). */
export function getStagedDiff(dir = process.cwd()) {
  return executarGit('diff --staged', { dir });
}

/**
 * Devolve o nome da branch atual.
 * Se o repositório ainda não tem nenhum commit ("branch não nasceu"),
 * `rev-parse` falha e caímos no `symbolic-ref`, que funciona nesse caso.
 * Se tudo falhar, devolvemos string vazia em vez de quebrar a CLI.
 */
export function getCurrentBranch(dir = process.cwd()) {
  try {
    return executarGit('rev-parse --abbrev-ref HEAD', { dir });
  } catch {
    try {
      return executarGit('symbolic-ref --short HEAD', { dir });
    } catch {
      return '';
    }
  }
}

/** Manda tudo que mudou na pasta para o stage (`git add -A`). */
export function add(dir = process.cwd()) {
  return executarGit('add -A', { dir });
}

/**
 * Cria o commit com a mensagem informada.
 * Usamos `git commit -F -`, que lê a mensagem do stdin: assim a mensagem
 * pode ter várias linhas (assunto + corpo), aspas e acentos sem quebrar.
 * Com `-m "texto"` o Windows quebraria a string no primeiro \n.
 */
export function commit(message, dir = process.cwd()) {
  return executarGit('commit -F -', { dir, input: message });
}

/** Inicializa um repositório git na pasta informada. */
export function init(dir = process.cwd()) {
  return executarGit('init', { dir });
}
