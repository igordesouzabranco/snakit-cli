// src/utils/check.js
// Regras puras do `snakit check`: recebem texto/listas e devolvem achados.
// Nada daqui executa git nem escreve em disco — o comando (check.js) cuida
// disso. Cada achado é { nivel, regra, arquivo, linha, trecho }.

// --- Regras de erro (segredos e arquivos sensíveis) -------------------------

const REGRAS_SEGREDO = [
  { regra: 'chave-aws', padrao: /AKIA[0-9A-Z]{16}/ },
  { regra: 'chave-anthropic', padrao: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { regra: 'chave-openai', padrao: /sk-[A-Za-z0-9]{32,}/ },
  { regra: 'token-github', padrao: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { regra: 'chave-privada', padrao: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  {
    regra: 'credencial-literal',
    padrao: /(password|senha|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
];

// Extensões que denunciam arquivo sensível no stage (fora do diff).
const PADRAO_ARQUIVO_SENSIVEL = /(^|\/)\.env(\..+)?$|\.pem$|\.key$/i;
const ARQUIVO_ENV_EXCECAO = /\.env\.example$/i;

const EXTENSOES_BINARIAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.gz',
  '.exe', '.dll', '.so', '.wasm', '.jar', '.class', '.woff', '.woff2', '.ttf',
]);

const LIMITE_ARQUIVO_GRANDE = 1024 * 1024; // 1 MB
const LIMITE_BINARIO_GRANDE = 100 * 1024; // 100 KB

const MARCA_IGNORAR = 'snakit-ignore';

// --- Utilidades internas ----------------------------------------------------

/** Substitui cada segredo encontrado pela sua 1ª parte + reticências. */
export function mascararSegredos(texto) {
  let saida = String(texto);
  for (const { padrao } of REGRAS_SEGREDO) {
    saida = saida.replace(new RegExp(padrao.source, 'g'), (trecho) => trecho.slice(0, 4) + '…');
  }
  return saida;
}

/** Cria um achado já mascarado: NENHUM trecho sai daqui com segredo inteiro,
 *  nem os avisos (um console.log com a chave não pode vazar no log de CI). */
function achado(nivel, regra, arquivo, linha, trecho) {
  return { nivel, regra, arquivo, linha, trecho: mascararSegredos(trecho) };
}

/**
 * Lê a saída de `git diff --cached -U0` e devolve só as linhas ADICIONADAS,
 * cada uma como { arquivo, linha, conteudo }. Linhas removidas (começam com
 * `-`) e cabeçalhos (`+++`, `---`, `@@`) são ignorados.
 */
export function extrairLinhasAdicionadas(diff) {
  const linhas = [];
  let arquivo = '';

  for (const bruta of String(diff).split(/\r?\n/)) {
    if (bruta.startsWith('+++ ')) {
      arquivo = bruta.slice(4).replace(/^b\//, '');
      continue;
    }
    if (bruta.startsWith('@@')) {
      // @@ -a,b +c,d @@ → o número que interessa é o de cima (novo arquivo)
      const casamento = bruta.match(/\+(\d+)/);
      let proxima = casamento ? Number(casamento[1]) : 1;
      // O git não manda o número em cada linha; vamos contando a partir do hunk.
      linhas.push({ __hunk: true, arquivo, proxima });
      continue;
    }
    if (bruta.startsWith('+') && !bruta.startsWith('+++')) {
      const controle = linhas[linhas.length - 1];
      const numero = controle && controle.__hunk ? controle.proxima : (controle?.linha ?? 0) + 1;
      linhas.push({ arquivo, linha: numero, conteudo: bruta.slice(1) });
      continue;
    }
    if (bruta.startsWith('-') && !bruta.startsWith('---')) continue;
    if (bruta.startsWith('\\')) continue; // "\ No newline at end of file"

    // Linha de contexto (não deveria existir com -U0, mas não custa nada).
    const controle = linhas[linhas.length - 1];
    if (controle && controle.__hunk) controle.proxima += 1;
  }

  return linhas.filter((l) => !l.__hunk && typeof l.linha === 'number');
}

/** Diz se o caminho está nas pastas/arquivos onde debug é aceitável. */
export function caminhoPermitidoDebug(caminho) {
  const normalizado = String(caminho).replace(/\\/g, '/');
  return (
    /(^|\/)test\//.test(normalizado) ||
    /(^|\/)tests\//.test(normalizado) ||
    /\.test\.[jt]sx?$/.test(normalizado) ||
    /\.spec\.[jt]sx?$/.test(normalizado) ||
    /(^|\/)bin\//.test(normalizado) ||
    /(^|\/)scripts\//.test(normalizado)
  );
}

function ehArquivoDeCodigo(caminho) {
  return /\.(js|jsx|ts|tsx)$/.test(String(caminho));
}

/**
 * Analisa uma lista de linhas adicionadas ({ arquivo, linha, conteudo })
 * e devolve os achados (erros de segredo + avisos de debug/TODO).
 * Linhas com o comentário `snakit-ignore` são puladas.
 */
export function analisarLinhas(linhas) {
  const achados = [];

  for (const { arquivo, linha, conteudo } of linhas) {
    if (String(conteudo).includes(MARCA_IGNORAR)) continue;

    for (const { regra, padrao } of REGRAS_SEGREDO) {
      if (padrao.test(conteudo)) {
        achados.push(achado('erro', regra, arquivo, linha, mascararSegredos(conteudo)));
      }
    }

    if (ehArquivoDeCodigo(arquivo) && !caminhoPermitidoDebug(arquivo)) {
      if (/\bconsole\.(log|debug)\b/.test(conteudo)) {
        achados.push(achado('aviso', 'console-debug', arquivo, linha, conteudo.trim()));
      }
      if (/\bdebugger\b/.test(conteudo)) {
        achados.push(achado('aviso', 'debugger', arquivo, linha, conteudo.trim()));
      }
    }

    if (/\b(TODO|FIXME)\b/.test(conteudo)) {
      achados.push(achado('aviso', 'marcador-todo', arquivo, linha, conteudo.trim()));
    }
  }

  return achados;
}

/** Diz se o conteúdo lido (ou o nome do arquivo) denuncia binário. */
export function ehBinario(caminho, buffer) {
  if (buffer && buffer.length > 0) {
    const inicio = buffer.subarray(0, 8192);
    if (inicio.includes(0)) return true;
  }
  return EXTENSOES_BINARIAS.has(String(caminho).slice(String(caminho).lastIndexOf('.')).toLowerCase());
}

/**
 * Analisa a lista de arquivos no stage.
 * Recebe [{ caminho, tamanho, ehBinario }] e devolve achados de erro
 * (arquivos sensíveis) e aviso (arquivo/binário grande).
 */
export function analisarArquivosStage(arquivos) {
  const achados = [];

  for (const { caminho, tamanho = 0, ehBinario: binario = false } of arquivos) {
    const normalizado = String(caminho).replace(/\\/g, '/');

    if (PADRAO_ARQUIVO_SENSIVEL.test(normalizado) && !ARQUIVO_ENV_EXCECAO.test(normalizado)) {
      achados.push(achado('erro', 'arquivo-sensivel', caminho, 0, 'arquivo no stage'));
      continue;
    }

    if (tamanho > LIMITE_ARQUIVO_GRANDE) {
      achados.push(achado('aviso', 'arquivo-grande', caminho, 0, `${(tamanho / (1024 * 1024)).toFixed(1)} MB`));
    } else if (binario && tamanho > LIMITE_BINARIO_GRANDE) {
      achados.push(achado('aviso', 'binario-grande', caminho, 0, `${(tamanho / 1024).toFixed(0)} KB`));
    }
  }

  return achados;
}

/**
 * Ponto de entrada puro: junta diff do stage + metadados dos arquivos
 * e devolve { erros, avisos } já ordenados por arquivo e linha.
 */
export function analisarStage({ diff = '', arquivos = [] } = {}) {
  const linhas = extrairLinhasAdicionadas(diff);
  const achados = [...analisarLinhas(linhas), ...analisarArquivosStage(arquivos)];

  const porPosicao = (a, b) =>
    String(a.arquivo).localeCompare(String(b.arquivo)) || (a.linha || 0) - (b.linha || 0);

  return {
    erros: achados.filter((a) => a.nivel === 'erro').sort(porPosicao),
    avisos: achados.filter((a) => a.nivel === 'aviso').sort(porPosicao),
  };
}
