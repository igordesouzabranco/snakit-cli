# snakit

CLI com **scaffolder de projetos** e **gerador de mensagens de commit** no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/).

Dois comandos, nada de mágica:

| Comando | O que faz |
| --- | --- |
| `snakit new <nome>` | Cria projeto (9 templates). `--template`, `--yes`, `--pm`, `--ts`, `--no-install`, `--no-git`. |
| `snakit commit` | Sugere mensagem. `--dry-run`, `--yes`, `--all`, `--push`, `--type`, `--scope`, `-m`, `--message`, `--break`, `--ai`, `--allow-send`. |
| `snakit hook` | `install` / `uninstall` / `status` (`--ai`). |
| `snakit lint` | Valida mensagem. `[mensagem]`, `--from`, `--to`. |
| `snakit changelog` | Gera `CHANGELOG.md`. `--from`, `--to`, `--dry-run`, `--stdout`. |
| `snakit release` | Bump (`patch/minor/major`), `--dry-run` padrão. |
| `snakit undo` | `git reset --soft HEAD~1`. |
| `snakit amend` | Reescreve mensagem do último commit. |
| `snakit add <recurso>` | Adiciona recurso (`eslint`, `prettier`, `vitest`, `docker`, `ci`, `husky`, `env`, `license`). `--list`. |
| `snakit generate` | Gera arquivo MVC (`controller`, `model`, `route`, `resource <nome>`). |
| `snakit templates` | `list`, `add <repo> <nome>`, `remove <nome>`. |
| `snakit config` | `get`, `set`, `list`, `path`. |
| `snakit init` | Cria `.snakitrc.json` comentado. |
| `snakit doctor` | Verifica ambiente e configuração. |
| `snakit pr` | Gera título/descrição PR (`--base`, `--ai`, `--copy`). |
| `snakit check` | Revisão local (`--fix`). |
| `snakit readme` | Gera `README.md` (`--force`). |
| `snakit stats` | Estatísticas (`--since`, `--until`, `--output json`). |
| `snakit branch <desc>` | Sugere nome `tipo/descricao-kebab`. |

**O `snakit commit` funciona offline e de graça.** O `snakit new` precisa de internet apenas para o `npm install` (use `--no-install` para evitar). A IA é opcional e só roda se você pedir com `--ai`.

---

## Requisitos

- Node.js **18 ou superior**
- Git instalado (para o `git init` e para o `snakit commit`)

## Instalação

```bash
# sem instalar nada, direto no projeto
npx snakit new minha-loja

# instalar globalmente
npm install -g snakit

# clonando o repositório (para contribuir)
git clone https://github.com/igordesouzabranco/snakit-cli.git
cd snakit-cli
npm install
npm link          # o comando `snakit` passa a apontar para a sua cópia
```

## `snakit new <nome>`

Pergunta qual template usar, copia a pasta, troca os `{{nome}}` pelos valores reais e, por padrão, roda `git init` → `npm install` → primeiro commit.

O `npm install` precisa de conexão com a internet; use `--no-install` para montar só a estrutura, sem baixar dependências.

```bash
snakit new minha-loja
snakit new minha-loja --no-install   # não roda npm install
snakit new minha-loja --no-git       # não roda git init nem o primeiro commit
snakit new minha-loja --no-install --no-git   # só monta a estrutura
```

### Templates inclusos

| Template | Estrutura |
| --- | --- |
| **Express MVC** | `app.js`, `controllers/`, `models/`, `routes/`, `package.json` |
| **Express + TypeScript** | MVC com `ts-node`, `tsc`, `src/app.ts` |
| **React** | Vite mínimo |
| **React + TypeScript** | Vite + TypeScript |
| **Node puro** | `index.js` + `package.json` |
| **FastAPI** | Python: `app/main.py`, `requirements.txt` |
| **Django** | `manage.py`, `wsgi.py`, `requirements.txt` |
| **CLI Node** | `bin/cli.js` com `commander` |
| **Lib npm** | ESM (`exports`), `src/index.js`, teste |

O nome do projeto é validado (sem espaços, sem acentos, sem caracteres fora de
letras/números/`.`/`-`/`_`) e se a pasta já existir a CLI aborta em vez de apagar
o que você já tem.

Ao final ela imprime os próximos passos:

```
Próximos passos:
  cd minha-loja
  npm start
```

## `snakit commit`

Lê `git diff --staged --name-status` (`A` = novo, `M` = modificado, `D` = removido),
monta uma sugestão e **só commita depois que você confirmar**.

```bash
snakit commit              # mostra a sugestão e pergunta: aceitar / editar / cancelar
snakit commit --dry-run    # só mostra a mensagem, não commita
snakit commit --yes        # aceita a sugestão sem perguntar
snakit commit --ai         # sugere pela IA (ver seção abaixo)
snakit commit --help       # ajuda completa, com exemplos
```

### Erros tratados

A CLI sai com **código 1** e uma mensagem que já diz o que fazer quando:

- o git não está instalado (ou não está no `PATH`);
- você não está dentro de um repositório git;
- não há nada no stage (`snakit` sugere rodar `git add`);
- o nome do comando é desconhecido.

