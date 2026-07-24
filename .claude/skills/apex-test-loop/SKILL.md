---
name: apex-test-loop
description: >-
  AGENT LOOP de contexto unico para cobertura de teste Apex: dada UMA classe de
  producao, VOCE mesmo conduz o ciclo fechado (escrever -> deploy -> rodar+cobertura
  -> analisar -> melhorar) ate o MINIMO VIAVEL DEPLOYAVEL: >= 99% de cobertura real
  na ORG, com TODOS os testes passando e sem testes lentos (modo --rigoroso opcional
  exige asserts exaustivos), com travas de seguranca, MODO GUIADO em portugues (para
  leigos) e MODO SCAFFOLD (dev/treino). Toda regra de negocio vive em
  references/loop-rules.md (fonte unica); o "craft" de teste (mocks, asserts, data
  factory, bulk, async, DML) e DELEGADO as skills oficiais do sf-skills importadas
  neste projeto. TRIGGER quando: o usuario pedir "cobrir/aumentar a cobertura da
  classe X ate ~99% em loop", "criar classe de teste com o loop", invocar
  /apex-test-loop <Classe>, pedir o modo guiado (--guiado, "me ensine", "sou
  iniciante"), o scaffold (--scaffold), ou pedir para RETOMAR/continuar um loop
  anterior ("continue de onde paramos", "retoma a classe X" — ha memoria de estado
  por classe). DO NOT TRIGGER para escrever UM teste avulso sem o loop de cobertura
  (use platform-apex-test-generate), rodar testes/ver cobertura sem loop (use
  platform-apex-test-run), autorar/refatorar producao (use platform-apex-generate),
  ou testes Jest/LWC.
---

# Apex Test Loop — loop de cobertura de contexto único

**VOCÊ conduz o loop inteiro, sozinho, num único contexto.** Não há subagentes: você
escreve o teste, deploya, mede a cobertura, analisa e decide o próximo passo — tudo na
mesma sessão, acumulando contexto do começo ao fim. (Uma versão anterior dividia isto
em 5 subagentes; a passagem de contexto entre eles se mostrou frágil sob interrupção do
harness e com modelos menores — ver `RECOMMENDATIONS.md` R-0040/R-0042. Este desenho
volta à robustez do contexto único, mantendo a **governança** em fonte única.)

Toda a **lógica de negócio** (meta de qualidade, critério de conclusão dos dois portões,
travas de segurança, pontos de decisão humana, regra do platô, portão de estabilidade)
vive num único lugar — **`references/loop-rules.md`**. Leia esse arquivo ANTES de começar
e nunca decida algo que o contradiga. O **craft** de teste é delegado às skills oficiais
(tabela no fim). Você é a **orquestração**: quem dirige o ciclo e decide parar ou continuar.

## Passo 0 — antes de tudo

1. Leia `references/loop-rules.md` (regras) e `references/run-state.md` (formato do
   checkpoint).
2. Identifique a classe de produção alvo, o alias da org, e o modo pedido (automático /
   `--guiado` / `--scaffold` / `--rigoroso`).
3. Verifique se existe checkpoint em `.apex-test-loop/state/<Classe>.md`:
   - `em_andamento` / `pausado_bloqueado` → **retome** do `Proximo passo` (não recomece
     do zero). Se houver mais de um arquivo casando com `state/<Classe>*.md`, PARE e
     pergunte qual é válido (ponto de decisão humana em `loop-rules.md`).
   - `concluido` → a classe mudou? Confirme com o usuário antes de recomeçar.
   - não existe → crie a partir do template de `run-state.md` antes da 1ª iteração.

## Gate de pré-deploy (antes do PRIMEIRO deploy)

Mapeie **todos** os cenários da classe (por método: happy path, ramos, exceções, bulk)
e preencha o `## Inventário de cenários` do checkpoint. **Autore a classe de teste
cobrindo TODOS eles antes de deployar** — marque `[x]` quando o teste do cenário estiver
escrito (não quando passar). Só deploye com o inventário esgotado. Isso impede o
drip-feed (deploy prematuro), crítico com modelos menores.

## O loop (uma iteração)

1. **Escrever/ajustar `<Classe>Test.cls`.** Na 1ª iteração completa, cubra o inventário.
   Nas seguintes, mire o prompt dirigido que você mesmo derivou da análise anterior
   (linhas/ramos específicos ainda descobertos — nunca "melhore a cobertura" genérico).
   Para o craft (mocks, asserts, data factory, bulk, async), invoque as skills oficiais
   via `Skill` em vez de reinventar. **Nunca** toque na classe de produção.
2. **Deploy + teste + cobertura.** Rode o script determinístico (redirecione a saída
   completa para arquivo — **nunca** trunque com `tail`/`head`):
   ```bash
   node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
     --class <Classe> --test <Classe>Test --test-only [--org <alias>] [--extra ApexClass:TestDataFactory] \
     > .apex-test-loop/state/cov-atual.json 2> .apex-test-loop/state/cov-atual.err
   ```
   ⚠️ **Timeout:** o run é síncrono e testes de callout podem levar vários segundos cada
   — use um timeout generoso (≥ 300s) na chamada do comando. Se o script não puder rodar
   (Node ausente, conflito de formato de source), use o fallback de `references/sf-cli-and-coverage.md`.
   O JSON traz `coveredPercent`, `uncoveredLines`, `failures`, `slowTests`,
   `blockedByDependency`, `deployErrors`.
3. **Analisar** o JSON + o histórico do checkpoint e decidir (ver `loop-rules.md` e
   `references/runtime-blockers.md`):
   - Deploy falhou na própria classe de teste (compilação) → corrija citando `deployErrors`.
   - `failures` não vazio → distinga falha do seu teste (ajuste) de bloqueio de runtime
     da org (Flow/config/governor limit → `runtime-blockers.md`; CPU por bulk pesado →
     dividir em grupos com `startTest/stopTest` próprios, nunca reduzir cenário).
   - `blockedByDependency: true` → não crie nada sozinho: é ponto de decisão humana
     (uso real: apontar a org certa; dev/treino: `--scaffold`).
   - `coveredPercent` subiu mas < 99 → continue, prompt citando as `uncoveredLines`
     restantes em lote.
   - **Regra do platô:** cobertura igual por 2 iterações com testes crescendo → o próximo
     prompt DEVE nomear a linha/ramo exato ainda descoberto.
   - `slowTests` não vazio → não conclua; divida o teste lento (portão de estabilidade).
   - **Circuit-breaker:** 2-3 rodadas sem convergir → um único "deploy de investigação"
     dirigido, não tentativas às cegas.
4. **Gravar o checkpoint** (`state/<Classe>.md`): atualize `iteracao`, `cobertura_atual`,
   `historico_cobertura`, `linhas_nao_cobertas`, os campos `portao_1_*`/`portao_2_*`, o
   checklist e o `Proximo passo` em uma frase concreta. Grave DE VERDADE a cada iteração
   (estado velho é pior que nenhum). Só os caminhos da allowlist de `run-state.md`; nunca
   crie arquivos soltos (`-Copia`/`-backup`) nem pastas novas.
5. Volte ao passo 1 até bater o critério de conclusão.

## Critério de conclusão — DOIS portões (nunca conclua sem os dois)

Detalhe completo em `loop-rules.md`. Resumo operacional:

- **Portão 1** (a cada iteração, via `apex run test`): `coveredPercent >= 99` **e**
  `failures == []` **e** `slowTests == []`. Marque `portao_1_apex_run_test: confirmado`.
- **Portão 2** (UMA vez, disparado AUTOMATICAMENTE ao bater o Portão 1): rode a validação
  oficial — **não pergunte, não liste como opção, não encerre o turno pedindo permissão**:
  ```bash
  node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
    --class <Classe> --test <Classe>Test --validate [--org <alias>] [--extra ...] \
    > .apex-test-loop/state/cov-validate.json 2> .apex-test-loop/state/cov-validate.err
  ```
  É `sf project deploy validate --test-level RunSpecifiedTests` (check-only, não grava na
  org). Só declare `concluido` com `deployWouldSucceed == true` **e** `coveredPercent >= 99`
  **e** `failures == []` do `phase: "validate"`, e grave `portao_2_deploy_validate: confirmado`.
  Se o Portão 2 falhar apesar do Portão 1 (ex.: `validateError` sobre cobertura agregada
  da org ou dependência), NÃO é conclusão — é continuar (citando o `validateError`) ou
  bloqueado (se for limitação de ambiente que exige decisão humana).

**Nunca** rode `--validate` a cada iteração (é mais pesado) — só uma vez, ao final.
`status: concluido` EXIGE `portao_2_deploy_validate: confirmado`.

## Autonomia — 100% autônomo entre os pontos nomeados

Não pause para "posso continuar?" a cada iteração. As **únicas** pausas legítimas são os
5 pontos de decisão humana de `loop-rules.md` (editar produção, ativar scaffold, meta
inatingível, estado ambíguo, parada de segurança de emergência). Rodar o Portão 2 **não**
é um deles — é automático. Só fale com o humano ao **concluir** (com Portão 2 confirmado)
ou ao **bloquear** (com a pergunta exata a decidir).

## Modo guiado (`--guiado`/`--passo-a-passo`)

Quando pedido, siga `references/guided-mode.md`: uma etapa por vez, em português simples,
com pausas de confirmação antes do primeiro deploy. As travas e o critério de conclusão
de `loop-rules.md` continuam valendo — o guiado muda a **comunicação**, não as regras.

## 🚫 Nunca faça

Regras completas em `references/loop-rules.md`. Resumo: nunca editar/apagar/mover a classe
de produção; nunca rodar comando destrutivo; nunca concluir sem o critério objetivo dos
dois portões; nunca abaixar a meta de 99% sem decisão explícita do humano; nunca gravar
`concluido` sem `portao_2_deploy_validate: confirmado`. Reforçado por `settings.json`
(`permissions.deny`) e `scripts/guard.mjs` (hook `PreToolUse`), independente do que você
decidir.

## Referências

- `references/loop-rules.md` — **fonte única** de regras de negócio (leia primeiro).
- `references/run-state.md` — formato e ciclo de vida do checkpoint por classe.
- `references/guided-mode.md` — roteiro do modo guiado em português.
- `references/scaffolding-dependencies.md` — modo scaffold (dev/treino).
- `references/runtime-blockers.md` — bloqueios de runtime (Flow, governor limit etc.).
- `references/parallel-methods.md` — decomposição por método para classes grandes.
- `references/sf-cli-and-coverage.md` — comandos `sf` de fallback + Portão 2.
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
