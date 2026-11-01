// test/react-ts-slow.test.js
// Fumaça lenta do template react-ts: gera o projeto com a CLI, instala as
// dependências e roda `npm run build`. Precisa de internet, por isso só
// roda quando SNAKIT_SLOW_TESTS=1 (teste opt-in, nunca puxa rede por padrão).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pastaTemporaria, limparPastasTemporarias } from './helpers/git.js';

// O `snakit new` roda git init + commit dentro do projeto gerado: em CI não
// há identidade de git, então definimos a nossa antes (hermético).
process.env.GIT_AUTHOR_NAME = 'CI';
process.env.GIT_AUTHOR_EMAIL = 'ci@snakit.dev';
process.env.GIT_COMMITTER_NAME = 'CI';
process.env.GIT_COMMITTER_EMAIL = 'ci@snakit.dev';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RODAR = process.env.SNAKIT_SLOW_TESTS === '1';

after(limparPastasTemporarias);

describe('react-ts — fumaça lenta (SNAKIT_SLOW_TESTS=1)', () => {
  test(
    'snakit new gera o projeto e `npm run build` passa',
    { skip: RODAR ? false : 'pulado: defina SNAKIT_SLOW_TESTS=1 para rodar (usa internet)' },
    () => {
      const raiz = pastaTemporaria('snakit-slow-');

      execFileSync(
        process.execPath,
        [path.join(RAIZ, 'bin', 'snakit.js'), 'new', 'x', '--template', 'react-ts', '--yes', '--no-install'],
        { cwd: raiz, stdio: 'pipe' },
      );

      const projeto = path.join(raiz, 'x');
      for (const arquivo of ['package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'src/main.tsx', 'src/App.tsx']) {
        assert.ok(existsSync(path.join(projeto, arquivo)), `falta ${arquivo}`);
      }

      // shell: true no Windows porque o npm é um arquivo .cmd.
      execFileSync('npm', ['install'], { cwd: projeto, stdio: 'pipe', timeout: 300_000, shell: true });
      execFileSync('npm', ['run', 'build'], { cwd: projeto, stdio: 'pipe', timeout: 300_000, shell: true });
      execFileSync('npm', ['test'], { cwd: projeto, stdio: 'pipe', timeout: 300_000, shell: true });
    },
  );
});
