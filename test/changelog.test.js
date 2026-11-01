// test/changelog.test.js
// Testa o parser e o agrupamento do `snakit changelog`, em pt-BR e em en,
// mais uma integração com repositório temporário (sem internet).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearAssunto, formatarItem, agruparCommits } from '../src/commands/changelog.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-changelog-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe('parsearAssunto', () => {
  test('separa tipo, escopo e descrição', () => {
    assert.deepEqual(parsearAssunto('feat(api): adiciona rota'), {
      tipo: 'feat', escopo: 'api', descricao: 'adiciona rota', breaking: false,
    });
  });

  test('sem escopo', () => {
    assert.deepEqual(parsearAssunto('fix: corrige bug'), {
      tipo: 'fix', escopo: '', descricao: 'corrige bug', breaking: false,
    });
  });

  test('marcador ! vira breaking', () => {
    assert.equal(parsearAssunto('feat!: muda tudo').breaking, true);
    assert.equal(parsearAssunto('feat(api)!: muda tudo').breaking, true);
  });

  test('assunto fora do padrão não quebra', () => {
    assert.deepEqual(parsearAssunto('atualização package.json'), {
      tipo: 'outro', escopo: '', descricao: 'atualização package.json', breaking: false,
    });
  });
});

describe('formatarItem', () => {
  test('mantém escopo em negrito e remove o prefixo tipo(', () => {
    const linha = formatarItem({ assunto: 'feat(api): adiciona rota', hash: 'abc1234', data: '2026-10-31' });
    assert.equal(linha, '- **api:** adiciona rota (abc1234, 2026-10-31)');
  });

  test('sem escopo fica só a descrição', () => {
    const linha = formatarItem({ assunto: 'docs: atualiza README', hash: 'def5678', data: '2026-10-31' });
    assert.equal(linha, '- atualiza README (def5678, 2026-10-31)');
  });
});

describe('agruparCommits — pt-BR', () => {
  const commits = [
    { assunto: 'feat: rota nova', hash: 'a1', data: '2026-10-01', corpo: '' },
    { assunto: 'fix: corrige bug', hash: 'a2', data: '2026-10-02', corpo: '' },
    { assunto: 'docs: atualiza leia-me', hash: 'a3', data: '2026-10-03', corpo: '' },
    { assunto: 'refactor: reorganiza', hash: 'a4', data: '2026-10-04', corpo: '' },
    { assunto: 'perf: cache', hash: 'a5', data: '2026-10-05', corpo: '' },
    { assunto: 'test: cobre novo caso', hash: 'a6', data: '2026-10-06', corpo: '' },
    { assunto: 'build: ajusta script', hash: 'a7', data: '2026-10-07', corpo: '' },
    { assunto: 'ci: workflow', hash: 'a8', data: '2026-10-08', corpo: '' },
    { assunto: 'chore: limpa lixo', hash: 'a9', data: '2026-10-09', corpo: '' },
    { assunto: 'feat!: quebra tudo', hash: 'a10', data: '2026-10-10', corpo: '' },
    { assunto: 'melhora qualquer coisa', hash: 'a11', data: '2026-10-11', corpo: '' },
  ];

  test('mapeia tipos para títulos legíveis, na ordem certa', () => {
    const secoes = agruparCommits(commits, 'pt-BR');
    const titulos = secoes.map((s) => s.titulo);
    assert.deepEqual(titulos, [
      '⚠ Mudanças incompatíveis',
      'Funcionalidades',
      'Correções',
      'Documentação',
      'Refatoração',
      'Desempenho',
      'Testes',
      'Manutenção',
      'Outros',
    ]);
  });

  test('build, ci e chore caem juntos em Manutenção', () => {
    const secoes = agruparCommits(commits, 'pt-BR');
    const manutencao = secoes.find((s) => s.titulo === 'Manutenção');
    assert.equal(manutencao.itens.length, 3);
  });

  test('BREAKING CHANGE no corpo também destaca no topo', () => {
    const secoes = agruparCommits(
      [{ assunto: 'feat: mudança grande', hash: 'b1', data: '2026-10-01', corpo: 'BREAKING CHANGE: sem voltar' }],
      'pt-BR',
    );
    assert.equal(secoes[0].titulo, '⚠ Mudanças incompatíveis');
  });
});

describe('agruparCommits — en', () => {
  test('títulos em inglês', () => {
    const secoes = agruparCommits(
      [
        { assunto: 'feat: new route', hash: 'c1', data: '2026-10-01', corpo: '' },
        { assunto: 'fix: bug', hash: 'c2', data: '2026-10-02', corpo: '' },
        { assunto: 'feat!: breaks', hash: 'c3', data: '2026-10-03', corpo: '' },
      ],
      'en',
    );
    assert.deepEqual(secoes.map((s) => s.titulo), ['⚠ Breaking changes', 'Features', 'Fixes']);
  });
});

describe('snakit changelog — integração', () => {
  function rodarChangelog(pasta, ...args) {
    try {
      const saida = execFileSync('node', [path.join(RAIZ, 'bin', 'snakit.js'), 'changelog', '--stdout', ...args], {
        cwd: pasta,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { status: 0, saida };
    } catch (erro) {
      return { status: erro.status, saida: (erro.stdout || '') + (erro.stderr || '') };
    }
  }

  function repoComCommits() {
    const pasta = pastaTemporaria();
    execFileSync('git', ['init', '-q'], { cwd: pasta });
    execFileSync('git', ['config', 'user.email', 'teste@snakit.dev'], { cwd: pasta });
    execFileSync('git', ['config', 'user.name', 'Snakit'], { cwd: pasta });
    for (const [indice, mensagem] of [
      'feat: adiciona rota',
      'fix(api): corrige validação',
      'chore: limpa arquivos',
    ].entries()) {
      writeFileSync(path.join(pasta, `a${indice}.txt`), String(indice));
      execFileSync('git', ['add', '.'], { cwd: pasta });
      execFileSync('git', ['commit', '-q', '-m', mensagem], { cwd: pasta });
    }
    return pasta;
  }

  test('usa "## Não lançado" em vez de "## HEAD" e agrupa por título', () => {
    const { status, saida } = rodarChangelog(repoComCommits());
    assert.equal(status, 0);
    assert.ok(saida.includes('## Não lançado'), 'devia usar "Não lançado"');
    assert.ok(!saida.includes('## HEAD'), 'não devia usar "## HEAD"');
    assert.ok(saida.includes('### Funcionalidades'));
    assert.ok(saida.includes('### Correções'));
    assert.ok(saida.includes('### Manutenção'));
    assert.match(saida, /\*\*api:\*\* corrige validação \([0-9a-f]+, \d{4}-\d{2}-\d{2}\)/);
    assert.ok(!/- feat\(/.test(saida), 'não deve imprimir o prefixo tipo(');
  });

  test('idioma en vira "## Unreleased"', () => {
    const pasta = repoComCommits();
    writeFileSync(path.join(pasta, '.snakitrc.json'), JSON.stringify({ idioma: 'en' }));
    const { saida } = rodarChangelog(pasta);
    assert.ok(saida.includes('## Unreleased'));
    assert.ok(saida.includes('### Features'));
  });
});
