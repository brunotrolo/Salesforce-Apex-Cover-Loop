# Bloqueios de RUNTIME — quando o teste falha por causa da ORG, nao do teste

`blockedByDependency` cobre falha de **deploy** (dependencia que nao compila). Esta
referencia cobre o outro caso, aprendido em campo (run real do CaseHandler): o teste
compila e roda, mas **falha em execucao** por automacao ou configuracao da org:

- um **Flow/Process/Validation Rule** bloqueia o DML do setup de teste;
- uma **configuracao esperada nao existe** na org (Entitlements, Queues, Groups,
  Custom Settings vazios) e o codigo estoura (`List index out of bounds`, NPE);
- um **governor limit** estoura no teste (CPU time, SOQL limit), geralmente em bulk.

## ⛔ O que (nao) fazer diante de um bloqueio de runtime — depende do MODO

> **Modo MVP (padrao):** o objetivo e cobertura+testes passando+portabilidade. Guardas
> de config (`if (!lista.isEmpty())`) e try/catch de portabilidade sao **permitidos**
> como fallback — MAS lembre: excecao/guard que desvia o fluxo **corta a cobertura**
> das linhas seguintes, entao **dado real continua sendo a melhor tatica de
> COBERTURA** (use o guard como fallback, nao como primeira opcao). O que segue
> proibido mesmo no MVP: remover teste que ja passa, e deixar teste falhando.

No **modo `--rigoroso`**, estes tres atalhos sao **proibidos** (observados em campo):

1. **Remover/reduzir o cenario obrigatorio** (ex.: apagar o teste bulk porque o CPU
   estourou). O cenario existe para pegar exatamente esse tipo de problema.
2. **Engolir a excecao com try/catch** para o teste "passar". Um teste que captura o
   erro e segue nao valida NADA — vira execucao de codigo, nao teste.
3. **Guardar o assert com `if (!lista.isEmpty())`** e afins. Mesmo efeito: o teste
   passa vazio, silenciosamente.

## O que fazer — por tipo de bloqueio

### 1) Governor limit (CPU/SOQL) estourando no teste

Ordem de ataque:
1. **Diagnostique antes de mexer**: delegue a **platform-apex-logs-debug** (e a
   especialista em governor limits). Pergunta-chave: o consumo vem do TESTE (setup
   pesado, operacoes combinadas) ou da PRODUCAO (SOQL/DML em loop, logica O(n²))?
2. **Se a causa e o teste**: divida — um cenario por metodo (nunca "mega-teste" com
   dezenas de combinacoes); use `Test.startTest()/stopTest()` para zerar os limites
   antes da acao sob teste; mova setup pesado para `@TestSetup`.

   **Caso mais comum e traicoeiro — bulk DML numa trigger pesada (aprendido em campo):**
   um unico `insert`/`update` de VARIOS registros dentro de um `Test.startTest()/
   stopTest()`, quando cada registro dispara uma trigger que faz muito trabalho por
   registro (`getDescribe`/`getRecordTypeInfos`, dezenas/centenas de `if`), soma CPU
   ate estourar os ~10s. Ex. real: 12 `Case` num unico `update` × trigger com ~200
   `if` + ~35 `getDescribe` por Case = CPU limit.
   - **A correcao e SPLIT, nao reducao de variedade.** Divida o metodo em **grupos de
     poucos registros (comece por ~3-4), cada grupo com seu proprio `Test.startTest()/
     stopTest()`** — cada `startTest` reseta o contador de CPU, entao cada grupo ganha
     um orcamento de ~10s fresco. Os N cenarios distintos continuam TODOS cobertos, so
     redistribuidos entre os grupos/metodos (no caso real: 12 cenarios preservados em
     4 grupos). **Nunca remova o cenario** — compare com o anti-padrao A-0002 (e R-0015),
     onde o bulk foi apagado; o split e a resposta certa.
   - **Heuristica de tamanho:** o "~3-4" e ponto de partida, nao lei. Se um unico
     registro ja custa ~800ms de CPU na trigger, ate 10 estouram — dimensione o grupo
     para ficar BEM abaixo do teto (nao encostado nele). Se a trigger tem `getDescribe`/
     `getRecordTypeInfos` no caminho ou muitos `if`, assuma poucos por DML **desde ja**
     (split preventivo), sem esperar a falha.
   - **Intermitencia (o motivo de o portao de estabilidade existir):** CPU limit
     depende da CARGA da org no momento — um metodo que consome ~9s passa numa org
     vazia e ESTOURA numa cheia. Por isso a MESMA suite pode falhar 17 numa maquina e
     1 noutra. Um metodo que "passou uma vez" perto do teto NAO e portavel: o script
     `apex-coverage.mjs` sinaliza esses em `slowTests`, e o passo 4 do SKILL.md manda
     dividi-los ANTES de concluir, mesmo que estejam passando agora.
   - **Varredura preventiva (nao so o teste que falhou):** ao diagnosticar um CPU limit
     por bulk, procure na classe de teste OUTROS lotes grandes (List com ~5+ registros
     em `insert`/`update`/`Database.insert|update` dentro de `startTest/stopTest`) e
     aplique o mesmo split — os vizinhos costumam estar igualmente na beira. Use a
     ferramenta **Grep** do agente (nao `grep` de shell; R-0031) e registre no checkpoint.
   - **Achado de producao conexo:** trigger que gasta CPU alta por registro
     (`getDescribe` nao cacheado, `if` em cascata que deveria ser `Map`) e candidata a
     **achado de producao** (escala mal em bulk real) — reporte no encerramento sem
     tocar na producao; a correcao e da `platform-apex-generate` com aprovacao humana.
