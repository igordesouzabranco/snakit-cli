// test/ai.test.js
// Testa montagem do prompt, filtragem de arquivos e validação da resposta.
// NENHUM teste daqui chama a API — nada aqui gasta dinheiro.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  ehArquivoExcluido,
  filtrarDiff,
  truncarDiff,
  montarPrompt,
  ehMensagemValida,
  limparResposta,
  obterChave,
  obterModelo,
} from '../src/utils/ai.js';

after(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.DEVKIT_MODEL;
});

describe('ehArquivoExcluido — o que NUNCA sai da máquina', () => {
  test('arquivos de ambiente', () => {
    for (const caminho of ['.env', '.env.local', '.env.production', 'api/.env']) {
      assert.equal(ehArquivoExcluido(caminho), true, `esperava excluir ${caminho}`);
    }
  });

  test('chaves privadas', () => {
    assert.equal(ehArquivoExcluido('certs/servidor.pem'), true);
    assert.equal(ehArquivoExcluido('id_rsa.key'), true);
  });

  test('lockfiles', () => {
    for (const caminho of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'go.sum']) {
      assert.equal(ehArquivoExcluido(caminho), true, `esperava excluir ${caminho}`);
    }
  });

  test('binários', () => {
    for (const caminho of ['logo.png', 'foto.JPG', 'fonte.woff2', 'app.exe', 'banco.db']) {
      assert.equal(ehArquivoExcluido(caminho), true, `esperava excluir ${caminho}`);
    }
  });

  test('dependências', () => {
    assert.equal(ehArquivoExcluido('node_modules/express/index.js'), true);
  });

  test('código e documentação normais passam', () => {
    for (const caminho of ['src/app.js', 'README.md', 'index.html', 'styles.css', 'Dockerfile']) {
      assert.equal(ehArquivoExcluido(caminho), false, `esperava manter ${caminho}`);
    }
  });

  test('nomes que só parecem .env continuam', () => {
    assert.equal(ehArquivoExcluido('environment.js'), false);
    assert.equal(ehArquivoExcluido('src/keygen.js'), false);
  });
});

describe('filtrarDiff', () => {
  const diff = [
    'diff --git a/src/app.js b/src/app.js',
    'index 111..222 100644',
    '--- a/src/app.js',
    '+++ b/src/app.js',
    '@@ -1 +1 @@',
    '-antes',
    '+depois',
    'diff --git a/.env b/.env',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/.env',
    '@@ -0,0 +1 @@',
    '+CHAVE_SECRETA=abc',
    'diff --git a/README.md b/README.md',
    'index 333..444 100644',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1 +1 @@',
    '-# velho',
    '+# novo',
    '',
  ].join('\n');

  test('remove só o arquivo proibido', () => {
    const resultado = filtrarDiff(diff);

    assert.equal(resultado.diff.includes('.env'), false);
    assert.equal(resultado.diff.includes('CHAVE_SECRETA'), false);
    assert.equal(resultado.diff.includes('src/app.js'), true);
    assert.equal(resultado.diff.includes('README.md'), true);
    assert.deepEqual(resultado.removidos, ['.env']);
  });

  test('mantém o resto do texto intacto', () => {
    const { diff: filtrado, removidos } = filtrarDiff(diff);
    assert.equal(filtrado, diff.replace(/diff --git a\/\.env b\/\.env[\s\S]*?(?=diff --git)/, ''));
    assert.equal(removidos.length, 1);
  });

  test('caminho com espaços continua reconhecido', () => {
    const comEspaco = [
      'diff --git a/meu arquivo.js b/meu arquivo.js',
      '+linha',
      '',
    ].join('\n');
    const { removidos } = filtrarDiff(comEspaco);
    assert.deepEqual(removidos, []);
  });

  test('diff vazio não quebra', () => {
    assert.deepEqual(filtrarDiff(''), { diff: '', removidos: [] });
    assert.deepEqual(filtrarDiff(undefined), { diff: '', removidos: [] });
  });
});

