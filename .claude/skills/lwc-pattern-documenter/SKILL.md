---
name: lwc-pattern-documenter
description: >-
  Documenta o DESIGN SYSTEM de Lightning Web Components (LWC) de uma org, por
  JORNADA/PRODUTO, num Markdown vivo e incremental. Dado um conjunto de LWCs que o
  usuario aponta (caminho manual OU menu interativo) + um nome de jornada/produto,
  extrai padroes (naming, CSS/tokens, slots, eventos, imports, acessibilidade,
  composicao) e ESCREVE/ATUALIZA uma secao em .lwc-pattern-documenter/lwc-design-system/design-patterns.md — nunca gera
  nem edita componentes, so LE e DOCUMENTA. Tem um GUIA INICIAL obrigatorio (nunca
  "recebe input e sai processando"): confirma jornada, exige minimo de 3 componentes,
  documenta divergencia em vez de decidir sozinha, evita jornada duplicada. TRIGGER
  quando o usuario pedir "documente/aprenda os padroes de LWC da jornada X",
  "registre o design system desses componentes", invocar /lwc-pattern-documenter, ou
  pedir para atualizar uma jornada ja documentada. DO NOT TRIGGER para GERAR/editar
  um LWC (isso e a futura lwc-pattern-generator), autorar Apex, criar campos/objetos,
  ou mexer em Flow.
---

# LWC Pattern Documenter — aprende e registra o design system, por jornada

Objetivo: dado um conjunto de LWCs que o usuario aponta como representativos de uma
**jornada/produto** (ex.: "Atendimento ao Cliente", "Vendas B2B"), extrair os padroes
de design e **escrever/atualizar uma secao** em `.lwc-pattern-documenter/lwc-design-system/design-patterns.md`. O documento
cresce **incrementalmente** — uma jornada por vez — e vira a referencia canonica que a
futura `lwc-pattern-generator` (Skill 2) usara para gerar novos componentes alinhados.

Esta skill **so le e documenta**. Ela **nunca** gera, edita ou deploya componentes.
E uma skill de risco baixo de proposito (a validacao do "cerebro" — extracao de
padroes — antes de arriscar o "corpo" — geracao de codigo). Veja `references/architecture.md`.

## 🚫 NUNCA FACA (proibicoes absolutas)

Esta skill escreve APENAS dois arquivos: `.lwc-pattern-documenter/lwc-design-system/design-patterns.md` e
`.lwc-pattern-documenter/lwc-design-system/journeys-index.json`. Voce **NUNCA**:

1. **Escreve, edita, cria, move, apaga ou deploya** qualquer arquivo de componente LWC
   (`.js`/`.html`/`.css`/`.js-meta.xml`) — a leitura desses arquivos e **somente
   leitura**. Gerar/editar LWC e trabalho da futura `lwc-pattern-generator`, nao desta.
2. **Autora Apex, cria campos/objetos, mexe em Flow/Process/Automation** ou qualquer
   outro metadata. Fora do escopo total desta skill.
3. **Decide sozinha qual convencao "vale mais"** quando os componentes divergem — voce
   DOCUMENTA as variantes e sinaliza (regra 3 abaixo); a decisao e do usuario.
4. **Documenta uma jornada com menos de 3 componentes** (regra 2) — bloqueie e peca mais.
5. **Escreve no documento sem passar pelo GUIA INICIAL** (as 9 etapas) e sem o preview
   aprovado pelo usuario (etapa 8).

Na duvida sobre tocar em qualquer coisa que nao seja os dois arquivos de saida: PARE.

## As 4 regras de curadoria (o coracao da skill)

Decididas com o usuario (ver `references/architecture.md`, secao 3). Elas tornam o guia
inicial obrigatorio — cada uma exige uma checagem ANTES de escrever:

1. **Selecao hibrida.** O usuario informa os caminhos dos LWCs diretamente OU pede que
   voce liste os componentes do projeto para escolher de um menu. **Sempre pergunte
   qual dos dois** — nunca assuma.
