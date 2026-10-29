// src/utils/rules.js
// Regras puras: recebem dados e devolvem a sugestão de commit.
// Não chama git, não imprime nada, não lê arquivo — por isso é a parte
// mais fácil de testar (ver test/rules.test.js na Etapa 6).

// Verbos e palavras por idioma. `idioma` vem do .snakitrc.json e só muda
// a MENSAGEM de commit — a interface da CLI continua em português.
const TEXTOS = {
  'pt-BR': {
    feat: 'adiciona',
    fix: 'corrige',
    docs: 'atualiza',
    chore: 'atualiza',
    refactor: 'atualiza',
    test: 'atualiza',
    remocao: 'remove',
    plural: 'arquivos',
  },
  en: {
    feat: 'add',
    fix: 'fix',
    docs: 'update',
    chore: 'update',
    refactor: 'update',
    test: 'update',
    remocao: 'remove',
    plural: 'files',
  },
};

export const IDIOMAS_SUPORTADOS = Object.keys(TEXTOS);

function textosDe(idioma) {
  return TEXTOS[idioma] ?? TEXTOS['pt-BR'];
}

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
  /\.config\.(c|m)?js$/,
  /\.config\.json$/,
  /^Dockerfile$/,
  /^docker-compose\.(yml|yaml)$/,
  /^\.github\/workflows\/.*$/,
  /^requirements\.txt$/,
  /^pyproject\.toml$/,
  /^pom\.xml$/,
  /^build\.gradle$/,
];

function baseDoArquivo(caminho) {
  const partes = caminho.split('/');
  return partes[partes.length - 1];
}

function ehArquivoDeTeste(caminho) {
  return /\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx|py|java|go|rs)$/i.test(caminho) ||
         /test_.*\.py$|.*_test\.py$|.*Test\.java$|.*_test\.go$/i.test(caminho) ||
         /(__tests__|tests)\//i.test(caminho);
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

  const todosCss = caminhos.every((c) => /\.css$|\.scss$/.test(c));
  if (todosCss) return 'style';

  if (todosOsArquivos(caminhos, ehArquivoDeTeste)) return 'test';
  if (todosOsArquivos(caminhos, ehDocumentacao)) return 'docs';
  if (todosOsArquivos(caminhos, ehConfiguracao)) return 'chore';

  const soRemovidos = arquivos.every((item) => item.status === 'D');
  if (soRemovidos) return 'refactor';

  // Observação: "fix" como substring pega até "prefix.js". É o que o
  // enunciado pede ("caminho contendo fix"), então mantemos simples.
  const mencionaFix =
    /(?:^|[\/_.-])(?:fix|fixes|hotfix|bugfix)(?=[\/_.-]|$)/i.test(branch) ||
    caminhos.some((caminho) => /(?:^|[\/_.-])(?:fix|fixes|hotfix|bugfix)(?=[\/_.-]|$)/i.test(caminho));
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
 * Verbo no imperativo.
 * - Todo arquivo removido → remoção (não há outra leitura possível).
 * - `feat` e `fix` descrevem a intenção, então o tipo manda.
 * - Nos demais casos o que aconteceu com o arquivo é mais informativo:
 *   arquivo novo é "adiciona", arquivo mexido é "atualiza".
 * Assim `feat` nunca sai como "atualiza", mesmo com mudanças mistas.
 */
function descobrirVerbo(arquivos, type, idioma) {
  const textos = textosDe(idioma);

  const todosRemovidos = arquivos.every((item) => item.status === 'D');
  if (todosRemovidos) return textos.remocao;

  if (type === 'feat') return textos.feat;
  if (type === 'fix') return textos.fix;

  const todosNovos = arquivos.every((item) => item.status === 'A');
  if (todosNovos) return textos.feat;

  return textos[type] ?? textos.chore;
}

/**
 * Descrição curta e no imperativo.
 * Um arquivo → usa o nome dele sem extensão; vários → conta.
 * Ex.: "adiciona userController", "remove 3 arquivos".
 */
export function criarDescricao(arquivos, type, idioma = 'pt-BR') {
  if (arquivos.length === 0) return '';

  const textos = textosDe(idioma);
  const verbo = descobrirVerbo(arquivos, type, idioma);

  if (arquivos.length === 1) {
    const base = baseDoArquivo(arquivos[0].file);
    const nome = base
      .replace(/\.(test|spec)\.(js|mjs|cjs|jsx|ts|tsx|py|java|go|rs)$/, '')
      .replace(/\.(js|mjs|cjs|jsx|ts|tsx|json|md|css|scss|html|py|java|go|rs|php|rb|c|cpp|cs|sql|yml|yaml|toml)$/, '');
    return `${verbo} ${nome}`;
  }

  return `${verbo} ${arquivos.length} ${textos.plural}`;
}

/** Monta a linha final: `tipo(escopo): descrição` ou `tipo: descrição`. */
export function montarMensagem({ type, scope, description }) {
  return scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;
}

/** Junta todas as decisões em um único objeto pronto para virar mensagem. */
export function gerarSugestao(arquivos, branch = '', idioma = 'pt-BR') {
  const type = descobrirTipo(arquivos, branch);
  const scope = descobrirEscopo(arquivos);
  const description = criarDescricao(arquivos, type, idioma);
  return { type, scope, description, message: montarMensagem({ type, scope, description }) };
}
