// src/utils/config.js
// Lê o arquivo `.snakitrc.json` da pasta onde a CLI foi rodada.
//
// A configuração é OPCIONAL: sem arquivo, tudo funciona com os padrões.
// Com arquivo quebrado, avisamos e continuamos com os padrões — nunca
// derrubamos a CLI por causa de config.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { IDIOMAS_SUPORTADOS } from './rules.js';

export const ARQUIVO_CONFIG = '.snakitrc.json';

const PADRAO = {
  idioma: 'pt-BR',
  useAi: false,
  templatesExtras: [],
};

function ehTemplateValido(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.valor === 'string' &&
    item.valor.trim() !== '' &&
    typeof item.nome === 'string' &&
    typeof item.pasta === 'string' &&
    item.pasta.trim() !== ''
  );
}

/**
 * Devolve { idioma, useAi, templatesExtras, dir, arquivo, aviso }.
 * `aviso` é uma string quando algo no arquivo estava errado (ou null).
 */
export function carregarConfig(dir = process.cwd()) {
  const arquivo = path.join(dir, ARQUIVO_CONFIG);
  const base = { ...PADRAO, dir, arquivo: null, aviso: null };

  if (!existsSync(arquivo)) return base;

  let bruto;
  try {
    bruto = JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (erro) {
    return {
      ...base,
      arquivo,
      aviso: `${ARQUIVO_CONFIG} não é um JSON válido (${erro.message}). Usando os padrões.`,
    };
  }

  if (bruto === null || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return {
      ...base,
      arquivo,
      aviso: `${ARQUIVO_CONFIG} precisa conter um objeto JSON. Usando os padrões.`,
    };
  }

  const config = { ...base, arquivo };

  if (typeof bruto.idioma === 'string' && bruto.idioma.trim() !== '') {
    config.idioma = bruto.idioma.trim();
  }
  if (!IDIOMAS_SUPORTADOS.includes(config.idioma)) {
    config.aviso =
      `Idioma "${config.idioma}" não é suportado (use ${IDIOMAS_SUPORTADOS.join(' ou ')}). Voltando para pt-BR.`;
    config.idioma = 'pt-BR';
  }

  if (typeof bruto.useAi === 'boolean') {
    config.useAi = bruto.useAi;
  }

  if (Array.isArray(bruto.templatesExtras)) {
    config.templatesExtras = bruto.templatesExtras.filter(ehTemplateValido);
    const rejeitados = bruto.templatesExtras.length - config.templatesExtras.length;
    if (rejeitados > 0) {
      config.aviso = `${rejeitados} item(ns) de "templatesExtras" estão incompletos e foram ignorados.`;
    }
  }

  return config;
}
