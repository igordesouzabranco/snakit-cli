// test/check.test.js
// Testa as regras puras do check e a integração do comando com um
// repositório temporário (sem internet, tudo em os.tmpdir()).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extrairLinhasAdicionadas,
  analisarLinhas,
  analisarArquivosStage,
  analisarStage,
  mascararSegredos,
  caminhoPermitidoDebug,
  ehBinario,
} from '../src/utils/check.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-check-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

/** Monta um diff fake no formato git diff --cached -U0. */
function diffFake(arquivo, linhasAdicionadas) {
  const hunk = `@@ -0,0 +1,${linhasAdicionadas.length} @@`;
  return [
    `diff --git a/${arquivo} b/${arquivo}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${arquivo}`,
    hunk,
    ...linhasAdicionadas.map((l) => '+' + l),
    '',
  ].join('\n');
}

function linhasDe(arquivo, linhasAdicionadas) {
  return extrairLinhasAdicionadas(diffFake(arquivo, linhasAdicionadas)).map((l) => ({
    arquivo: l.arquivo,
    linha: l.linha,
    conteudo: l.conteudo,
  }));
}

describe('extrairLinhasAdicionadas', () => {
  test('pega só as linhas adicionadas, com número e arquivo', () => {
    const linhas = linhasDe('src/a.js', ['const x = 1;', 'console.log(x);']);
    assert.equal(linhas.length, 2);
    assert.equal(linhas[0].arquivo, 'src/a.js');
    assert.equal(linhas[0].linha, 1);
    assert.equal(linhas[1].linha, 2);
    assert.equal(linhas[1].conteudo, 'console.log(x);');
  });

  test('linha removida não vira achado', () => {
    const diff = [
      'diff --git a/a.js b/a.js',
      '--- a/a.js',
      '+++ b/a.js',
      '@@ -1 +0,0 @@',
      '-const senha = "antiga-senha-123";',
      '',
    ].join('\n');
    assert.deepEqual(extrairLinhasAdicionadas(diff), []);
    assert.deepEqual(analisarLinhas(extrairLinhasAdicionadas(diff)), []);
  });
});

describe('regras de erro — segredos', () => {
  const casos = [
    { regra: 'chave-aws', conteudo: 'const k = "AKIAIOSFODNN7EXAMPLE";' },
    { regra: 'chave-anthropic', conteudo: 'const k = "sk-ant-' + 'x'.repeat(24) + '";' },
    { regra: 'chave-openai', conteudo: 'const k = "sk-' + 'a'.repeat(32) + '";' },
    { regra: 'token-github', conteudo: 'const k = "ghp_' + 'b'.repeat(36) + '";' },
    { regra: 'chave-privada', conteudo: '-----BEGIN RSA PRIVATE KEY-----' },
    { regra: 'credencial-literal', conteudo: 'password = "supersecreta123";' },
  ];

  for (const caso of casos) {
    test(`detecta ${caso.regra}`, () => {
      const achados = analisarLinhas(linhasDe('src/a.js', [caso.conteudo]));
      const erro = achados.find((a) => a.regra === caso.regra);
      assert.ok(erro, `esperava erro ${caso.regra}`);
      assert.equal(erro.nivel, 'erro');
      assert.equal(erro.arquivo, 'src/a.js');
      assert.equal(erro.linha, 1);
    });
  }

  test('senha em português também é pega', () => {
    const achados = analisarLinhas(linhasDe('config.py', ["senha = 'abcdef123456'"]));
    assert.ok(achados.some((a) => a.regra === 'credencial-literal'));
  });

  test('não imprime o segredo inteiro no trecho', () => {
    const achados = analisarLinhas(linhasDe('a.js', ['const k = "AKIAIOSFODNN7EXAMPLE";']));
    assert.match(achados[0].trecho, /AKIA…/);
    assert.ok(!achados[0].trecho.includes('IOSFODNN7'));
  });

  test('mascararSegredos preserva o texto fora do segredo', () => {
    assert.equal(mascararSegredos('x = "AKIAIOSFODNN7EXAMPLE" # ok'), 'x = "AKIA…" # ok');
  });
});

describe('regras de aviso', () => {
  test('detecta console.log em código de aplicação', () => {
    const achados = analisarLinhas(linhasDe('src/app.js', ["console.log('oi');"]));
    assert.ok(achados.some((a) => a.regra === 'console-debug' && a.nivel === 'aviso'));
  });

  test('detecta console.debug e debugger', () => {
    const achados = analisarLinhas(linhasDe('src/app.ts', ['console.debug(1);', 'debugger;']));
    assert.ok(achados.some((a) => a.regra === 'console-debug'));
    assert.ok(achados.some((a) => a.regra === 'debugger'));
  });

  test('não acusa console.log em test/, bin/, scripts/ nem *.test.*', () => {
    const caminhos = [
      'test/a.js',
      'tests/a.js',
      'src/a.test.js',
      'src/a.spec.ts',
      'bin/cli.js',
      'scripts/x.js',
    ];
    for (const caminho of caminhos) {
      const achados = analisarLinhas(linhasDe(caminho, ["console.log('ok');"]));
      assert.equal(achados.length, 0, `não devia acusar ${caminho}`);
      assert.equal(caminhoPermitidoDebug(caminho), true);
    }
  });

  test('detecta TODO e FIXME novos', () => {
    const achados = analisarLinhas(linhasDe('src/a.js', ['// TODO: terminar', '// FIXME bug']));
    assert.equal(achados.filter((a) => a.regra === 'marcador-todo').length, 2);
  });

  test('arquivo > 1 MB no stage vira aviso', () => {
    const achados = analisarArquivosStage([
      { caminho: 'grande.txt', tamanho: 2 * 1024 * 1024, ehBinario: false },
    ]);
    assert.equal(achados.length, 1);
    assert.equal(achados[0].nivel, 'aviso');
    assert.equal(achados[0].regra, 'arquivo-grande');
  });

  test('binário > 100 KB no stage vira aviso; pequeno passa', () => {
    const grande = analisarArquivosStage([
      { caminho: 'logo.png', tamanho: 200 * 1024, ehBinario: true },
    ]);
    assert.equal(grande[0]?.regra, 'binario-grande');
    const pequeno = analisarArquivosStage([
      { caminho: 'logo.png', tamanho: 4 * 1024, ehBinario: true },
    ]);
    assert.equal(pequeno.length, 0);
  });
});

