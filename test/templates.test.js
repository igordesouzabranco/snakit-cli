// test/templates.test.js
// Gera TODOS os templates em pastas temporárias e confere que o projeto
// sai sem placeholders sobrando. Casas para as correções de templates
// (Django, FastAPI, react-ts, codificação) que forem chegando.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listarTemplates, copiarTemplate, substituirPlaceholders } from '../src/utils/files.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporarias = [];

function pastaTemporaria(prefixo = 'snakit-templates-') {
  const pasta = mkdtempSync(path.join(tmpdir(), prefixo));
  temporarias.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of temporarias) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

/** Gera o template completo numa pasta nova e devolve o caminho. */
function gerarTemplate(valor, nome = 'meu-projeto') {
  const destino = path.join(pastaTemporaria(), nome);
  copiarTemplate(valor, destino);
  substituirPlaceholders(destino, { nome, nome_pacote: nome.replace(/[-.]/g, '_') });
  return destino;
}

/** Caminha todos os arquivos (caminhos relativos) da pasta. */
function listarTodosArquivos(dir, base = dir) {
  const encontrados = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) {
      encontrados.push(...listarTodosArquivos(caminho, base));
    } else {
      encontrados.push(path.relative(base, caminho));
    }
  }
  return encontrados;
}

describe('templates — placeholders', () => {
  test('nenhum template gerado contém {{ sobrando', () => {
    for (const { valor } of listarTemplates()) {
      const destino = gerarTemplate(valor);
      for (const relativo of listarTodosArquivos(destino)) {
        const conteudo = readFileSync(path.join(destino, relativo), 'utf8');
        assert.ok(
          !conteudo.includes('{{'),
          `template ${valor}: ${relativo} ainda tem placeholder`,
        );
      }
    }
  });

  test('substitui em .py, .toml, .sh, .sql, .cfg, .ini e .txt', () => {
    const pasta = pastaTemporaria();
    const arquivos = {
      'a.py': 'nome = "{{nome}}"\n',
      'b.toml': 'name = "{{nome}}"\n',
      'c.sh': 'echo "{{nome}}"\n',
      'd.sql': '-- {{nome}}\n',
      'e.cfg': '[meta]\nname={{nome}}\n',
      'f.ini': 'nome={{nome}}\n',
      'g.txt': '{{nome}}\n',
    };
    for (const [arquivo, conteudo] of Object.entries(arquivos)) {
      writeFileSync(path.join(pasta, arquivo), conteudo);
    }

    substituirPlaceholders(pasta, { nome: 'loja' });

    for (const arquivo of Object.keys(arquivos)) {
      const texto = readFileSync(path.join(pasta, arquivo), 'utf8');
      assert.ok(!texto.includes('{{'), `${arquivo} ainda tem placeholder`);
    }
  });

  test('processa arquivo sem extensão conhecida se for texto (.gitignore, .env.example)', () => {
    const pasta = pastaTemporaria();
    writeFileSync(path.join(pasta, '.gitignore'), 'dist/ # {{nome}}\n');
    writeFileSync(path.join(pasta, '.env.example'), 'CHAVE={{nome}}\n');

    substituirPlaceholders(pasta, { nome: 'loja' });

    assert.equal(readFileSync(path.join(pasta, '.gitignore'), 'utf8'), 'dist/ # loja\n');
    assert.equal(readFileSync(path.join(pasta, '.env.example'), 'utf8'), 'CHAVE=loja\n');
  });

  test('não mexe em binário mesmo com extensão desconhecida', () => {
    const pasta = pastaTemporaria();
    const bytes = Buffer.from([0x00, 0x7b, 0x7b, 0x6e, 0x6f, 0x6d, 0x65, 0x7d, 0x7d]);
    writeFileSync(path.join(pasta, 'dados.bin'), bytes);

    substituirPlaceholders(pasta, { nome: 'loja' });

    assert.deepEqual(readFileSync(path.join(pasta, 'dados.bin')), bytes);
  });

  test('renomeia pasta com placeholder ({{nome_pacote}} → meu_app)', () => {
    const pasta = pastaTemporaria();
    const dentro = path.join(pasta, '{{nome_pacote}}', 'sub');
    mkdirSync(dentro, { recursive: true });
    writeFileSync(path.join(pasta, '{{nome_pacote}}', '__init__.py'), '');
    writeFileSync(path.join(dentro, 'x.py'), '# {{nome_pacote}}\n');

    substituirPlaceholders(pasta, { nome: 'meu-app', nome_pacote: 'meu_app' });

    assert.ok(existsSync(path.join(pasta, 'meu_app', '__init__.py')));
    assert.ok(existsSync(path.join(pasta, 'meu_app', 'sub', 'x.py')));
    assert.equal(readFileSync(path.join(pasta, 'meu_app', 'sub', 'x.py'), 'utf8'), '# meu_app\n');
  });
});

describe('templates — raiz', () => {
  test('pasta de template não fica com pastas {{ }} depois de gerar', () => {
    const destino = gerarTemplate('node-puro');
    for (const relativo of listarTodosArquivos(destino)) {
      assert.ok(!relativo.includes('{{'), `caminho com placeholder: ${relativo}`);
    }
  });

  test('RAIZ dos templates existe para os testes de codificação', () => {
    assert.ok(existsSync(path.join(RAIZ, 'src', 'templates')));
  });
});
