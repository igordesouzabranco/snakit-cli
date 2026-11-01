// test/identidade.test.js
// O que acontece quando o git NÃO tem user.name/user.email (usuário novo,
// runner de CI, HOME vazio): a CLI detecta antes de commitar, usa a
// identidade temporária (ou a do .snakitrc.json) e nunca deixa o stderr
// cru do git chegar na tela.
//
// Tudo hermético: HOME, GIT_CONFIG_* e as variáveis GIT_AUTHOR_*/GIT_COMMITTER_*
// ficam presos em pastas temporárias — nada aqui lê o ~/.gitconfig de quem roda.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pastaTemporaria,
  criarRepoTemporario,
  criarRepoSemIdentidade,
  envSemIdentidade,
  limparPastasTemporarias,
} from './helpers/git.js';
import { obterIdentidade, temIdentidade } from '../src/utils/git.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(RAIZ, 'bin', 'snakit.js');

after(() => limparPastasTemporarias());

/** Roda a CLI com ambiente isolado. process.execPath: sem depender do PATH. */
function rodarCli(argumentos, { cwd, env }) {
  try {
    const saida = execFileSync(process.execPath, [BIN, ...argumentos], {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, saida };
  } catch (erro) {
    return { status: erro.status, saida: `${erro.stdout || ''}${erro.stderr || ''}` };
  }
}

/** git lendo configuração: `--get` sai com 1 quando a chave não existe. */
function lerConfig(argumentos, { cwd, env }) {
  try {
    return execFileSync('git', argumentos, { cwd, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function autorDoUltimoCommit(cwd, env) {
  return lerConfig(['log', '-1', '--format=%an <%ae>'], { cwd, env });
}

/** Roda `fn` com o ambiente SEM identidade e restaura tudo depois.
 *  Preciso para as chamadas in-process de obterIdentidade, que leem
 *  process.env do próprio processo de teste. */
function comEnvSemIdentidade(fn) {
  const chaves = [
    'HOME', 'USERPROFILE', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM',
    'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
  ];
  const anteriores = {};
  for (const chave of chaves) {
    anteriores[chave] = process.env[chave];
    delete process.env[chave];
  }
  const pasta = pastaTemporaria('snakit-identidade-env-');
  process.env.HOME = pasta;
  process.env.USERPROFILE = pasta;
  process.env.XDG_CONFIG_HOME = path.join(pasta, '.config');
  process.env.GIT_CONFIG_GLOBAL = path.join(pasta, 'gitconfig-ausente');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  try {
    return fn(pasta);
  } finally {
    for (const chave of chaves) {
      if (anteriores[chave] === undefined) delete process.env[chave];
      else process.env[chave] = anteriores[chave];
    }
  }
}

/** Nenhum erro cru do git pode aparecer em nenhuma saída. */
function semErroCru(saida, contexto) {
  assert.ok(!/Author identity unknown/i.test(saida), `${contexto}: saiu erro cru de identidade:\n${saida}`);
  assert.ok(!/unable to auto-detect email/i.test(saida), `${contexto}: saiu auto-detect cru:\n${saida}`);
  assert.ok(!/\bfatal:/i.test(saida), `${contexto}: saiu "fatal:" cru:\n${saida}`);
  assert.ok(!/Please tell me who you are/i.test(saida), `${contexto}: saiu tutorial cru do git:\n${saida}`);
}

describe('obterIdentidade', () => {
  test('devolve vazio quando não há nenhuma configuração', () => {
    comEnvSemIdentidade((pasta) => {
      const identidade = obterIdentidade(pasta);
      assert.equal(identidade.nome, '');
      assert.equal(identidade.email, '');
      assert.equal(temIdentidade(pasta), false);
    });
  });

  test('devolve preenchido quando há configuração local', () => {
    comEnvSemIdentidade(() => {
      const repo = criarRepoTemporario();
      const identidade = obterIdentidade(repo);
      assert.equal(identidade.nome, 'Snakit Teste');
      assert.equal(identidade.email, 'teste@snakit.dev');
      assert.equal(temIdentidade(repo), true);
    });
  });
});

describe('snakit new sem identidade', () => {
  test('cria o projeto, commita com a temporária, avisa e sai com 0', () => {
    const base = pastaTemporaria('snakit-new-semident-');
    const env = envSemIdentidade(base);

    const { status, saida } = rodarCli(
      ['new', 'x', '--template', 'node-puro', '--yes', '--no-install'],
      { cwd: base, env },
    );

    assert.equal(status, 0, `esperava exit 0:\n${saida}`);
    assert.match(saida, /Identidade do git não configurada/);
    assert.match(saida, /Snakit <snakit@localhost>/);
    assert.match(saida, /git config --global user\.email/);
    semErroCru(saida, 'new --yes');

    const projeto = path.join(base, 'x');
    assert.equal(autorDoUltimoCommit(projeto, env), 'Snakit <snakit@localhost>');

    // --yes não grava NADA em nenhuma configuração do git.
    assert.equal(lerConfig(['config', '--get', 'user.name'], { cwd: projeto, env }), '');
    assert.equal(lerConfig(['config', '--get', 'user.email'], { cwd: projeto, env }), '');
    assert.equal(lerConfig(['config', '--global', '--get', 'user.name'], { cwd: projeto, env }), '');
    assert.equal(lerConfig(['config', '--global', '--get', 'user.email'], { cwd: projeto, env }), '');
  });
});

describe('snakit commit sem identidade', () => {
  test('--yes usa a temporária, avisa e não escreve configuração', () => {
    const { pasta, env } = criarRepoSemIdentidade();
    writeFileSync(path.join(pasta, 'arquivo.txt'), 'conteudo\n');
    lerConfig(['add', '-A'], { cwd: pasta, env });

    const { status, saida } = rodarCli(['commit', '--yes'], { cwd: pasta, env });

    assert.equal(status, 0, `esperava exit 0:\n${saida}`);
    assert.match(saida, /Identidade do git não configurada/);
    assert.match(saida, /Snakit <snakit@localhost>/);
    semErroCru(saida, 'commit --yes');

    assert.equal(autorDoUltimoCommit(pasta, env), 'Snakit <snakit@localhost>');
    assert.equal(lerConfig(['config', '--get', 'user.name'], { cwd: pasta, env }), '');
    assert.equal(lerConfig(['config', '--global', '--get', 'user.name'], { cwd: pasta, env }), '');
  });

  test('com identidade local, o autor é do usuário e não há aviso', () => {
    const repo = criarRepoTemporario();
    const env = envSemIdentidade(repo);
    writeFileSync(path.join(repo, 'arquivo.txt'), 'conteudo\n');
    lerConfig(['add', '-A'], { cwd: repo, env });

    const { status, saida } = rodarCli(['commit', '--yes'], { cwd: repo, env });

    assert.equal(status, 0, `esperava exit 0:\n${saida}`);
    assert.equal(autorDoUltimoCommit(repo, env), 'Snakit Teste <teste@snakit.dev>');
    assert.ok(!/não configurada/i.test(saida), `não deveria avisar:\n${saida}`);
    assert.ok(!/snakit@localhost/i.test(saida), `não deveria citar a temporária:\n${saida}`);
    semErroCru(saida, 'commit com identidade');
  });
});

describe('identidade no .snakitrc.json', () => {
  test('é respeitada no commit', () => {
    const { pasta, env } = criarRepoSemIdentidade();
    writeFileSync(
      path.join(pasta, '.snakitrc.json'),
      JSON.stringify({ identidade: { nome: 'Do Config', email: 'config@exemplo.com' } }),
    );
    writeFileSync(path.join(pasta, 'arquivo.txt'), 'conteudo\n');
    lerConfig(['add', '-A'], { cwd: pasta, env });

    const { status, saida } = rodarCli(['commit', '--yes'], { cwd: pasta, env });

    assert.equal(status, 0, `esperava exit 0:\n${saida}`);
    assert.equal(autorDoUltimoCommit(pasta, env), 'Do Config <config@exemplo.com>');
    assert.match(saida, /\.snakitrc\.json/);
    semErroCru(saida, 'commit com identidade do config');
  });

  test('valor inválido gera aviso e a CLI continua', () => {
    const { pasta, env } = criarRepoSemIdentidade();
    writeFileSync(
      path.join(pasta, '.snakitrc.json'),
      JSON.stringify({ identidade: { nome: 'Qualquer', email: 'nao-e-email' } }),
    );
    writeFileSync(path.join(pasta, 'arquivo.txt'), 'conteudo\n');
    lerConfig(['add', '-A'], { cwd: pasta, env });

    const { status, saida } = rodarCli(['commit', '--yes'], { cwd: pasta, env });

    assert.equal(status, 0, `a CLI não pode morrer por config inválida:\n${saida}`);
    assert.match(saida, /"identidade" inválida/i);
    // inválida foi ignorada → caiu na temporária e o commit saiu mesmo assim
    assert.equal(autorDoUltimoCommit(pasta, env), 'Snakit <snakit@localhost>');
    semErroCru(saida, 'commit com identidade inválida');
  });
});

describe('snakit doctor', () => {
  test('sem identidade: mostra a checagem como não configurada com a dica', () => {
    const base = pastaTemporaria('snakit-doctor-semident-');
    const env = envSemIdentidade(base);

    const { status, saida } = rodarCli(['doctor'], { cwd: base, env });

    assert.equal(status, 0, saida);
    assert.match(saida, /Identidade do git: não configurada/);
    assert.match(saida, /git config --global user\.name/);
  });

  test('com identidade local: mostra Nome <email>', () => {
    const repo = criarRepoTemporario();
    const env = envSemIdentidade(repo);

    const { status, saida } = rodarCli(['doctor'], { cwd: repo, env });

    assert.equal(status, 0, saida);
    assert.match(saida, /Identidade do git: Snakit Teste <teste@snakit\.dev>/);
    assert.ok(!/não configurada/.test(saida), saida);
  });
});