2. **Minimo de 3 componentes por jornada.** Menos de 3 nao prova convencao, prova
   coincidencia. Se vier menos, **bloqueie a extracao** e peca mais exemplos.
3. **Divergencia e documentada, nunca decidida.** Se os componentes usam convencoes
   diferentes entre si (ex.: 2 com token de cor, 1 com cor hardcoded), **registre as
   variantes** na secao e marque como "convencao inconsistente nesta jornada". Nunca
   escolha a maioria automaticamente.
4. **Lista canonica de jornadas.** Antes de criar uma secao nova, cheque o
   `.lwc-pattern-documenter/lwc-design-system/journeys-index.json`: se o nome novo se parece com um ja existente
   ("Atendimento" vs "Atendimento ao Cliente"), **avise e confirme** antes de criar —
   evita fragmentar o documento por variacao de digitacao.

## Delegacao

Esta skill (Skill 1) **nao delega craft** — ela so extrai e documenta, nao gera nada.
(A Skill 2, `lwc-pattern-generator`, e que delegara a geracao de LWC para as skills
oficiais `experience-lwc-generate` e `design-systems-slds-apply` — ver `references/architecture.md`.)

## Sinal deterministico — `pattern-extractor.mjs`

Em vez de ler cada arquivo e adivinhar, use o script (mesma filosofia do
`apex-coverage.mjs` do apex-test-loop: o script EXTRAI de forma mecanica, voce JULGA e
escreve):

```bash
# Listar os LWCs do projeto (para o menu de selecao — regra 1):
node .claude/skills/lwc-pattern-documenter/scripts/pattern-extractor.mjs \
  --list force-app/main/default/lwc

# Extrair os sinais dos componentes apontados:
node .claude/skills/lwc-pattern-documenter/scripts/pattern-extractor.mjs \
  --components <pasta1>,<pasta2>,<pasta3> --journey "Nome da Jornada"
```

O JSON de extracao traz, por componente e agregado:
- **Estrutura/composicao (a receita p/ gerar):** `html.skeleton` (outline indentado da
  composicao), `aggregate.html.representativeSkeleton` e `aggregate.html.modalSkeleton`
  (esqueletos ja escolhidos, prontos para colar), `aggregate.html.rootTags`, `customTags`
  (filhos `c-*`).
- **Utilitarios compartilhados:** `aggregate.js.sharedUtils` — a superficie de API dos
  `c/xUtil` importados por varios componentes (o extrator LE o util e lista os exports).
  Se 14/18 importam `c/consorcioUtil`, o componente novo TEM que usa-lo corretamente.
- **Naming:** `naming.style`, `aggregate.naming.dominantStyle`/`commonPrefix`.
- **CSS/SLDS:** `css` (custom properties consumidas/definidas, `:host`, cores hardcoded)
  + `aggregate.html.commonSldsClasses` (classes utilitarias `slds-*` mais usadas).
- **JS/dados:** imports, decorators, eventos (`aggregate.js.allEvents`), lifecycle;
  **contrato `@api`** (`commonApiMembers`/`allApiMembers` — nomes das props publicas),
  **alvos `@wire`** (`wireAdapters`), `aggregate.js.apexCallStyle` (forma da chamada Apex:
  then/await/try-catch/refreshApex), `js.toast` (`{users,variants}` — erro/feedback),
  `loadingStateUsers`/`html.spinnerUsers` (loading), `labelUsers`/`allLabels` (i18n).
- **Testes:** `aggregate.tests` (quantos tem `.test.js`).
- **Curadoria:** `aggregate.componentSpecifics` (unico de 1 comp), `partialConventions`
  (usado por um subconjunto), `aggregate.divergences` (conflito), `minComponentsMet`,
  `warnings`.

O que cada sinal significa, a ordem de prioridade e o template da secao estao em
`references/extraction-signals.md`. **Lembre: documentar quer frequencia; GERAR quer a
receita** — por isso estrutura, classes SLDS, loading/erro e forma do Apex sao de
primeira classe, nao detalhes.

## Escrita deterministica — `pattern-writer.mjs`

