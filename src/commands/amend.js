// src/commands/amend.js
// `snakit amend` — reescreve a mensagem do último commit.
// O amend também É um commit: passa pela mesma garantia de identidade
// e pelos erros traduzidos da camada git.

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { carregarConfig } from '../utils/config.js';
import { gerarSugestao } from '../utils/rules.js';
import { getStagedFiles, getCurrentBranch, amend } from '../utils/git.js';
import { garantirIdentidade } from '../utils/identidade.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function comandoAmend() {
  const cmd = new Command('amend');
  cmd.description('Reescreve a mensagem do último commit.')
    .action(async () => {
      try {
        const arquivos = getStagedFiles();
        let msg = arquivos.length > 0 ? gerarSugestao(arquivos, getCurrentBranch(), carregarConfig().idioma).message : '';
        if (!msg) {
          try {
            msg = execSync('git log -1 --pretty=%B', {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            }).trim();
          } catch { msg = ''; }
        }
        const { mensagem } = await inquirer.prompt([
          { type: 'input', name: 'mensagem', message: 'Nova mensagem:', default: msg.split('\n')[0] }
        ]);

        const garantia = await garantirIdentidade(process.cwd(), {});
        if (garantia.modo === 'cancelada') {
          console.log(chalk.yellow('Amend cancelado: identidade do git não configurada.'));
          return;
        }

        amend(mensagem, process.cwd(), {
          identidade: garantia.temporaria ? garantia.identidade : null,
        });
        console.log(chalk.green('✔ Mensagem reescrita.'));
      } catch (erro) {
        console.error(chalk.red(`✖ ${erro.message || erro}`));
        process.exitCode = 1;
      }
    });
  return cmd;
}
