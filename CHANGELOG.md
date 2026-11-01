# Changelog

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
