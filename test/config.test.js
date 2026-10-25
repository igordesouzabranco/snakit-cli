// test/config.test.js
// Testa a leitura do .snakitrc.json — incluindo arquivo quebrado,
// para garantir que config ruim nunca derruba a CLI.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { carregarConfig, ARQUIVO_CONFIG } from '../src/utils/config.js';

const temporarias = [];

function pastaComConfig(conteudo) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'snakit-config-'));
  temporarias.push(pasta);
  if (conteudo !== undefined) writeFileSync(path.join(pasta, ARQUIVO_CONFIG), conteudo);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) rmSync(pasta, { recursive: true, force: true });
});

describe('carregarConfig — sem arquivo', () => {
  test('devolve os padrões', () => {
    const pasta = pastaComConfig(undefined);
    const config = carregarConfig(pasta);

    assert.equal(config.idioma, 'pt-BR');
    assert.equal(config.useAi, false);
    assert.deepEqual(config.templatesExtras, []);
    assert.equal(config.arquivo, null);
    assert.equal(config.aviso, null);
  });
});

describe('carregarConfig — arquivo válido', () => {
  test('aplica as três chaves', () => {
    const pasta = pastaComConfig(
      JSON.stringify({
        idioma: 'en',
        useAi: true,
        templatesExtras: [{ valor: 'api', nome: 'API', pasta: '../api' }],
      }),
    );
    const config = carregarConfig(pasta);

    assert.equal(config.idioma, 'en');
    assert.equal(config.useAi, true);
    assert.equal(config.templatesExtras.length, 1);
    assert.equal(config.aviso, null);
  });

  test('só uma chave preenchida mantém as outras no padrão', () => {
    const pasta = pastaComConfig(JSON.stringify({ useAi: true }));
    const config = carregarConfig(pasta);

    assert.equal(config.useAi, true);
    assert.equal(config.idioma, 'pt-BR');
    assert.deepEqual(config.templatesExtras, []);
  });

  test('descarta templatesExtras incompletos e avisa', () => {
    const pasta = pastaComConfig(
      JSON.stringify({
        templatesExtras: [
          { valor: 'bom', nome: 'Bom', pasta: '../bom' },
          { valor: 'ruim', nome: 'Ruim' },
          null,
        ],
      }),
    );
    const config = carregarConfig(pasta);

    assert.equal(config.templatesExtras.length, 1);
    assert.equal(config.templatesExtras[0].valor, 'bom');
    assert.match(config.aviso, /templatesExtras/);
  });
});

describe('carregarConfig — arquivo quebrado', () => {
  test('JSON inválido não lança erro', () => {
    const pasta = pastaComConfig('{ "idioma": ');
    const config = carregarConfig(pasta);

    assert.equal(config.idioma, 'pt-BR');
    assert.match(config.aviso, /JSON válido/);
  });

  test('JSON que não é objeto também é tratado', () => {
    const pasta = pastaComConfig('[1, 2, 3]');
    const config = carregarConfig(pasta);

    assert.equal(config.useAi, false);
    assert.match(config.aviso, /objeto JSON/);
  });

  test('idioma não suportado volta para pt-BR com aviso', () => {
    const pasta = pastaComConfig(JSON.stringify({ idioma: 'fr' }));
    const config = carregarConfig(pasta);

    assert.equal(config.idioma, 'pt-BR');
    assert.match(config.aviso, /não é suportado/);
  });

  test('tipos errados são ignorados sem quebrar', () => {
    const pasta = pastaComConfig(JSON.stringify({ idioma: 42, useAi: 'sim' }));
    const config = carregarConfig(pasta);

    assert.equal(config.idioma, 'pt-BR');
    assert.equal(config.useAi, false);
  });
});

describe('carregarConfig — caminho', () => {
  test('guarda a pasta onde foi lida (para resolver templatesExtras)', () => {
    const pasta = pastaComConfig('{}');
    const config = carregarConfig(pasta);
    assert.equal(config.dir, pasta);
    assert.equal(config.arquivo, path.join(pasta, ARQUIVO_CONFIG));
  });
});
