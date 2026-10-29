import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

function listarScripts() {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    return pkg.scripts ? Object.entries(pkg.scripts).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n') : '';
  } catch { return ''; }
}

function listarPastas() {
  try {
    return readdirSync('.', { withFileTypes: true }).filter(i => i.isDirectory() && !['node_modules', '.git'].includes(i.name)).map(i => i.name).join(', ');
  } catch { return ''; }
}

export function comandoReadme() {
  const cmd = new Command('readme');
  cmd
    .description('Gera README.md a partir do projeto.')
    .option('--force', 'sobrescreve README existente')
    .action((opcoes) => {
      const arquivo = 'README.md';
      if (existsSync(arquivo) && !opcoes.force) {
        console.log(chalk.yellow('• ' + arquivo + ' já existe. Use --force para sobrescrever.'));
        return;
      }
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
      const scripts = listarScripts();
      const pastas = listarPastas();
      const md = `# ${pkg.name || 'Projeto'}\n\n${pkg.description || ''}\n\n` +
        `## Instalação\n\n\`npm install\`\n\n` +
        `## Scripts\n\n${scripts || 'Nenhum script definido.'}\n\n` +
        `## Estrutura\n\n` +
        (pastas ? `- ${pastas}\n` : 'Nenhuma pasta adicional.') +
        `\n` +
        `## Licença\n\n${pkg.license || 'MIT'}\n`;
      writeFileSync(arquivo, md);
      console.log(chalk.green('✔ ' + arquivo + ' gerado.'));
    });
  return cmd;
}
