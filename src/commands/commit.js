// src/commands/commit.js
// `devkit commit` — lê o stage, sugere uma mensagem e só commita depois
// que a pessoa confirmar.

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  isGitInstalled,
  isGitRepo,
  getStagedFiles,
  getCurrentBranch,
  commit,
} from '../utils/git.js';
import { gerarSugestao } from '../utils/rules.js';

/** Mensagens de erro claras: dizem o problema E o próximo passo. */
function erroDoGit(erro) {
  const texto = String(erro.message || erro);
  if (/not recognized|não é reconhecido|command not found/i.test(texto)) {
    return 'Git não está instalado (ou não está no PATH). Instale em git-scm.com e tente de novo.';
  }
  if (/not a git repository|não é um repositório/i.test(texto)) {
    return 'Esta pasta não é um repositório git. Rode `git init` primeiro.';
  }
  return texto;
}

function falhar(mensagem) {
  console.error(chalk.red(`✖ ${mensagem}`));
  process.exitCode = 1;
}

async function escolherAcao(mensagemSugerida) {
  console.log('');
  console.log(chalk.bold('Mensagem sugerida:'));
  console.log(`  ${chalk.cyan(mensagemSugerida)}`);
  console.log('');

  const { acao } = await inquirer.prompt([
    {
      type: 'list',
      name: 'acao',
      message: 'O que você quer fazer?',
      choices: [
        { name: 'Aceitar e commitar', value: 'aceitar' },
        { name: 'Editar a mensagem', value: 'editar' },
        { name: 'Cancelar', value: 'cancelar' },
      ],
    },
  ]);

  if (acao === 'cancelar') return null;

  if (acao === 'aceitar') return mensagemSugerida;

  const { mensagem } = await inquirer.prompt([
    {
      type: 'input',
      name: 'mensagem',
      message: 'Edite a mensagem do commit:',
      default: mensagemSugerida,
      validate: (valor) => (valor.trim() ? true : 'A mensagem não pode ficar vazia.'),
    },
  ]);
  return mensagem.trim();
}

export function comandoCommit() {
  const comando = new Command('commit');

  comando
    .description('Analisa o git diff --staged e sugere uma mensagem de commit.')
    .option('--dry-run', 'só mostra a mensagem, não commita')
    .option('--yes', 'aceita a sugestão sem perguntar')
    .action(async (opcoes) => {
      try {
        if (!isGitInstalled()) {
          return falhar('Git não está instalado (ou não está no PATH). Instale em git-scm.com.');
        }
        if (!isGitRepo()) {
          return falhar('Esta pasta não é um repositório git. Rode `git init` primeiro.');
        }

        const arquivos = getStagedFiles();
        if (arquivos.length === 0) {
          return falhar(
            'Nada encontrado no stage. Rode `git add <arquivos>` antes de usar o devkit commit.',
          );
        }

        const branch = getCurrentBranch();
        const sugestao = gerarSugestao(arquivos, branch);
        const mensagem = sugestao.message;

        if (opcoes.dryRun) {
          console.log(chalk.yellow('Dry-run: nada foi commitado.'));
          console.log(`  ${chalk.cyan(mensagem)}`);
          return;
        }

        // Com --yes pulamos o menu e usamos a sugestão direto.
        const mensagemFinal = opcoes.yes ? mensagem : await escolherAcao(mensagem);

        if (mensagemFinal === null) {
          console.log(chalk.yellow('Commit cancelado.'));
          return;
        }

        commit(mensagemFinal);
        console.log(chalk.green(`✔ Commit criado: ${mensagemFinal}`));
      } catch (erro) {
        falhar(erroDoGit(erro));
      }
    });

  return comando;
}
