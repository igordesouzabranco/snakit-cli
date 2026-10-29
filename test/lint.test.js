import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function ehMensagemValida(mensagem) {
  const primeira = String(mensagem ?? '').split('\n')[0].trim();
  return /^([a-z]+)(\([^)]+\))?: \S.*$/.test(primeira);
}

describe('lint — validação básica', () => {
  test('mensagem válida', () => {
    assert.equal(ehMensagemValida('feat(app): adiciona user'), true);
  });

  test('mensagem inválida', () => {
    assert.equal(ehMensagemValida('texto solto'), false);
  });

  test('formato com escopo', () => {
    assert.equal(ehMensagemValida('fix(api): corrige endpoint'), true);
  });

  test('break change com !', () => {
    assert.equal(ehMensagemValida('feat!: remove api antiga'), false); // ! não faz parte do tipo
  });
});
