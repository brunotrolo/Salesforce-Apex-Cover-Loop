---
name: apex-test-loop
description: >-
  Orquestrador de AGENT LOOP para cobertura de teste Apex: dada UMA classe de
  producao, roda um ciclo fechado (deploy -> run test -> ler linhas nao cobertas
  -> melhorar) ate o MINIMO VIAVEL DEPLOYAVEL: >= 99% de cobertura com TODOS os
  testes passando e portaveis entre ambientes (modo --rigoroso opcional exige
  asserts exaustivos), com travas de seguranca, MODO GUIADO em portugues (para
  leigos) e MODO SCAFFOLD (dev/treino).
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

Objetivo: dada UMA classe de producao Apex, dirigir um **ciclo fechado** ate o
**MINIMO VIAVEL DEPLOYAVEL** — meta padrao **>= 99% de cobertura, todos os testes
passando, portaveis entre ambientes**: escrever/melhorar o teste → deploy → rodar
com cobertura → ler as linhas nao cobertas → melhorar → repetir, ate a meta ou uma
parada segura.

## 🎯 Objetivo de qualidade: MVP deployavel (PADRAO) vs `--rigoroso` (opt-in)

A plataforma Salesforce exige para deploy: **cobertura + testes passando**. Ela NAO
exige asserts — e cada assert de valor exato e um ponto potencial de quebra entre
ambientes (config de org diverge). Por isso o padrao desta skill e o **MVP
deployavel**:

- **Teste que EXECUTA a linha e PASSA** vale mais que teste que verifica e quebra
  em outra org. Asserts sao bem-vindos quando **baratos e estaveis** (smoke), nunca
  obrigatorios por padrao.
- **Guardas de config sao PERMITIDAS e recomendadas** (`if (!queues.isEmpty())`,
  try/catch em torno de dependencia de org): isso e **portabilidade**, nao trapaca —
  o teste precisa passar em QUALQUER sandbox do pipeline. Atencao ao efeito
  colateral: excecao no MEIO do metodo corta a cobertura das linhas seguintes, entao
  **dado real que evita a excecao ainda e a melhor tatica DE COBERTURA** (por
  eficacia, nao por moral).
- **Bulk 251+ e recomendado, nao mandatorio** — e um bulk que estoura CPU e um
  deploy-blocker: reduza/divida ate PASSAR e registre o achado de producao.
- **Menos asserts = menos falhas = menos iteracoes.** Grande parte do tempo perdido
  em campo foi corrigindo asserts com expectativa errada — o MVP elimina essa classe
  inteira de retrabalho.

Se o usuario pedir **`--rigoroso`** (ou "testes com verificacao completa"), ai sim
aplique o pacote exaustivo: assert de valor exato com mensagem em todo metodo, 1
comportamento por metodo, bulk mandatorio (as regras marcadas como [rigoroso] abaixo).

Esta skill e a **orquestracao**. O **craft** (como escrever um bom teste) vem das
skills oficiais da Salesforce importadas aqui (veja Delegacao). Nosso valor: o loop,
as **travas de seguranca**, o **modo guiado PT** e o **modo scaffold**.

## ⚡ Estratégia de custo: menos ciclos de deploy, testes sem-DML primeiro

**Constraint do Salesforce (leia com atencao):** teste Apex **NAO roda na maquina
local** — ele SEMPRE executa na ORG (servidor na nuvem). Para a org rodar um teste
NOVO/ALTERADO, o codigo do teste **precisa ser deployado antes** (`sf project deploy
start`). Nao existe "rodar o teste local para poupar deploy" — se voce nao deploya, a
org roda a **versao antiga** do teste e a cobertura medida fica **errada**. O custo
dominante do loop e esse round-trip deploy+run (minutos), e ele e **inevitavel** toda
vez que o teste muda.

Como o custo esta no round-trip, as alavancas REAIS de tempo sao:

1. **`--test-only` (padrao):** deploya SOMENTE a classe de teste (pequena, rapida),
   nunca a de producao (que ja esta na org). Ja e o default do loop.
2. **Lote maximo por deploy:** enfileire TODOS os testes que sabe escrever (corrigir
   todas as falhas + cobrir todas as linhas-alvo mapeadas) e gaste **um** deploy por
   iteracao. Meca exito em "linhas-alvo eliminadas por deploy", nao em iteracoes.
   (Regra detalhada em "⚡ Disciplina de execucao → Lote maximo por deploy", abaixo.)
