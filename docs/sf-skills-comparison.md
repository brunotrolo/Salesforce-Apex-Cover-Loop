# Análise: `forcedotcom/sf-skills` vs nossa `apex-test-loop`

Meta-análise (fase de decisão — **nenhum código da skill foi alterado**). Objetivo:
decidir, skill-a-skill, o que **REUSAR / ADAPTAR / MANTER NOSSO / ENXERTAR** do
repositório oficial da Salesforce, preservando nossas travas de segurança.

## Fontes

- Repo: https://github.com/forcedotcom/sf-skills (Apache-2.0, oficial `forcedotcom`, ativo).
- Skills lidas (via `raw.githubusercontent.com/forcedotcom/sf-skills/main/skills/...`):
  `platform-apex-test-generate/SKILL.md`, `platform-apex-test-run/SKILL.md`,
  `platform-apex-generate/SKILL.md`, `platform-apex-logs-debug/SKILL.md`,
  `platform-apex-test-run/scripts/parse-test-results.py`, `LICENSE.txt`.
- Descartado: `SalesforceAIResearch/agentforce-adlc` — **CC BY-NC** (não-comercial),
  pré-1.0, foco em agentes Agentforce (não TDD Apex). Só inspiração, sem cópia.

## Nota de licença/atribuição

- `sf-skills` é **Apache-2.0** (Copyright 2026 Salesforce). **Não há arquivo NOTICE**
  no repo (§4(d) é condicional a existir NOTICE — não existe).
- Uso aqui é **pessoal/estudo**. Mesmo assim: se copiarmos texto/template deles,
  retemos referência de licença + crédito. **Preferência: escrever equivalentes
  próprios e citar como inspiração** (evita discussão de trabalho derivado).

## Resumo executivo

O framing inicial ("reusar as skills e só enriquecer com nossos loops") **não se
aplica direto**: as skills Apex deles **já têm** um loop deploy→run→cobertura→fix. O
que a nossa tem de único (e superior no nosso caso) é a **camada de segurança em 3
camadas**, o **modo guiado PT**, `--test-only`, o **modo scaffold**, o **ledger de
autoaprendizado** e o **contrato JSON determinístico** do `apex-coverage.mjs`.

**Recomendação:** manter a NOSSA skill como espinha e **ADAPTAR** um conjunto focado
de boas ideias deles (abaixo). Não substituir; não copiar em massa. Nada do que
adaptamos toca no guard/deny/contrato.

## Análise skill-a-skill

### 1) `platform-apex-test-generate` (v1.0) — geração de teste
- **O que faz:** gera `{Classe}Test.cls` + meta, cria `TestDataFactory` se ausente,
  loop de 5 passos com **máx 3 iterações**, alvo **75% mín / 90%+ recomendado**.
  Arquivos: `references/{assertion-patterns,async-testing,mocking-patterns,test-data-factory}.md`,
  `assets/{test-class-template,test-data-factory-template}.cls`.
- **Regras fortes (citadas):** "one behavior per method... never combine null vs empty";
  "251+ records to cross the 200-record trigger batch boundary"; "exact expected values
  computed from test data setup. NEVER use range assertions"; "never legacy `System.assert*`";
  "Mandatory failure messages"; "no `SeeAllData=true`; no hardcoded IDs"; API 66.0.
- **Nossa cobre?** Sim (quality-checklist + templates), **exceto**: bulk usamos 200
  (eles 251); não temos a regra explícita "valor exato, nunca range"; TestDataFactory
  nós detectamos/opcional (eles mandam + auto-criam + template).
- **Veredito:** **MANTER NOSSO** (loop/segurança) **+ ADAPTAR 3 regras**: bulk 251+,
  "assert de valor exato (nunca range)", "1 comportamento por método". E **fortalecer**
  o uso de TestDataFactory + adicionar um template de factory (próprio).

### 2) `platform-apex-test-run` (v1.1) — execução + cobertura + rubrica
- **O que faz:** roda `sf apex run test`, parseia via `parse-test-results.py` (hook
  pós-tool), loop de fix (máx 3), **rubrica de 120 pontos**, `SeeAllData=false`.
  Tabela Own/Delegate: fix de produção → `platform-apex-generate`; deploy → skill de
  deploy; logs → `platform-apex-logs-debug`.
- **Parser deles (`parse-test-results.py`):** lê `TOOL_OUTPUT` do `sf apex run test`,
  emite **TEXTO legível** (não JSON), **gate único 75%**, **trunca linhas não cobertas
  a 10**; chaves de cobertura `coveredLines/totalLines/uncoveredLines` com fallback
  `numLinesCovered/numLinesUncovered`.
- **Nosso `apex-coverage.mjs`:** emite **JSON de máquina**, **não trunca** linhas,
  faz **deploy+run**, discrimina `blockedByDependency`, trata Windows `.cmd` e ENOENT,
  traz `otherClassesTouched`. → **Mais adequado ao nosso loop.**
