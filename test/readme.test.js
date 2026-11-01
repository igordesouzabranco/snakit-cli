// test/readme.test.js
// O README tem que espelhar a CLI: todo comando do `--help` aparece no
// README, e todo `snakit <comando>` citado no README existe de verdade.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(RAIZ, 'bin', 'snakit.js');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-readme-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

function comandosDaCli() {
  const saida = execFileSync(process.execPath, [BIN, '--help'], {
    cwd: pastaTemporaria(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const bloco = saida.split(/Commands:/)[1] || '';
  const comandos = new Set();
  for (const linha of bloco.split('\n')) {
    const casamento = linha.match(/^ {2}([a-z][a-z-]*)(?:\s|$)/);
    if (casamento) comandos.add(casamento[1]);
  }
  comandos.delete('help'); // comando genérico do commander, não é nosso
  return comandos;
}

function comandosCitadosNoReadme() {
  const readme = readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
  const comandos = new Set();
  for (const casamento of readme.matchAll(/snakit ([a-z][a-z-]*)/g)) {
    comandos.add(casamento[1]);
  }
  return comandos;
}

describe('README x CLI', () => {
  test('todo comando do --help aparece no README', () => {
    const cli = comandosDaCli();
    const readme = comandosCitadosNoReadme();
    assert.ok(cli.size >= 15, 'esperava vários comandos na CLI');
    for (const comando of cli) {
      assert.ok(readme.has(comando), `comando "${comando}" não aparece no README`);
    }
  });

  test('todo snakit <comando> citado no README existe na CLI', () => {
    const cli = comandosDaCli();
    const readme = comandosCitadosNoReadme();
    for (const comando of readme) {
      assert.ok(cli.has(comando), `README cita "snakit ${comando}", que não existe`);
    }
  });

  test('README documenta snakit-ignore e as flags novas do check', () => {
    const readme = readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
    assert.ok(readme.includes('snakit-ignore'), 'README deve documentar snakit-ignore');
    assert.ok(readme.includes('--strict'), 'README deve citar --strict do check');
    assert.ok(readme.includes('--output json'), 'README deve citar --output json do check');
    assert.ok(!readme.includes('--fix'), 'README não deve citar mais o --fix removido');
  });
});