3. **Testes sem-DML primeiro (ate ~90% OU empacar):** priorize os cenarios que NAO
   precisam de `insert/update/delete` — eles **escapam de bloqueios de Flow/automacao
   e de governor no setup**, e cobrem a "parte barata" da classe rapidamente. So depois
   parta para os cenarios com DML (mais sujeitos a Flow/governor). (Atencao: o deploy+run
   continua igual com ou sem DML — o ganho aqui e **evitar bloqueios**, nao velocidade de
   execucao.)

**⚠️ Teto do sem-DML:** linhas de producao que so executam APOS persistencia real
(logica pos-`insert`, SOQL de re-leitura, **triggers**, rollups, campos formula, `Id`
populado) **nao sao alcancaveis** por teste sem-DML — para uma trigger handler ou
selector/DAO o teto sem-DML pode ser bem baixo (as vezes ~0%). Por isso a meta da fase
sem-DML e **"~90% OU o ponto em que a cobertura empaca"**, o que vier primeiro — nunca
insista nos 90% sem-DML se as linhas restantes claramente exigem DML (nesses tipos de
classe, va direto ao DML). Ao empacar, passe para os testes com DML (aplicando a ordem
de ataque de `references/runtime-blockers.md`: satisfazer Flow → runAs → dado real).

Isso e **ordem de trabalho** (estrategia que VOCE, agente, segue), nao uma flag do
script. O `apex-coverage.mjs` continua so medindo cobertura de forma deterministica; a
priorizacao sem-DML → DML e decisao sua ao escolher quais cenarios escrever em cada
lote.

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

> Reforco fora do modelo (`.claude/settings.json`): o hook `guard.mjs` **bloqueia de
> forma dura** (`deny`) um conjunto ESPECIFICO de padroes destrutivos — `sf project/
> org/data delete`, deploy destrutivo (`destructive-changes`), `rm/del/unlink` de
> `.cls`, `find ... -delete` e `rm -rf` sobre `force-app`/`classes`, e `mv`/`move` de
> `.cls`/`.trigger`. **Sobrescrever** um `.cls`/`.trigger` de producao **existente**
> **pede aprovacao** (`ask`, nao bloqueio duro) — assim a `platform-apex-generate` pode
> refatorar producao com o seu ok, e nunca ha sobrescrita **silenciosa** (o bug
> original). **Limitacao honesta:** o guard casa por TEXTO do comando — nao e uma
> fronteira criptografica; wrappers/variaveis exoticos podem escapar, e ha o efeito
> colateral de as vezes bloquear um comando benigno que apenas *menciona* essas strings
> (falso-positivo seguro). Por isso as Travas acima (instrucoes) continuam essenciais.

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
`<projeto>/.apex-test-loop/state/<Classe>.md` — caminho **neutro de ferramenta** (na
raiz do projeto, fora de `.claude`/`.opencode`, para Claude Code e OpenCode lerem o
MESMO estado; veja `references/run-state.md`).
- Existe com `status: em_andamento`/`pausado_bloqueado` → **resuma ao usuario onde
  parou e RETOME dali** (nao recomece do zero, salvo pedido explicito).
- Achou estado antigo em `.claude/apex-test-loop/state/` ou `.opencode/**/state/` →
  **mova** para o caminho neutro e siga dali (nunca mantenha dois silos).
- Nao existe → crie a partir do template antes da primeira iteracao.

**Checagem de seguranca (obrigatoria):** rode `git status`; a classe de producao e
**somente leitura** para esta skill — voce simplesmente **nao mexe** nela.

1. **Localizar a classe**: `**/classes/<Classe>.cls` em `force-app` (ou nos
   `packageDirectories` do `sfdx-project.json`). Leia a versao REAL do repo.

