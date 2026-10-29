// src/utils/files.js
// Copia o template escolhido para a pasta nova e troca os placeholders
// (textos entre chaves, como {{nome}}) pelos valores reais.

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
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

// Catálogo dos templates: nome amigável para o menu/commit + descrição.
// A ordem define a ordem do menu do `snakit new`.
const CATALOGO = [
  { valor: 'express-mvc', nome: 'Express MVC', descricao: 'Express com estrutura MVC (controllers/, models/, routes/)' },
  { valor: 'express-ts', nome: 'Express + TypeScript', descricao: 'Express MVC com TypeScript (ts-node, tsc)' },
  { valor: 'react', nome: 'React', descricao: 'React mínimo com Vite' },
  { valor: 'react-ts', nome: 'React + TypeScript', descricao: 'React com Vite e TypeScript' },
  { valor: 'node-puro', nome: 'Node puro', descricao: 'Node.js puro (index.js + package.json)' },
  { valor: 'fastapi', nome: 'FastAPI', descricao: 'API Python com FastAPI' },
  { valor: 'django', nome: 'Django', descricao: 'Projeto Django mínimo' },
  { valor: 'cli-node', nome: 'CLI Node', descricao: 'CLI em Node.js com Commander e teste' },
  { valor: 'lib-npm', nome: 'Lib npm', descricao: 'Biblioteca npm (ESM, exports, teste)' },
];

/**
 * Lista os templates disponíveis: os embutidos em src/templates/ + os que o
 * `.snakitrc.json` declarar em "templatesExtras".
 * Devolve [{ valor, nome, descricao, pasta? }].
 */
export function listarTemplates(config = {}) {
  const pastas = new Set(
    readdirSync(RAIZ_TEMPLATES, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name),
  );

  const embutidos = CATALOGO.filter((item) => pastas.has(item.valor));

  const extras = (config.templatesExtras ?? []).map((item) => ({
    valor: item.valor,
    nome: item.nome,
    descricao: item.descricao ?? item.valor,
    pasta: item.pasta,
  }));

  return [...embutidos, ...extras];
}

/**
 * Copia a pasta do template para o destino.
 * `cpSync` com `recursive: true` é o "arrasta e solta" do Node: copia a
 * árvore inteira de arquivos e subpastas.
 * Template extra aceita caminho absoluto ou relativo à pasta de trabalho.
 */
export function copiarTemplate(template, destino, config = {}) {
  const extra = (config.templatesExtras ?? []).find((item) => item.valor === template);
  const origem = extra
    ? path.resolve(config.dir ?? process.cwd(), extra.pasta)
    : path.join(RAIZ_TEMPLATES, template);

  if (!existsSync(origem)) {
    throw new Error(
      extra
        ? `Template extra "${template}" não existe em: ${origem}`
        : `Template não encontrado: ${template}`,
    );
  }
  if (existsSync(destino)) {
    throw new Error(`A pasta "${destino}" já existe. Escolha outro nome ou apague a pasta.`);
  }

  cpSync(origem, destino, { recursive: true });

  // Renomear arquivos que começam com _ para . (npm ignora .gitignore no publish)
  function renomearRecursivo(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, item.name);
      if (item.isDirectory()) {
        renomearRecursivo(caminho);
      } else if (item.name.startsWith('_')) {
        renameSync(caminho, path.join(dir, '.' + item.name.slice(1)));
      }
    }
  }
  renomearRecursivo(destino);
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
