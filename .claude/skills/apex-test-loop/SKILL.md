---
name: apex-test-loop
description: >-
  Orquestrador de AGENT LOOP para cobertura de teste Apex: dada UMA classe de
  producao, roda um ciclo fechado (deploy -> run test -> ler linhas nao cobertas
  -> melhorar) ate atingir cobertura real e alta (meta padrao >= 99%), com travas
  de seguranca, MODO GUIADO em portugues (para leigos) e MODO SCAFFOLD (dev/treino).
  O "craft" de teste (mocks, asserts, data factory, bulk, async, DML) e DELEGADO as
  skills oficiais do sf-skills importadas neste projeto. TRIGGER quando: o usuario
  pedir "cobrir/aumentar a cobertura da classe X ate ~99% em loop", "criar classe de
  teste com o loop", invocar /apex-test-loop <Classe>, pedir o modo guiado
  (--guiado, "me ensine", "sou iniciante"), o scaffold (--scaffold), ou pedir para
  RETOMAR/continuar um loop anterior ("continue de onde paramos", "retoma a classe X"
  — ha memoria de estado por classe). DO NOT TRIGGER
  para escrever UM teste avulso sem o loop de cobertura (use platform-apex-test-generate),
  rodar testes/ver cobertura sem loop (use platform-apex-test-run), autorar/refatorar
  producao (use platform-apex-generate), ou testes Jest/LWC.
---

# Apex Test Loop — Orquestrador do loop de cobertura

Objetivo: dada UMA classe de producao Apex, dirigir um **ciclo fechado** ate a classe
de teste alcancar cobertura alta e **real** (meta padrao **>= 99%**): escrever/melhorar
o teste → deploy → rodar com cobertura → ler as linhas nao cobertas → melhorar →
repetir, ate a meta ou uma parada segura.

Esta skill e a **orquestracao**. O **craft** (como escrever um bom teste) vem das
skills oficiais da Salesforce importadas aqui (veja Delegacao). Nosso valor: o loop,
as **travas de seguranca**, o **modo guiado PT** e o **modo scaffold**.

## Delegacao — o craft vem das skills oficiais (importadas)

Ao precisar do "como fazer", **aplique a skill oficial correspondente** (todas em
`.claude/skills/`, snapshot Apache-2.0 — veja `VENDOR-ATTRIBUTION.md`):

| Precisa de... | Delegue para |
|---|---|
| Escrever/melhorar a classe de TESTE (mocks, asserts, bulk 251+, async, DML) | **platform-apex-test-generate** |
| Rodar teste / analisar cobertura / padroes de fix | **platform-apex-test-run** |
| Criar/seedar DADOS de teste (TestDataFactory, bulk, casos de borda) | **platform-data-manage** |
| Diagnosticar falha por log / governor limit / stack trace | **platform-apex-logs-debug** |
| Autorar/refatorar a classe de PRODUCAO (fora do loop, com o humano) | **platform-apex-generate** |
| Criar objeto `__c` faltante (modo scaffold) | **platform-custom-object-generate** |
| Criar campo `__c` / `__mdt` faltante (modo scaffold) | **platform-custom-field-generate** |

Nao reescreva esse conhecimento aqui — o modelo ja tem essas skills no contexto.
Nossa `apex-test-loop` cuida do **loop + seguranca + guiado + scaffold**.

## 🚫 NUNCA FACA (proibicoes absolutas — leia ANTES de qualquer acao)

Esta skill **CRIA e edita apenas a classe de TESTE** (`<Classe>Test.cls`). A classe
de producao e **intocavel** por esta skill. (Se o usuario quiser mesmo alterar producao,
isso e trabalho da **platform-apex-generate**, com aprovacao — nao desta.) Voce
**NUNCA**, em hipotese alguma:

1. **Apaga, move ou renomeia a classe de producao** `<Classe>.cls`/`.cls-meta.xml` —
   nem no disco, nem na org.
2. **Sobrescreve a classe de producao.** Antes de QUALQUER `Write`/`Edit`, confirme
   que o caminho e a classe de TESTE (ou um arquivo NOVO de scaffold). Nunca edite a
   classe sob teste para "ajudar" o teste.
3. **Roda comandos que apagam arquivos** (`rm`, `del`, `Remove-Item`, `unlink`,
   `find ... -delete`) sobre `.cls`/`.cls-meta.xml` ou qualquer arquivo do projeto.
4. **Roda deploy destrutivo ou exclusao na org**: `sf project delete source`,
   `sf project delete tracking`, deploy com `--pre-/--post-destructive-changes` /
   `destructiveChanges.xml`, `sf org delete`, `sf data delete`.
5. **Apaga outras classes, testes ou dados** que voce nao criou nesta sessao.
6. **Mexe na classe de producao para "resolver" teste que falha ou cobertura baixa.**
   A resposta e **SEMPRE ajustar a classe de TESTE** — nunca a de producao.

Na duvida sobre remover/mover/substituir algo de producao ou da org: **PARE e pergunte.**

