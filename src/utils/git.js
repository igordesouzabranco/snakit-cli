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
    const tipo = reconhecerTipoDeErro(stderr);
    const texto = tipo ? traduzirErro(stderr, tipo) : (stderr || erro.message);
    const novoErro = new Error(texto);
    novoErro.status = erro.status;
    novoErro.stderr = stderr;
    novoErro.tipo = tipo;
    throw novoErro;
  }
}

// ---------------------------------------------------------------------------
// Identidade de commit (user.name / user.email)
// ---------------------------------------------------------------------------

const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Diz se um e-mail tem cara de e-mail (regex simples, sem rede). */
export function emailValido(email) {
  return typeof email === 'string' && PADRAO_EMAIL.test(email.trim());
}

/**
 * Lê a identidade de commit que o git usaria em `dir`.
 * Ordem igual à do git: variáveis GIT_AUTHOR_ e GIT_COMMITTER_ na frente,
 * depois `git config user.name/user.email` (local + global).
 * Sem identidade, devolve strings vazias — nunca lança erro.
 */
export function obterIdentidade(dir = process.cwd()) {
  const lerConfig = (chave) => {
    try {
      return executarGit(`config --get ${chave}`, { dir });
    } catch {
      return '';
    }
  };
  const primeiro = (...valores) => {
    for (const valor of valores) {
      const texto = String(valor ?? '').trim();
      if (texto) return texto;
    }
    return '';
  };
  return {
    nome: primeiro(
      process.env.GIT_AUTHOR_NAME,
      process.env.GIT_COMMITTER_NAME,
      lerConfig('user.name'),
    ),
    email: primeiro(
      process.env.GIT_AUTHOR_EMAIL,
      process.env.GIT_COMMITTER_EMAIL,
      lerConfig('user.email'),
    ),
  };
}

/** true quando há nome E email prontos para commitar. */
export function temIdentidade(dir = process.cwd()) {
  const { nome, email } = obterIdentidade(dir);
  return Boolean(nome && email);
}

/** Tira aspas e caracteres de shell do valor (Windows usa cmd, POSIX sh). */
function limparValor(valor) {
  return String(valor).replace(/["`%$]/g, '').trim();
}

/**
 * Flags `-c user.name=… -c user.email=…` para o comando de commit.
 * Servem para a identidade temporária e para a do `.snakitrc.json`,
 * que não estão gravadas em nenhum arquivo de configuração do git.
 */
function flagsIdentidade(identidade) {
  if (!identidade || !identidade.nome || !identidade.email) return '';
  const nome = limparValor(identidade.nome);
  const email = limparValor(identidade.email);
  if (!nome || !email) return '';
  return `-c user.name="${nome}" -c user.email="${email}" `;
}

/**
 * Grava identidade SÓ no repositório informado (`git config` sem --global).
 * Nunca tocamos no ~/.gitconfig de ninguém.
 */
export function definirIdentidadeLocal(dir, { nome, email }) {
  executarGit(`config user.name "${limparValor(nome)}"`, { dir });
  executarGit(`config user.email "${limparValor(email)}"`, { dir });
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

// ---------------------------------------------------------------------------
// Erros do git em português: nada de derrubar o stderr cru no usuário
// ---------------------------------------------------------------------------

const PADROES_IDENTIDADE =
  /Author identity unknown|unable to auto-detect email address|empty ident name|Please tell me who you are/i;
const PADROES_GPG = /\bgpg\b|gpgsig|could not sign|commit\.gpgsign/i;
const PADROES_HOOK =
  /\.git[/\\]hooks|hook (failed|exited|declined)|hook(s)? .+ exited with code|(pre-commit|commit-msg|prepare-commit-msg) hook/i;

/** 'identidade' | 'gpg' | 'hook' | null — o que o stderr está dizendo. */
function reconhecerTipoDeErro(stderr) {
  const texto = String(stderr || '');
  if (PADROES_IDENTIDADE.test(texto)) return 'identidade';
  if (PADROES_GPG.test(texto)) return 'gpg';
  if (PADROES_HOOK.test(texto)) return 'hook';
  return null;
}

/** Primeira linha que presta (sem os "hint:" de tutorial do git). */
function primeiraLinhaUtil(stderr) {
  const linhas = String(stderr || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .filter((linha) => !/^(hint:|run |to set your account|omit --global|.*please tell me)/i.test(linha));
  return linhas[0] || '';
}

/** Mensagem curta e acionável em pt-BR para cada tipo de erro conhecido. */
function traduzirErro(stderr, tipo) {
  if (tipo === 'identidade') {
    return (
      'O git não tem identidade de commit configurada (user.name e user.email). ' +
      'Configure com `git config --global user.name "Seu Nome"` e ' +
      '`git config --global user.email "voce@exemplo.com"`, ou use ' +
      '`snakit commit --yes`, que usa uma identidade temporária.'
    );
  }
  if (tipo === 'gpg') {
    const motivo = primeiraLinhaUtil(stderr);
    return (
      'A assinatura GPG do commit falhou' +
      (motivo ? `: ${motivo}` : '') +
      '. Desative com `git config --global commit.gpgsign false` ou ajuste as chaves.'
    );
  }
  // hook: uma linha só, sem o despejo inteiro
  const motivo = primeiraLinhaUtil(stderr) || 'o hook recusou o commit';
  return `Hook de commit rejeitou: ${motivo}`;
}

/**
 * true quando o erro é de identidade ausente (usado para decidir exit code
 * no `snakit new`, onde só isso não é fatal).
 */
export function ehErroIdentidade(erro) {
  if (erro && erro.tipo === 'identidade') return true;
  const texto = `${erro?.message || erro || ''} ${erro?.stderr || ''}`;
  return PADROES_IDENTIDADE.test(texto);
}

// ---------------------------------------------------------------------------
// Operações de escrita (aceitam identidade opcional)
// ---------------------------------------------------------------------------

/**
 * Cria o commit com a mensagem informada.
 * Usamos `git commit -F -`, que lê a mensagem do stdin: assim a mensagem
 * pode ter várias linhas (assunto + corpo), aspas e acentos sem quebrar.
 * Com `-m "texto"` o Windows quebraria a string no primeiro \n.
 *
 * `identidade` ({ nome, email }) é opcional: quando vem, vale SÓ para este
 * comando, via `-c user.name=… -c user.email=…` (nada é gravado no git).
 */
export function commit(message, dir = process.cwd(), { identidade = null } = {}) {
  return executarGit(`${flagsIdentidade(identidade)}commit -F -`, { dir, input: message });
}

/** Reescreve a mensagem do último commit (mesmo caminho seguro do commit). */
export function amend(message, dir = process.cwd(), { identidade = null } = {}) {
  return executarGit(`${flagsIdentidade(identidade)}commit --amend -F -`, { dir, input: message });
}

/** Cria tag anotada (o tagger também precisa de identidade). */
export function criarTag(tag, mensagem, dir = process.cwd(), { identidade = null } = {}) {
  return executarGit(`${flagsIdentidade(identidade)}tag -a ${tag} -m "${limparValor(mensagem)}"`, { dir });
}

/** Faz `git push`, se houver upstream configurado. */
export function push(dir = process.cwd()) {
  try {
    executarGit('push', { dir });
    return true;
  } catch (erro) {
    // Se não há upstream, devolvemos false sem quebrar a CLI.
    return false;
  }
}

/** Inicializa um repositório git na pasta informada. */
export function init(dir = process.cwd()) {
  return executarGit('init', { dir });
}
