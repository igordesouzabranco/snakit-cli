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
import { comandoHook } from '../src/commands/hook.js';
import { comandoLint } from '../src/commands/lint.js';
import { comandoChangelog } from '../src/commands/changelog.js';
import { comandoRelease } from '../src/commands/release.js';
import { comandoUndo } from '../src/commands/undo.js';
import { comandoAmend } from '../src/commands/amend.js';
import { comandoAdd } from '../src/commands/add.js';

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
program.addCommand(comandoHook());
program.addCommand(comandoLint());
program.addCommand(comandoChangelog());
program.addCommand(comandoRelease());
program.addCommand(comandoUndo());
program.addCommand(comandoAmend());
program.addCommand(comandoAdd());
import { comandoGenerate } from '../src/commands/generate.js';
program.addCommand(comandoGenerate());
import { comandoTemplates } from '../src/commands/templates.js';
import { comandoConfig } from '../src/commands/config.js';
program.addCommand(comandoConfig());
import { comandoInit } from '../src/commands/init.js';
import { comandoDoctor } from '../src/commands/doctor.js';
program.addCommand(comandoInit());
program.addCommand(comandoDoctor());
program.addCommand(comandoTemplates());
import { comandoPr } from '../src/commands/pr.js';
program.addCommand(comandoPr());
import { comandoCheck } from '../src/commands/check.js';
program.addCommand(comandoCheck());
import { comandoReadme } from '../src/commands/readme.js';
program.addCommand(comandoReadme());
import { comandoStats } from '../src/commands/stats.js';
import { comandoBranch } from '../src/commands/branch.js';
program.addCommand(comandoStats());
program.addCommand(comandoBranch());

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
