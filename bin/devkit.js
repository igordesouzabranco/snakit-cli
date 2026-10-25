#!/usr/bin/env node

// Ponto de entrada da CLI.
// A linha acima (shebang) diz ao sistema operacional para executar este arquivo
// com o Node.js, permitindo rodar `devkit` direto no terminal.

import { Command } from 'commander';
import { comandoCommit } from '../src/commands/commit.js';
import { comandoNew } from '../src/commands/new.js';

// Cria o programa principal e registra os comandos nele.
const program = new Command();

program
  .name('devkit')
  .description('CLI com scaffolder de projetos e gerador de mensagens de commit.')
  .version('0.1.0');

// Comandos da CLI ficam em src/commands/ e são registrados aqui.
program.addCommand(comandoCommit());
program.addCommand(comandoNew());

// Comando de teste da Etapa 1: só valida que o binário está instalado e rodando.
program
  .command('ola')
  .description('Comando de teste: imprime uma saudação.')
  .action(() => {
    console.log('olá');
  });

// Sem subcomando, mostra a ajuda em vez de falhar silenciosamente.
program.action(() => {
  program.help();
});

// parseAsync (e não parse) porque as ações podem ser async — o inquirer
// devolve uma Promise quando abre o menu interativo.
await program.parseAsync(process.argv);