3. **Se a causa e a producao** (ex.: SOQL dentro de loop): isso e um **ACHADO DE
   PRODUCAO** — o teste bulk esta fazendo o trabalho dele. Registre no relatorio
   final (secao "Achados de producao") e no ledger; a correcao e da
   **platform-apex-generate** com aprovacao humana, fora deste loop. O CENARIO bulk
   permanece — mas **reestruturado/reduzido ate PASSAR** (teste falhando e
   deploy-blocker em qualquer modo, Trava 5), com o tamanho reduzido e o motivo
   documentados no relatorio. Remover o cenario por completo esconderia o bug.

### 2) Flow/automacao bloqueando o DML do setup

Ordem de ataque (do mais legitimo ao ultimo recurso):
1. **Satisfaca a automacao**: leia o criterio do Flow/Validation e crie dados que
   passem por ele (muitas vezes e so um campo/relacionamento que falta). Delegue o
   padrao de dados a **platform-data-manage**.
   **Atalho de ouro (aprendido em campo):** antes de decifrar o Flow na unha,
   **procure classes de teste EXISTENTES** (no repo ou na org) que ja inserem esse
   objeto — se uma classe de teste humana roda em producao fazendo `insert Case`,
   ela E a receita pronta do dado que passa pela automacao. Minere o setup dela
   (campos, relacionamentos, ordem) em vez de redescobrir por tentativa e erro.
   (No benchmark real: o agente concluiu "Flow bloqueia DML" e foi para memoria,
   enquanto a classe de teste humana da mesma org fazia 54 DMLs de Case havia anos.)
2. **`System.runAs`** com usuario adequado, se o bloqueio for de perfil/permissao.
3. **Teste em memoria (sem DML) — ULTIMO recurso, com regras**: vale para logica
   pura (metodo recebe objetos e preenche campos). Mas ele **nao cobre** triggers,
   SOQL real, nem persistencia — entao: (a) documente a limitacao no relatorio e no
   checkpoint; (b) marque as linhas dependentes de DML real como possivelmente
   inalcancaveis neste ambiente; (c) NUNCA o apresente como equivalente ao teste
   com DML. Silencio aqui = cobertura de fachada.
4. **Pergunte ao humano**: desativar o Flow numa sandbox/scratch de teste, ou rodar
   numa org sem a automacao, pode ser a solucao certa — e a decisao e dele.

### 3) Configuracao da org ausente (Entitlements, Queues, Groups...)

1. **Crie o dado de verdade no teste**, quando o tipo permite:
   - **Queues/Groups**: podem ser criados em teste via DML; envolva em
     `System.runAs(new User(Id = UserInfo.getUserId()))` para evitar `MIXED_DML`.
   - **Entitlements**: criaveis em teste **se** o Entitlement Management estiver
     habilitado na org (e feature de org, nao dado).
   Delegue o padrao a **platform-data-manage** / TestDataFactory.
2. **Se e feature de org desabilitada** (nao da para criar em teste): isso e um
   **bloqueio genuino de ambiente** — trate como o `blockedByDependency`: PARE,
   explique ao usuario ("a org de teste nao tem X habilitado") e ofereca: (a) org
   com a feature; (b) marcar os ramos dependentes como inalcancaveis documentados.
3. **Se o codigo de producao deveria checar `isEmpty()` e nao checa**: registre como
   **achado de producao** (robustez), sem tocar na producao.

### 4) Linhas atras de `FeatureManagement`/permissao (inalcancaveis por design)

Padrao comum e recorrente (visto em campo): ramos controlados por
`FeatureManagement.checkPermission('...')`, custom permissions, ou checagens de
perfil/licenca que **retornam um valor fixo em contexto de teste** e nao podem ser
setados como `true` via Apex de teste. Sao um numero PEQUENO de linhas bem
localizadas (tipicamente 1-5), quase sempre um `if (FeatureManagement...)`.