2. **Inventario MECANICO de metodos (obrigatorio, antes de escrever qualquer teste)**.
   "Ler e entender" a classe nao basta em arquivos grandes — e assim que se perde
   metodo (aconteceu em campo: uma classe de 2790 linhas tinha 31 metodos, e a leitura
   inicial so notou 5; a sessao passou iteracoes inteiras testando so um sexto da
   classe achando que era o todo). Antes de mapear cenarios, rode um grep de
   assinaturas para ter a lista **completa e definitiva**:
   ```
   grep -n "^\s*(public|private|global|protected).*\b(void|List|Map|Set|Boolean|String|Id|Integer)\b.*\(.*\)\s*\{?\s*$"
   ```
   (ajuste os tipos de retorno conforme a classe). Monte uma tabela **metodo → linha
   inicial/final** — esse mapa e a fonte de verdade para o resto do run: rastreie
   cobertura POR METODO (nao so o agregado da classe), e cada teste que voce escrever
   deve saber a qual metodo pertence.
   **Classe grande (aprox. >10-15 metodos, ou muitas linhas)**: com o inventario em
   maos, avalie DESDE JA se cabe a estrategia de decomposicao por metodo (fan-out —
   veja `references/parallel-methods.md`) em vez de descobrir isso tarde, no meio
   do run, como aconteceu em campo.

3. **Mapear o que cobrir por metodo** (usando o inventario acima): ramos (`if/else`,
   ternario, `switch`), loops, `try/catch`, DML, SOQL/SOSL, chamadas externas,
   `@AuraEnabled`/`@InvocableMethod`, sharing, excecoes custom. **Detecte
   callout/assincrono** (`Http`, WSDL, `@future`, Queueable, Batchable, Schedulable,
   Platform Events) — para o COMO, aplique **platform-apex-test-generate**
   (mocks/async).
   **Avalie a alcancabilidade (mas a meta continua ≥99% — NAO a abaixe)**: se a classe
   depende fortemente de configuracao de org (muitos record types, Entitlements, Queues,
   Custom Settings), diga ao usuario DESDE JA quais ramos podem ser inalcancaveis
   neste ambiente e qual e a meta pratica — 99% e o padrao, nao uma promessa cega
   (veja `references/runtime-blockers.md`, "Meta honesta").
4. **Dados de teste**: procure `TestDataFactory`/`TestFactory` — e tambem **classes
   de teste EXISTENTES que ja inserem o objeto-alvo** (ex.: um `*_tst.cls` humano que
   faz `insert Case`): elas sao a receita comprovada do dado que passa pelas
   automacoes da org — minere o setup delas antes de inventar o seu. Para criar/
   seedar dados e o padrao de factory, delegue a **platform-data-manage**.
5. **Org alvo**: `sf config get target-org` / `sf org display`. Se `sf` nao estiver
   instalado/autenticado, pare e oriente.
6. **Dependencias repo vs org**: a producao ja costuma estar **na org** com suas
   dependencias. O loop deploya **so o teste** (`--test-only`). Traga algo com
   `sf project retrieve start` so se faltar de fato na org.
7. **Baseline**: se `<Classe>Test.cls` ja existe, meca a cobertura atual **sem alterar**
   e **melhore** o existente (preserve os testes bons). Se o inventario de metodos
   (item 2) revelar metodos sem nenhum teste correspondente, isso e sinal de que a
   classe de teste existente tambem so cobria parte da classe.

> **Triggers**: para cobrir uma trigger, faca DML no objeto dentro do teste; a
> cobertura dela aparece em `otherClassesTouched` do script.

## O loop (repetir 1→4)

