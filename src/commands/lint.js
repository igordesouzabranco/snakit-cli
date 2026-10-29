// src/commands/lint.js
// Valida mensagem no padrão Conventional Commits.

import { Command } from 'commander';
import { ehMensagemValida } from '../utils/ai.js';
import { carregarConfig } from '../utils/config.js';
import { execSync } from 'node:child_process';
import chalk from 'chalk';

function obterMensagemUltimoCommit() {
  try {
    return execSync('git log -1 --pretty=%B', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export function comandoLint() {
  const cmd = new Command('lint');
  cmd
    .description('Valida uma mensagem de commit no padrão Conventional Commits.')
    .argument('[mensagem]', 'mensagem a validar (se omitido, valida o último commit)')
    .option('--from <ref>', 'ref inicial para intervalo')
    .option('--to <ref>', 'ref final para intervalo')
    .action((mensagem, opcoes) => {
      const config = carregarConfig();
      let texto = mensagem || '';

      if (!texto && !opcoes.from && !opcoes.to) {
        texto = obterMensagemUltimoCommit();
      }

      if (!texto) {
        console.error(chalk.red('✖ Nenhuma mensagem encontrada. Passe uma mensagem ou use --from/--to.'));
        process.exitCode = 1;
        return;
      }

      const linhas = texto.split('\n');
      const primeira = linhas[0] || '';
      const valida = ehMensagemValida(texto);

      // Respeita escopos e tipos permitidos do config
      let erros = [];
      if (!valida) erros.push('Formato inválido (deve ser tipo(escopo): descrição)');

      const tiposPermitidos = config.tiposPermitidos || ['feat','fix','docs','style','refactor','perf','test','build','ci','chore','revert'];
      const tipoExtraido = primeira.split(':')[0]?.split('(')[0] || '';
      if (tipoExtraido && !tiposPermitidos.includes(tipoExtraido)) {
        erros.push(`Tipo "${tipoExtraido}" não permitido (${tiposPermitidos.join(', ')})`);
      }

      const tamanhoMaximo = config.tamanhoMaximoAssunto || 72;
      if (primeira.length > tamanhoMaximo) {
        erros.push(`Assunto com ${primeira.length} caracteres (máximo ${tamanhoMaximo})`);
      }

      const escoposPermitidos = config.escoposPermitidos || [];
      if (escoposPermitidos.length > 0 && tipoExtraido) {
        const match = primeira.match(/\(([^)]+)\):/);
        const escopo = match ? match[1] : '';
        if (escopo && !escoposPermitidos.includes(escopo)) {
          erros.push(`Escopo "${escopo}" não permitido (${escoposPermitidos.join(', ')})`);
        }
      }

      if (erros.length === 0) {
        console.log(chalk.green('✔ Mensagem válida.'));
      } else {
        console.error(chalk.red('✖ Mensagem inválida:'));
        for (const e of erros) console.error(chalk.red('  - ' + e));
        console.error(chalk.yellow('Dica: use `tipo(escopo): descrição` com até 72 caracteres.'));
        process.exitCode = 1;
      }
    });

  return cmd;
}