---

## Como as regras escolhem a mensagem

Regras locais, sem internet, aplicadas **nesta ordem** — a primeira que casar vence:

| # | Condição | Tipo |
| --- | --- | --- |
| 1 | Só arquivos `*.test.js` / `*.spec.js` | `test` |
| 2 | Só `README`, `*.md` ou pasta `docs/` | `docs` |
| 3 | Só `package.json`, lockfiles, `.gitignore`, configs (`*.config.js`…) | `chore` |
| 4 | Todos os arquivos foram removidos | `refactor` |
| 5 | Branch ou caminho contendo `fix` | `fix` |
| 6 | Tem arquivo **novo** | `feat` |
| 7 | Qualquer outro caso | `refactor` |

### Escopo

O escopo é a **primeira pasta** dos arquivos alterados, quando todos estão na
mesma pasta:

- `controllers/user.js` → `feat(controllers): adiciona user`
- arquivos em `src/` **e** `bin/` → sem escopo (várias pastas)
- `README.md` (raiz) → sem escopo

### Descrição

Curta, no imperativo, em português:

- um arquivo → `adiciona userController`
- vários arquivos → `adiciona 3 arquivos`
- remoção → `remove velho`

O verbo acompanha o tipo: `feat` → *adiciona*, `fix` → *corrige*, `docs`/`chore` →
*atualiza*, remoção em massa → *remove*.

---

## Configuração: `.snakitrc.json`

Opcional. Coloque na raiz do projeto onde você roda a CLI:

```json
{
  "idioma": "en",
  "useAi": false,
  "templatesExtras": [
    {
      "valor": "minha-api",
      "nome": "Minha API",
      "descricao": "Base da minha API",
      "pasta": "../templates/minha-api"
    }
  ]
}
```

| Chave | Padrão | O que faz |
| --- | --- | --- |
| `idioma` | `"pt-BR"` | Idioma da **mensagem de commit**. Aceita `pt-BR` e `en`. |
| `useAi` | `false` | Liga o modo IA por padrão (ainda pede confirmação antes de enviar). |
| `templatesExtras` | `[]` | Templates seus, apontando para uma pasta (`pasta` relativa ou absoluta). |

Arquivo quebrado, idioma desconhecido ou item incompleto **não derrubam a CLI**:
elas aparecem como aviso amarelo e a ferramenta segue com os padrões.

---

## IA (opcional)

A IA é um extra. **Ninguém precisa pagar nada para usar o `snakit`.**

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # macOS/Linux
setx ANTHROPIC_API_KEY sk-ant-...     # Windows

snakit commit --ai
```

Comportamento:

1. **Antes de enviar** a CLI avisa que o diff vai para uma API externa e pede
   confirmação (a menos que você use `--yes`).
2. Ela **remove do envio** arquivos sensíveis ou inúteis: `.env*`, `*.pem`,
   `*.key`, lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`…),
   binários (`.png`, `.exe`, `.woff2`…) e `node_modules/`.
3. O diff é **truncado em 15 mil caracteres** (com aviso) antes do envio.
4. A resposta precisa bater com `tipo(escopo): descrição`; se não bater, ou se
   faltar chave / der timeout / a chamada falhar, o `snakit` **avisa e volta
   para as regras locais automaticamente**.

Sem o SDK: `@anthropic-ai/sdk` **não** é dependência deste pacote (instalação
leve). Se você o tiver instalado, ele é usado; senão a CLI cai num `fetch`
nativo do próprio Node.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Chave da API. Nunca é gravada em arquivo nem impressa. |
| `SNAKIT_MODEL` | `claude-haiku-5-5` | Modelo usado. Troque se quiser outro. |

---

## Desenvolvimento

```bash
npm install
npm test          # roda os testes com node:test
npm link          # faz o `snakit` apontar para a sua cópia local
```

Os testes ficam em `test/` e usam só `node:test` e `node:assert`:

- `rules.test.js` — cada regra de tipo, escopo e descrição;
- `files.test.js` — validação de nome e troca de placeholders (usa pastas em `os.tmpdir()`);
- `ai.test.js` — montagem do prompt e filtragem de arquivos (**nenhum teste chama a API**);
- `config.test.js` — leitura do `.snakitrc.json`, inclusive arquivo quebrado.

### Estrutura

```
snakit/
├── bin/snakit.js          # ponto de entrada, registra os comandos
├── src/commands/          # new.js, commit.js
├── src/templates/         # express-mvc/, react/, node-puro/
├── src/utils/             # git.js, files.js, rules.js, ai.js, config.js
├── test/                  # node:test
└── package.json
```

## Como contribuir

1. Faça um fork e crie uma branch: `git checkout -b minha-correcao`
2. Faça suas mudanças
3. Rode `npm test` — precisa sair tudo verde
4. Faça o commit seguindo o padrão (dá para usar o próprio `snakit commit` 😉)
5. Abra um Pull Request descrevendo o problema e a solução

Bug ou sugestão? [Abra uma issue](https://github.com/igordesouzabranco/snakit-cli/issues).

## Licença

[MIT](./LICENSE)