- **Veredito:** **MANTER NOSSO** (parser e loop). **ADAPTAR 2 ideias:** (a) adicionar
  os fallbacks `numLinesCovered/numLinesUncovered` ao nosso parser (robustez entre
  versões do `sf`); (b) uma **rubrica leve de "pronto"** própria como quality gate
  (a deles publica só as faixas 108+/96–107/84–95/<84 — **o detalhamento por dimensão
  NÃO está publicado**, então desenharíamos a nossa).

### 3) `platform-apex-generate` — autoria de Apex de produção
- **O que faz:** cria/refatora classes de produção; valida com `run_code_analyzer`
  (MCP) + `sf apex run test`. **Delega** testes para `platform-apex-test-generate`.
- **Nossa cobre?** **Não — e por design.** Nós NUNCA autoramos/alteramos produção
  (é a base da nossa segurança).
- **Veredito:** **MANTER NOSSO escopo** (fora do nosso território). Se um dia
  coexistirmos com o sf-skills, **delegar** questões de produção a esta skill —
  espelhando o padrão Own/Delegate deles. **ADAPTAR (opcional):** rodar
  `run_code_analyzer` na CLASSE DE TESTE que geramos (lint do teste).

### 4) `platform-apex-logs-debug` — análise de logs (100 pontos)
- **O que faz:** analisa debug logs, governor limits, stack traces; recomenda fix
  baseado em evidência do log.
- **Nossa cobre?** Não (adjacente, não sobrepõe).
- **Veredito:** **COMPLEMENTAR** (não integrar agora). Bom candidato a "quando um teste
  falha por governor limit, use esta skill" no futuro.

## Matriz de decisão (resumo)

| Capacidade deles | Nossa cobre? | Veredito | Ação |
|---|---|---|---|
| Loop deploy→run→cobertura→fix | Sim (melhor: JSON, blockedByDependency) | MANTER NOSSO | — |
| Parser de resultado | Sim (`apex-coverage.mjs`, JSON) | MANTER NOSSO | +fallbacks `numLines*` |
| Bulk 251+ (eles) vs 200 (nós) | Parcial | ADAPTAR | 200→251 no checklist |
| Assert de valor exato (nunca range) | Parcial | ADAPTAR | regra explícita |
| 1 comportamento por método | Parcial | ADAPTAR | regra explícita |
| TestDataFactory mandatório + template | Parcial | ADAPTAR | mandar + template próprio |
| TRIGGER / DO NOT TRIGGER no frontmatter | Não (só gatilhos soltos) | ADAPTAR | adicionar blocos |
| Split generate vs run + Own/Delegate | N/A (nós unificamos) | ADAPTAR (padrão) | fronteiras de delegação |
| Rubrica de pontos (quality gate) | Parcial (checklist "pronto") | ADAPTAR (própria) | opcional |
| Autoria de produção (`apex-generate`) | Não (por segurança) | MANTER NOSSO | delegar se coexistir |
| Debug de logs (`logs-debug`) | Não | COMPLEMENTAR | futuro |
| Suíte de teste dos scripts | Não (temos matrizes ad-hoc) | ADAPTAR | versionar testes `.mjs` |

## Fortes candidatos a ADAPTAR (priorizados, baixo risco)

1. **Bulk 251+** (era 200) — `references/quality-checklist.md`.
2. **Assert de valor exato, nunca range** + **1 comportamento por método** — checklist.
3. **Blocos TRIGGER / DO NOT TRIGGER** no frontmatter do nosso `SKILL.md` (melhora
   auto-ativação e evita colisão se o usuário instalar o sf-skills junto).
4. **TestDataFactory**: tornar o uso mandatório quando existir + adicionar um template
   de factory próprio em `references/templates/`.
5. **Fallbacks `numLinesCovered/numLinesUncovered`** no `apex-coverage.mjs` (robustez).
6. **(Opcional)** rubrica leve de "definição de pronto" própria como quality gate.
7. **(Opcional)** versionar como suíte de teste as matrizes do `guard.mjs`/`apex-coverage.mjs`.

## Como as travas continuam intactas (checagem obrigatória)

Todos os itens acima são **regras de documentação, frontmatter, um template novo, ou
robustez de parser** — **nenhum** altera:
- o hook `guard.mjs` (`classify`/`classifyWrite`) nem sua fiação em `settings.json`;
- as regras `permissions.deny`;
- a seção "🚫 NUNCA FAÇA";
- o contrato de saída do `apex-coverage.mjs` (só **adiciona** fallbacks de leitura).
Nada que reusamos autoriza escrever/sobrescrever a classe de produção.

## Recomendação para a próxima fase (a decidir juntos)

- **Espinha = nossa skill.** Aplicar os ADAPTs 1–5 (baixo risco, alto valor) num PR.
- **Não** copiar em massa nem trocar nosso parser pelo Python deles.
- **Não** usar `agentforce-adlc` (CC BY-NC).
- Registrar os ADAPTs como recomendações no `RECOMMENDATIONS.md` (R-0009…) antes de
  aplicar, mantendo o ciclo de autoaprendizado.
- Itens 6–7 e a delegação para `platform-apex-generate`/`logs-debug`: backlog.
