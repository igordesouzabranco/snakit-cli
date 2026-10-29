import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { carregarConfig } from '../utils/config.js';
import { gerarSugestao } from '../utils/rules.js';
import { getStagedFiles, getCurrentBranch } from '../utils/git.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function comandoAmend() {
  const cmd = new Command('amend');
  cmd.description('Reescreve a mensagem do último commit.')
    .action(async () => {
      const arquivos = getStagedFiles();
      let msg = arquivos.length > 0 ? gerarSugestao(arquivos, getCurrentBranch(), carregarConfig().idioma).message : '';
      if (!msg) {
        try {
          msg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
        } catch { msg = ''; }
      }
      const { mensagem } = await inquirer.prompt([
        { type: 'input', name: 'mensagem', message: 'Nova mensagem:', default: msg.split('\n')[0] }
      ]);
      execSync('git commit --amend -m "' + mensagem + '"', { stdio: 'inherit' });
      console.log(chalk.green('✔ Mensagem reescrita.'));
    });
  return cmd;
}
