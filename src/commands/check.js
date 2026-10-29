import { Command } from 'commander';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const PADROES_PROIBIDOS = [
  /sk-ant-/, /api_key/i, /api-key/i, /secret/i, /token/i,
  /-----BEGIN (PRIVATE|PUBLIC) KEY-----/,
  /password/i,
];
const EXTENSOES_BINARIAS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.exe', '.dll', '.so', '.wasm', '.jar', '.class'];

function ehArquivoGrande(pasta, limite = 1024 * 1024) {
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.git') {
      const grande = ehArquivoGrande(caminho, limite);
      if (grande) return grande;
    } else if (item.isFile()) {
      if (statSync(caminho).size > limite) return caminho;
    }
  }
  return null;
}

export function comandoCheck() {
  const cmd = new Command('check');
  cmd
    .description('Revisão local antes do commit.')
    .option('--fix', 'tenta corrigir automaticamente o que for seguro')
    .action((opcoes) => {
      const erros = [];
      // Segredos no stage
      try {
        const diff = require('node:child_process').execSync('git diff --cached', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) || '';
        for (const linha of diff.split('\n')) {
          for (const padrao of PADROES_PROIBIDOS) {
            if (padrao.test(linha) && !linha.startsWith('+')) {
              erros.push('Possível segredo no diff: ' + linha.slice(0, 60));
            }
          }
        }
      } catch { /* sem stage */ }

      // console.log / debugger
      try {
        const arquivos = require('node:child_process').execSync('git ls-files', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n');
        for (const arquivo of arquivos) {
          if (arquivo.endsWith('.js') || arquivo.endsWith('.ts') || arquivo.endsWith('.jsx') || arquivo.endsWith('.tsx')) {
            const conteudo = readFileSync(arquivo, 'utf8');
            if (conteudo.includes('console.log') || conteudo.includes('console.debug')) {
              erros.push('console.log/debug esquecido em: ' + arquivo);
            }
            if (conteudo.includes('debugger')) {
              erros.push('debugger esquecido em: ' + arquivo);
            }
          }
        }
      } catch { /* sem git */ }

      // TODO / FIXME
      try {
        const arquivos = require('node:child_process').execSync('git ls-files', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n');
        for (const arquivo of arquivos) {
          if (arquivo.endsWith('.js') || arquivo.endsWith('.ts') || arquivo.endsWith('.jsx') || arquivo.endsWith('.tsx') || arquivo.endsWith('.py') || arquivo.endsWith('.md')) {
            const conteudo = readFileSync(arquivo, 'utf8');
            if (conteudo.match(/(TODO|FIXME)/gi)) {
              erros.push('TODO/FIXME encontrado em: ' + arquivo);
            }
          }
        }
      } catch { }

      // Arquivo grande
      const grande = ehArquivoGrande('.');
      if (grande) erros.push('Arquivo grande (>1MB): ' + grande);

      // Binários no stage
      try {
        const stage = require('node:child_process').execSync('git diff --cached --name-only', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n');
        for (const arquivo of stage) {
          for (const ext of EXTENSOES_BINARIAS) {
            if (arquivo.endsWith(ext)) {
              erros.push('Binário no stage: ' + arquivo);
            }
          }
        }
      } catch { }

      if (erros.length === 0) {
        console.log(chalk.green('✔ Nenhum problema encontrado.'));
      } else {
        console.error(chalk.red('✖ Problemas encontrados:'));
        for (const e of erros) console.error('  - ' + e);
        process.exitCode = 1;
      }
    });
  return cmd;
}
