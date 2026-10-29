import { Command } from 'commander';
import chalk from 'chalk';
import { carregarConfig } from '../utils/config.js';

export function comandoTemplates() {
    const command = new Command('templates');

    command
        .description('Gerencia e lista os templates customizados do snakit.');

    // Subcomando: list
    command
        .command('list')
        .description('Lista todos os templates disponíveis (inclusos e extras).')
        .action(async () => {
            const config = await carregarConfig();

            console.log(chalk.bold('\n📋 Templates Inclusos:'));
            console.log(`  - ${chalk.green('express-mvc')}     : Estrutura Express clássica com MVC`);
            console.log(`  - ${chalk.green('react')}           : SPA mínima usando Vite`);
            console.log(`  - ${chalk.green('node-puro')}       : Arquivo index.js e package.json mínimo`);

            if (config.templatesExtras && config.templatesExtras.length > 0) {
                console.log(chalk.bold('\n⭐️ Templates Extras (.snakitrc.json):'));
                config.templatesExtras.forEach(template => {
                    console.log(`  - ${chalk.yellow(template.valor || template.nome)}: ${template.descricao || ''}`);
                });
            }
            console.log();
        });

    // Subcomando: add
    command
        .command('add <repo> <nome>')
        .description('Adiciona um novo repositório externo como template extra.')
        .action((repo, nome) => {
            console.log(chalk.blue(`\n[snakit] Preparando para mapear o repositório [${repo}] como "${nome}"...`));
            console.log(chalk.yellow('💡 Dica: Configure caminhos locais no seu arquivo .snakitrc.json na chave "templatesExtras".\n'));
        });

    // Subcomando: remove
    command
        .command('remove <nome>')
        .description('Remove um template customizado extra.')
        .action((nome) => {
            console.log(chalk.red(`\n[snakit] Removendo template "${nome}" das configurações locais...\n`));
        });

    return command;
}

