// src/commands/new.js
// `devkit new <nome>` — cria uma pasta nova a partir de um template.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { isGitInstalled, init, add, commit } from '../utils/git.js';
import { validarNomeProjeto, listarTemplates, copiarTemplate, substituirPlaceholders } from '../utils/files.js';
import { montarMensagem } from '../utils/rules.js';
import { carregarConfig } from '../utils/config.js';

function falhar(mensagem) {
  console.error(chalk.red(`✖ ${mensagem}`));
  process.exitCode = 1;
}

/** Roda `npm install` mostrando a saída na tela. Falha não derruba o
 *  scaffold, mas sai com código 1 — erro é erro. */
function instalarDependencias(destino) {
  try {
    execSync('npm install', { cwd: destino, stdio: 'inherit' });
    return true;
  } catch {
    console.error(chalk.red('✖ `npm install` falhou. Rode manualmente dentro da pasta.'));
    process.exitCode = 1;
    return false;
  }
}

function mostrarProximosPassos(nome, instalou) {
  console.log('');
  console.log(chalk.bold('Próximos passos:'));
  console.log(`  cd ${nome}`);
  if (!instalou) console.log('  npm install');
  console.log('  npm start');
}

export function comandoNew() {
  const comando = new Command('new');

  comando
    .argument('<nome>', 'nome da pasta do projeto')
    .description('Cria um projeto novo a partir de um template.')
    .option('--no-install', 'não roda npm install')
    .option('--no-git', 'não roda git init nem o primeiro commit')
    .addHelpText(
      'after',
      `
Exemplos:
  $ devkit new minha-loja                          pergunta o template e instala tudo
  $ devkit new minha-loja --no-install             só monta a estrutura
  $ devkit new minha-loja --no-install --no-git    só monta a estrutura, sem git`,
    )
    .action(async (nome, opcoes) => {
      try {
        const config = carregarConfig();
        if (config.aviso) console.log(chalk.yellow(`• ${config.aviso}`));

        const validacao = validarNomeProjeto(nome);
        if (!validacao.ok) return falhar(validacao.erro);

        const destino = path.resolve(process.cwd(), validacao.nome);
        if (existsSync(destino)) {
          return falhar(`A pasta "${destino}" já existe. Escolha outro nome ou apague a pasta.`);
        }

        const templates = listarTemplates(config);
        if (templates.length === 0) return falhar('Nenhum template encontrado em src/templates/.');

        const { escolhido } = await inquirer.prompt([
          {
            type: 'list',
            name: 'escolhido',
            message: 'Qual template você quer usar?',
            choices: templates.map((t) => ({ name: `${t.nome} — ${t.descricao}`, value: t })),
          },
        ]);

        copiarTemplate(escolhido.valor, destino, config);
        const alterados = substituirPlaceholders(destino, { nome: validacao.nome });
        console.log(
          chalk.green(`✔ Projeto "${validacao.nome}" criado com o template ${escolhido.nome} (${alterados} arquivos ajustados).`),
        );

        // Ordem do enunciado: git init -> npm install -> primeiro commit.
        const usarGit = opcoes.git && isGitInstalled();
        if (opcoes.git && !usarGit) {
          console.log(chalk.yellow('• Git não encontrado: pulando git init e primeiro commit.'));
        }
        if (usarGit) init(destino);

        const instalou = opcoes.install ? instalarDependencias(destino) : false;
        if (!opcoes.install) console.log(chalk.yellow('• `npm install` pulado (--no-install).'));

        if (usarGit) {
          add(destino);
          const mensagem = montarMensagem({
            type: 'chore',
            scope: '',
            description: `estrutura inicial ${escolhido.nome}`,
          });
          commit(mensagem, destino);
          console.log(chalk.green(`✔ Primeiro commit: ${mensagem}`));
        }

        mostrarProximosPassos(validacao.nome, opcoes.install && instalou);
      } catch (erro) {
        falhar(String(erro.message || erro));
      }
    });

  return comando;
}