describe('truncarDiff', () => {
  test('texto curto passa direto', () => {
    assert.deepEqual(truncarDiff('abc'), { texto: 'abc', truncado: false });
  });

  test('texto grande é cortado e marcado', () => {
    const grande = 'x'.repeat(20000);
    const resultado = truncarDiff(grande, 100);
    assert.equal(resultado.truncado, true);
    assert.ok(resultado.texto.length < 2000);
    assert.ok(resultado.texto.includes('truncado'));
  });

  test('respeita o limite padrão de 15 mil', () => {
    const grande = 'y'.repeat(15001);
    assert.equal(truncarDiff(grande).truncado, true);
    assert.equal(truncarDiff('y'.repeat(15000)).truncado, false);
  });
});

describe('montarPrompt', () => {
  const prompt = montarPrompt({ branch: 'fix/login', diff: '+novo codigo' });

  test('inclui a branch atual', () => {
    assert.ok(prompt.includes('Branch atual: fix/login'));
  });

  test('inclui o diff', () => {
    assert.ok(prompt.includes('+novo codigo'));
  });

  test('pede UMA mensagem só', () => {
    assert.ok(prompt.includes('UMA única mensagem'));
  });

  test('pede português, imperativo e no máximo 72 caracteres', () => {
    //toLowerCase: a regra pode aparecer no início de linha ("Imperativo...")
    //e String.includes não ignora maiúsculas.
    const baixo = prompt.toLowerCase();
    assert.ok(baixo.includes('português'));
    assert.ok(baixo.includes('imperativo'));
    assert.ok(baixo.includes('72 caracteres'));
  });

  test('lista os tipos do Conventional Commits', () => {
    for (const tipo of ['feat', 'fix', 'docs', 'refactor', 'chore', 'test']) {
      assert.ok(prompt.includes(tipo), `prompt deveria citar ${tipo}`);
    }
  });

  test('branch desconhecida não deixa o prompt malformado', () => {
    const semBranch = montarPrompt({ branch: '', diff: 'x' });
    assert.ok(semBranch.includes('(desconhecida)'));
  });
});

describe('ehMensagemValida', () => {
  test('aceita o formato pedido', () => {
    for (const msg of [
      'feat: adiciona carrinho',
      'fix(controllers): corrige validação',
      'chore: estrutura inicial Express MVC',
      'test: cobre o cálculo de frete',
      'refactor: extrai serviço de e-mail',
    ]) {
      assert.equal(ehMensagemValida(msg), true, `esperava aceitar "${msg}"`);
    }
  });

  test('aceita mensagem com corpo', () => {
    assert.equal(ehMensagemValida('feat: adiciona carrinho\n\nCorpo explicando o porquê.'), true);
  });

  test('rejeita texto solto', () => {
    assert.equal(ehMensagemValida('mexi em umas coisas'), false);
  });

  test('rejeita tipo desconhecido', () => {
    assert.equal(ehMensagemValida('banana: algo aqui'), false);
  });

  test('rejeita espaço faltando depois dos dois-pontos', () => {
    assert.equal(ehMensagemValida('feat:algo aqui'), false);
  });

  test('rejeita vazio e undefined', () => {
    assert.equal(ehMensagemValida(''), false);
    assert.equal(ehMensagemValida(undefined), false);
  });
});

describe('limparResposta', () => {
  test('remove cercas de código', () => {
    assert.equal(limparResposta('```commit\nfeat: algo\n```'), 'feat: algo');
    assert.equal(limparResposta('```\nfix: erro\n```'), 'fix: erro');
  });

  test('mensagem limpa passa inalterada', () => {
    assert.equal(limparResposta('feat: algo'), 'feat: algo');
  });
});

describe('configuração por variável de ambiente', () => {
  test('sem ANTHROPIC_API_KEY não há chave', () => {
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(obterChave(), null);
  });

  test('chave vem da variável de ambiente, nunca do código', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-teste';
    assert.equal(obterChave(), 'sk-ant-teste');
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('DEVKIT_MODEL sobrescreve o modelo padrão', () => {
    delete process.env.DEVKIT_MODEL;
    assert.equal(obterModelo(), 'claude-haiku-5-5');
    process.env.DEVKIT_MODEL = 'claude-sonnet-5-5';
    assert.equal(obterModelo(), 'claude-sonnet-5-5');
    delete process.env.DEVKIT_MODEL;
  });
});