A escrita dos dois arquivos de saida **tambem e mecanica** — nunca reescreva a mao. O
`pattern-writer.mjs` faz o merge seguro (jornada nova anexa; existente substitui so a
sua secao; upsert do index; trava que aborta se fosse perder alguma jornada). Ver etapa
9 do guia e `references/guided-mode.md`. Motivo: um modelo reescrevendo o arquivo inteiro
ja apagou uma jornada gravada — o script elimina essa classe de bug.

> Sempre redirecione a saida para arquivo (`> extract.json`), nunca trunque por
> `tail`/`head` — igual a licao R-0023 do apex-test-loop.

## O GUIA INICIAL (9 etapas obrigatorias)

Nunca pule para a escrita. Toda execucao passa por estas etapas — detalhe e mensagens
em `references/guided-mode.md`:

1. **Mostrar o estado atual** — leia `.lwc-pattern-documenter/lwc-design-system/journeys-index.json` e liste as jornadas ja
   documentadas (se houver).
2. **Jornada nova ou atualizacao?** — receba o nome; se parecer com uma ja indexada,
   avise e confirme (regra 4).
3. **Modo de selecao** — pergunte: "voce tem os caminhos, ou quer que eu liste os LWCs
   do projeto?" (regra 1). Se listar, use `--list`.
4. **Confirmar a lista final** de componentes antes de extrair — checkpoint explicito.
5. **Rodar o extrator e checar o minimo** — `--components ... --journey ...`. Se
   `minComponentsMet` for `false`, **PARE** e peca mais componentes (regra 2). Nao
   escreva nada.
6. **Interpretar os sinais** (usando `references/extraction-signals.md`) — traduza o
   JSON em convencoes legiveis (naming, CSS/tokens, slots, eventos, a11y, composicao).
   **Registre TUDO** que foi identificado, em tres camadas: (a) **padroes
   compartilhados** entre os componentes; (b) **elementos especificos** de um so
   componente (`aggregate.componentSpecifics`) — atrelados ao arquivo de origem, pois
   o usuario quer o que for muito especifico registrado como daquele componente; (c)
   divergencias (etapa 7). Nao resuma a ponto de perder itens — o que nao entrar no
   documento, a Skill 2 nao vera.
7. **Tratar divergencia** — para cada item em `aggregate.divergences`, documente as
   variantes e marque "inconsistente"; nunca decida (regra 3).
8. **Preview + aprovacao** — mostre ao usuario o Markdown EXATO que vai escrever na
   secao, ANTES de salvar. So prossiga com o "ok" explicito.
9. **Escrever/atualizar (DETERMINISTICO — nunca a mao)** — ⚠️ **NUNCA reescreva os dois
   arquivos manualmente.** Um modelo reescrevendo o arquivo inteiro ja APAGOU uma jornada
   ja gravada (bug real). Use SEMPRE o `pattern-writer.mjs`, que faz o merge mecanico:
   ```bash
   # salve a secao aprovada na etapa 8 em section.md, depois:
   node .claude/skills/lwc-pattern-documenter/scripts/pattern-writer.mjs \
     --journey "Nome da Jornada" --components compA,compB,compC --section section.md
   ```
   O writer garante: jornada nova → **anexa** sem tocar nas existentes; jornada existente
   → substitui **so** a secao `## Padrao: <Nome>` dela, preservando cabecalho, ordem e as
   demais jornadas; e faz upsert seguro do `journeys-index.json` (nunca zera o array).
   Ele tem uma trava de integridade: **aborta** se o merge fosse perder qualquer jornada.

## Formato e local do documento

> **Onde fica (padrao do apex-test-loop):** a saida vai numa pasta **oculta e propria
> da ferramenta, na RAIZ do projeto** — `.lwc-pattern-documenter/lwc-design-system/` —
> **nunca em `docs/`**. Isso espelha a `apex-test-loop`, que grava seu estado em
> `.apex-test-loop/state/`: uma pasta com o nome da skill, fora de `docs/` e fora de
> `.claude/`, para (a) nao poluir a `docs/` do projeto do usuario, (b) deixar claro de
> quem e o diretorio, e (c) nao colidir com nada. A pasta e criada em tempo de execucao
> no projeto do usuario.

