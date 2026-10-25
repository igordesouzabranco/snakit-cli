// src/utils/ai.js
// Modo IA do `devkit commit`.
//
// Importante sobre custo/instalação:
// - Nada aqui roda por padrão. A IA SÓ é usada se você passar `--ai`.
// - `@anthropic-ai/sdk` NÃO é dependência do pacote (instalação leve).
//   Tentamos importá-lo dinamicamente; se não existir, usamos `fetch` nativo.
// - A chave vem SEMPRE da variável de ambiente ANTHROPIC_API_KEY.
//   Ela nunca é gravada em arquivo, nunca é impressa e nunca vai no log.

import { extname } from 'node:path';

const URL_API = 'https://api.anthropic.com/v1/messages';
const VERSAO_API = '2023-06-01';
const MODELO_PADRAO = 'claude-haiku-5-5'; // menor custo da família atual
const LIMITE_DIFF = 15000;
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;

// Padrões que NÃO podem sair da máquina: segredos, chaves e arquivos
// gigantes/inescrutíveis que só atrapalham o entendimento do modelo.
const ARQUIVOS_DE_CADEADO = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Cargo.lock',
  'go.sum',
]);

const EXTENSOES_BINARIAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.pdf',
  '.zip', '.gz', '.tar', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.jar', '.class',
  '.o', '.a', '.pyc', '.db', '.sqlite',
]);

const TIPOS_VALIDOS =
  'feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert';

/** Lê a chave da API. Devolve null se não estiver configurada. */
export function obterChave() {
  const chave = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  return chave === '' ? null : chave;
}

/** Modelo: variável DEVKIT_MODEL, ou o padrão da casa. */
export function obterModelo() {
  return (process.env.DEVKIT_MODEL ?? '').trim() || MODELO_PADRAO;
}

function nomeBase(caminho) {
  const partes = caminho.split('/');
  return partes[partes.length - 1];
}

/** Diz se um arquivo não pode ser enviado para a API. */
export function ehArquivoExcluido(caminho) {
  const base = nomeBase(caminho);

  if (caminho.startsWith('node_modules/')) return true;
  if (/^\.env($|\.)/.test(base)) return true; // .env, .env.local, .env.production
  if (/\.(pem|key)$/i.test(base)) return true;
  if (ARQUIVOS_DE_CADEADO.has(base)) return true;
  return EXTENSOES_BINARIAS.has(extname(base).toLowerCase());
}

/**
 * Corta o diff em seções (uma por arquivo) e descarta as proibidas.
 * Devolve { diff, removidos } para a CLI poder avisar o usuário.
 */
export function filtrarDiff(diff) {
  if (!diff || !diff.trim()) return { diff: '', removidos: [] };

  const secoes = diff.split(/(?=^diff --git )/m);
  const mantidas = [];
  const removidos = [];

  for (const secao of secoes) {
    if (!secao.trim()) continue;

    // Cabeçalho: `diff --git a/caminho b/caminho` (o caminho novo é o b/).
    const cabecalho = secao.split('\n')[0].trim();
    const combinacao = /^diff --git a\/(.+) b\/(.+)$/.exec(cabecalho);
    const caminho = combinacao ? combinacao[2] : null;

    if (caminho && ehArquivoExcluido(caminho)) {
      removidos.push(caminho);
      continue;
    }
    mantidas.push(secao);
  }

  return { diff: mantidas.join(''), removidos };
}

/** Limita o tamanho do diff antes de mandar para a API. */
export function truncarDiff(texto, limite = LIMITE_DIFF) {
  if (texto.length <= limite) return { texto, truncado: false };
  return {
    texto: `${texto.slice(0, limite)}\n\n[... diff truncado pelo devkit ...]`,
    truncado: true,
  };
}

/**
 * Monta o prompt. Função pura: é ela que os testes exercitam sem gastar
 * um centavo.
 */
export function montarPrompt({ branch, diff }) {
  return `Você gera mensagens de commit no padrão Conventional Commits.

Escreva UMA única mensagem de commit para o diff abaixo.

Regras obrigatórias:
- Idioma português (pt-BR).
- Imperativo na primeira linha (ex.: "adiciona", "corrige", "remove").
- Primeira linha no formato: tipo(escopo): descricao
  - tipo deve ser um de: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
  - escopo opcional: use somente quando houver uma única pasta principal alterada
  - no máximo 72 caracteres na primeira linha
- Corpo opcional: no máximo 3 linhas curtas, separado da primeira linha por uma linha em branco.
- Responda SOMENTE com a mensagem. Nada de markdown, crases ou explicações.

Branch atual: ${branch || '(desconhecida)'}

Diff dos arquivos alterados (arquivos sensíveis e inúteis já removidos):

\`\`\`diff
${diff}
\`\`\``;
}

/** Valida o formato `tipo(escopo): descricao` (escopo opcional). */
export function ehMensagemValida(mensagem) {
  const primeiraLinha = String(mensagem ?? '').split('\n')[0].trim();
  return new RegExp(`^(${TIPOS_VALIDOS})(\\([^)]+\\))?: \\S.*$`).test(primeiraLinha);
}

/** Remove cercas de código (```) que o modelo por vezes adiciona. */
export function limparResposta(texto) {
  return String(texto ?? '')
    .trim()
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Tenta usar o SDK se a pessoa tiver instalado; caso contrário usa `fetch`.
 * Nenhum dos dois caminhos expõe a chave: ela vai no corpo/na URL nunca,
 * só no cabeçalho `x-api-key`.
 */
async function carregarCliente() {
  try {
    const modulo = await import('@anthropic-ai/sdk');
    const Anthropic = modulo.default ?? modulo.Anthropic;
    return { tipo: 'sdk', cliente: new Anthropic({ apiKey: obterChave(), maxRetries: 1, timeout: TIMEOUT_MS }) };
  } catch {
    return { tipo: 'fetch' };
  }
}

async function chamarComFetch(payload) {
  const resposta = await fetch(URL_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': obterChave(),
      'anthropic-version': VERSAO_API,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const motivo = dados?.error?.message ?? `HTTP ${resposta.status}`;
    throw new Error(`a API respondeu ${resposta.status} (${motivo})`);
  }

  return extrairTexto(dados);
}

function extrairTexto(dados) {
  const blocos = Array.isArray(dados?.content) ? dados.content : [];
  const texto = blocos.map((bloco) => bloco.text ?? '').join('').trim();
  if (!texto) throw new Error('a API devolveu uma resposta vazia');
  return texto;
}

/**
 * Chama a API e devolve o texto bruto da resposta.
 * Levanta erro em caso de falha/timeout — quem chama decide o fallback.
 */
export async function gerarMensagemComIA({ branch, diff }) {
  const payload = {
    model: obterModelo(),
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: montarPrompt({ branch, diff }) }],
  };

  const carregado = await carregarCliente();

  if (carregado.tipo === 'sdk') {
    const resposta = await carregado.cliente.messages.create(payload);
    return extrairTexto(resposta);
  }

  return chamarComFetch(payload);
}
