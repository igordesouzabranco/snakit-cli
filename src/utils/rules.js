// src/utils/rules.js
// Regras puras: recebem dados e devolvem a sugestão de commit.
// Não chama git, não imprime nada, não lê arquivo — por isso é a parte
// mais fácil de testar (ver test/rules.test.js na Etapa 6).

// Padrões que tratamos como "arquivo de configuração" da regra `chore`.
// O enunciado diz "configs" sem detalhar; estes são os mais comuns.
const PADROES_DE_CONFIGURACAO = [
  /^package(-lock)?\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^\.gitignore$/,
  /^\.npmrc$/,
  /^\.editorconfig$/,
  /^\.eslintrc(\..+)?$/,
  /^eslint\.config\.(c|m)?js$/,
  /^\.prettierrc(\..+)?$/,
  /^prettier\.config\.(c|m)?js$/,
  /^tsconfig.*\.json$/,
  /\.config\.(c|m)?js$/, // vite.config.js, jest.config.js
  /\.config\.json$/,
];

function baseDoArquivo(caminho) {
  const partes = caminho.split('/');
  return partes[partes.length - 1];
}

function ehArquivoDeTeste(caminho) {
  return /\.(test|spec)\.js$/.test(caminho);
}

function ehDocumentacao(caminho) {
  const base = baseDoArquivo(caminho);
  const emDocs = caminho.startsWith('docs/');
  const ehMd = caminho.endsWith('.md');
  const ehReadme = /^readme/i.test(base);
  return emDocs || ehMd || ehReadme;
}

function ehConfiguracao(caminho) {
  const base = baseDoArquivo(caminho);
  return PADROES_DE_CONFIGURACAO.some((padrao) => padrao.test(base));
}

function todosOsArquivos(caminhos, regra) {
  return caminhos.length > 0 && caminhos.every(regra);
}

/**
 * Regra 1 a 6, na ordem do enunciado: a primeira que casar vence.
 * A ordem importa — se a branch for `fix-login` e só houver arquivos de
 * teste alterados, a regra 1 (test) responde antes da regra 5 (fix).
 */
export function descobrirTipo(arquivos, branch = '') {
  const caminhos = arquivos.map((item) => item.file);
  if (caminhos.length === 0) return 'chore';

  if (todosOsArquivos(caminhos, ehArquivoDeTeste)) return 'test';
  if (todosOsArquivos(caminhos, ehDocumentacao)) return 'docs';
  if (todosOsArquivos(caminhos, ehConfiguracao)) return 'chore';

  const soRemovidos = arquivos.every((item) => item.status === 'D');
  if (soRemovidos) return 'refactor';

  // Observação: "fix" como substring pega até "prefix.js". É o que o
  // enunciado pede ("caminho contendo fix"), então mantemos simples.
  const mencionaFix =
    branch.toLowerCase().includes('fix') ||
    caminhos.some((caminho) => caminho.toLowerCase().includes('fix'));
  if (mencionaFix) return 'fix';

  const temArquivoNovo = arquivos.some((item) => item.status === 'A');
  return temArquivoNovo ? 'feat' : 'refactor';
}

/**
 * Escopo = primeira pasta dos arquivos alterados, se todos estiverem
 * na mesma pasta. Arquivo na raiz ou pastas diferentes → sem escopo.
 */
export function descobrirEscopo(arquivos) {
  const pastas = new Set();

  for (const { file } of arquivos) {
    const partes = file.split('/');
    if (partes.length < 2) return ''; // arquivo na raiz não gera escopo
    pastas.add(partes[0]);
  }

  if (pastas.size !== 1) return ''; // várias pastas → omitir escopo
  return [...pastas][0];
}

/**
 * Verbo no imperativo, em português.
 * - Todo arquivo removido → "remove" (não há outra leitura possível).
 * - `feat` e `fix` descrevem a intenção, então o tipo manda.
 * - Nos demais casos o que aconteceu com o arquivo é mais informativo:
 *   arquivo novo é "adiciona", arquivo mexido é "atualiza".
 * Assim `feat` nunca sai como "atualiza", mesmo com mudanças mistas.
 */
function descobrirVerbo(arquivos, type) {
  const todosRemovidos = arquivos.every((item) => item.status === 'D');
  if (todosRemovidos) return 'remove';

  if (type === 'feat') return 'adiciona';
  if (type === 'fix') return 'corrige';

  const todosNovos = arquivos.every((item) => item.status === 'A');
  return todosNovos ? 'adiciona' : 'atualiza';
}

/**
 * Descrição curta e no imperativo.
 * Um arquivo → usa o nome dele sem extensão; vários → conta.
 * Ex.: "adiciona userController", "remove 3 arquivos".
 */
export function criarDescricao(arquivos, type) {
  if (arquivos.length === 0) return '';

  const verbo = descobrirVerbo(arquivos, type);

  if (arquivos.length === 1) {
    const base = baseDoArquivo(arquivos[0].file);
    const nome = base
      .replace(/\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx)$/, '') // user.test.js → user
      .replace(/\.(js|mjs|cjs|jsx|ts|tsx|json|md|css|html)$/, '');
    return `${verbo} ${nome}`;
  }

  return `${verbo} ${arquivos.length} arquivos`;
}

/** Monta a linha final: `tipo(escopo): descrição` ou `tipo: descrição`. */
export function montarMensagem({ type, scope, description }) {
  return scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;
}

/** Junta todas as decisões em um único objeto pronto para virar mensagem. */
export function gerarSugestao(arquivos, branch = '') {
  const type = descobrirTipo(arquivos, branch);
  const scope = descobrirEscopo(arquivos);
  const description = criarDescricao(arquivos, type);
  return { type, scope, description, message: montarMensagem({ type, scope, description }) };
}