describe('regras de erro — arquivos sensíveis no stage', () => {
  test('detecta .env e .env.local, mas aceita .env.example', () => {
    const achados = analisarArquivosStage([
      { caminho: '.env', tamanho: 10, ehBinario: false },
      { caminho: 'api/.env.local', tamanho: 10, ehBinario: false },
      { caminho: '.env.example', tamanho: 10, ehBinario: false },
    ]);
    assert.equal(achados.length, 2);
    assert.ok(achados.every((a) => a.regra === 'arquivo-sensivel' && a.nivel === 'erro'));
  });

  test('detecta *.pem e *.key', () => {
    const achados = analisarArquivosStage([
      { caminho: 'certs/server.pem', tamanho: 10, ehBinario: false },
      { caminho: 'id.key', tamanho: 10, ehBinario: false },
    ]);
    assert.equal(achados.length, 2);
  });
});

describe('snakit-ignore', () => {
  test('linha com snakit-ignore é ignorada', () => {
    const achados = analisarLinhas(
      linhasDe('a.js', ['const k = "AKIAIOSFODNN7EXAMPLE"; // snakit-ignore']),
    );
    assert.equal(achados.length, 0);
  });

  test('a mesma linha sem a marca continua acusando', () => {
    const achados = analisarLinhas(linhasDe('a.js', ['const k = "AKIAIOSFODNN7EXAMPLE";']));
    assert.equal(achados.length, 1);
  });
});

describe('analisarStage', () => {
  test('stage vazio devolve lists vazias', () => {
    assert.deepEqual(analisarStage({ diff: '', arquivos: [] }), { erros: [], avisos: [] });
  });

  test('separa erros de avisos', () => {
    const resultado = analisarStage({
      diff: diffFake('src/a.js', ["const k = 'AKIAIOSFODNN7EXAMPLE';", 'console.log(1);']),
      arquivos: [],
    });
    assert.equal(resultado.erros.length, 1);
    assert.equal(resultado.avisos.length, 1);
  });
});

describe('ehBinario', () => {
  test('conteúdo com byte nulo é binário', () => {
    assert.equal(ehBinario('arquivo.dat', Buffer.from([1, 0, 2])), true);
    assert.equal(ehBinario('arquivo.txt', Buffer.from('olá')), false);
  });

  test('extensão conhecida sem buffer também conta', () => {
    assert.equal(ehBinario('img.png', Buffer.alloc(0)), true);
  });
});

describe('snakit check — integração (CLI)', () => {
  function rodarCheck(pasta, ...args) {
    try {
      const saida = execFileSync('node', [path.join(RAIZ, 'bin', 'snakit.js'), 'check', ...args], {
        cwd: pasta,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { status: 0, saida };
    } catch (erro) {
      return {
        status: erro.status,
        saida: (erro.stdout || '') + (erro.stderr || ''),
      };
    }
  }

  test('chave falsa no stage dá exit 1 e mostra o arquivo:linha', () => {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    writeFileSync(path.join(pasta, 'a.js'), 'const k="AKIAIOSFODNN7EXAMPLE"\n');
    execFileSync('git', ['add', 'a.js'], { cwd: pasta });

    const { status, saida } = rodarCheck(pasta);
    assert.equal(status, 1);
    assert.match(saida, /a\.js:1/);
    assert.match(saida, /AKIA…/);
    assert.ok(!saida.includes('AKIAIOSFODNN7EXAMPLE'));
  });

  test('stage vazio sai com 0 e avisa', () => {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    const { status, saida } = rodarCheck(pasta);
    assert.equal(status, 0);
    assert.match(saida, /Nada no stage para revisar/);
  });

  test('--output json devolve erros e avisos', () => {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    writeFileSync(path.join(pasta, 'a.js'), 'console.log(1);\n');
    execFileSync('git', ['add', 'a.js'], { cwd: pasta });

    const { status, saida } = rodarCheck(pasta, '--output', 'json');
    assert.equal(status, 0);
    const json = JSON.parse(saida);
    assert.deepEqual(json.erros, []);
    assert.equal(json.avisos[0].regra, 'console-debug');
  });

  test('--strict faz aviso sair com 1', () => {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    writeFileSync(path.join(pasta, 'a.js'), 'debugger;\n');
    execFileSync('git', ['add', 'a.js'], { cwd: pasta });

    assert.equal(rodarCheck(pasta).status, 0);
    assert.equal(rodarCheck(pasta, '--strict').status, 1);
  });

  test('.env no stage dá exit 1 mesmo sem segredo no diff', () => {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    writeFileSync(path.join(pasta, '.env'), 'QUALQUER=coisa\n');
    execFileSync('git', ['add', '.env'], { cwd: pasta });

    const { status, saida } = rodarCheck(pasta);
    assert.equal(status, 1);
    assert.match(saida, /\.env/);
  });

  test('fora de repositório git o comando falha com exit 1 e diz o motivo', () => {
    const pasta = pastaTemporaria();
    const { status, saida } = rodarCheck(pasta);
    assert.equal(status, 1);
    assert.match(saida, /git falhou/);
  });
});