- **Reconheca cedo e nao queime iteracoes:** se a `uncoveredLine` cai exatamente
  numa checagem de `FeatureManagement`/custom permission, **e inalcancavel neste
  ambiente** — nao tente "mais um teste". Marque e siga.
- **Documente** na secao "Limitacoes de cobertura" do encerramento e no checkpoint,
  com o motivo ("linha N: FeatureManagement.checkPermission — nao setavel em teste").
- **Nao refatore a producao** so para cobrir (ex.: extrair um wrapper `@TestVisible`)
  — isso e mudanca de producao, fora do escopo desta skill; no maximo vira sugestao
  de **achado de producao** para o humano decidir com a `platform-apex-generate`.
- **Efeito na meta:** poucas linhas assim derrubam o teto de 100% para ~99% de forma
  legitima — e exatamente o tipo de teto honesto que o MVP aceita.

## Regra do platô (sinal de cobertura de fachada)

Se a cobertura **nao subir por 2 iteracoes seguidas** enquanto o numero de testes
cresce, PARE de escrever testes novos e diagnostique:
- Compare `uncoveredLines` da iteracao atual com a anterior: **identicas?** Entao os
  testes novos estao cobrindo linhas ja cobertas.
- A partir dai, **cada teste novo deve nomear as linhas-alvo** (do `uncoveredLines`)
  que pretende cobrir — e a iteracao seguinte confere se elas sairam da lista.
- Se as linhas restantes forem todas dependentes de config/feature ausente, nao ha o
  que "forcar": documente-as **uma a uma** como inalcancaveis neste ambiente (linha +
  motivo). A meta NAO cai por isso (veja abaixo).

## Meta honesta — piso fixo ≥99%, nunca "aceitar X%"

**A meta e piso fixo ≥99% e o agente NUNCA a abaixa.** Nao escreva `meta_cobertura < 99`
nem "aceite X%" por conta propria — isso e Trava (SKILL.md, ⛔ Travas #6). O jeito
honesto de lidar com o que nao da pra cobrir NAO e derrubar o numero, e sim:

- **Poucas linhas inalcancaveis** (FeatureManagement, permissao, config ausente) →
  **documente cada uma** (linha + motivo). Elas levam 100%→~99% de forma legitima —
  ainda ≥99, ainda dentro da meta.
- **Muitas linhas bloqueadas (99% genuinamente inatingivel neste ambiente)** → NAO
  escreva 95/90/85. **PARE (parada de seguranca)** e apresente as opcoes ao humano
  (abaixo). So o DONO, explicitamente, pode aceitar uma excecao — o agente nunca
  decide isso sozinho (foi o erro do modelo fraco: escrever 95 no state file sem aval).

### Quando o teto so fica claro DEPOIS de ja rodar iteracoes

Nem sempre da para saber no Passo 0 — muitas vezes o teto so aparece depois que a
regra do platô te fez diagnosticar as `uncoveredLines` a fundo e ficou claro que
aquelas linhas especificas **nao sao "precisa de mais teste"**, sao **"bloqueadas
pelo ambiente"** (Flow, feature de org desabilitada, config ausente que nao pode ser
criada em teste). Quando isso acontecer, **pare e apresente ao usuario um pedido de
confirmacao concreto**, com opcoes nomeadas — nao decida sozinho e nao force:

> *"A cobertura estabilizou em X%. As linhas [lista] dependem de [Groups/Queues/
> Entitlements/Flow] que [nao existem nesta org / estao bloqueados pela automacao].
> Suas opcoes:*
> *(a) apontar para uma org/sandbox que tenha essa configuracao completa (preferida —
>      mantem a meta ≥99% de verdade);*
> *(b) VOCE (dono) aceitar explicitamente essas linhas como excecoes documentadas e
>      concluir — a meta segue registrada como 99 com as linhas listadas como
>      inalcancaveis; o agente NAO escreve um numero menor por conta propria;*
> *(c) [so se for dev/treino] usar `--scaffold` para o que for metadata criavel
> (objetos/campos custom, `__mdt`) — mas sendo claro que features de org habilitadas
> (ex.: Entitlement Management) e automacoes (Flow) NAO sao scaffoldable, essas
> exigem a opcao (a).*
> *Qual voce prefere?"*

Registre a resposta no checkpoint (`state/<Classe>.md`) e no ledger se for uma
decisao relevante — assim, se o run for retomado depois, o proximo agente sabe que
a pergunta ja foi feita e qual foi a resposta (nao pergunte de novo).

## Registro imediato no ledger

Bloqueio de runtime que resulte em **qualquer** compromisso de qualidade (cenario
nao coberto, teste em memoria, meta ajustada) e **friccao grave**: registre no
`RECOMMENDATIONS.md` **na hora** (nao espere o fim do run) e mencione no checkpoint
(`state/<Classe>.md`, secao Bloqueios). O usuario decide com informacao fresca.
