// src/commands/hook.js
// Instala/remove/verifica o hook prepare-commit-msg.

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const HOOK_FILE = '.git/hooks/prepare-commit-msg';
const BACKUP = '.git/hooks/prepare-commit-msg.snakit-backup';

function hookContent(modo = 'local') {
  const iaFlag = modo === 'ai' ? '--ai' : '';
  return `#!/bin/sh
# Snakit hook (instalado por snakit hook install)
# Modo: ${modo}

msgFile="$1"

# Usa regras locais por padrão; IA só se configurado (--ai ou .snakitrc.json)
snakit commit --dry-run --yes ${iaFlag} > /dev/null 2>&1 || true

# Se o usuário quiser preencher a mensagem automaticamente:
if command -v snakit >/dev/null 2>&1; then
  msg=$(snakit commit --dry-run --yes ${iaFlag} 2>/dev/null || echo "")
  if [ -n "$msg" ]; then
    echo "$msg" > "$msgFile"
  fi
fi
`;
}

export function comandoHook() {
  const cmd = new Command('hook');
  cmd.description('Gerencia o hook prepare-commit-msg do git.')

  cmd
    .command('install')
    .description('Instala o hook prepare-commit-msg')
    .option('--ai', 'instala com opção --ai habilitada')
    .action((opcoes) => {
      const hookPath = path.resolve(process.cwd(), HOOK_FILE);
      if (!existsSync(path.dirname(hookPath))) {
        console.log(chalk.yellow('• Não é um repositório git (não há .git/hooks).'));
        process.exitCode = 1;
        return;
      }
      if (existsSync(hookPath)) {
        if (!existsSync(BACKUP)) {
          renameSync(hookPath, BACKUP);
          console.log(chalk.yellow('• Hook existente movido para .git/hooks/prepare-commit-msg.snakit-backup'));
        } else {
          console.log(chalk.yellow('• Hook existente preservado; backup já existe.'));
        }
      }
      writeFileSync(hookPath, hookContent(opcoes.ai ? 'ai' : 'local'), { mode: 0o755 });
      console.log(chalk.green('✔ Hook prepare-commit-msg instalado.'));
    });

  cmd
    .command('uninstall')
    .description('Remove o hook prepare-commit-msg')
    .action(() => {
      const hookPath = path.resolve(process.cwd(), HOOK_FILE);
      if (existsSync(hookPath)) {
        unlinkSync(hookPath);
        console.log(chalk.green('✔ Hook removido.'));
      }
      if (existsSync(BACKUP)) {
        renameSync(BACKUP, hookPath);
        console.log(chalk.green('✔ Backup restaurado para prepare-commit-msg.'));
      }
    });

  cmd
    .command('status')
    .description('Mostra o status do hook')
    .action(() => {
      const hookPath = path.resolve(process.cwd(), HOOK_FILE);
      if (existsSync(hookPath)) {
        console.log(chalk.green('✔ Hook instalado: ' + hookPath));
        const conteudo = readFileSync(hookPath, 'utf8');
        const modo = conteudo.includes('--ai') ? 'ai' : 'local';
        console.log('  Modo: ' + modo);
      } else {
        console.log(chalk.yellow('✖ Hook não instalado.'));
      }
      if (existsSync(BACKUP)) {
        console.log(chalk.yellow('  Backup existente: ' + BACKUP));
      }
    });

  cmd.addHelpText('after', `
Exemplos:
  $ snakit hook install
  $ snakit hook install --ai
  $ snakit hook uninstall
  $ snakit hook status`);

  return cmd;
}
