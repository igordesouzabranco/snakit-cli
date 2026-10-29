import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { carregarConfig } from '../utils/config.js';

export function comandoDoctor() {
  const cmd = new Command('doctor');
  cmd.description('Verifica ambiente e configuração.')
    .action(() => {
      const config = carregarConfig();
      const problemas = [];

      // Node
      try {
        const v = process.version;
        console.log(chalk.green('✔ Node: ' + v));
      } catch {
        problemas.push('Node não detectado.');
      }

      // Git
      try {
        const git = execSync('git --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(chalk.green('✔ Git: ' + git.trim()));
      } catch {
        problemas.push('Git não instalado (git-scm.com).');
      }

      // Gerenciador
      try {
        const pm = execSync('npm --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(chalk.green('✔ npm: ' + pm.trim()));
      } catch {
        problemas.push('npm não detectado.');
      }

      // Config
      if (config.aviso) {
        console.log(chalk.yellow('• Config: aviso - ' + config.aviso));
      } else {
        console.log(chalk.green('✔ Config válida.'));
      }

      // Hooks
      const hookPath = '.git/hooks/prepare-commit-msg';
      if (existsSync(hookPath)) {
        console.log(chalk.green('✔ Hook prepare-commit-msg instalado.'));
      } else {
        console.log(chalk.yellow('✖ Hook não instalado (rode `snakit hook install`).'));
      }

      // API
      const chave = process.env.ANTHROPIC_API_KEY ? 'definida' : 'não definida';
      console.log('  ANTHROPIC_API_KEY: ' + chave);

      if (problemas.length > 0) {
        console.log(chalk.yellow('Problemas encontrados:'));
        for (const p of problemas) console.log('  - ' + p);
      } else {
        console.log(chalk.green('✔ Nenhum problema detectado.'));
      }
    });
  return cmd;
}