> Reforco fora do modelo (`.claude/settings.json`): comandos destrutivos (delete/rm/
> deploy destrutivo) sao **bloqueados de forma dura** (`deny` + hook `guard.mjs`).
> **Sobrescrever** um `.cls`/`.trigger` de producao **existente** agora **pede
> aprovacao** (nao e bloqueio duro) — assim a `platform-apex-generate` pode refatorar
> producao com o seu ok, e nunca ha sobrescrita **silenciosa** (o bug original).

## Entrada

`/apex-test-loop AccountService` ou "cubra a AccountService com testes ate 99%".
Se o nome nao foi dado, pergunte qual classe cobrir.

### Dois modos de execucao

- **Automatico (padrao)**: roda o loop inteiro e apresenta o resultado no fim.
- **Guiado (passo a passo, para leigos)**: conduz UMA etapa por vez, em linguagem
  simples, **pedindo confirmacao** antes de acoes que mexem na org. Entre neste modo
  com `--guiado`/`--passo-a-passo` ou frases como "me ensine", "sou iniciante". Na
  duvida, **ofereca**. Roteiro completo em `references/guided-mode.md`.

## Passo 0 — Contexto e SEGURANCA (rodar UMA vez)

**Memoria de estado (PRIMEIRA acao):** verifique se existe
`.claude/apex-test-loop/state/<Classe>.md` no projeto (veja `references/run-state.md`).
- Existe com `status: em_andamento`/`pausado_bloqueado` → **resuma ao usuario onde
  parou e RETOME dali** (nao recomece do zero, salvo pedido explicito).
- Nao existe → crie a partir do template antes da primeira iteracao.

**Checagem de seguranca (obrigatoria):** rode `git status`; a classe de producao e
**somente leitura** para esta skill — voce simplesmente **nao mexe** nela.

1. **Localizar a classe**: `**/classes/<Classe>.cls` em `force-app` (ou nos
   `packageDirectories` do `sfdx-project.json`). Leia a versao REAL do repo.
2. **Mapear o que cobrir**: metodos, ramos (`if/else`, ternario, `switch`), loops,
   `try/catch`, DML, SOQL/SOSL, chamadas externas, `@AuraEnabled`/`@InvocableMethod`,
   sharing, excecoes custom. **Detecte callout/assincrono** (`Http`, WSDL, `@future`,
   Queueable, Batchable, Schedulable, Platform Events) — para o COMO, aplique
   **platform-apex-test-generate** (mocks/async).
3. **Dados de teste**: procure `TestDataFactory`/`TestFactory`. Para criar/seedar
   dados e o padrao de factory, delegue a **platform-data-manage**.
4. **Org alvo**: `sf config get target-org` / `sf org display`. Se `sf` nao estiver
   instalado/autenticado, pare e oriente.
5. **Dependencias repo vs org**: a producao ja costuma estar **na org** com suas
   dependencias. O loop deploya **so o teste** (`--test-only`). Traga algo com
   `sf project retrieve start` so se faltar de fato na org.
6. **Baseline**: se `<Classe>Test.cls` ja existe, meca a cobertura atual **sem alterar**
   e **melhore** o existente (preserve os testes bons).

> **Triggers**: para cobrir uma trigger, faca DML no objeto dentro do teste; a
> cobertura dela aparece em `otherClassesTouched` do script.

## O loop (repetir 1→4)

1. **Escrever/melhorar** `force-app/**/classes/<Classe>Test.cls` (+ `.cls-meta.xml`).
   Para o COMO (estrutura, mocks, asserts, bulk, async, DML), aplique o craft de
   **platform-apex-test-generate**. Cada caminho vira um `@IsTest` com **assert real**
   (veja Regras de Ouro).

2. **Deploy do TESTE + cobertura** com o script determinístico. Use **`--test-only`**
   (a producao ja esta na org — nao reenviar/sobrescrever):

   ```bash
   node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
     --class <Classe> --test <Classe>Test --test-only [--org <alias>] \
     [--extra ApexClass:TestDataFactory]
   ```

   Imprime JSON compacto: `coveredPercent`, `uncoveredLines`, `failures`. Use
   `--deploy` (produção + teste) so se a producao for nova/alterada legitimamente.
   Sem o script, use os comandos crus de `references/sf-cli-and-coverage.md`.

3. **Ler o resultado**:
   - `blockedByDependency: true` → falha de **dependencia** (`__c`, `__mdt`, outra
     classe) ausente, **nao do teste**. Nunca recrie/apague/sobrescreva a classe sob
     teste. Distinga:
     - **Uso real (tem a org):** nao crie nada — ofereca (a) `--test-only` se a
       producao ja esta na org; (b) `sf project retrieve start`; (c) apontar a org.
     - **Dev/treino (sem a org):** ofereca o **modo scaffold** (arquivos NOVOS, so
       com sinal `--scaffold`/"estou treinando"). Para o COMO criar o objeto/campo,
       delegue a **platform-custom-object-generate** / **platform-custom-field-generate**;
       a orquestracao (o que e minimo, nunca tocar a classe sob teste) esta em
       `references/scaffolding-dependencies.md`.
     Sem sinal de scaffold, **pare e ofereca as opcoes**.
   - Falha na **classe de teste** → corrija o TESTE conforme `deployErrors` e volte a 2.
   - `failures` nao vazio → corrija **o teste** (nunca remova assert) e volte a 2.
   - Passou → veja `coveredPercent` e `uncoveredLines`.

