// src/commands/changelog.js
// Gera/atualiza CHANGELOG.md a partir dos commits desde a última tag.

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

function obterTags() {
  try {
    return execSync('git tag --sort=-creatordate', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      .trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function obterCommits(from, to) {
  const range = from ? `${from}..${to || 'HEAD'}` : 'HEAD';
  try {
    return execSync(`git log ${range} --pretty=format:"%h|%s|%b" --no-decorate`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      .trim();
  } catch { return ''; }
}

function agruparPorTipo(commitsStr) {
  const grupos = {};
  for (const linha of commitsStr.split('\n').filter(Boolean)) {
    const [hash, assunto, corpo] = linha.split('|');
    const tipo = assunto.split(':')[0] || 'outros';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push({ hash, assunto, corpo });
  }
  return grupos;
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
      const tags = obterTags();
      const ultimaTag = tags[0] || '';
      const from = opcoes.from || ultimaTag;
      const to = opcoes.to || 'HEAD';
      const commits = obterCommits(from, to);
      const grupos = agruparPorTipo(commits);

      let md = `# Changelog\n\n## ${to || 'Não lançado'}\n`;
      for (const [tipo, itens] of Object.entries(grupos)) {
        md += `\n### ${tipo}\n`;
        for (const item of itens) {
          md += `- ${item.assunto} (${item.hash})\n`;
          if (item.corpo && item.corpo.trim()) {
            md += `  - ${item.corpo.trim().replace(/\n/g, ' ')}\n`;
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