- `.lwc-pattern-documenter/lwc-design-system/design-patterns.md` — uma secao `## Padrao: <Jornada>` por jornada/produto, com
  componentes-fonte, data do scan, e as convencoes (naming, CSS/tokens, slots, eventos,
  composicao, a11y). **Elementos especificos de um componente** ficam numa subsecao
  "Elementos especificos por componente" (atrelados ao arquivo); **divergencias** numa
  subsecao "⚠️ Convencoes inconsistentes". Template completo em
  `references/extraction-signals.md`.
- `.lwc-pattern-documenter/lwc-design-system/journeys-index.json` — lista canonica: `[{ "journey", "components", "lastScan" }]`.
  Fonte de verdade da regra 4 (evitar duplicata) e do "estado atual" da etapa 1.

**Se os arquivos ou a pasta `.lwc-pattern-documenter/lwc-design-system/` nao existirem, CRIE-OS** (a partir
do template). A skill e dona exclusiva desse diretorio — nunca escreve fora dele.

## 🤝 Coexistencia com outras skills (em especial `apex-test-loop`)

Esta skill foi desenhada para conviver no MESMO projeto que a `apex-test-loop` (e as 7
skills oficiais que ela importa) **sem sobrescrever nada**. Garantias:

1. **Nao traz `.claude/settings.json`.** Esta skill nao precisa de guard/hook/permissoes
   proprias (so le arquivos e escreve `.md`/`.json`). A instalacao e **puramente
   aditiva**: copie a pasta `.claude/skills/lwc-pattern-documenter/` para o projeto e
   pronto. **NUNCA** substitua, mescle por cima, ou apague o `.claude/settings.json`
   existente — ele pertence a `apex-test-loop` (guard, `permissions.deny`,
   `bypassPermissions`) e sobrescreve-lo destruiria a seguranca daquela skill.
2. **Escreve so em `.lwc-pattern-documenter/lwc-design-system/`.** Nao toca em `.apex-test-loop/state/`
   (estado da apex-test-loop), no `RECOMMENDATIONS.md` de outra skill, nem em nenhum
   arquivo `.cls`/`.trigger`/`force-app/classes` — dominios da apex-test-loop.
3. **Convive com o guard da apex-test-loop, se presente.** O hook `guard.mjs` daquela
   skill so bloqueia acoes destrutivas/sobrescrita sobre codigo Apex (`.cls`/`.trigger`)
   — ele **libera** as escritas de `.md`/`.json` desta skill e a leitura (somente
   leitura) de LWC. Ou seja: o guard alheio, se ativo, e uma rede de seguranca extra,
   nunca um bloqueio ao trabalho legitimo desta skill.
4. **Sem colisao de gatilhos.** O bloco TRIGGER/DO NOT TRIGGER (frontmatter) e escopado a
   documentacao de padroes de LWC; a `apex-test-loop` dispara em cobertura de teste Apex.
   Elas nao se ativam uma pela outra.

Resumo: instalar esta skill ao lado da `apex-test-loop` e seguro e reversivel — some a
pasta da skill e a pasta `.lwc-pattern-documenter/lwc-design-system/`, nada mais e afetado.

## Encerramento

Resumo curto: qual jornada foi documentada/atualizada, quantos componentes, e se houve
divergencias registradas. Se apareceu uma licao reutilizavel sobre a propria skill,
anote em `RECOMMENDATIONS.md` (quando existir) — mesmo modelo de ledger do apex-test-loop.

## Referencias

- `references/extraction-signals.md` — o que cada sinal significa, ordem de prioridade,
  e o template da secao do documento.
- `references/guided-mode.md` — o roteiro detalhado das 9 etapas (mensagens em PT).
- `references/architecture.md` — a arquitetura completa das 2 skills e as
  decisoes de design por tras destas regras.
