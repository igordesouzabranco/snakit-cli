// test/files.test.js
// Testa validação de nome, cópia de template e troca de placeholders.
// Usa pastas temporárias em os.tmpdir() para não sujar o projeto.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  validarNomeProjeto,
  listarTemplates,
  copiarTemplate,
  substituirPlaceholders,
} from '../src/utils/files.js';

const temporarias = [];

/** Cria uma pasta descartável e guarda para limpar no final. */
function pastaTemporaria(prefixo = 'devkit-test-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe('validarNomeProjeto', () => {
  test('aceita nomes válidos', () => {
    for (const nome of ['minha-loja', 'Meu_App2', 'app.v2', 'projeto1']) {
      const resultado = validarNomeProjeto(nome);
      assert.equal(resultado.ok, true, `esperava aceitar "${nome}"`);
      assert.equal(resultado.nome, nome);
    }
  });

  test('rejeita espaço', () => {
    const resultado = validarNomeProjeto('meu projeto');
    assert.equal(resultado.ok, false);
    assert.match(resultado.erro, /espaços/);
  });

  test('rejeita caractere inválido', () => {
    const resultado = validarNomeProjeto('projeto!');
    assert.equal(resultado.ok, false);
    assert.match(resultado.erro, /letras, números/);
  });

  test('rejeita nome que começa com ponto', () => {
    assert.equal(validarNomeProjeto('.oculto').ok, false);
  });

  test('rejeita nome que começa com hífen', () => {
    assert.equal(validarNomeProjeto('-flag').ok, false);
  });

  test('rejeita vazio e só espaços', () => {
    assert.equal(validarNomeProjeto('').ok, false);
    assert.equal(validarNomeProjeto('   ').ok, false);
  });

  test('rejeita valor sem argumento (undefined)', () => {
    assert.equal(validarNomeProjeto(undefined).ok, false);
  });

  test('remove espaços nas pontas antes de validar', () => {
    const resultado = validarNomeProjeto('  projeto  ');
    assert.equal(resultado.ok, true);
    assert.equal(resultado.nome, 'projeto');
  });
});

describe('listarTemplates', () => {
  test('encontra os três templates do projeto', () => {
    const nomes = listarTemplates().map((t) => t.valor);
    assert.deepEqual(nomes.sort(), ['express-mvc', 'node-puro', 'react']);
  });

  test('cada template tem nome e descrição', () => {
    for (const template of listarTemplates()) {
      assert.ok(template.nome.length > 0);
      assert.ok(template.descricao.length > 0);
    }
  });
});

describe('copiarTemplate', () => {
  test('copia o template node-puro para a pasta de destino', () => {
    const destino = path.join(pastaTemporaria(), 'meu-projeto');
    copiarTemplate('node-puro', destino);

    assert.ok(existsSync(path.join(destino, 'package.json')));
    assert.ok(existsSync(path.join(destino, 'index.js')));
  });

  test('falha se a pasta de destino já existe', () => {
    const destino = path.join(pastaTemporaria(), 'repetido');
    mkdirSync(destino);
    assert.throws(() => copiarTemplate('node-puro', destino), /já existe/);
  });

  test('falha se o template não existe', () => {
    const destino = path.join(pastaTemporaria(), 'qualquer');
    assert.throws(() => copiarTemplate('nao-existe', destino), /Template não encontrado/);
  });
});

describe('substituirPlaceholders', () => {
  test('troca {{nome}} em vários arquivos', () => {
    const pasta = pastaTemporaria();
    writeFileSync(path.join(pasta, 'a.js'), 'const projeto = "{{nome}}";\n');
    writeFileSync(path.join(pasta, 'b.json'), '{"name": "{{nome}}"}\n');
    mkdirSync(path.join(pasta, 'sub'));
    writeFileSync(path.join(pasta, 'sub', 'c.md'), '# {{nome}}\n');

    const alterados = substituirPlaceholders(pasta, { nome: 'loja' });

    assert.equal(alterados, 3);
    assert.equal(readFileSync(path.join(pasta, 'a.js'), 'utf8'), 'const projeto = "loja";\n');
    assert.equal(readFileSync(path.join(pasta, 'b.json'), 'utf8'), '{"name": "loja"}\n');
    assert.equal(readFileSync(path.join(pasta, 'sub', 'c.md'), 'utf8'), '# loja\n');
  });

  test('deixa chave desconhecida intacta', () => {
    const pasta = pastaTemporaria();
    writeFileSync(path.join(pasta, 'a.js'), 'valor: {{outraChave}}\n');

    substituirPlaceholders(pasta, { nome: 'loja' });

    assert.equal(readFileSync(path.join(pasta, 'a.js'), 'utf8'), 'valor: {{outraChave}}\n');
  });

  test('não mexe em arquivo que não é texto', () => {
    const pasta = pastaTemporaria();
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x7b, 0x7b, 0x6e, 0x6f, 0x6d, 0x65, 0x7d, 0x7d]);
    writeFileSync(path.join(pasta, 'logo.png'), bytes);

    substituirPlaceholders(pasta, { nome: 'loja' });

    assert.deepEqual(readFileSync(path.join(pasta, 'logo.png')), bytes);
  });

  test('devolve zero quando não há placeholder', () => {
    const pasta = pastaTemporaria();
    writeFileSync(path.join(pasta, 'a.js'), 'console.log(1);\n');
    assert.equal(substituirPlaceholders(pasta, { nome: 'loja' }), 0);
  });

  test('o template node-puro sai sem nenhum {{ sobrando', () => {
    const destino = path.join(pastaTemporaria(), 'sem-placeholder');
    copiarTemplate('node-puro', destino);
    substituirPlaceholders(destino, { nome: 'projeto-x' });

    const pacote = JSON.parse(readFileSync(path.join(destino, 'package.json'), 'utf8'));
    assert.equal(pacote.name, 'projeto-x');
    assert.equal(readFileSync(path.join(destino, 'index.js'), 'utf8').includes('{{'), false);
  });
});
