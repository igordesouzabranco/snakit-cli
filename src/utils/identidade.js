// src/utils/identidade.js
// Garante identidade ANTES de qualquer commit (`new`, `commit`, `amend`,
// `release`). Um único lugar com a decisão, para os comandos não repetirem:
//
// - identidade já no git (ou nas variáveis GIT_AUTHOR_*/GIT_COMMITTER_*):
//   segue normal, sem perguntar nada;
// - identidade no `.snakitrc.json` (`identidade: { nome, email }`):
//   usada só naquele commit, sem gravar nada no git;
// - sem identidade e com TTY (sem --yes): a pessoa escolhe entre configurar
//   SÓ neste repositório, usar uma temporária, ou cancelar;
// - sem identidade e sem TTY (--yes, CI): identidade temporária + aviso
//   amarelo de como configurar a verdadeira.
//
// NUNCA escrevemos em `git config --global`: o ~/.gitconfig é do usuário.

import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  obterIdentidade,
  emailValido,
  definirIdentidadeLocal,
} from './git.js';

/** Identidade usada quando não há nenhuma configurada (só naquele commit). */
export const IDENTIDADE_TEMPORARIA = { nome: 'Snakit', email: 'snakit@localhost' };

function dicaDeConfiguracao() {
  return (
    '  Configure a sua com `git config --global user.name "Seu Nome"` e ' +
    '`git config --global user.email "voce@exemplo.com"`.'
  );
}

/**
 * Decide a identidade do próximo commit.
 *
 * @param {string} dir repositório que vai receber o commit
 * @param {object} opcoes { config: .snakitrc.json carregado, yes, interativo }
 * @returns {Promise<{ modo, identidade, temporaria }>}
 *   modo: 'configurada' | 'config-local' | 'config-arquivo' | 'temporaria' | 'cancelada'
 *   temporaria: true quando a identidade NÃO está gravada no git e precisa
 *   ser passada com `-c user.name=… -c user.email=…` no comando do commit.
 */
export async function garantirIdentidade(dir = process.cwd(), opcoes = {}) {
  const { config = null, yes = false } = opcoes;

  const atual = obterIdentidade(dir);
  if (atual.nome && atual.email) {
    return { modo: 'configurada', identidade: atual, temporaria: false };
  }

  // Identidade escrita no .snakitrc.json vale como escolha explícita.
  const doArquivo = config && config.identidade;
  if (doArquivo && doArquivo.nome && doArquivo.email) {
    console.log(
      chalk.gray(
        `• Usando a identidade do .snakitrc.json neste commit: ${doArquivo.nome} <${doArquivo.email}>`,
      ),
    );
    return { modo: 'config-arquivo', identidade: doArquivo, temporaria: true };
  }

  const interativo =
    opcoes.interativo ?? (Boolean(process.stdin.isTTY) && !yes && !process.env.CI);

  if (interativo) {
    console.log('');
    const { escolha } = await inquirer.prompt([
      {
        type: 'list',
        name: 'escolha',
        message: 'O git não tem identidade de commit (user.name/user.email). O que fazer?',
        choices: [
          { name: 'Configurar só neste repositório', value: 'local' },
          { name: 'Usar uma identidade temporária só neste commit', value: 'temporaria' },
          { name: 'Cancelar', value: 'cancelar' },
        ],
      },
    ]);

    if (escolha === 'cancelar') {
      return { modo: 'cancelada', identidade: null, temporaria: false };
    }

    if (escolha === 'local') {
      const { nome } = await inquirer.prompt([
        {
          type: 'input',
          name: 'nome',
          message: 'Seu nome:',
          validate: (valor) => (valor.trim() ? true : 'O nome não pode ficar vazio.'),
        },
      ]);
      const { email } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Seu e-mail:',
          validate: (valor) =>
            emailValido(valor) ? true : 'E-mail inválido (exemplo: voce@exemplo.com).',
        },
      ]);
      const identidade = { nome: nome.trim(), email: email.trim() };
      definirIdentidadeLocal(dir, identidade);
      console.log(
        chalk.green(`✔ Identidade gravada só neste repositório: ${identidade.nome} <${identidade.email}>`),
      );
      return { modo: 'config-local', identidade, temporaria: false };
    }

    console.log(
      chalk.yellow(
        `• Identidade temporária usada só neste commit: ${IDENTIDADE_TEMPORARIA.nome} <${IDENTIDADE_TEMPORARIA.email}>`,
      ),
    );
    return { modo: 'temporaria', identidade: IDENTIDADE_TEMPORARIA, temporaria: true };
  }

  // Não interativo (--yes, sem TTY ou CI): avisa e segue com a temporária.
  console.log(
    chalk.yellow(
      `⚠ Identidade do git não configurada: commitando como ${IDENTIDADE_TEMPORARIA.nome} <${IDENTIDADE_TEMPORARIA.email}> (só neste commit).`,
    ),
  );
  console.log(chalk.gray(dicaDeConfiguracao()));
  return { modo: 'temporaria', identidade: IDENTIDADE_TEMPORARIA, temporaria: true };
}
