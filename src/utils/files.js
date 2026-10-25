// src/utils/files.js
// Copia o template escolhido para a pasta nova e troca os placeholders
// (textos entre chaves, como {{nome}}) pelos valores reais.

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_TEMPLATES = path.join(AQUI, '..', 'templates');

// Extensões que consideramos texto seguro para trocar placeholders.
// Imagens e binários são ignorados: ler e reescrever eles como UTF-8
// corromperia o arquivo.
const EXTENSOES_DE_TEXTO = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', '.md', '.html', '.css', '.txt',
  '.yml', '.yaml', '.env',
]);

const NOME_VALIDO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Valida o nome de um projeto.
 * Devolve { ok: true } ou { ok: false, erro: 'motivo' }.
 * Regras: sem espaços, sem caracteres fora de letras/números/. / - / _,
 * e não pode começar com ponto ou hífen.
 */
export function validarNomeProjeto(nome) {
  const nomeLimpo = String(nome ?? '').trim();

  if (!nomeLimpo) return { ok: false, erro: 'O nome do projeto não pode ficar vazio.' };
  if (/\s/.test(nomeLimpo)) return { ok: false, erro: 'O nome não pode conter espaços.' };
  if (nomeLimpo.startsWith('.') || nomeLimpo.startsWith('-')) {
    return { ok: false, erro: 'O nome não pode começar com ponto ou hífen.' };
  }
  if (!NOME_VALIDO.test(nomeLimpo)) {
    return {
      ok: false,
      erro: 'Use só letras, números, ponto, hífen e sublinhado (sem acentos ou espaços).',
    };
  }
  return { ok: true, nome: nomeLimpo };
}

/** Lista os nomes das pastas disponíveis em src/templates/. */
export function listarTemplates() {
  return readdirSync(RAIZ_TEMPLATES, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

/** Explica, em português, um template a partir do nome da pasta. */
export function descreverTemplate(nome) {
  const descricoes = {
    'node-puro': 'Node.js puro (index.js + package.json)',
    'express-mvc': 'Express com estrutura MVC (controllers/, models/, routes/)',
    react: 'React mínimo com Vite',
  };
  return descricoes[nome] ?? nome;
}

/**
 * Copia a pasta do template para o destino.
 * `cpSync` com `recursive: true` é o "arrasta e solta" do Node: copia a
 * árvore inteira de arquivos e subpastas.
 */
export function copiarTemplate(template, destino) {
  const origem = path.join(RAIZ_TEMPLATES, template);

  if (!existsSync(origem)) {
    throw new Error(`Template não encontrado: ${template}`);
  }
  if (existsSync(destino)) {
    throw new Error(`A pasta "${destino}" já existe. Escolha outro nome ou apague a pasta.`);
  }

  cpSync(origem, destino, { recursive: true });
}

/** Caminha pela pasta devolvendo só os arquivos de texto. */
function listarArquivosDeTexto(dir) {
  const encontrados = [];

  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) {
      encontrados.push(...listarArquivosDeTexto(caminho));
    } else if (EXTENSOES_DE_TEXTO.has(path.extname(item.name))) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

/**
 * Troca todos os `{{chave}}` dos arquivos pelo valor correspondente.
 * Ex.: substituirPlaceholders(pasta, { nome: 'minha-loja' })
 *      transforma "{{nome}} v1" em "minha-loja v1".
 * Chave desconhecida fica intacta, para não apagar acidentalmente.
 */
export function substituirPlaceholders(dir, dados) {
  let alterados = 0;

  for (const arquivo of listarArquivosDeTexto(dir)) {
    const texto = readFileSync(arquivo, 'utf8');
    if (!texto.includes('{{')) continue;

    const novoTexto = texto.replace(/\{\{(\w+)\}\}/g, (marca, chave) => {
      const valor = dados[chave];
      return valor === undefined ? marca : String(valor);
    });

    if (novoTexto !== texto) {
      writeFileSync(arquivo, novoTexto, 'utf8');
      alterados += 1;
    }
  }

  return alterados;
}
