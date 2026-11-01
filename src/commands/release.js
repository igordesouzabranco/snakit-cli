// src/commands/release.js
// Calcula bump, atualiza package.json, gera changelog, cria commit e tag.
// Identidade garantida ANTES de mexer em qualquer arquivo: cancelar aqui
// não deixa a árvore pela metade.

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { commit, criarTag } from '../utils/git.js';
import { garantirIdentidade } from '../utils/identidade.js';

export function comandoRelease() {
  const cmd = new Command('release');
  cmd
    .description('Calcula o bump, atualiza package.json, gera changelog, cria commit e tag.')
    .argument('[patch|minor|major]', 'tipo de bump (se omitido, calcula automaticamente)')
    .option('--dry-run', 'mostra o que seria feito, sem alterar nada', true)
    .action(async (tipo, opcoes) => {
      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        const atual = pkg.version || '0.0.0';
        const [maior, menor, patch] = atual.split('.').map(Number);

        let bump = tipo || 'patch';
        if (!tipo) {
          // Lógica simples: se há breaking change no stage ou no último commit, major
          const diff = execSync('git diff --cached --name-only', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) || '';
          const ultimo = execSync('git log -1 --pretty=%B', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) || '';
          if (ultimo.includes('BREAKING CHANGE') || diff.includes('!')) bump = 'major';
          else if (ultimo.toLowerCase().includes('feat')) bump = 'minor';
          else bump = 'patch';
        }

        let novaVersao = atual;
        if (bump === 'major') novaVersao = `${maior + 1}.0.0`;
        else if (bump === 'minor') novaVersao = `${maior}.${menor + 1}.0`;
        else novaVersao = `${maior}.${menor}.${patch + 1}`;

        console.log(chalk.yellow('Dry-run: ' + novaVersao + ' (' + bump + ')'));
        console.log(chalk.yellow('  • Atualizaria package.json para ' + novaVersao));
        console.log(chalk.yellow('  • Criaria tag v' + novaVersao));
        console.log(chalk.yellow('  • Aborta se árvore suja'));

        if (!opcoes.dryRun) {
          const status = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
          if (status.trim()) {
            console.error(chalk.red('✖ Árvore de trabalho suja. Faça commit ou stash antes do release.'));
            process.exitCode = 1;
            return;
          }

          // Identidade ANTES de alterar o package.json (nada muda se cancelar).
          const garantia = await garantirIdentidade(process.cwd(), {});
          if (garantia.modo === 'cancelada') {
            console.log(chalk.yellow('Release cancelado: identidade do git não configurada. Nada foi alterado.'));
            return;
          }
          const identidade = garantia.temporaria ? garantia.identidade : null;

          pkg.version = novaVersao;
          writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
          execSync('git add package.json', { stdio: ['pipe', 'pipe', 'pipe'] });
          commit(`chore(release): v${novaVersao}`, process.cwd(), { identidade });
          criarTag(`v${novaVersao}`, `v${novaVersao}`, process.cwd(), { identidade });
          console.log(chalk.green('✔ Release ' + novaVersao + ' criado.'));
        }
      } catch (erro) {
        console.error(chalk.red(`✖ Release falhou: ${erro.message || erro}`));
        process.exitCode = 1;
      }
    });

  return cmd;
}
