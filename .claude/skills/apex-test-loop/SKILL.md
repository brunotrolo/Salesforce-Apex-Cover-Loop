---
name: apex-test-loop
description: >-
  Orquestrador de AGENT LOOP multiagente para cobertura de teste Apex: dada UMA
  classe de producao, aciona o agente apex-orchestrator (100% autonomo) que
  coordena 4 subagentes especialistas — apex-test-writer, apex-deploy-runner,
  apex-coverage-analyst, apex-state-recorder — num ciclo fechado (escrever ->
  deploy -> rodar+cobertura -> analisar -> melhorar) ate o MINIMO VIAVEL
  DEPLOYAVEL: >= 99% de cobertura real na ORG, com TODOS os testes passando e
  sem testes lentos (modo --rigoroso opcional exige asserts exaustivos), com
  travas de seguranca, MODO GUIADO em portugues (para leigos) e MODO SCAFFOLD
  (dev/treino). O "craft" de teste (mocks, asserts, data factory, bulk, async,
  DML) e DELEGADO as skills oficiais do sf-skills importadas neste projeto.
  TRIGGER quando: o usuario pedir "cobrir/aumentar a cobertura da classe X ate
  ~99% em loop", "criar classe de teste com o loop", invocar
  /apex-test-loop <Classe>, pedir o modo guiado (--guiado, "me ensine", "sou
  iniciante"), o scaffold (--scaffold), ou pedir para RETOMAR/continuar um loop
  anterior ("continue de onde paramos", "retoma a classe X" — ha memoria de
  estado por classe). DO NOT TRIGGER para escrever UM teste avulso sem o loop
  de cobertura (use platform-apex-test-generate), rodar testes/ver cobertura
  sem loop (use platform-apex-test-run), autorar/refatorar producao (use
  platform-apex-generate), ou testes Jest/LWC.
---

# Apex Test Loop — orquestração multiagente do loop de cobertura

Esta skill é a **porta de entrada**. Toda a lógica de negócio (meta de qualidade,
critério de conclusão, travas de segurança, condição de parada) vive num único lugar
— `references/loop-rules.md` — para não haver deriva entre agentes. Toda a
**orquestração e execução** vive nos agentes em `.claude/agents/`:

| Agente | Papel |
|---|---|
| `apex-orchestrator` | Coordena o ciclo fechado, 100% autônomo, único que decide parar/continuar |
| `apex-test-writer` | Escreve/ajusta `<Classe>Test.cls` (delega craft às skills oficiais) |
| `apex-deploy-runner` | Deploy + roda teste + devolve cobertura (JSON determinístico) |
| `apex-coverage-analyst` | Interpreta o resultado e decide o próximo passo |
| `apex-state-recorder` | Único agente que grava checkpoint e aprendizado, allowlist fechada |

## O que esta skill faz ao ser acionada

1. Identifica a classe de produção alvo e o modo pedido (automático / `--guiado` /
   `--scaffold` / `--rigoroso`).
2. Invoca `apex-orchestrator` (via Task) passando: nome da classe, modo, e se há
   estado anterior a retomar.
3. Fica fora do caminho: o orquestrador conduz o loop inteiro sozinho, invocando os 4
   subagentes especialistas, até bater a meta de `loop-rules.md` ou parar com uma
   pergunta nomeada para o humano.
4. Ao final (concluído ou pausado), apresenta o resumo que o orquestrador devolveu —
   não reinterpreta nem resume por conta própria.

## Modo guiado (`--guiado`/`--passo-a-passo`)

Quando pedido, a skill instrui o `apex-orchestrator` a seguir
`references/guided-mode.md`: uma etapa por vez, em português simples, com pausas de
confirmação antes do primeiro deploy. As travas de segurança e o critério de
conclusão de `loop-rules.md` continuam valendo integralmente — o modo guiado muda
a **comunicação**, não as regras.

## 🚫 Nunca faça (herda para todos os agentes invocados)

Regras completas em `references/loop-rules.md`. Resumo: nunca editar/apagar/mover a
classe de produção; nunca rodar comando destrutivo; nunca concluir sem o critério
objetivo de cobertura/testes/estabilidade; nunca abaixar a meta de 99% sem decisão
explícita do humano. Reforçado por `settings.json` (`permissions.deny`) e
`scripts/guard.mjs` (hook `PreToolUse`), independente do que os agentes decidirem.

## Referências

- `references/loop-rules.md` — **fonte única** de regras de negócio (leia primeiro).
- `references/run-state.md` — formato e ciclo de vida do checkpoint por classe.
- `references/guided-mode.md` — roteiro do modo guiado em português.
- `references/scaffolding-dependencies.md` — modo scaffold (dev/treino).
- `references/runtime-blockers.md` — bloqueios de runtime (Flow, governor limit etc.).
- `references/parallel-methods.md` — decomposição por método para classes grandes.
- `references/sf-cli-and-coverage.md` — comandos `sf` de fallback.
- `references/contribution-guidelines.md` — quando registrar um padrão agnóstico.
- `references/apex-test-loop-recommendations.md` — padrões agnósticos já aprendidos.
- `RECOMMENDATIONS.md` — ledger de fricção da própria skill (local, nunca `git push`).

## Skills oficiais delegadas (craft)

| Precisa de... | Delegue para |
|---|---|
| Escrever/melhorar classe de TESTE | `platform-apex-test-generate` |
| Rodar teste/analisar cobertura (padrões) | `platform-apex-test-run` |
| Criar/seedar dados de teste | `platform-data-manage` |
| Diagnosticar falha por log/governor limit | `platform-apex-logs-debug` |
| Autorar/refatorar produção (fora do loop) | `platform-apex-generate` |
| Criar objeto `__c` faltante (scaffold) | `platform-custom-object-generate` |
| Criar campo `__c`/`__mdt` faltante (scaffold) | `platform-custom-field-generate` |