> ### 🚦 GATE DE PRÉ-DEPLOY (vale para a PRIMEIRA iteração — NÃO PULE)
>
> O round-trip deploy→org custa **minutos**; a autoria custa **segundos e é local**.
> Logo, **antes do PRIMEIRO deploy** é OBRIGATÓRIO esgotar a autoria:
>
> 1. **Materialize o inventário de cenários no state file.** A partir do mapa do Passo 0,
>    liste TODOS os cenários a cobrir como checklist por método
>    (`[ ] <metodo> — <ramo/caso>`) na seção `## Inventário de cenários` do
>    `state/<Classe>.md`. É a sua lista dos "N itens" (podem ser 8 ou 150) — o **alvo
>    concreto e definitivo** do run.
> 2. **Autore a classe de teste cobrindo TODOS os itens que dá para escrever sem
>    feedback de runtime** — o inventário inteiro, não um subconjunto. Pode quebrar a
>    AUTORIA em quantos passos de escrita precisar (é local e de graça); o que **não
>    pode** é deployar no meio.
> 3. **Só então** rode o primeiro deploy (passo 2), carregando o lote inteiro.
>
> 🚫 **Anti-padrão PROIBIDO — drip-feed:** escrever 3 testes → deployar → escrever mais 3
> → deployar. Cada deploy prematuro queima minutos de org por trabalho que já podia estar
> no lote. A ÚNICA exceção é um **deploy de investigação declarado** (você precisa de UM
> diagnóstico de runtime — ex.: descobrir o dado real que um Flow exige); aí diga que é
> investigação, não drip-feed.
>
> Depois do gate, seja honesto: o primeiro run quase nunca fecha 99% (o runtime revela
> falhas e linhas que a autoria não previu). As iterações 2+ trabalham **contra o
> checklist** — marcam o que passou, consertam falhas, miram as `uncoveredLines` — em
> poucos round-trips, não dezenas. O ganho é colapsar ~30 idas à org em ~5.

1. **Escrever/melhorar** `force-app/**/classes/<Classe>Test.cls` (+ `.cls-meta.xml`).
   Para o COMO (estrutura, mocks, asserts, bulk, async, DML), aplique o craft de
   **platform-apex-test-generate**. Cada caminho relevante vira um `@IsTest` que
   **executa e passa** (no `--rigoroso`, tambem com assert real)
   (veja Travas e, se `--rigoroso`, Regras de qualidade).

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
   - `failures` nao vazio → **investigue a CAUSA antes de "corrigir"**:
     - Causa e o **teste** (assert errado, dado mal montado) → corrija o teste e
       volte a 2. **No MVP**, um assert de expectativa errada/instavel PODE ser
       afrouxado ou removido (asserts sao opcionais — nao gaste iteracoes consertando
       verificacao que o modo nao exige); **no `--rigoroso`**, conserte o assert,
       nunca o remova.
     - Causa e a **ORG em runtime** (Flow bloqueando DML, Entitlement/Queue/config
       ausente, governor limit — CPU/SOQL) → isso e um **bloqueio de runtime**, nao
       um defeito do teste. Siga `references/runtime-blockers.md`: primeiro minere
       testes existentes/dado real (melhor tatica de COBERTURA), e no MVP guardas de
       config sao aceitaveis como fallback de portabilidade; no `--rigoroso`,
       enfraquecer o teste e proibido (Regras de qualidade).
       - **CPU limit por bulk DML numa trigger pesada** (ex.: `update`/`insert` de
         varios registros num unico `startTest/stopTest`, e a trigger faz muito
         trabalho por registro — `getDescribe`/`getRecordTypeInfos`, dezenas de `if`):
         a correcao NAO e remover o cenario (anti-padrao A-0002 / R-0015) nem reduzir
         a variedade — e
         **dividir em grupos menores, cada um com seu proprio `Test.startTest()/
         stopTest()`** (cada grupo ganha orcamento de CPU fresco). Detalhe e heuristica
         de tamanho em `references/runtime-blockers.md` (secao 1). **Varredura
         obrigatoria (nao so o teste que falhou):** procure na classe de teste OUTROS
         lotes grandes (`insert`/`update`/`Database.insert|update` de List com ~5+
         registros dentro de `startTest/stopTest`) e aplique o mesmo split
         preventivamente — use a ferramenta **Grep** do agente (nao dependa de `grep`
         de shell; R-0031). Registre no checkpoint.
     - **Circuit-breaker de investigacao (aprendido em campo):** se a causa de UMA
       falha nao ficar clara em **2-3 passos** de leitura/investigacao solta, PARE de
       cavar — prefira **um unico deploy com diagnostico dirigido** (assert/debug
       temporario NO TESTE que revele o dado real) e siga trabalhando o resto do lote
       enquanto isso; se nem assim a causa fechar, registre a falha como pendencia no
       checkpoint e reporte ao usuario no fim da iteracao, em vez de queimar dezenas
       de chamadas numa falha so. (Uma falha pontual NUNCA deve travar o avanco das
       demais linhas-alvo.)
     - **⚡ Iteracao rapida ao consertar falha (economiza tempo de org):** ao depurar
       UM ou poucos metodos que falham, NAO re-rode a suite inteira a cada tentativa.
       Depois do deploy do teste, rode SO os metodos em questao:
       ```bash
       sf apex run test --tests <Classe>Test.<metodo1>,<Classe>Test.<metodo2> \
         --result-format human --wait 5 --target-org <alias>
       ```
       Isso executa 2-3 metodos em segundos, em vez de todos (dezenas → minutos).
       **⚠️ Ressalva CRITICA (nao pule):** essa run parcial serve so para **passa/
       falha** — a **cobertura** e as `uncoveredLines` dela sao PARCIAIS (so das linhas
       que esses metodos tocaram), NAO a cobertura real da classe. Para o numero de
       cobertura que DIRIGE o loop (passo 4), rode SEMPRE a classe inteira via o script
       (`--test-only`, que usa `--class-names`). Regra: `--tests` para iterar rapido em
       falha; `apex-coverage.mjs` (classe cheia) para medir cobertura de verdade.
   - Passou → veja `coveredPercent` e `uncoveredLines`.

