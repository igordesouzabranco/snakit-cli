// test/templates.test.js
// Gera TODOS os templates em pastas temporárias e confere que o projeto
// sai sem placeholders sobrando. Casas para as correções de templates
// (Django, FastAPI, react-ts, codificação) que forem chegando.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

/** Diz se há algum python utilizável no PATH. */
function pythonDisponivel() {
  for (const py of ['python3', 'python']) {
    try {
      execFileSync(py, ['--version'], { stdio: 'pipe' });
      return true;
    } catch { /* tenta o próximo nome */ }
  }
  return false;
}

/** Compila todos os .py de uma pasta com python -m py_compile. */
function compilarPython(dir) {
  const pythons = ['python3', 'python'];
  const arquivosPy = listarTodosArquivos(dir)
    .filter((a) => a.endsWith('.py'))
    .map((a) => path.join(dir, a));
  if (arquivosPy.length === 0) return;

  for (const py of pythons) {
    try {
      execFileSync(py, ['-m', 'py_compile', ...arquivosPy], { stdio: 'pipe' });
      return;
    } catch { /* tenta o próximo nome */ }
  }
  assert.fail('nenhum python conseguiu compilar os arquivos de ' + dir);
}

describe('templates — Django', () => {
  test('gera estrutura completa que roda, com nome de pacote normalizado', () => {
    const destino = gerarTemplate('django', 'meu-app');
    const pacote = path.join(destino, 'meu_app');

    for (const arquivo of ['manage.py', 'requirements.txt', 'README.md']) {
      assert.ok(existsSync(path.join(destino, arquivo)), `falta ${arquivo}`);
    }
    for (const arquivo of ['__init__.py', 'settings.py', 'urls.py', 'wsgi.py', 'asgi.py']) {
      assert.ok(existsSync(path.join(pacote, arquivo)), `falta meu_app/${arquivo}`);
    }

    const settings = readFileSync(path.join(pacote, 'settings.py'), 'utf8');
    assert.ok(settings.includes('SECRET_KEY'), 'settings deve ler SECRET_KEY');
    assert.ok(settings.includes('DJANGO_SECRET_KEY'), 'SECRET_KEY deve vir de variável de ambiente');
    assert.ok(settings.includes("'meu_app'") || settings.includes('"meu_app"') || settings.includes('meu_app.'), 'settings deve referenciar o pacote normalizado');

    const urls = readFileSync(path.join(pacote, 'urls.py'), 'utf8');
    assert.match(urls, /mensagem/);
    assert.match(urls, /Projeto meu-app no ar/);

    const manage = readFileSync(path.join(destino, 'manage.py'), 'utf8');
    assert.ok(manage.includes('meu_app.settings'));

    const requirements = readFileSync(path.join(destino, 'requirements.txt'), 'utf8');
    assert.match(requirements, /Django>=\d/);

    if (pythonDisponivel()) compilarPython(destino);
  });

  test("catálogo declara instalação 'nenhum' e comandos Python nos próximos passos", () => {
    for (const item of listarTemplates()) {
      if (item.valor === 'django' || item.valor === 'fastapi') {
        assert.equal(item.passoInstalacao, 'nenhum', `${item.valor} não deve instalar com npm`);
        assert.ok(Array.isArray(item.proximosPassos), `${item.valor} deve ter proximosPassos`);
        assert.ok(item.proximosPassos.some((c) => c.startsWith('pip install')), `${item.valor} deve sugerir pip install`);
        assert.ok(!item.proximosPassos.some((c) => c.includes('npm')), `${item.valor} não deve sugerir npm`);
      }
    }
  });
});

describe('templates — FastAPI', () => {
  test('gera app com / e /saude, requirements com faixa e README', () => {
    const destino = gerarTemplate('fastapi', 'minha-api');

    for (const arquivo of ['app/__init__.py', 'app/main.py', 'requirements.txt', 'README.md']) {
      assert.ok(existsSync(path.join(destino, arquivo)), `falta ${arquivo}`);
    }

    const main = readFileSync(path.join(destino, 'app', 'main.py'), 'utf8');
    assert.match(main, /@app\.get\('\/'\)/);
    assert.match(main, /@app\.get\('\/saude'\)/);

    const requirements = readFileSync(path.join(destino, 'requirements.txt'), 'utf8');
    assert.match(requirements, /fastapi>=/);
    assert.match(requirements, /uvicorn\[standard\]>=/);
    assert.ok(requirements.endsWith('\n'), 'requirements.txt deve terminar com quebra de linha');

    const readme = readFileSync(path.join(destino, 'README.md'), 'utf8');
    assert.ok(readme.includes('uvicorn app.main:app --reload'));

    if (pythonDisponivel()) compilarPython(destino);
  });
});

describe('templates — react-ts', () => {
  test('gera arquivos completos de Vite + TypeScript', () => {
    const destino = gerarTemplate('react-ts', 'meu-front');

    for (const arquivo of [
      'package.json', 'index.html', 'vite.config.ts',
      'tsconfig.json', 'tsconfig.node.json',
      'src/main.tsx', 'src/App.tsx', 'src/vite-env.d.ts', 'src/App.test.tsx',
    ]) {
      assert.ok(existsSync(path.join(destino, arquivo)), `falta ${arquivo}`);
    }

    const pacote = JSON.parse(readFileSync(path.join(destino, 'package.json'), 'utf8'));
    assert.equal(pacote.main, undefined, 'package.json não deve ter "main"');
    assert.equal(pacote.private, true);
    assert.equal(pacote.type, 'module');
    assert.equal(pacote.scripts.build, 'tsc && vite build');
    assert.ok(pacote.scripts.start && pacote.scripts.dev && pacote.scripts.preview && pacote.scripts.test);
    assert.ok(pacote.devDependencies?.vitest, 'vitest deve estar nas devDependencies');
    assert.ok(pacote.devDependencies?.typescript, 'typescript deve estar nas devDependencies');

    const viteConfig = readFileSync(path.join(destino, 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes('@vitejs/plugin-react'));
  });
});
