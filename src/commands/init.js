import { Command } from 'commander';
import { writeFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';

export function comandoInit() {
  const cmd = new Command('init');
  cmd.description('Cria um .snakitrc.json comentado.')
    .action(() => {
      const arquivo = '.snakitrc.json';
      if (existsSync(arquivo)) {
        console.log(chalk.yellow('• ' + arquivo + ' já existe.'));
        return;
      }
      const conteudo = `{
  // Idioma da mensagem de commit (pt-BR | en)
  "idioma": "pt-BR",

  // Se verdadeiro, usa a IA por padrão (ainda precisa de --allow-send para enviar)
  "useAi": false,

  // Escopos permitidos (vazio = qualquer um)
  "escoposPermitidos": [],

  // Tipos permitidos
  "tiposPermitidos": ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],

  // Tamanho máximo do assunto (padrão 72)
  "tamanhoMaximoAssunto": 72,

  // Estilo da mensagem (conventional | gitmoji)
  "estilo": "conventional",

  // Templates extras
  "templatesExtras": []
}\n`;
      writeFileSync(arquivo, conteudo);
      console.log(chalk.green('✔ ' + arquivo + ' criado.'));
    });
  return cmd;
}
