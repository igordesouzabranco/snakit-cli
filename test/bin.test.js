// test/bin.test.js
// Garante que o ponto de entrada carrega: `--help` da CLI e de cada
// comando (descoberto dinamicamente pelo próprio --help) sai com exit 0.
// Teria pegado, por exemplo, o template esquecido na 1.3.0.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(RAIZ, 'bin', 'snakit.js');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-bin-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

/** Roda a CLI fora de repositório git (para não colidir com configs locais).
 *  process.execPath: o binário do Node atual, sem depender do PATH. */
function rodarCli(...argumentos) {
  try {
    const saida = execFileSync(process.execPath, [BIN, ...argumentos], {
      cwd: pastaTemporaria(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, saida };
  } catch (erro) {
    return { status: erro.status, saida: (erro.stdout || '') + (erro.stderr || '') };
  }
}

/** Lê os nomes dos comandos listados no --help raiz. */
function descobrirComandos() {
  const { status, saida } = rodarCli('--help');
  assert.equal(status, 0, `--help da CLI falhou:\n${saida}`);
  const bloco = saida.split(/Commands:/)[1] || '';
  const comandos = [];
  for (const linha of bloco.split('\n')) {
    const casamento = linha.match(/^ {2}([a-z][a-z-]*)(?:\s|$)/);
    if (casamento) comandos.push(casamento[1]);
  }
  return comandos;
}

describe('bin/snakit.js', () => {
  test('--help raiz sai com exit 0 e lista comandos', () => {
    const { status, saida } = rodarCli('--help');
    assert.equal(status, 0);
    assert.match(saida, /Usage:/);
    const comandos = descobrirComandos();
    assert.ok(comandos.length >= 15, `esperava vários comandos, achei ${comandos.length}`);
    assert.ok(comandos.includes('commit'));
    assert.ok(comandos.includes('new'));
    assert.ok(comandos.includes('check'));
  });

  test('sem argumento mostra a ajuda e sai com 0', () => {
    const { status, saida } = rodarCli();
    assert.equal(status, 0);
    assert.match(saida, /Usage:/);
  });

  test('--version sai com exit 0 e devolve a versão do package.json', () => {
    const { status, saida } = rodarCli('--version');
    assert.equal(status, 0);
    const pacote = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
    assert.equal(saida.trim(), pacote.version);
  });

  test('código de saída desconhecido é 1 (não engole erro)', () => {
    const { status, saida } = rodarCli('comando-inventado');
    assert.equal(status, 1);
    assert.match(saida, /comando-inventado|error/i);
  });

  for (const comando of descobrirComandos()) {
    test(`--help do comando "${comando}" sai com exit 0`, () => {
      const { status, saida } = rodarCli(comando, '--help');
      assert.equal(status, 0, `--help de ${comando} falhou:\n${saida}`);
      assert.match(saida, /Usage:/);
    });
  }
});
