#!/usr/bin/env node

// Ponto de entrada da CLI.
// A linha acima (shebang) diz ao sistema operacional para executar este arquivo
// com o Node.js, permitindo rodar `snakit` direto no terminal.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { comandoCommit } from '../src/commands/commit.js';
import { comandoNew } from '../src/commands/new.js';

// Lê a versão direto do package.json: assim nunca sobra versão divergente
// entre o `--version` e o que foi publicado no npm.
const aqui = path.dirname(fileURLToPath(import.meta.url));
const pacote = JSON.parse(readFileSync(path.join(aqui, '..', 'package.json'), 'utf8'));

// Cria o programa principal e registra os comandos nele.
const program = new Command();

program
  .name('snakit')
  .description('CLI com scaffolder de projetos e gerador de mensagens de commit.')
  .version(pacote.version);

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

// Sem nenhum argumento, mostra a ajuda (sai com 0).
// Importante: isto é feito ANTES do parse. Se deixássemos um `program.action`
// fazendo o mesmo, ele também engoliria comandos desconhecidos como
// `snakit inventado` e o exit code sairia 0 em vez de 1.
if (process.argv.length <= 2) {
  program.help();
}

// parseAsync (e não parse) porque as ações podem ser async — o inquirer
// devolve uma Promise quando abre o menu interativo.
await program.parseAsync(process.argv);