4. **Decidir e SALVAR o checkpoint**:
   - `coveredPercent >= 99` **e** todo metodo com assert real → **concluir**.
   - Senão → leia a classe de producao **nas `uncoveredLines`**, entenda o cenario
     que falta (ramo `else`? `catch`? item de `switch`? loop vazio/cheio?), adicione
     **um metodo de teste** para aquele caminho (aplicando o craft de
     platform-apex-test-generate) e volte a 2.
   - **Em AMBOS os casos, atualize `state/<Classe>.md`** (iteracao, cobertura,
     historico, linhas restantes, feito, proximo passo) — e parte do passo, nao um
     extra. E isso que permite retomar o loop de onde parou.

## ⛔ Regras de Ouro (inegociaveis — anti-cheat)

Cobertura sem verificacao e execucao de codigo, nao teste. Voce **NAO PODE**:

1. **Alterar a classe de producao para inflar cobertura** (formatacao, linhas, chaves).
2. **Entregar teste sem assert.** Todo `@IsTest` valida comportamento com a classe
   `Assert` (nunca `System.assert*` legado); asserts de **valor exato** calculado do
   setup (nunca range/aproximado quando o valor e deterministico); **mensagem
   obrigatoria** no assert; valide efeito colateral via SOQL.
3. **Atalhos proibidos**: sem `@IsTest(SeeAllData=true)`, sem IDs hardcoded, sem
   depender de dados da org.
4. **Fingir cobertura impossivel** — documente linhas inalcancaveis em vez de forcar.

Boas praticas: `@TestSetup`; `Test.startTest()/stopTest()`; `System.runAs` para
permissao; **bulk 251+ registros** (cruza a fronteira de batch de 200 da trigger) para
triggers/handlers/`@InvocableMethod`; **um comportamento por metodo**. O detalhamento
desses padroes vive nas skills oficiais (**platform-apex-test-generate** /
**platform-apex-test-run**).

## Condicao de parada e encerramento

- **Parada de seguranca**: apos **6 iteracoes** sem evoluir (ou erro cronico de
  deploy), PARE e gere relatorio (linha travada, motivo, recomendacao). No estado:
  `status: pausado_bloqueado` + o motivo exato + o que o humano precisa decidir —
  assim, resolvido o bloqueio, o loop retoma dali.
- **Encerramento**: resumo curto — cobertura final, metodos criados e o cenario que
  cada um valida. No estado: `status: concluido` + resumo final.

## Fase de retrospectiva (autoaprendizado da skill)

No **fim de cada run** (sucesso OU parada), reflita: *o que nesta skill me atrapalhou?*
**So registre proposta quando houve FRICCAO REAL** (guard bloqueou algo legitimo,
dependencia travou, muitas iteracoes, decisao humana por ambiguidade, delegacao
faltando/confusa, comando `sf` errado). **Em run limpo, nao registre nada.**

Para cada friccao (max ~3): confira `RECOMMENDATIONS.md` (nao duplicar) e **anexe**
uma entrada `R-XXXX` com status `🟡 Proposta` (gatilho real, problema, mudanca
acionavel). Avise o usuario: *"registrei N recomendacao(oes); peca para eu revisar
quando quiser"*. Escrever neste `.md` e permitido. **Melhoria nunca afrouxa as Regras
de Ouro nem as travas.** Ao **processar**: decida `🟢 Aprovada`/`⚪ Reprovada`/`✅ Aplicada`
e atualize o status com o PR.

## Modo guiado (passo a passo para leigos)

Quando ativado, siga `references/guided-mode.md`. Em resumo: uma etapa por vez em
portugues simples; **pausas de confirmacao** antes do primeiro deploy; ensine os
conceitos; mostre o progresso (`72% -> 88% -> 99%`); as Regras de Ouro continuam valendo.

## Referencias

**Nossas (unicas desta camada):**
- `references/run-state.md` — memoria de estado do run (checkpoint por classe:
  onde le/escreve, regras e template para retomar o loop de onde parou).
- `references/guided-mode.md` — roteiro do modo guiado (PT, para leigos).
- `references/scaffolding-dependencies.md` — orquestracao do scaffold dev/treino.
- `references/sf-cli-and-coverage.md` — contrato do `apex-coverage.mjs` e comandos
  `sf` crus de fallback.
- `RECOMMENDATIONS.md` — livro-razao de autoaprendizado (memoria LONGA, entre runs).

**Craft (skills oficiais importadas — veja a tabela de Delegacao):**
platform-apex-test-generate, platform-apex-test-run, platform-data-manage,
platform-apex-generate, platform-apex-logs-debug, platform-custom-object-generate,
platform-custom-field-generate.
