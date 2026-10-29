import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { carregarConfig } from '../utils/config.js';

export function comandoConfig() {
  const cmd = new Command('config');

  cmd.command('get')
    .description('Mostra uma chave da configuração')
    .argument('<chave>', 'nome da chave')
    .action((chave) => {
      const config = carregarConfig();
      if (chave in config) console.log(chalk.green(config[chave]));
      else console.error(chalk.red('Chave "' + chave + '" não encontrada.'));
    });

  cmd.command('set')
    .description('Define uma chave da configuração')
    .argument('<chave>', 'nome da chave')
    .argument('<valor>', 'valor')
    .action((chave, valor) => {
      const arquivo = '.snakitrc.json';
      let config = {};
      if (existsSync(arquivo)) {
        try { config = JSON.parse(readFileSync(arquivo, 'utf8')); } catch { config = {}; }
      }
      if (chave === 'idioma') config.idioma = valor;
      else if (chave === 'useAi') config.useAi = valor === 'true';
      else if (chave === 'escoposPermitidos') config.escoposPermitidos = valor.split(',');
      else if (chave === 'tiposPermitidos') config.tiposPermitidos = valor.split(',');
      else if (chave === 'tamanhoMaximoAssunto') config.tamanhoMaximoAssunto = parseInt(valor, 10);
      else config[chave] = valor;
      writeFileSync(arquivo, JSON.stringify(config, null, 2) + '\n');
      console.log(chalk.green('✔ Config atualizado.'));
    });

  cmd.command('list')
    .description('Lista a configuração atual')
    .action(() => {
      const config = carregarConfig();
      console.log(JSON.stringify(config, null, 2));
    });

  cmd.command('path')
    .description('Mostra o caminho do arquivo .snakitrc.json')
    .action(() => {
      const config = carregarConfig();
      console.log(config.arquivo || '.snakitrc.json');
    });

  return cmd;
}
