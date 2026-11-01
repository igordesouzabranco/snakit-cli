// test/integration.test.js
// Testes de integração com git e disco temporário.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { init, isGitRepo, getStagedFiles, add, commit, getCurrentBranch } from '../src/utils/git.js';

// O runner do GitHub Actions não tem identidade de git (~/.gitconfig vazio).
// Definimos as variáveis ANTES de qualquer commit para os testes não
// dependerem da máquina de quem roda.
process.env.GIT_AUTHOR_NAME = 'CI';
process.env.GIT_AUTHOR_EMAIL = 'ci@snakit.dev';
process.env.GIT_COMMITTER_NAME = 'CI';
process.env.GIT_COMMITTER_EMAIL = 'ci@snakit.dev';

const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-integ-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe('git — integração', () => {
  test('init cria repositório', () => {
    const pasta = pastaTemporaria();
    init(pasta);
    assert.ok(isGitRepo(pasta));
    // A branch inicial depende de init.defaultBranch da máquina: master ou main.
    assert.ok(['master', 'main'].includes(getCurrentBranch(pasta)));
  });

  test('stage vazio retorna vazio', () => {
    const pasta = pastaTemporaria();
    init(pasta);
    assert.deepEqual(getStagedFiles(pasta), []);
  });

  test('add e commit com arquivo', () => {
    const pasta = pastaTemporaria();
    init(pasta);
    writeFileSync(path.join(pasta, 'a.txt'), 'hello');
    add(pasta);
    const arquivos = getStagedFiles(pasta);
    assert.equal(arquivos.length, 1);
    assert.equal(arquivos[0].file, 'a.txt');
    commit('feat: adiciona arquivo', pasta);
    assert.ok(existsSync(path.join(pasta, '.git')));
  });
});
