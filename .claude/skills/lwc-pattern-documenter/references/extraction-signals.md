# Sinais de extracao — o que documentar, em que prioridade

Referencia do que o `pattern-extractor.mjs` extrai e como o agente deve traduzir isso
em convencoes legiveis na secao do `.lwc-pattern-documenter/lwc-design-system/design-patterns.md`. A ordem abaixo e a
**prioridade** — os primeiros sinais sao os que mais definem "o jeito da org" e os que
a futura `lwc-pattern-generator` mais vai consultar ao gerar.

> **Documentar × Gerar (leia isto):** para DOCUMENTAR, frequencia basta ("9/9 usam
> lightning-card"). Para GERAR um componente perfeito, a Skill 2 precisa da **receita**
> — o "como", nao so o "o que". Por isso os sinais de ESTRUTURA, classes SLDS, loading/
> erro e forma da chamada Apex (abaixo) sao tao importantes quanto naming/tokens: sem
> eles o documento diz "o que aparece" mas nao "como montar".

## Prioridade 0 — Estrutura / Composicao (a RECEITA — o mais importante para gerar)

- **`html.skeleton`** (por componente) — um outline indentado dos elementos estruturais
  (lightning-*, c-*, containers de bloco, `template` com diretiva), com dica de classe
  SLDS e diretiva. **E a receita de composicao**: mostra COMO os componentes da jornada
  sao montados (ex.: `lightning-card > div.slds-grid > template[lwc:if] > ...`), nao so
  quais tags existem. Registre o esqueleto REPRESENTATIVO da jornada (o padrao comum;
  se variam, mostre 1-2 exemplos reais). **Se a jornada tem um arquetipo de modal, cole
  tambem um skeleton de modal representativo — nao so o de grid.**
- **`aggregate.html.representativeSkeleton`** — `{ component, skeleton }`: o esqueleto
  mais completo da jornada (componente com mais estrutura), ja escolhido pelo extrator.
  Cole-o na secao Estrutura.
- **`aggregate.html.modalSkeleton`** — `{ component, skeleton }`: se a jornada tem
  arquetipo de modal (`slds-modal`), o extrator emite o skeleton do modal mais completo —
  **a receita copiavel de modal**, separada do skeleton de grid. Cole-a tambem.
- **`aggregate.html.rootTags`** — a tag raiz/wrapper de topo mais comum (ex.:
  `lightning-card` em 9/9). O componente novo deve nascer com o mesmo wrapper.
- **`aggregate.html.allCustomTags`** / **`html.customTags`** — componentes filhos `c-*`
  reutilizados (composicao parent-child real da org).
- **`aggregate.js.sharedUtils`** — **superficie de API dos utilitarios locais** (`c/xUtil`)
  importados por varios componentes: quais funcoes o util exporta. Se 14/18 importam
  `c/consorcioUtil`, o componente novo TEM que usa-lo — e a Skill 2 precisa saber quais
  funcoes existem. Registre os exports (nome + assinatura, quando extraivel).

## Prioridade 1 — Naming

- **`naming.style`** por componente (camelCase, PascalCase, kebab-case...) e
  **`aggregate.naming.dominantStyle`**. LWC exige camelCase na pasta, mas o sinal pega
  desvios.
- **`aggregate.naming.commonPrefix`** — prefixo compartilhado (ex.: todos comecam com
  `invoice`, ou um prefixo de namespace). Se existir, e uma convencao forte da jornada.
- **Divergencia** (`naming.style`): estilos diferentes entre componentes → documentar
  as variantes, nao escolher.

## Prioridade 2 — CSS & Design Tokens

- **`css.customPropsConsumed`** (`var(--x)`) e **`css.usesSlds`** — a org usa tokens
  SLDS/custom properties? Quais tokens aparecem (`aggregate.css.allTokensSeen`)?
- **`css.hardcodedColors`** — cores hardcoded (`#fff`, `rgb(...)`) sao o anti-sinal:
  quebram tema/dark mode e fogem do design system.
- **`css.usesHost`** — escopo via `:host` (boa pratica de encapsulamento).
- **`aggregate.html.commonSldsClasses`** — **as classes utilitarias SLDS mais usadas no
  HTML** (`class="slds-..."`), com contagem. Parte ENORME da convencao real de LWC/SLDS
  que so olhar o CSS nao captura (ex.: `slds-grid`, `slds-p-around_medium`, `slds-wrap`,
  `slds-col`, `slds-box`). Registre as recorrentes — a Skill 2 vai reproduzir esse
  vocabulario de layout/spacing.
- **Divergencia** (`css.colorStrategy`): uns usam token, outros hardcoded → a jornada
  tem convencao de cor inconsistente. Documentar as duas, marcar.

## Prioridade 3 — Slots & Composicao

- **`html.slots`** — slots nomeados (`header`, `content`, `footer`) e default. O padrao
  de slots define como os componentes sao compostos/reusados.
- **`aggregate.html.componentsWithSlots`** — quantos usam slots (nem todo componente
  precisa; informativo).
- **`html.lightningTags`** — base components `lightning-*` usados: revela se a org
  prefere Lightning Base Components (recomendado pelo SLDS) vs HTML cru.

## Prioridade 4 — Eventos (JavaScript)

- **`js.events`** (nomes em `new CustomEvent('...')`) e **`aggregate.js.allEvents`**. A
  convencao de nome de evento e chave para composicao parent-child.
- **Divergencia** (`js.eventNaming`): mistura de estilos (uns com prefixo `on`, outros
  sem) → documentar o conflito.

## Prioridade 5 — Data & Decorators

- **`aggregate.js.commonApiMembers`** / **`allApiMembers`** — **os NOMES das propriedades
  `@api`** (contrato publico: `recordId`, `objectApiName`, etc.). E o que o componente
  expoe por fora — o primeiro codigo que a geracao escreve. Registre o contrato tipico
  da jornada.
- **`aggregate.js.wireAdapters`** — **os ALVOS do `@wire`** (`getRecord`, `getObjectInfo`,
  `CurrentPageReference`, `MessageContext`, ou um metodo Apex), com contagem. Padrao de
  acesso a dados.
- **`js.decorators`** (`@api`, `@track`, `@wire`) — contagens. `aggregate.js.wireUsers`/
  `apexUsers` mostram a estrategia dominante (wire adapters vs Apex imperativo).
- **`js.imports`** — bibliotecas/modulos recorrentes (uiRecordApi, navigation, toast,
  Apex controllers). Imports repetidos entre componentes = convencao da org.
- **`js.lifecycle`** — hooks usados.

## Prioridade 5.1 — Loading & Erro (padrao de UX que o componente novo tem que seguir)

- **`aggregate.html.spinnerUsers`** + **`aggregate.js.loadingStateUsers`** — a jornada
  padroniza estado de loading? (`lightning-spinner` + `isLoading`/`showSpinner`). Se sim,
  o componente novo precisa ter o mesmo padrao (senao nasce "sem carregando").
- **`aggregate.js.toast`** — `{ users, variants }`: quantos usam `ShowToastEvent` e com
  quais variantes (`error`/`success`/`warning`/`info`). Padrao de feedback de erro/sucesso.

## Prioridade 5.2 — Forma da chamada Apex (a receita do call, nao so "usa Apex")

- **`aggregate.js.apexCallStyle`** — contagem de `usesThen` (`.then/.catch`), `usesAwait`
  (`async/await`), `usesTryCatch`, `refreshApex`. Diz COMO a org chama Apex
  imperativo. Um componente novo tecnicamente correto mas com estilo destoante (ex.:
  `.then` numa jornada 100% `async/await`) fica fora do padrao. Se houver mistura,
  registre as duas formas.

## Prioridade 5.3 — Custom Labels / i18n

- **`aggregate.js.labelUsers`** + **`aggregate.js.allLabels`** — a jornada usa Custom
  Labels (`@salesforce/label/...`) em vez de string hardcoded? Se e convencao, o
  componente novo deve importar labels, nao escrever texto fixo.

## Prioridade 5.4 — Testes Jest

- **`aggregate.tests`** — `{ componentsWithTests, total }`: quantos componentes tem
  `.test.js` companheiro. Se a jornada testa, um componente novo sem teste ja nasce fora
  do padrao (a Skill 2 deve gerar o teste tambem).

## Prioridade 6 — Acessibilidade (a11y)

- **`html.aria`**, **`html.roles`**, **`html.hasTabindex`**, **`html.hasAlt`** e o
  **`aggregate.html.a11yAvg`** (media de sinais de a11y por componente). Baixo = a org
  provavelmente nao padroniza acessibilidade (registrar como observacao, nao inventar).

## Prioridade 7 — Metadados

- **`meta.apiVersion`** (divergencia de versao entre componentes e sinal de idade
  distinta), **`meta.isExposed`**, **`meta.targets`** (onde o componente aparece:
  RecordPage, App, Home, Community, Tab).

---

## Template da secao no `.lwc-pattern-documenter/lwc-design-system/design-patterns.md`

Ao escrever (etapa 9), use esta estrutura por jornada:

```markdown
## Padrao: <Nome da Jornada/Produto>

**Componentes-fonte:** compA, compB, compC
**Componentes analisados:** 3
**Ultimo scan:** AAAA-MM-DD

### Estrutura & Composicao (a receita)
<tag raiz/wrapper comum (ex.: lightning-card com title/icon-name); esqueleto
representativo da composicao — cole 1 exemplo real de `html.skeleton`; se ha arquetipo
de modal, cole tambem 1 skeleton de modal; componentes filhos c-* reutilizados;
utilitarios locais compartilhados (c/xUtil) e sua superficie de API>

### Naming
<estilo dominante + prefixo comum, com exemplo real>

### CSS, Tokens & Classes SLDS
<usa tokens/SLDS custom properties? quais? :host? cores hardcoded? +
classes utilitarias SLDS mais usadas (slds-grid, slds-p-around_*, slds-col...)>

### Slots
<slots nomeados, se houver (muitas jornadas nao usam)>

### Eventos
<convencao de nome de evento, com exemplos reais>

### Dados & Apex
<contrato @api tipico (nomes: recordId, objectApiName...); alvos @wire (getRecord,
getObjectInfo, MessageContext, Apex...); @wire vs Apex imperativo; FORMA da chamada Apex
(.then/.catch vs async-await vs try/catch; refreshApex); imports recorrentes>

### Loading & Erro
<padrao de loading (spinner + isLoading)? feedback de erro (ShowToastEvent, variante)?>

### i18n
<usa Custom Labels (@salesforce/label) ou texto hardcoded?>

### Acessibilidade
<nivel observado de ARIA/role/alt — sem inventar o que nao existe>

### Testes
<quantos componentes tem .test.js companheiro (aggregate.tests)>

### Metadados
<apiVersion, targets tipicos>

<!-- SO se `aggregate.componentSpecifics` tiver itens: -->
### Elementos especificos por componente
Itens que aparecem em UM SO componente desta jornada (nao sao padrao compartilhado,
mas foram identificados e devem ficar registrados atrelados ao componente de origem):
- **compA:** <slots/eventos/tokens/imports/tags/classes/labels exclusivos deste componente>
- **compB:** <...>

<!-- SO se `aggregate.partialConventions` tiver itens: -->
### Convencoes parciais (usadas por parte dos componentes)
Itens usados por um SUBCONJUNTO (nem todos, nem um so) — nao sao regra da jornada nem
exclusividade; registre como observacao com a contagem (ex.: `slds-grid` em 2/3):
- **<dimensao>:** item (N/total), ...

<!-- SO se houver divergencias no aggregate: -->
### ⚠️ Convencoes inconsistentes nesta jornada
- **<sinal>:** <as variantes encontradas, com quais componentes usam cada uma>.
  _Decisao pendente do usuario — a skill nao escolheu._
```

**Distincao importante (compartilhado × especifico × divergente):**
- **Padrao compartilhado** = o sinal aparece em varios componentes (vai nas secoes de
  Naming, CSS, Slots, Eventos... como a convencao da jornada).
- **Elemento especifico** (`aggregate.componentSpecifics`) = so UM componente tem
  aquele item; nao e conflito, e so unico. Vai em "Elementos especificos por
  componente", atrelado ao arquivo. (Pedido explicito do usuario: registrar tudo, e o
  que for muito especifico de um arquivo fica marcado como daquele arquivo.)
- **Divergencia** (`aggregate.divergences`) = os componentes DISCORDAM sobre a mesma
  convencao (ex.: uns com token, outros com cor hardcoded). Vai em "⚠️ Convencoes
  inconsistentes", com a decisao deixada para o usuario.

Registre **todos** os elementos identificados — nao resuma a ponto de perder itens.
O documento e a fonte que a Skill 2 vai usar; o que nao for registrado, ela nao vera.

**Regras de escrita:**
- Use **exemplos reais** extraidos dos componentes (o token real, o nome de evento
  real), nunca inventados.
- Nao afirme o que os sinais nao mostram (ex.: se `a11yAvg` e 0, escreva "nenhum sinal
  de a11y padronizado observado", nao "a org caprichou em acessibilidade").
- Divergencia SEMPRE vira subsecao "⚠️ Convencoes inconsistentes" — nunca some numa
  escolha silenciosa.
