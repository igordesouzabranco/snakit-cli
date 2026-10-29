import { Command } from 'commander';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function comandoUndo() {
  const cmd = new Command('undo');
  cmd.description('Desfaz o último commit, mantendo alterações no stage.')
    .action(async () => {
      const { confirmar } = await inquirer.prompt([
        { type: 'confirm', name: 'confirmar', message: 'Desfazer o último commit? (as alterações voltam ao stage)', default: false }
      ]);
      if (!confirmar) {
        console.log(chalk.yellow('Cancelado.'));
        return;
      }
      try {
        execSync('git reset --soft HEAD~1', { stdio: 'inherit' });
        console.log(chalk.green('✔ Último commit desfeito (alterações no stage).'));
      } catch (e) {
        console.error(chalk.red('✖ Erro: ' + (e.message || e)));
        process.exitCode = 1;
      }
    });
  return cmd;
}
