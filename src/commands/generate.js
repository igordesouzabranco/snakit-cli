import { Command } from 'commander';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

export function comandoGenerate() {
  const cmd = new Command('generate');
  cmd
    .description('Gera arquivos para projetos MVC.')
    .addHelpText('after', `
Exemplos:
  $ snakit generate resource user
  $ snakit generate controller task
  $ snakit generate model product
  $ snakit generate route order`)
    .action((tipo, nome) => {
      if (!tipo || !nome) {
        console.error(chalk.red('✖ Uso: snakit generate <controller|model|route|resource> <nome>'));
        process.exitCode = 1;
        return;
      }
      // Detecta se é MVC (express-mvc)
      const appPath = path.resolve(process.cwd(), 'app.js');
      if (!existsSync(appPath)) {
        console.error(chalk.red('✖ Estrutura MVC não detectada (falta app.js). Este comando funciona só no template express-mvc.'));
        process.exitCode = 1;
        return;
      }
      const recursos = { controller: 'controllers', model: 'models', route: 'routes', resource: '' };
      const pasta = recursos[tipo] || tipo;
      if (!pasta) {
        console.error(chalk.red('✖ Tipo "' + tipo + '" não reconhecido. Use: controller, model, route, resource.'));
        process.exitCode = 1;
        return;
      }
      const arquivoBase = tipo === 'resource' ? [
        `controllers/${nome}Controller.js`,
        `models/${nome}Model.js`,
        `routes/${nome}.js`,
      ] : [`${pasta}/${nome}${tipo === 'controller' ? 'Controller' : tipo === 'model' ? 'Model' : ''}.${tipo === 'route' ? 'js' : 'js'}`];
      // Simplificação: se resource, cria 3 arquivos
      if (tipo === 'resource') {
        for (const arq of arquivoBase) {
          const dir = path.dirname(arq);
          if (dir !== '.') mkdirSync(dir, { recursive: true });
          const conteudo = arq.includes('Controller') ? `// ${nome} controller\nexport default {};\n` : arq.includes('Model') ? `// ${nome} model\nexport default {};\n` : `// ${nome} routes\nimport { Router } from 'express';\nconst router = Router();\nrouter.get('/', (req, res) => res.send('${nome}'));
export default router;\n`;
          writeFileSync(arq, conteudo);
        }
        // Registra rota no app.js (simples: adiciona linha antes de module.exports)
        const appConteudo = require('node:fs').readFileSync('app.js', 'utf8');
        const novaLinha = `app.use('/${nome}', require('./routes/${nome}').default);\n`;
        if (!appConteudo.includes(nome)) {
          const atualizado = appConteudo.replace('module.exports', novaLinha + '\nmodule.exports');
          require('node:fs').writeFileSync('app.js', atualizado);
        }
      } else {
        const arquivo = arquivoBase[0];
        const dir = path.dirname(arquivo);
        if (dir !== '.') mkdirSync(dir, { recursive: true });
        const conteudo = `// ${nome} ${tipo}\nexport default {};\n`;
        writeFileSync(arquivo, conteudo);
      }
      console.log(chalk.green('✔ Arquivos gerados para "' + nome + '".'));
    });
  return cmd;
}
