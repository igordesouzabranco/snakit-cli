# Changelog

## 1.3.3 — 2026-10-31

### Funcionalidades
- **config:** valida chave identidade e documenta no init (df9c20b, 2026-10-31)
- **doctor,hook:** checagem de identidade do git (975fca3, 2026-10-31)
- **amend,release:** identidade garantida e erros em portugues (d673868, 2026-10-31)
- **new:** garante identidade do primeiro commit e exit 0 so (9f3e707, 2026-10-31)
- **identidade:** garantirIdentidade com caminho interativo e --yes (7080eea, 2026-10-31)
- **git:** detecta identidade e traduz erros cru do git (7bd914d, 2026-10-31)

### Correções
- **utils:** normaliza separadores de caminho para Windows (2c29ccd, 2026-10-31)
- **publish:** valida tag, package.json e NPM_TOKEN antes do npm publish (1cb3cac, 2026-10-31)
- **testes:** identidade de git e branch flexivel no integration.test.js (d42a366, 2026-10-31)

### Documentação
- **readme:** identidade de git, chave identidade do config e doctor (bfb3878, 2026-10-31)

### Testes
- **identidade:** suite hermetica sem identidade de git (99780c1, 2026-10-31)
- **ci:** repos temporarios hermeticos e process.execPath nos testes (b8a3902, 2026-10-31)

### Manutenção
- **github:** identidade de git, workflow_dispatch e permissoes minimas (18c235f, 2026-10-31)

### Outros
- Merge pull request #9 from igordesouzabranco/fix-ci (8eb538f, 2026-10-31)
  - Fix ci
- Fix capitalization of project name in README (6cf8c18, 2026-10-31)
  - Corrected the capitalization of the project name in the README.
- Merge pull request #8 from igordesouzabranco/fix-pos-1.3.1 (4392388, 2026-10-31)
  - Fix pos 1.3.1
- Merge pull request #7 from igordesouzabranco/fase-3-diferenciais (719a5ed, 2026-10-29)
  - atualização package.json e template.js
- Merge pull request #6 from igordesouzabranco/fase-3-diferenciais (1412424, 2026-10-29)
  - Fase 3 diferenciais
- Merge pull request #5 from igordesouzabranco/master (22588cd, 2026-10-29)
  - atualizaçao package.json
- Merge pull request #4 from igordesouzabranco/fase-3-diferenciais (5231b1c, 2026-10-29)
  - Fase 3 diferenciais
- Merge pull request #3 from igordesouzabranco/fase-2-toolkit (4d74f86, 2026-10-29)
  - Fase 2 toolkit
- Merge pull request #2 from igordesouzabranco/fase-1-commit (e083654, 2026-10-29)
  - Fase 1 commit
- Merge pull request #1 from igordesouzabranco/fase-0-correcoes (4cb24c9, 2026-10-29)
  - feat: fase 0 - correções iniciais, .gitignore, rules, --allow-send, CI

---

## 1.3.2 — 2026-10-31

Correções pós-1.3.1 e o conteúdo das fases 0–3 (que foi ao npm como 1.3.1, sem tag).

### Correções

- **check:** reescreve a revisão do stage com regras puras, flags `--strict` e `--output json` (7e57439)
- **check:** mascara segredos também nos avisos e no `--output json` (e8bf12c)
- **new:** troca placeholders em `.py` e afins e renomeia a pasta `{{nome_pacote}}` (7e0235f)
- **templates:** Django e FastAPI funcionais, sem npm no scaffold Python (86dd882)
- **templates:** template react-ts completo com Vite, TypeScript e teste (8d507b1)
- **templates:** remove BOM, padroniza LF e fixa a codificação com `.gitattributes` (207cba4)
- **changelog:** agrupa por tipo legível, tira o prefixo `tipo(escopo):` e usa o título da versão com data (6a69f56, 579bdd3)

### Funcionalidades (fases 0–3, publicadas como 1.3.1)

- commit com IA opcional, hook, lint, changelog, release, undo e amend (48074f2..13cee6d)
- toolkit: templates, add, generate, templates extra, config, init e doctor (fdb6e31..e314565)
- diferenciais: pr, check, readme, stats, branch e provedores de IA (a6d0a47, 361ccd5)

### Testes

- **cli:** cobre `--help`, empacotamento (`npm pack`) e a sincronia README x comandos (c2250ee)

### Manutenção

- release 1.3.2 com changelog gerado pela própria CLI (7f08863)
- ajustes de package.json e README na reta final da 1.3.1 (9113f15, af75fe2, 9a1cab2)
