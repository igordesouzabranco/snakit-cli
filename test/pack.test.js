// test/pack.test.js
// Confere o conteúdo do pacote publicado: `npm pack --dry-run --json` deve
// incluir o bin, todo arquivo que ele importa (recursivamente) e cada
// _gitignore dos templates (que viram .gitignore na cópia).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-pack-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

/** Lista os arquivos que o npm publicaria (caminhos com /). */
function arquivosDoPacote() {
  // shell: true porque no Windows o npm é um arquivo .cmd.
  const saida = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  const json = JSON.parse(saida);
  // npm antigo devolve array; npm mais novo devolve objeto por nome de pacote.
  const entrada = Array.isArray(json) ? json[0] : Object.values(json)[0];
  return entrada.files.map((f) => f.path);
}

/** Segue os imports relativos a partir de um arquivo, devolvendo o conjunto. */
function importadosRecursivamente(inicial, raiz = RAIZ) {
  const visitados = new Set();
  const pendentes = [inicial];

  while (pendentes.length > 0) {
    const relativo = pendentes.pop().replace(/\\/g, '/');
    if (visitados.has(relativo)) continue;
    visitados.add(relativo);

    const absoluto = path.join(raiz, relativo);
    if (!existsSync(absoluto)) continue;
    const conteudo = readFileSync(absoluto, 'utf8');
    for (const casamento of conteudo.matchAll(/from\s+'(\.[^']+)'/g)) {
      const destino = path
        .normalize(path.join(path.dirname(relativo), casamento[1]))
        .replace(/\\/g, '/');
      pendentes.push(destino);
    }
  }

  return visitados;
}

describe('npm pack --dry-run', () => {
  test('inclui o bin/snakit.js e todos os arquivos que ele importa', () => {
    const pacote = arquivosDoPacote();
    assert.ok(pacote.includes('bin/snakit.js'), 'bin/snakit.js faltando no pacote');

    const importados = importadosRecursivamente('bin/snakit.js');
    assert.ok(importados.size > 5, 'devia seguir vários imports');
    for (const arquivo of importados) {
      assert.ok(pacote.includes(arquivo), `arquivo importado faltando no pacote: ${arquivo}`);
    }
  });

  test('inclui cada _gitignore dos templates', () => {
    const pacote = arquivosDoPacote();
    const raizTemplates = path.join(RAIZ, 'src', 'templates');

    const gitignores = [];
    (function caminhar(dir) {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const caminho = path.join(dir, item.name);
        if (item.isDirectory()) caminhar(caminho);
        else if (item.name === '_gitignore') {
          gitignores.push(path.relative(RAIZ, caminho).replace(/\\/g, '/'));
        }
      }
    })(raizTemplates);

    assert.ok(gitignores.length >= 5, `esperava vários _gitignore, achei ${gitignores.length}`);
    for (const arquivo of gitignores) {
      assert.ok(pacote.includes(arquivo), `_gitignore faltando no pacote: ${arquivo}`);
    }
  });

  test('inclui README.md e LICENSE', () => {
    const pacote = arquivosDoPacote();
    assert.ok(pacote.includes('package.json'));
    assert.ok(pacote.includes('README.md'));
    assert.ok(pacote.includes('LICENSE'));
  });
});
