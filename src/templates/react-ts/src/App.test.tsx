// Teste simples do projeto {{nome}} — roda com `npm test` (vitest).
import { describe, expect, test } from 'vitest';
import App from './App';

describe('App', () => {
  test('é um componente React', () => {
    expect(typeof App).toBe('function');
  });

  test('renderiza a raiz <main> (sem DOM: só o elemento)', () => {
    const elemento = App();
    expect(elemento.type).toBe('main');
  });
});
