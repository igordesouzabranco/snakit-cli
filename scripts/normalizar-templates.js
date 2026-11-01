// scripts/normalizar-templates.js
// Normaliza a codificação de todos os arquivos de src/templates/:
// remove o BOM (EF BB BF), troca CRLF por LF e garante linha final vazia.
// Uso: node scripts/normalizar-templates.js

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'templates');
let alterados = 0;

function caminhar(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) {
      caminhar(caminho);
      continue;
    }
    const bruto = readFileSync(caminho);
    let texto = bruto.toString('utf8');
    const comBOM = bruto[0] === 0xef && bruto[1] === 0xbb && bruto[2] === 0xbf;
    if (comBOM) texto = texto.slice(1);
    const normalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n*$/, '\n');
    const final = Buffer.from(normalizado, 'utf8');
    if (comBOM || !final.equals(bruto)) {
      writeFileSync(caminho, final);
      alterados += 1;
      console.log('normalizado:', path.relative(RAIZ, caminho));
    }
  }
}

caminhar(RAIZ);
console.log(`${alterados} arquivo(s) normalizado(s).`);
