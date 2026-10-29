import { Command } from 'commander';
import chalk from 'chalk';

export function comandoBranch() {
  const cmd = new Command('branch');
  cmd
    .description('Sugere/cria nome de branch.')
    .argument('<descricao>', 'descrição da branch')
    .action((descricao) => {
      const kebab = descricao.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const tipo = 'feat';
      const nome = `${tipo}/${kebab}`;
      console.log(chalk.green('✔ Sugestão de branch: ' + nome));
    });
  return cmd;
}
