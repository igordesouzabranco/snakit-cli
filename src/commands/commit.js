// src/commands/commit.js
// `devkit commit` — lê o stage, sugere uma mensagem e só commita depois
// que a pessoa confirmar.
//
// Duas fontes de sugestão:
// - regras locais (padrão): rápido, grátis, offline.
// - `--ai`: opcional, chama a API da Anthropic e exige ANTHROPIC_API_KEY.

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  isGitInstalled,
  isGitRepo,
  getStagedFiles,
  getStagedDiff,
  getCurrentBranch,
  commit,
} from '../utils/git.js';
import { gerarSugestao } from '../utils/rules.js';
import { carregarConfig } from '../utils/config.js';
import {
  obterChave,
  filtrarDiff,
  truncarDiff,
  gerarMensagemComIA,
  ehMensagemValida,
  limparResposta,
} from '../utils/ai.js';

/** Mensagens de erro claras: dizem o problema E o próximo passo. */
function erroDoGit(erro) {
  const texto = String(erro.message || erro);
  if (/not recognized|não é reconhecido|command not found/i.test(texto)) {
    return 'Git não está instalado (ou não está no PATH). Instale em git-scm.com e tente de novo.';
  }
  if (/not a git repository|não é um repositório/i.test(texto)) {
    return 'Esta pasta não é um repositório git. Rode `git init` primeiro.';
  }
  return texto;
}

function falhar(mensagem) {
  console.error(chalk.red(`✖ ${mensagem}`));
  process.exitCode = 1;
}

/**
 * Toda a etapa opcional da IA. Devolve a mensagem ou null — e null significa
 * "cai para as regras locais", nunca um erro fatal.
 */
async function gerarComIA(arquivos, branch, opcoes, config) {
  if (!obterChave()) {
    console.log(chalk.yellow('• --ai ignorado: a variável ANTHROPIC_API_KEY não está definida.'));
    console.log(chalk.gray('  Usando as regras locais (grátis e offline).'));
    return null;
  }

  const { diff, removidos } = filtrarDiff(getStagedDiff());
  if (removidos.length > 0) {
    const mostra = removidos.slice(0, 4).join(', ');
    const fim = removidos.length > 4 ? '…' : '';
    console.log(chalk.gray(`  ${removidos.length} arquivo(s) fora do envio: ${mostra}${fim}`));
  }

  const { texto, truncado } = truncarDiff(diff);
  if (truncado) console.log(chalk.yellow('  Diff acima de 15 mil caracteres: truncado antes do envio.'));
  if (!texto.trim()) {
    console.log(chalk.yellow('  Nada sobrou depois da filtragem. Usando as regras locais.'));
    return null;
  }

  // Avisar ANTES de enviar, sempre — exceto quando quem mandou foi --yes.
  if (!opcoes.yes) {
    console.log('');
    console.log(chalk.yellow('⚠ O diff vai ser enviado para uma API externa (api.anthropic.com).'));
    console.log(chalk.gray('  Chaves, lockfiles e binários já foram removidos do conteúdo.'));
    const { confirmar } = await inquirer.prompt([
      { type: 'confirm', name: 'confirmar', message: 'Pode enviar o diff?', default: false },
    ]);
    if (!confirmar) {
      console.log(chalk.yellow('• Envio recusado. Usando as regras locais.'));
      return null;
    }
  }

  try {
    const resposta = limparResposta(
      await gerarMensagemComIA({ branch, diff: texto, idioma: config.idioma }),
    );
    if (!ehMensagemValida(resposta)) {
      console.log(chalk.yellow('• A IA devolveu uma mensagem fora do padrão. Usando as regras locais.'));
      return null;
    }
    return resposta;
  } catch (erro) {
    // Nunca imprimimos variáveis de ambiente aqui: só a mensagem do erro.
    console.log(chalk.yellow(`• IA indisponível: ${erro.message}. Usando as regras locais.`));
    return null;
  }
}

