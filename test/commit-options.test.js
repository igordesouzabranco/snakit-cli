import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { montarMensagemComOpcoes } from '../src/commands/commit.js';

describe('montarMensagemComOpcoes', () => {
  test('sobrescreve tipo', () => {
    assert.equal(montarMensagemComOpcoes('feat(app): adiciona x', { type: 'fix' }), 'fix(app): adiciona x');
  });

  test('sobrescreve escopo', () => {
    assert.equal(montarMensagemComOpcoes('feat: adiciona', { scope: 'api' }), 'feat(api): adiciona');
  });

  test('--message completo', () => {
    assert.equal(montarMensagemComOpcoes('feat: adiciona', { message: 'fix: corrige bug' }), 'fix: corrige bug');
  });

  test('--break adiciona !', () => {
    assert.ok(montarMensagemComOpcoes('feat: adiciona', { break: true }).includes('!'));
  });
});