4. **Decidir e SALVAR o checkpoint**:
   - `coveredPercent >= 99` **e** todos os testes passando **e** `slowTests` vazio
     → **concluir**. (No `--rigoroso`, exige tambem assert real em todo metodo.)
   - **⚠️ Portao de estabilidade (nao pule) — `slowTests` nao vazio:** o script
     sinaliza metodos lentos (>= `slowMs`, padrao 8s de wall-clock). Eles PASSAM agora,
     mas sao **deploy-blockers latentes**: tempo perto do teto de CPU estoura de forma
     INTERMITENTE numa org carregada — e por isso que a MESMA suite pode falhar 17
     testes numa org cheia e 1 numa vazia (o run que "passou uma vez" NAO prova portabilidade,
     que e o objetivo do MVP). Trate cada `slowTests` como pendencia: **divida o metodo
     em grupos menores, cada um com seu proprio `Test.startTest()/stopTest()`**
     (`references/runtime-blockers.md`, secao 1) ANTES de declarar a classe pronta.
     So conclua quando `slowTests` estiver vazio (ou o usuario aceitar o risco
     explicitamente, registrado no checkpoint). Isso NAO e o mesmo que "teste falhando"
     (Trava 5) — e a camada que pega o teste que ainda nao falhou, mas vai.
   - Senão → leia a classe de producao **nas `uncoveredLines`** (pelos intervalos do
     inventario de metodos — nao o arquivo inteiro), entenda os cenarios que faltam
     (ramo `else`? `catch`? item de `switch`? loop vazio/cheio?) e adicione **testes
     para TODAS as linhas-alvo conhecidas — EM LOTE, num unico ciclo** (aplicando o
     craft de platform-apex-test-generate), e volte a 2. **Nunca um teste por
     iteracao**: o custo dominante do loop e o ciclo deploy+teste (minutos), nao a
     autoria — cada deploy deve carregar o MAXIMO de trabalho novo (corrigir todas
     as falhas conhecidas + cobrir todas as linhas-alvo mapeadas de uma vez).
   - **Regra do platô**: cobertura parada por **2 iteracoes seguidas** enquanto o
     numero de testes cresce = os testes novos estao cobrindo linhas ja cobertas.
     PARE de escrever testes e diagnostique: compare `uncoveredLines` com a iteracao
     anterior; dai em diante **cada teste novo nomeia as linhas-alvo** que pretende
     cobrir, e a iteracao seguinte confere se elas sairam da lista. Detalhe em
     `references/runtime-blockers.md` (secao "Regra do platô").
   - **Se o diagnostico revelar que as linhas-alvo sao bloqueadas pelo ambiente**
     (nao "precisa de mais teste", e "Flow/feature/config impede"), isso NAO surgiu
     no Passo 0 mas surge agora — pare e apresente ao usuario o pedido de confirmacao
     com opcoes nomeadas de `references/runtime-blockers.md` ("Quando o teto so fica
     claro DEPOIS de ja rodar iteracoes"). Nao decida sozinho, nao force.
   - **Em AMBOS os casos, atualize `state/<Classe>.md`** (iteracao, cobertura,
     historico, linhas restantes, feito, proximo passo) — e parte do passo, nao um
     extra. E isso que permite retomar o loop de onde parou.

## ⚡ Disciplina de execucao (assertividade, tempo e tokens)

Aprendido em campo: o loop estava correto mas lento — pedia aprovacao demais, fazia
pouco por iteracao e desperdicava contexto. Regras de execucao:

**1. Autonomia por padrao — NAO pergunte, decida e reporte.** As politicas desta
skill ja decidem quase tudo; se uma regra escrita cobre o caso, **aja** e registre a
decisao no checkpoint. Os UNICOS pontos onde se pergunta ao usuario sao os nomeados:
(a) editar/sobrescrever producao (guard `ask`); (b) ativar scaffold; (c) o teto de 99%
parecer genuinamente inatingivel no ambiente (linhas bloqueadas por org/Flow) — ai PARE
e apresente as opcoes, **sem NUNCA escrever meta < 99** (a regua so muda se o dono
decidir); (d) estado ambiguo (ex.: checkpoints duplicados); (e) parada
de seguranca/bloqueio genuino sem saida nas politicas. **Todo o resto — qual teste
escrever, como corrigir uma falha de teste, que dado criar, ordem de ataque — e
decisao SUA**, ja governada pelas Travas e pelo modo de qualidade vigente.
Perguntar o que a skill ja
responde e desperdicio do tempo do usuario.

**2. Lote maximo por deploy.** O ciclo deploy+teste custa minutos; a autoria custa
segundos. Enfileire TUDO que se sabe fazer (corrigir todas as falhas + cobrir todas
as linhas-alvo de todos os metodos mapeados) e gaste **um** deploy por iteracao.
Meca o exito em "linhas-alvo eliminadas por deploy", nao em "iteracoes rodadas".
**No PRIMEIRO deploy isso e TRAVA, nao sugestao** — cumpra o "🚦 GATE DE PRÉ-DEPLOY"
no inicio do loop (autore o inventario INTEIRO antes de deployar). Modelos menores
(ex.: rodando via OpenCode/DeepSeek) tendem a **pingar** — escrever pouco, deployar,
repetir — e cada round-trip prematuro custa minutos de org por trabalho que ja podia
estar no lote. O inventario materializado no `state/<Classe>.md` existe justamente para
dar ao modelo um alvo concreto a esgotar antes de gastar o primeiro deploy.

**3. Dieta de contexto.**
- Leia a producao **por intervalos do inventario de metodos** (Passo 0), nunca o
  arquivo inteiro repetidamente.
- Saida do `apex-coverage.mjs` SEMPRE para arquivo (`> cov-N.json`), nunca truncada
  por `tail`/`head` (detalhe em `references/sf-cli-and-coverage.md`) — perder o JSON
  custa um ciclo inteiro de re-deploy.
- O que ja esta no checkpoint nao se rederiva: leia `state/<Classe>.md` em vez de
  reinvestigar o que uma iteracao anterior ja concluiu.
- Durante o loop, reporte ao usuario em formato **curto** (tabela de progresso +
  proximo passo); prosa longa so no encerramento.

## ⛔ Travas (valem SEMPRE, em qualquer modo — seguranca e portabilidade)

1. **Nunca alterar a classe de producao** — nem para inflar cobertura (formatacao,
   linhas, chaves), nem para "ajudar" o teste. Producao e intocavel (guard impoe).
2. **Sem `@IsTest(SeeAllData=true)` e sem IDs hardcoded** — isso QUEBRA o proprio
   objetivo do MVP: o teste precisa passar em qualquer ambiente do pipeline, e
   dados/IDs de uma org especifica nao existem na proxima.
3. **Nunca fingir cobertura impossivel** — linhas inalcancaveis sao documentadas
   (Limitacoes de cobertura), nunca "resolvidas" com truque.
4. **Nunca remover/degradar um teste que ja PASSA** para "simplificar" — trabalho
   pago nao se joga fora.
5. **Todos os testes DEVEM passar** — teste falhando e deploy-blocker; nao existe
   "deixar falhando para depois" no artefato final.
6. **A meta e PISO FIXO ≥99% — o agente NUNCA a abaixa.** Nao escreva
   `meta_cobertura` menor que 99, nem "aceite X%" por conta propria. Linhas
   genuinamente inalcancaveis se documentam **uma a uma** (poucas linhas assim levam
   100%→~99%, ainda ≥99). Se 99% parecer genuinamente inatingivel no ambiente (muitas
   linhas bloqueadas por org/Flow), **PARE (parada de seguranca) e apresente as opcoes
   ao humano** — a regua so muda se o DONO decidir, explicitamente. Modelo fraco
   baixando a meta sozinho (ex.: escrever 95 no state file sem aval) e **violacao**.

## 📐 Regras de qualidade [rigoroso] (so quando o usuario pedir `--rigoroso`)

Cobertura sem verificacao e execucao de codigo, nao teste — quando o usuario QUER
verificacao. No modo rigoroso, adicionalmente:

- **Todo `@IsTest` com assert** da classe `Assert` moderna, **valor exato** calculado
  do setup (nunca range), **mensagem obrigatoria**; valide efeito colateral via SOQL.
- **1 comportamento por metodo** (sem mega-teste; data-driven so com assert
  individual por combinacao e mensagem que identifique qual combo falhou).
- **Bulk 251+ mandatorio** para triggers/handlers/`@InvocableMethod`.
- **Nunca engula excecao com try/catch nem guarde assert com `isEmpty()`** — no
  rigoroso, o dado real e obrigatorio, nao opcional.

No modo MVP (padrao), esses itens viram **taticas recomendadas quando baratas**, nao
bloqueios: guardas de config e try/catch de portabilidade sao permitidos (veja
"Objetivo de qualidade" acima), lembrando que excecao no meio do metodo corta
cobertura — dado real costuma ser a MELHOR tatica de cobertura mesmo no MVP.

Boas praticas em ambos os modos: `@TestSetup`; `Test.startTest()/stopTest()`;
`System.runAs` para permissao. O detalhamento vive nas skills oficiais
(**platform-apex-test-generate** / **platform-apex-test-run**).

## Condicao de parada e encerramento

- **Parada de seguranca**: apos **6 iteracoes** sem evoluir (ou erro cronico de
  deploy), PARE e gere relatorio (linha travada, motivo, recomendacao). No estado:
  `status: pausado_bloqueado` + o motivo exato + o que o humano precisa decidir —
  assim, resolvido o bloqueio, o loop retoma dali.
- **Encerramento**: resumo curto — cobertura final, metodos criados e o cenario que
  cada um valida. No estado: `status: concluido` + resumo final. Inclua DUAS secoes
  obrigatorias quando existirem:
  - **Achados de producao**: problemas do codigo de producao que os testes revelaram
    (ex.: SOQL em loop que estoura CPU em bulk, falta de checagem `isEmpty()`).
    Reportar apenas — a correcao e da `platform-apex-generate` com aprovacao humana.
  - **Limitacoes de cobertura**: linhas/ramos inalcancaveis NESTE ambiente e por que
    (feature desabilitada, Flow ativo, config ausente), para o usuario decidir.

## Fase de retrospectiva (autoaprendizado)

> A retrospectiva e um passo de **reflexao** — nao existe script para ela (nao rode
> nem invente um `apex-retrospective.mjs`; e voce lendo o run e escrevendo Markdown).

No **fim de cada run** (sucesso OU parada), reflita e direcione o aprendizado ao
ledger CERTO — sao dois, com propositos distintos:

| O que voce aprendeu | Onde registrar | Formato |
|---|---|---|
| Friccao com **a propria skill** (guard travou algo legitimo, delegacao confusa, passo faltando, comando `sf` errado) | `RECOMMENDATIONS.md` (**local** — nunca da push) | `R-XXXX` 🟡 Proposta |
| **Padrao de teste agnostico** util para QUALQUER classe futura (categoria de linha inalcancavel por tipo de classe, armadilha recorrente) | `references/apex-test-loop-recommendations.md` (**local** — nunca da push) | `P-XXXX` — veja `references/contribution-guidelines.md` |

**So registre quando houve FRICCAO/APRENDIZADO REAL** (guard bloqueou algo legitimo,
dependencia travou, muitas iteracoes, decisao humana por ambiguidade, delegacao
faltando/confusa, comando `sf` errado, padrao que vai se repetir). **Em run limpo,
nao registre nada** — ruido e pior que silencio. Nunca cite uma classe especifica num
`P-XXXX`: o padrao tem que servir para as proximas.

**EXCECAO — friccao GRAVE registra NA HORA, nao no fim** (aprendido em campo: num
run longo "ate 99%", o fim pode demorar dezenas de iteracoes e o detalhe se perde
na compactacao de contexto). E grave qualquer compromisso de qualidade: cenario
obrigatorio nao coberto, teste em memoria por bloqueio de Flow, excecao de org
contornada, **meta escrita abaixo de 99** (proibido — a regua e piso fixo; se isso
aconteceu, e um erro a corrigir, nao um estado valido). Nesses casos: registre no ledger e anote
no checkpoint (`state/<Classe>.md`, Bloqueios) **no momento em que acontecer**, e
avise o usuario na mesma resposta.

Para cada friccao (max ~3): confira `RECOMMENDATIONS.md` (nao duplicar) e **anexe**
uma entrada `R-XXXX` com status `🟡 Proposta` (gatilho real, problema, mudanca
acionavel). Escrever nestes `.md` e permitido; **🚫 dar `git push` de recomendacoes
NAO e** — este `.claude/` e uma copia no projeto do dev, sem acesso ao repo-casa, e
varios devs empurrando se sobrescreveriam. Avise o usuario deixando claro que ficou
**local**: *"registrei N recomendacao(oes) no arquivo local; envie ao mantenedor
quando ele abrir a coleta, ou peca para eu revisar"*. A consolidacao no repo e um
passo **central e manual** do mantenedor (`references/contribution-guidelines.md` →
"papel do mantenedor"). **Melhoria nunca afrouxa as Travas nem o modo de qualidade
vigente.** Ao **processar** (revisao local): decida `🟢 Aprovada`/`⚪ Reprovada`/`✅ Aplicada`.

## Modo guiado (passo a passo para leigos)

Quando ativado, siga `references/guided-mode.md`. Em resumo: uma etapa por vez em
portugues simples; **pausas de confirmacao** antes do primeiro deploy; ensine os
conceitos; mostre o progresso (`72% -> 88% -> 99%`); as Travas continuam valendo
(e as Regras de qualidade, se o modo for `--rigoroso`).

## Referencias

**Memoria e autoaprendizado (FUNDAMENTAL — consulte primeiro antes de cada run):**
- `references/apex-test-loop-recommendations.md` — padroes agnósticos de teste descobertos
  em campo (FeatureManagement, mocks, transacao grouping, linhas inalcancaveis por tipo
  de classe, state file etc) + recomendacoes para a propria skill (R-0001 em diante).
  **Leia aqui quando:** encontrar padroes repetidos entre classes diferentes, decidir
  sobre arquitetura de mocks, mapear quais linhas tendem a ser inalcancaveis (a meta
  segue ≥99%), ou contribuir uma licao nova (ver secao 4 do arquivo para contribuir).

**Nossas (unicas desta camada):**
- `references/parallel-methods.md` — decomposicao por metodo (fan-out) para classes
  grandes: quando usar, os 3 riscos de concorrencia e a estrutura segura (autoria
  paralela, merge/deploy/checkpoint sequenciais).
- `references/runtime-blockers.md` — bloqueios de RUNTIME (Flow bloqueando DML,
  config de org ausente, governor limits): o que nunca fazer, o que fazer por tipo,
  regra do platô e meta honesta.
- `references/run-state.md` — memoria de estado do run (checkpoint por classe:
  onde le/escreve, regras e template para retomar o loop de onde parou).
- `references/guided-mode.md` — roteiro do modo guiado (PT, para leigos).
- `references/scaffolding-dependencies.md` — orquestracao do scaffold dev/treino.
- `references/sf-cli-and-coverage.md` — comandos `sf` crus (deploy, run test, leitura
  do JSON de cobertura) de fallback quando o `apex-coverage.mjs` nao puder rodar.
- `RECOMMENDATIONS.md` (local) — historico de evolucao desta skill (R-0001 em diante,
  aplicadas em PRs passadas). Consulte para compreender decisoes passadas.

**Craft (skills oficiais importadas — veja a tabela de Delegacao):**
platform-apex-test-generate, platform-apex-test-run, platform-data-manage,
platform-apex-generate, platform-apex-logs-debug, platform-custom-object-generate,
platform-custom-field-generate.