async function escolherAcao(mensagemSugerida) {
  console.log('');
  console.log(chalk.bold('Mensagem sugerida:'));
  console.log(`  ${chalk.cyan(mensagemSugerida)}`);
  console.log('');

  const { acao } = await inquirer.prompt([
    {
      type: 'list',
      name: 'acao',
      message: 'O que você quer fazer?',
      choices: [
        { name: 'Aceitar e commitar', value: 'aceitar' },
        { name: 'Editar a mensagem', value: 'editar' },
        { name: 'Cancelar', value: 'cancelar' },
      ],
    },
  ]);

  if (acao === 'cancelar') return null;
  if (acao === 'aceitar') return mensagemSugerida;

  // Editamos só a primeira linha (o assunto); um eventual corpo é mantido.
  const [assunto, ...corpo] = mensagemSugerida.split('\n');
  const { mensagem } = await inquirer.prompt([
    {
      type: 'input',
      name: 'mensagem',
      message: 'Edite o assunto do commit:',
      default: assunto,
      validate: (valor) => (valor.trim() ? true : 'A mensagem não pode ficar vazia.'),
    },
  ]);
  return [mensagem.trim(), ...corpo].join('\n');
}

export function comandoCommit() {
  const comando = new Command('commit');

  comando
    .description('Analisa o git diff --staged e sugere uma mensagem de commit.')
    .option('--dry-run', 'só mostra a mensagem, não commita')
    .option('--yes', 'aceita a sugestão sem perguntar')
    .option('--ai', 'usa a IA para gerar a mensagem (precisa de ANTHROPIC_API_KEY)')
    .addHelpText(
      'after',
      `
Exemplos:
  $ devkit commit --dry-run   só mostra a sugestão, não commita
  $ devkit commit --yes       aceita a sugestão e commita na hora
  $ devkit commit --ai        sugere pela IA (grátis para as regras locais)`,
    )
    .action(async (opcoes) => {
      try {
        const config = carregarConfig();
        if (config.aviso) console.log(chalk.yellow(`• ${config.aviso}`));

        if (!isGitInstalled()) {
          return falhar('Git não está instalado (ou não está no PATH). Instale em git-scm.com.');
        }
        if (!isGitRepo()) {
          return falhar('Esta pasta não é um repositório git. Rode `git init` primeiro.');
        }

        const arquivos = getStagedFiles();
        if (arquivos.length === 0) {
          return falhar(
            'Nada encontrado no stage. Rode `git add <arquivos>` antes de usar o devkit commit.',
          );
        }

        const branch = getCurrentBranch();

        let mensagem = null;
        let origem = 'regras locais';

        // --ai liga a IA; .devkitrc.json {"useAi": true} também liga.
        const usarIA = opcoes.ai || config.useAi;
        if (usarIA) {
          const gerada = await gerarComIA(arquivos, branch, opcoes, config);
          if (gerada) {
            mensagem = gerada;
            origem = 'IA';
          }
        }

        if (!mensagem) mensagem = gerarSugestao(arquivos, branch, config.idioma).message;

        if (opcoes.dryRun) {
          console.log(chalk.yellow('Dry-run: nada foi commitado.'));
          console.log(`  ${chalk.cyan(mensagem)}`);
          console.log(chalk.gray(`  (sugestão por ${origem})`));
          return;
        }

        console.log(chalk.gray(`Sugestão por ${origem}.`));

        // Com --yes pulamos o menu e usamos a sugestão direto.
        const mensagemFinal = opcoes.yes ? mensagem : await escolherAcao(mensagem);

        if (mensagemFinal === null) {
          console.log(chalk.yellow('Commit cancelado.'));
          return;
        }

        commit(mensagemFinal);
        console.log(chalk.green(`✔ Commit criado: ${mensagemFinal}`));
      } catch (erro) {
        falhar(erroDoGit(erro));
      }
    });

  return comando;
}
