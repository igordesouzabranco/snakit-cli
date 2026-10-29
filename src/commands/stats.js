import { Command } from 'commander';
import { execSync } from 'node:child_process';
import chalk from 'chalk';

export function comandoStats() {
  const cmd = new Command('stats');
  cmd
    .description('Estatísticas de commits.')
    .option('--since <data>', 'desde data')
    .option('--until <data>', 'até data')
    .option('--output <json>', 'saída em JSON')
    .action((opcoes) => {
      const args = ['git', 'log', '--pretty=format:"%h %ae %s"'];
      if (opcoes.since) args.push('--since=' + opcoes.since);
      if (opcoes.until) args.push('--until=' + opcoes.until);
      try {
        const saida = execSync(args.join(' '), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const commits = saida ? saida.split('\n') : [];
        const porTipo = {};
        const porAutor = {};
        for (const linha of commits) {
          const partes = linha.split(' ');
          const hash = partes[0];
          const autor = partes[1];
          const assunto = partes.slice(2).join(' ');
          const tipo = assunto.split(':')[0] || 'outros';
          porTipo[tipo] = (porTipo[tipo] || 0) + 1;
          porAutor[autor] = (porAutor[autor] || 0) + 1;
        }
        if (opcoes.output === 'json') {
          console.log(JSON.stringify({ porTipo, porAutor, total: commits.length }, null, 2));
        } else {
          console.log(chalk.bold('Estatísticas:'));
          console.log('  Total: ' + commits.length);
          console.log('  Por tipo: ' + JSON.stringify(porTipo));
          console.log('  Por autor: ' + JSON.stringify(porAutor));
        }
      } catch (e) {
        console.error(chalk.red('✖ Erro ao obter estatísticas: ' + (e.message || e)));
        process.exitCode = 1;
      }
    });
  return cmd;
}
