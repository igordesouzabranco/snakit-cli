// src/commands/check.js
// `snakit check` — revisa o que está no stage (segredos, debug, arquivos
// sensíveis). Só olha o stage, nunca o repositório inteiro.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { analisarStage, ehBinario } from '../utils/check.js';

/** Roda um comando git com os argumentos em array (sem shell). */
function rodarGit(argumentos, dir) {
  return execFileSync('git', argumentos, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** Coleta metadados dos arquivos no stage: tamanho e se é binário. */
function carregarArquivosStage(dir) {
  const nomeSaida = rodarGit(['diff', '--cached', '--name-only'], dir);
  const caminhos = nomeSaida.split(/\r?\n/).filter(Boolean);
  const arquivos = [];

  for (const caminho of caminhos) {
    try {
      const buffer = readFileSync(path.join(dir, caminho));
      arquivos.push({
        caminho,
        tamanho: buffer.length,
        ehBinario: ehBinario(caminho, buffer),
      });
    } catch {
      // Arquivo removido do disco mas ainda no stage: sem tamanho/binário.
      arquivos.push({ caminho, tamanho: 0, ehBinario: false });
    }
  }

  return arquivos;
}

function imprimirAchados(erros, avisos) {
  if (erros.length > 0) {
    console.error(chalk.red(`✖ Erros (${erros.length}):`));
    for (const a of erros) {
      const local = a.linha > 0 ? `${a.arquivo}:${a.linha}` : a.arquivo;
      console.error(`  - [${a.regra}] ${local} — ${a.trecho}`);
    }
  }
  if (avisos.length > 0) {
    console.log(chalk.yellow(`⚠ Avisos (${avisos.length}):`));
    for (const a of avisos) {
      const local = a.linha > 0 ? `${a.arquivo}:${a.linha}` : a.arquivo;
      console.log(`  - [${a.regra}] ${local} — ${a.trecho}`);
    }
  }
}

export function comandoCheck() {
  const cmd = new Command('check');
  cmd
    .description('Revisa o stage antes do commit (segredos, debug, arquivos sensíveis).')
    .option('--strict', 'avisos também fazem sair com código 1')
    .option('--output <formato>', 'formato da saída: text (padrão) ou json')
    .addHelpText(
      'after',
      `
Regras:
  Erro (exit 1): chaves AWS/Anthropic/OpenAI, token GitHub, chave privada,
    credencial literal em código, arquivos .env* (exceto .env.example),
    *.pem e *.key no stage.
  Aviso (exit 0, salvo com --strict): console.log/debug e debugger em código,
    TODO/FIXME novos, arquivo > 1 MB e binário grande no stage.

Exemplos:
  $ snakit check                 revisa o stage com a saída no terminal
  $ snakit check --strict        avisos também dão exit 1
  $ snakit check --output json   saída em JSON`,
    )
    .action((opcoes) => {
      const dir = process.cwd();

      let diff;
      try {
        diff = rodarGit(['diff', '--cached', '-U0'], dir);
      } catch (erro) {
        const motivo = (typeof erro.stderr === 'string' && erro.stderr.trim()) || erro.message;
        console.error(chalk.red(`✖ O git falhou: ${motivo}`));
        process.exitCode = 1;
        return;
      }

      let arquivos;
      try {
        arquivos = carregarArquivosStage(dir);
      } catch (erro) {
        const motivo = (typeof erro.stderr === 'string' && erro.stderr.trim()) || erro.message;
        console.error(chalk.red(`✖ O git falhou: ${motivo}`));
        process.exitCode = 1;
        return;
      }

      if (!diff.trim() && arquivos.length === 0) {
        if (opcoes.output === 'json') {
          console.log(JSON.stringify({ erros: [], avisos: [] }, null, 2));
        } else {
          console.log(chalk.green('Nada no stage para revisar'));
        }
        return;
      }

      const { erros, avisos } = analisarStage({ diff, arquivos });

      if (opcoes.output === 'json') {
        console.log(JSON.stringify({ erros, avisos }, null, 2));
      } else if (erros.length === 0 && avisos.length === 0) {
        console.log(chalk.green('✔ Nenhum problema encontrado no stage.'));
      } else {
        imprimirAchados(erros, avisos);
      }

      if (erros.length > 0 || (opcoes.strict && avisos.length > 0)) {
        process.exitCode = 1;
      }
    });
  return cmd;
}
