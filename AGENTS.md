# AGENTS.md

Guia para agentes que trabalham neste repositório.

## O que é

`snakit` — CLI Node.js publicada no npm, com dois comandos:

- `snakit new <nome>` — scaffolder com 3 templates (`express-mvc`, `react`, `node-puro`)
- `snakit commit` — sugere mensagem Conventional Commits a partir do `git diff --staged`, por regras locais ou com IA opcional (`--ai`)

Repositório: <https://github.com/igordesouzabranco/snakit-cli> · npm: <https://www.npmjs.com/package/snakit>

## Stack e restrições

- Node 18+ (testado em v24.18.1), **ES Modules** (`"type": "module"`)
- Dependências: apenas `commander`, `inquirer`, `chalk`
- IA é opcional e **não** está em `dependencies` — import dinâmico com queda para `fetch` nativo (`ANTHROPIC_API_KEY` lida só de variável de ambiente)
- Sem TypeScript. Testes exclusivamente com `node:test` / `node:assert`
- Interface e documentação em **pt-BR**; a opção `idioma` de `.snakitrc.json` afeta **só** a mensagem de commit (`pt` | `en`)
- Não ampliar o escopo sem perguntar

## Comandos

```bash
npm test        # node --test (104 testes)
npm link        # expõe `snakit` no PATH durante o desenvolvimento
npm pack        # gera o .tgz para testar a instalação real
npm pkg fix     # normaliza package.json (ver "Armadilhas" abaixo)
```

Só `bin/`, `src/`, `package.json`, `README.md` e `LICENSE` vão ao ar (`files` no package.json). `test/` fica de fora.

## Estrutura

```
bin/snakit.js              ponto de entrada (shebang + commander)
src/commands/new.js        scaffolder
src/commands/commit.js     gerador de mensagem
src/templates/<nome>/      templates copiados pelo `new`
src/utils/git.js           camada de execução do git
src/utils/files.js         validação de nome + cópia de template
src/utils/rules.js         regras de commit + TEXTOS pt/en
src/utils/ai.js            chamada opcional à IA
src/utils/config.js        leitura/escrita de .snakitrc.json
test/*.test.js             suite com node:test
```

Convenções: comentários em pt-BR e curtos; mensagens de commit geradas pelo próprio `snakit commit` (formato `tipo(escopo): resumo`).

## Armadilhas conhecidas

- **Encoding**: o PowerShell 5.1 lê UTF-8 como ANSI e mostra acentos errados. Nunca concluir que o arquivo está corrogado por causa do `Get-Content` — conferir com `node -e "..."` usando `codePointAt(0)`.
- **TTY obrigatório**: `snakit new` abre menu do `inquirer`; em shell sem terminal (pipe, CI) quebra com `ERR_USE_AFTER_CLOSE` e exit 13. Não é bug do pacote.
- **`npm publish`**: o registry cria um `0.0.0-stage` (placeholder) e retém a versão real até a revisão — leva minutos. Sinal de sucesso é o `202` + "being processed", não a presença imediata da versão.
- **Aviso falso do npm**: `"bin[snakit]" script name ... was invalid and removed` aparece em todo publish. É bug de redação do npm — ele só normaliza `./bin/snakit.js` → `bin/snakit.js` e mantém o campo. Rode `npm pkg fix` para não vê-lo mais.
- **YAML no frontmatter**: valor de `description` com `: ` (dois-pontos + espaço) sem aspas quebra o parse e o opencode **descarta a skill em silêncio**. Sempre entre aspas simples.

## Publicação

Versão segue semver (`MAJOR.MINOR.PATCH`). Fluxo:

```bash
npm version patch    # ou minor/major
npm publish          # exige npm login + 2FA
```
