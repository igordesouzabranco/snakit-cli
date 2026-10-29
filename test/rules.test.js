// test/rules.test.js
// Testa as regras puras de sugestão de commit.
// Roda com: npm test  (que chama node --test)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  descobrirTipo,
  descobrirEscopo,
  criarDescricao,
  montarMensagem,
  gerarSugestao,
} from '../src/utils/rules.js';

// Atalhos para montar os arquivos que o git devolveria.
const novo = (file) => ({ status: 'A', file });
const alterado = (file) => ({ status: 'M', file });
const removido = (file) => ({ status: 'D', file });

describe('descobrirTipo — regra 1: arquivos de teste', () => {
  test('só .test.js vira test', () => {
    assert.equal(descobrirTipo([novo('src/user.test.js')]), 'test');
  });

  test('só .spec.js vira test', () => {
    assert.equal(descobrirTipo([alterado('src/user.spec.js')]), 'test');
  });

  test('teste junto com código NÃO é test (regra exige que só tenha teste)', () => {
    assert.equal(descobrirTipo([novo('src/app.js'), novo('src/app.test.js')]), 'feat');
  });
});

describe('descobrirTipo — regra 2: documentação', () => {
  test('README vira docs', () => {
    assert.equal(descobrirTipo([alterado('README.md')]), 'docs');
  });

  test('qualquer .md vira docs', () => {
    assert.equal(descobrirTipo([novo('docs/guia.md')]), 'docs');
  });

  test('pasta docs/ vira docs mesmo sem extensão .md', () => {
    assert.equal(descobrirTipo([alterado('docs/imagem.png')]), 'docs');
  });
});

describe('descobrirTipo — regra 3: configurações', () => {
  test('package.json vira chore', () => {
    assert.equal(descobrirTipo([alterado('package.json')]), 'chore');
  });

  test('package-lock.json vira chore', () => {
    assert.equal(descobrirTipo([alterado('package-lock.json')]), 'chore');
  });

  test('.gitignore vira chore', () => {
    assert.equal(descobrirTipo([alterado('.gitignore')]), 'chore');
  });

  test('arquivo de configuração do Vite vira chore', () => {
    assert.equal(descobrirTipo([alterado('vite.config.js')]), 'chore');
  });
});

describe('descobrirTipo — regra 4: só removidos', () => {
  test('todos removidos vira refactor', () => {
    assert.equal(descobrirTipo([removido('src/velho.js')]), 'refactor');
  });

  test('todos removidos em várias pastas continua refactor', () => {
    assert.equal(descobrirTipo([removido('src/a.js'), removido('test/b.js')]), 'refactor');
  });
});

describe('descobrirTipo — regra 5: fix', () => {
  test('branch com "fix" vira fix', () => {
    assert.equal(descobrirTipo([alterado('src/app.js')], 'fix/login'), 'fix');
  });

  test('caminho com "fix" como palavra inteira vira fix', () => {
    assert.equal(descobrirTipo([alterado('src/fix-bug.js')], 'master'), 'fix');
  });

  test('branch com "fix" mas só docs respeita a ordem e fica docs', () => {
    assert.equal(descobrirTipo([alterado('docs/x.md')], 'fix/erro'), 'docs');
  });
});

describe('descobrirTipo — regra 6: fallback', () => {
  test('arquivo novo vira feat', () => {
    assert.equal(descobrirTipo([novo('src/novo.js')]), 'feat');
  });

  test('arquivo alterado sem nada especial vira refactor', () => {
    assert.equal(descobrirTipo([alterado('src/app.js')], 'master'), 'refactor');
  });

  test('mistura de novo e alterado vira feat (tem arquivo novo)', () => {
    assert.equal(descobrirTipo([novo('src/a.js'), alterado('src/b.js')], 'master'), 'feat');
  });

  test('lista vazia não quebra', () => {
    assert.equal(descobrirTipo([]), 'chore');
  });
});

describe('descobrirEscopo', () => {
  test('pasta única vira escopo', () => {
    assert.equal(descobrirEscopo([novo('controllers/user.js')]), 'controllers');
  });

  test('duas pastas diferentes não geram escopo', () => {
    assert.equal(descobrirEscopo([novo('controllers/a.js'), novo('models/b.js')]), '');
  });

  test('arquivo na raiz não gera escopo', () => {
    assert.equal(descobrirEscopo([alterado('index.js')]), '');
  });

  test('raiz misturada com subpasta não gera escopo', () => {
    assert.equal(descobrirEscopo([alterado('README.md'), novo('src/a.js')]), '');
  });

  test('usa só a primeira pasta, mesmo aninhada', () => {
    assert.equal(descobrirEscopo([novo('src/utils/ajuda.js')]), 'src');
  });

  test('lista vazia não gera escopo', () => {
    assert.equal(descobrirEscopo([]), '');
  });
});

