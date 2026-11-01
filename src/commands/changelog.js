// src/commands/changelog.js
// Gera/atualiza CHANGELOG.md a partir dos commits desde a última tag.

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { carregarConfig } from '../utils/config.js';

// Títulos de grupo por idioma. build/ci/chore compartilham o grupo
// "Manutenção"/"Chores" (chave 'chore').
const TITULOS = {
  'pt-BR': {
    feat: 'Funcionalidades',
    fix: 'Correções',
    docs: 'Documentação',
    refactor: 'Refatoração',
    perf: 'Desempenho',
    test: 'Testes',
    chore: 'Manutenção',
    outro: 'Outros',
    breaking: '⚠ Mudanças incompatíveis',
  },
  en: {
    feat: 'Features',
    fix: 'Fixes',
    docs: 'Documentation',
    refactor: 'Refactoring',
    perf: 'Performance',
    test: 'Tests',
    chore: 'Chores',
    outro: 'Others',
    breaking: '⚠ Breaking changes',
  },
};

const ORDEM_TIPOS = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore'];

/** Chave de grupo do tipo: build/ci/chore caem todos em "chore". */
function chaveDeTipo(tipo) {
  if (['build', 'ci', 'chore'].includes(tipo)) return 'chore';
  return ORDEM_TIPOS.includes(tipo) ? tipo : 'outro';
}

function textosDe(idioma) {
  return TITULOS[idioma] ?? TITULOS['pt-BR'];
}

function obterTags() {
  try {
    return execSync('git tag --sort=-creatordate', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      .trim().split('\n').filter(Boolean);
  } catch { return []; }
}

/** Lê os commits do range. Separa registros com \x1e e campos com \x1f
 *  para o corpo (que pode ter várias linhas) não quebrar o parser. */
function obterCommits(from, to) {
  const range = from ? `${from}..${to || 'HEAD'}` : (to || 'HEAD');
  try {
    const saida = execSync(
      `git log ${range} --pretty=format:%x1e%h%x1f%ad%x1f%s%x1f%b --date=short --no-decorate`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return saida
      .split('\x1e')
      .map((registro) => registro.trim())
      .filter(Boolean)
      .map((registro) => {
        const [hash, data, assunto, corpo = ''] = registro.split('\x1f');
        return { hash, data, assunto, corpo };
      });
  } catch { return []; }
}

/** Divide o assunto em tipo, escopo, descrição e se é breaking. */
export function parsearAssunto(assunto) {
  const casamento = String(assunto).match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/);
  if (!casamento) {
    return { tipo: 'outro', escopo: '', descricao: String(assunto), breaking: false };
  }
  const [, tipo, escopo = '', bang, descricao] = casamento;
  return { tipo, escopo, descricao, breaking: bang === '!' };
}

/** Monta a linha do changelog: "- **api:** descrição (hash, data)". */
export function formatarItem(commit) {
  const { escopo, descricao } = parsearAssunto(commit.assunto);
  const prefixo = escopo ? `**${escopo}:** ` : '';
  return `- ${prefixo}${descricao} (${commit.hash}, ${commit.data})`;
}

/** Agrupa os commits por tipo legível; breaking sai separado no topo. */
export function agruparCommits(commits, idioma = 'pt-BR') {
  const textos = textosDe(idioma);
  const breaking = [];
  const grupos = new Map();

  for (const commit of commits) {
    const parsed = parsearAssunto(commit.assunto);
    const ehBreaking = parsed.breaking || /BREAKING CHANGE/.test(commit.corpo || '');
    if (ehBreaking) {
      breaking.push(commit);
      continue;
    }
    const chave = chaveDeTipo(parsed.tipo);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(commit);
  }

  const secoes = [];
  if (breaking.length > 0) {
    secoes.push({ titulo: textos.breaking, itens: breaking });
  }
  for (const tipo of ORDEM_TIPOS) {
    if (grupos.has(tipo)) {
      secoes.push({ titulo: textos[tipo], itens: grupos.get(tipo) });
    }
  }
  if (grupos.has('outro')) {
    secoes.push({ titulo: textos.outro, itens: grupos.get('outro') });
  }
  return secoes;
}

/** Título da seção: "Não lançado"/"Unreleased" quando o fim é HEAD. */
function tituloSecao(to, idioma) {
  if (!to || to === 'HEAD') return idioma === 'en' ? 'Unreleased' : 'Não lançado';
  return to;
}

export function comandoChangelog() {
  const cmd = new Command('changelog');
  cmd
    .description('Gera ou atualiza CHANGELOG.md.')
    .option('--from <tag>', 'tag inicial')
    .option('--to <tag>', 'tag final (padrão: HEAD)')
    .option('--dry-run', 'mostra a saída sem escrever')
    .option('--stdout', 'imprime no terminal')
    .action((opcoes) => {
      const { idioma } = carregarConfig();
      const tags = obterTags();
      const ultimaTag = tags[0] || '';
      const from = opcoes.from || ultimaTag;
      const to = opcoes.to || 'HEAD';
      const commits = obterCommits(from, to);
      const secoes = agruparCommits(commits, idioma);

      let md = `# Changelog\n\n## ${tituloSecao(to, idioma)}\n`;
      for (const secao of secoes) {
        md += `\n### ${secao.titulo}\n`;
        for (const commit of secao.itens) {
          md += `${formatarItem(commit)}\n`;
          if (commit.corpo && commit.corpo.trim()) {
            md += `  - ${commit.corpo.trim().replace(/\n/g, ' ')}\n`;
          }
        }
      }

      if (opcoes.stdout || opcoes.dryRun) {
        console.log(md);
      }
      if (!opcoes.dryRun && !opcoes.stdout) {
        if (existsSync('CHANGELOG.md')) {
          const existente = readFileSync('CHANGELOG.md', 'utf8');
          md = md + '\n---\n' + existente.split('---').slice(1).join('---');
        }
        writeFileSync('CHANGELOG.md', md);
        console.log(chalk.green('✔ CHANGELOG.md atualizado.'));
      }
    });
  return cmd;
}
