import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RECURSOS = path.join(AQUI, '..', 'resources');

function listarRecursos() {
  try {
    return require('node:fs').readdirSync(RECURSOS, { withFileTypes: true })
      .filter(i => i.isDirectory())
      .map(i => i.name);
  } catch { return ['eslint', 'prettier', 'vitest', 'docker', 'ci', 'husky', 'env', 'license']; }
}

export function comandoAdd() {
  const cmd = new Command('add');
  cmd
    .description('Adiciona recursos a um projeto existente.')
    .argument('<recurso>', 'nome do recurso')
    .addHelpText('after', `
Exemplos:
  $ snakit add eslint
  $ snakit add docker
  $ snakit add --list
`)
    .action((recurso) => {
      const recursos = listarRecursos();
      if (recurso === '--list') {
        console.log('Recursos disponíveis:', recursos.join(', '));
        return;
      }
      if (!recursos.includes(recurso)) {
        console.error(chalk.red('✖ Recurso "' + recurso + '" não encontrado. Use --list para ver os disponíveis.'));
        process.exitCode = 1;
        return;
      }
      const origem = path.join(RECURSOS, recurso);
      if (!existsSync(origem)) {
        console.log(chalk.yellow('• Recurso "' + recurso + '" ainda não implementado (stub).'));
        return;
      }
      // Copiar arquivos do recurso sobre o projeto atual
      for (const item of require('node:fs').readdirSync(origem, { withFileTypes: true })) {
        const src = path.join(origem, item.name);
        const dst = path.join(process.cwd(), item.name);
        if (existsSync(dst) && item.isFile()) {
          console.log(chalk.yellow('• Arquivo ' + item.name + ' já existe. Não sobrescrevendo.'));
          continue;
        }
        if (item.isDirectory()) {
          require('node:fs').cpSync(src, dst, { recursive: true });
        } else {
          require('node:fs').copyFileSync(src, dst);
        }
      }
      console.log(chalk.green('✔ Recurso "' + recurso + '" adicionado.'));
    });
  return cmd;
}
