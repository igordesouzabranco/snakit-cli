import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { gerarSugestao } from '../utils/rules.js';
import { carregarConfig } from '../utils/config.js';
import chalk from 'chalk';

function obterCommitsEntre(base, atual = 'HEAD') {
  try {
    const saida = execSync(`git log ${base}..${atual} --pretty=format:"%h|%s|%b"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return saida.trim();
  } catch { return ''; }
}

export function comandoPr() {
  const cmd = new Command('pr');
  cmd
    .description('Gera título e descrição de Pull Request.')
    .option('--base <branch>', 'branch base', 'main')
    .option('--ai', 'usa IA para gerar')
    .option('--copy', 'copia para área de transferência (quando disponível)')
    .action((opcoes) => {
      const config = carregarConfig();
      const commitsStr = obterCommitsEntre(opcoes.base);
      if (!commitsStr) {
        console.log(chalk.yellow('Nenhum commit entre ' + opcoes.base + ' e a branch atual.'));
        return;
      }
      const grupos = {};
      for (const linha of commitsStr.split('\n').filter(Boolean)) {
        const [hash, assunto] = linha.split('|');
        const tipo = assunto.split(':')[0] || 'outros';
        if (!grupos[tipo]) grupos[tipo] = [];
        grupos[tipo].push({ hash, assunto });
      }

      let titulo = 'Atualização do projeto';
      const feat = grupos['feat'];
      if (feat && feat.length === 1) titulo = feat[0].assunto;
      else if (feat && feat.length > 1) titulo = `feat: ${feat.length} funcionalidades`;

      let descricao = '';
      for (const [tipo, itens] of Object.entries(grupos)) {
        descricao += `\n### ${tipo}\n`;
        for (const item of itens) {
          descricao += `- ${item.assunto} (${item.hash})\n`;
        }
      }

      console.log(chalk.bold('Título:'));
      console.log('  ' + titulo);
      console.log(chalk.bold('Descrição:'));
      console.log('  ' + descricao.trim());

      if (opcoes.copy) {
        console.log(chalk.yellow('• --copy ainda não implementado completamente.'));
      }
    });
  return cmd;
}