describe('criarDescricao — verbo no imperativo', () => {
  test('feat usa "adiciona"', () => {
    assert.equal(criarDescricao([novo('src/userController.js')], 'feat'), 'adiciona userController');
  });

  test('fix usa "corrige"', () => {
    assert.equal(criarDescricao([alterado('src/app.js')], 'fix'), 'corrige app');
  });

  test('refactor com remoção usa "remove"', () => {
    assert.equal(criarDescricao([removido('src/velho.js')], 'refactor'), 'remove velho');
  });

  test('docs modificado usa "atualiza"', () => {
    assert.equal(criarDescricao([alterado('README.md')], 'docs'), 'atualiza README');
  });

  test('docs novo usa "adiciona"', () => {
    assert.equal(criarDescricao([novo('docs/guia.md')], 'docs'), 'adiciona guia');
  });

  test('tira o sufixo .test.js do nome', () => {
    assert.equal(criarDescricao([novo('src/user.test.js')], 'test'), 'adiciona user');
  });

  test('vários arquivos viram contagem', () => {
    assert.equal(criarDescricao([novo('a.js'), alterado('b.js')], 'feat'), 'adiciona 2 arquivos');
  });

  test('remoção em massa usa "remove" com contagem', () => {
    assert.equal(criarDescricao([removido('a.js'), removido('b.js')], 'refactor'), 'remove 2 arquivos');
  });

  test('lista vazia não gera descrição', () => {
    assert.equal(criarDescricao([], 'feat'), '');
  });
});

describe('montarMensagem', () => {
  test('com escopo', () => {
    assert.equal(
      montarMensagem({ type: 'feat', scope: 'controllers', description: 'adiciona user' }),
      'feat(controllers): adiciona user',
    );
  });

  test('sem escopo', () => {
    assert.equal(
      montarMensagem({ type: 'chore', scope: '', description: 'estrutura inicial React' }),
      'chore: estrutura inicial React',
    );
  });
});

describe('idioma en — verbos trocam, formato continua Conventional Commits', () => {
  test('feat vira "add"', () => {
    assert.equal(
      gerarSugestao([novo('src/carrinho.js')], 'main', 'en').message,
      'feat(src): add carrinho',
    );
  });

  test('fix vira "fix"', () => {
    assert.equal(
      gerarSugestao([alterado('src/login.js')], 'fix/login', 'en').message,
      'fix(src): fix login',
    );
  });

  test('remoção vira "remove" e o plural vira "files"', () => {
    assert.equal(
      gerarSugestao([removido('src/a.js'), removido('src/b.js')], 'main', 'en').message,
      'refactor(src): remove 2 files',
    );
  });

  test('docs modificado vira "update"', () => {
    assert.equal(
      gerarSugestao([alterado('README.md')], 'main', 'en').message,
      'docs: update README',
    );
  });

  test('pt-BR é o padrão quando o idioma não é informado', () => {
    assert.equal(gerarSugestao([novo('src/carrinho.js')], 'main').message, 'feat(src): adiciona carrinho');
  });

  test('idioma desconhecido cai no português em vez de quebrar', () => {
    assert.equal(
      gerarSugestao([novo('src/carrinho.js')], 'main', 'xx').message,
      'feat(src): adiciona carrinho',
    );
  });
});

describe('gerarSugestao — ponta a ponta', () => {
  test('junta tipo, escopo e descrição', () => {
    assert.deepEqual(gerarSugestao([novo('controllers/user.js')], 'master'), {
      type: 'feat',
      scope: 'controllers',
      description: 'adiciona user',
      message: 'feat(controllers): adiciona user',
    });
  });

  test('caso do enunciado: só teste vira test', () => {
    assert.equal(gerarSugestao([alterado('src/calculo.spec.js')], 'main').message, 'test(src): atualiza calculo');
  });

  test('caso do enunciado: branch fix', () => {
    assert.equal(gerarSugestao([alterado('src/login.js')], 'fix/login').message, 'fix(src): corrige login');
  });
});
