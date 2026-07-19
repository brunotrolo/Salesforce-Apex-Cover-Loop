# Bloqueios de RUNTIME — quando o teste falha por causa da ORG, nao do teste

`blockedByDependency` cobre falha de **deploy** (dependencia que nao compila). Esta
referencia cobre o outro caso, aprendido em campo (run real do CaseHandler): o teste
compila e roda, mas **falha em execucao** por automacao ou configuracao da org:

- um **Flow/Process/Validation Rule** bloqueia o DML do setup de teste;
- uma **configuracao esperada nao existe** na org (Entitlements, Queues, Groups,
  Custom Settings vazios) e o codigo estoura (`List index out of bounds`, NPE);
- um **governor limit** estoura no teste (CPU time, SOQL limit), geralmente em bulk.

## ⛔ O que NUNCA fazer diante de um bloqueio de runtime

Estes tres atalhos foram observados em campo e sao **proibidos** (violam as Regras
de Ouro — se voce se pegar fazendo isso, PARE e registre no ledger imediatamente):

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
3. **Se a causa e a producao** (ex.: SOQL dentro de loop): isso e um **ACHADO DE
   PRODUCAO** — o teste bulk esta fazendo o trabalho dele. Registre no relatorio
   final (secao "Achados de producao") e no ledger; a correcao e da
   **platform-apex-generate** com aprovacao humana, fora deste loop. O teste bulk
   **permanece** (falhando ou como bloqueio documentado) — remove-lo esconderia o bug.

### 2) Flow/automacao bloqueando o DML do setup

Ordem de ataque (do mais legitimo ao ultimo recurso):
1. **Satisfaca a automacao**: leia o criterio do Flow/Validation e crie dados que
   passem por ele (muitas vezes e so um campo/relacionamento que falta). Delegue o
   padrao de dados a **platform-data-manage**.
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

## Regra do platô (sinal de cobertura de fachada)

Se a cobertura **nao subir por 2 iteracoes seguidas** enquanto o numero de testes
cresce, PARE de escrever testes novos e diagnostique:
- Compare `uncoveredLines` da iteracao atual com a anterior: **identicas?** Entao os
  testes novos estao cobrindo linhas ja cobertas.
- A partir dai, **cada teste novo deve nomear as linhas-alvo** (do `uncoveredLines`)
  que pretende cobrir — e a iteracao seguinte confere se elas sairam da lista.
- Se as linhas restantes forem todas dependentes de config/feature ausente, nao ha o
  que "forcar": documente-as como inalcancaveis neste ambiente e ajuste a meta com o
  usuario (veja abaixo).

## Meta honesta

99% e a meta padrao, nao uma promessa cega. No Passo 0, se a classe depende
fortemente de configuracao de org (dezenas de record types, Entitlements, Queues),
**diga isso ao usuario desde o inicio** e re-pacte: *"a meta pratica neste ambiente e
X%, porque os ramos A/B/C dependem de config que nao existe aqui — na org correta
eles se tornam alcancaveis"*. Meta ajustada com transparencia vale mais que 99% de
fachada.

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
> *(a) apontar para uma org/sandbox que tenha essa configuracao completa;*
> *(b) aceitar X% como meta final para este ambiente e concluir o run aqui;*
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
