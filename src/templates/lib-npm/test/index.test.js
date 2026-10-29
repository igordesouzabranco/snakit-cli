import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hello } from './src/index.js';

test('hello', () => {
  assert.equal(hello(), 'Hello from {{nome}}');
});
