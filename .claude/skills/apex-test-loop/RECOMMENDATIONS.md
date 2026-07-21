# Recomendacoes de melhoria — skill apex-test-loop

Registro **vivo** de melhorias para a propria skill. A fase de retrospectiva do
loop (autoaprendizado) anexa propostas aqui com base no que aconteceu num run
real; um humano revisa e decide. Este arquivo viaja junto com a skill, entao
existe tanto no repositorio-casa quanto na copia dentro do seu projeto Salesforce.

## Como funciona (o ciclo)

1. **Skill propoe** — ao terminar um run **com friccao real** (o guard bloqueou
   algo, dependencia travou o deploy, muitas iteracoes sem evoluir, precisou de
   decisao humana, faltou orientacao numa referencia...), a skill ANEXA aqui uma
   proposta com status `Proposta`. Em runs limpos, nao anexa nada (evita ruido).
2. **Voce pede** — "leia as recomendacoes e ajuste a skill se concordar".
3. **Revisao** — cada item recebe um status final; as aprovadas sao aplicadas e o
   PR/commit e anotado.

## Status

🟡 **Proposta** · 🟢 **Aprovada** (vamos aplicar) · ✅ **Aplicada** (feita, com PR) ·
⚪ **Reprovada** (com motivo)

## Regras para a skill (ao anexar)

- **Nao duplicar**: se ja existe item (aberto ou aplicado) sobre o mesmo ponto,
  nao crie outro — no maximo, adicione uma nota.
- **Ser concreto**: descreva o gatilho real, o problema e a mudanca proposta em
  termos acionaveis (qual arquivo/regra/passo). Nada de generico.
- **ID sequencial**: use o proximo `R-XXXX` livre.
- **Poucos e bons**: no maximo ~3 por run; so o que teve friccao de verdade.
- **LOCAL, sem `git push`**: 🚫 nunca rode `git add/commit/push` de recomendacoes.
  Este arquivo e uma **copia** dentro do projeto do dev, sem acesso de escrita ao
  repo-casa; se varios devs empurrassem, um sobrescreveria o outro. Apenas edite o
  `.md` e avise o usuario que a recomendacao ficou **local** e deve ser enviada ao
  mantenedor quando ele abrir a coleta (a consolidacao no repo e central e manual —
  ver `references/contribution-guidelines.md` → "papel do mantenedor"). Nunca diga que
  "registrou no GitHub".

---

## Recomendacoes

### R-0001 — Proibir explicitamente apagar/mover/sobrescrever a classe de producao
- **Status:** ✅ Aplicada (PR #7)
- **Data:** 2026-07-18
- **Gatilho:** O loop apagou/sobrescreveu a classe de producao ao encontrar
  dependencias nao resolvidas.
- **Problema:** As regras so falavam de "nao inflar cobertura"; nao havia proibicao
  explicita nem imposta contra acoes destrutivas na producao.
- **Melhoria:** Secao "🚫 NUNCA FACA" no SKILL.md + `permissions.deny` +
  hook `PreToolUse` (`guard.mjs`).

### R-0002 — Regras de permissao tambem em PowerShell (Windows sem Git Bash)
- **Status:** ✅ Aplicada (PR #6)
- **Data:** 2026-07-18
- **Gatilho:** No Windows, o loop pedia aprovacao para todo comando mesmo com a
  allowlist.
- **Problema:** `Bash(...)` e `PowerShell(...)` sao categorias diferentes; sem Git
  Bash o shell padrao e o PowerShell.
- **Melhoria:** Regras `PowerShell(...)` espelhando as `Bash(...)` no settings.json.

### R-0003 — Deploy somente da classe de teste (nao reenviar producao)
- **Status:** ✅ Aplicada (PR #8)
- **Data:** 2026-07-18
- **Gatilho:** O script reenviava a classe de producao a cada iteracao, abrindo
  espaco para sobrescrita.
- **Problema:** A producao ja esta na org; reenviar e desnecessario e arriscado.
- **Melhoria:** Flag `--test-only` + `--test-level NoTestRun` no apex-coverage.mjs.

### R-0004 — Bloquear escrita (Write/Edit) na classe de producao
- **Status:** ✅ Aplicada (PR #8)
- **Data:** 2026-07-18
- **Gatilho:** O vetor real do bug foi sobrescrever a `.cls` pelo tool Write, por
  baixo das travas de Bash.
- **Problema:** O guard so inspecionava comandos; escrita de arquivo passava direto.
- **Melhoria:** `classifyWrite` no guard.mjs + matcher `Write|Edit` no hook.

### R-0005 — Tratar deploy bloqueado por dependencia sem recriar/stubar
- **Status:** ✅ Aplicada (PR #8)
- **Data:** 2026-07-18
- **Gatilho:** Diante de dependencia faltando, o loop tentava recriar/stubar a classe.
- **Problema:** Recriar/stubar corrompe ou mascara a classe real.
- **Melhoria:** `blockedByDependency` + `hint` no script; SKILL.md manda parar e
  oferecer opcoes ao humano.

### R-0006 — Modo scaffold: criar o minimo de dependencias faltantes (dev/treino)
- **Status:** ✅ Aplicada (PR #10)
- **Data:** 2026-07-18
- **Gatilho:** Treinando a skill com so a `CardHandler.cls` baixada (sem a org com
  `Card__c`, `CardBlock__mdt`, `CardsInfo__mdt`), o loop parava e o trabalho nunca
  terminava.
- **Problema:** A regra "parar em blockedByDependency" era absoluta demais para o
  cenario de desenvolvimento; e havia confusao tecnica (tentar stubar `__c`/`__mdt`
  como Apex, o que e impossivel).
- **Melhoria:** Modo `scaffold` opt-in que cria o MINIMO das dependencias como
  **arquivos novos** (`__c`/`__mdt` como metadata XML; classes como stub), sem tocar
  na classe sob teste. Nova `references/scaffolding-dependencies.md`. Uso real
  continua parando e oferecendo apontar a org correta.

### R-0007 — Guard bloqueia so SOBRESCRITA de producao existente (permite arquivos novos)
- **Status:** ✅ Aplicada (PR #10)
- **Data:** 2026-07-18
- **Gatilho:** O guard bloqueava QUALQUER escrita em `.cls` de producao, o que
  impediria ate criar stubs de dependencias faltantes (modo scaffold).
- **Problema:** O vetor do bug era **sobrescrever** um arquivo existente; criar um
  arquivo novo nunca destroi nada. A regra estava mais larga que o risco.
- **Melhoria:** `classifyWrite` passa a bloquear so quando o `.cls`/`.trigger` de
  producao **ja existe** (via `existsSync`); arquivos novos e classes de teste sao
  liberados. A classe sob teste (existente) segue protegida. Testado 13/13.

### R-0008 — Liberar geral mantendo as travas (reduzir prompts, sobretudo PowerShell)
- **Status:** ✅ Aplicada (PR #10)
- **Data:** 2026-07-18
- **Gatilho:** No Windows/PowerShell, a allowlist escopada ainda pedia aprovacao para
  quase tudo (inclui bug conhecido de `/` vs `\`).
- **Problema:** Allowlist so cobria os 5 comandos da skill; o resto pedia aprovacao.
- **Melhoria:** `allow` amplo (`Bash(*)`, `PowerShell(*)`, `Write`, `Edit`) mantendo
  `deny` + hook `PreToolUse` — confirmado na doc que hook e deny continuam ativos
  (hook roda antes do allow). Sem prompts no trabalho normal; destrutivo segue
  bloqueado.

### R-0009 — Arquitetura hibrida: importar skills oficiais + enxugar a nossa
- **Status:** ✅ Aplicada (PR #12)
- **Data:** 2026-07-19
- **Gatilho:** Analise do `forcedotcom/sf-skills` (Apache-2.0) mostrou que as skills
  Apex deles ja fazem o *craft* de teste; manter o nosso duplicado era redundante.
- **Problema:** A nossa skill reimplementava craft (mocks, asserts, async, DML) que a
  Salesforce ja mantem melhor; e 3 skills de teste sobrepostas colidiriam.
- **Melhoria:** Importadas 7 oficiais na integra (snapshot v1.31.0) para
  `.claude/skills/` (craft). A `apex-test-loop` virou **orquestrador** enxuto (loop +
  seguranca + guiado PT + scaffold + ledger) que **delega** o craft, com blocos
  TRIGGER/DO NOT TRIGGER para nao colidir. Removidas as referencias de craft duplicadas
  (callouts-and-async, testing-dml-and-exceptions, quality-checklist, templates).

### R-0010 — Guard: sobrescrita de producao vira `ask` (nao mais `deny` duro)
- **Status:** ✅ Aplicada (PR #12)
- **Data:** 2026-07-19
- **Gatilho:** Importar `platform-apex-generate` (autoria de producao) conflitava com o
  guard, que bloqueava DURO qualquer sobrescrita de `.cls` de producao.
- **Problema:** Bloqueio duro impediria a skill oficial de refatorar producao.
- **Melhoria:** `classifyWrite` passa a devolver `decision: 'ask'` para sobrescrita de
  producao existente (era `deny`). Comandos destrutivos seguem `deny`. Assim o generate
  funciona com aprovacao humana e nunca ha sobrescrita silenciosa (o bug original).
  Testado: deny p/ destrutivo, ask p/ overwrite, novo/teste liberados.

### R-0011 — Adaptar boas regras deles ao anti-cheat (bulk 251+, valor exato)
- **Status:** ✅ Aplicada (PR #12)
- **Data:** 2026-07-19
- **Gatilho:** As skills deles trazem regras mais afiadas que as nossas.
- **Problema:** Nosso bulk era 200 (nao cruza a fronteira de 200 da trigger) e faltava
  a regra de assert de valor exato.
- **Melhoria:** Regras de Ouro do SKILL.md agora exigem **bulk 251+**, **assert de valor
  exato (nunca range)** e **1 comportamento por metodo** — alinhadas com o craft oficial.

### R-0012 — Memoria de estado do run (checkpoint por classe)
- **Status:** ✅ Aplicada (PR #13)
- **Data:** 2026-07-19
- **Gatilho:** Pedido do usuario (arquitetura de agent loop): o agente precisa saber
  "onde paramos e o que fizemos em cada interacao" para retomar apos interrupcao,
  troca de sessao ou compactacao de contexto.
- **Problema:** O loop nao tinha checkpoint — interrompeu, recomecou do zero.
- **Melhoria:** `references/run-state.md` (schema + regras + template) e integracao no
  SKILL.md: Passo 0 verifica/retoma `.claude/apex-test-loop/state/<Classe>.md`; passo 4
  atualiza o checkpoint a cada iteracao; encerramento/parada gravam
  `concluido`/`pausado_bloqueado`. Modo guiado oferece retomada; TRIGGER inclui
  "continue de onde paramos". Complementa o RECOMMENDATIONS.md (memoria longa).

### R-0013 — Empacotar como Plugin do Claude Code
- **Status:** 🟡 Proposta
- **Data:** 2026-07-19
- **Gatilho:** Discussao dos blocos de composicao (skills, automacoes, plugins/MCPs,
  sub-agentes, worktrees): plugins facilitariam distribuir/versionar o conjunto
  (8 skills + settings + hook do guard) como um pacote instalavel.
- **Problema:** Hoje a instalacao e "copie .claude/skills/ e mescle o settings.json" —
  funciona, mas e manual e propensa a erro de merge.
- **Melhoria proposta:** Criar a estrutura de plugin (`.claude-plugin/plugin.json` +
  skills + hook empacotado) validando o formato contra a doc oficial antes (nao
  meio-implementar). Requer decidir: repo vira plugin, ou pasta `plugin/` gerada.
- **Nota:** Sub-agentes, worktrees e mais automacoes foram avaliados e NAO recomendados
  por ora — o loop e sequencial (cada iteracao depende da cobertura anterior); seria
  complexidade sem ganho.

### R-0014 — Modo bypassPermissions (zero prompts) mantendo deny + guard
- **Status:** ✅ Aplicada (PR #15)
- **Data:** 2026-07-19
- **Gatilho:** Usuario incomodado com aprovacoes repetidas de Bash/PowerShell mesmo
  apos a allowlist ampla (R-0008); pediu "permissao FODA que nao precise aprovar nada".
- **Problema:** `allow: ["Bash(*)", "PowerShell(*)", ...]` ainda deixa prompts para
  outras ferramentas/casos fora do escopo coberto.
- **Melhoria:** `permissions.defaultMode: "bypassPermissions"` no settings.json.
  Verificado contra a doc oficial: `deny` e o hook `PreToolUse` (`guard.mjs`)
  **continuam validos** em bypass ("hook decisions don't bypass permission rules").
  README documenta o aviso unico de aceitacao, a limitacao na Web (ignorado
  silenciosamente) e o risco de `disableBypassPermissionsMode` gerenciado.

### R-0015 — [campo] Remocao de teste bulk por CPU limit (CaseHandler)
- **Status:** 🟢 Aprovada como licao / decisao de campo ⚪ Reprovada (PR #16)
- **Data:** 2026-07-19 (registrada em campo pela skill; processada aqui)
- **Gatilho:** Teste bulk (251) estourou CPU em `setToQueue`; o run removeu o teste.
- **Veredito do processamento:** A **licao e valida, a decisao tomada nao**. Remover
  o cenario bulk viola a Regra de Ouro; o CPU estourando ali era um **achado de
  producao** (SOQL em loop — o teste funcionou!). Aplicado: `runtime-blockers.md`
  define a ordem correta (diagnosticar com platform-apex-logs-debug → dividir teste/
  startTest-stopTest → se for producao, reportar como achado e MANTER o cenario) e a
  Regra de Ouro 5 proibe nominalmente "remover cenario obrigatorio".

### R-0016 — [campo] Try/catch engolindo falhas de entitlement (CaseHandler)
- **Status:** 🟢 Aprovada como licao / decisao de campo ⚪ Reprovada (PR #16)
- **Gatilho:** `setEntitlement` estoura `List index out of bounds` sem Entitlements
  na org; o run adicionou try/catch nos testes para "passar".
- **Veredito:** A propria skill reconheceu no registro: "o teste nao deve engolir
  erros da producao". Aplicado: `runtime-blockers.md` manda criar o dado real
  (Queues/Groups com runAs; Entitlements se a feature existir) ou PARAR e perguntar
  se e feature de org desabilitada; Regra de Ouro 5 proibe nominalmente try/catch
  de fachada e guardas `isEmpty()` em assert. Falta de `isEmpty()` na producao vira
  **achado de producao** no relatorio.

### R-0017 — [campo] Testes em memoria vs Flow bloqueando DML (CaseHandler)
- **Status:** 🟢 Aprovada parcialmente (PR #16)
- **Gatilho:** Flow "Tratamento de Caso" impede DML no setup; o run migrou para
  testes em memoria (sem insert).
- **Veredito:** Teste em memoria e **legitimo como ULTIMO recurso** para logica pura
  — mas nao antes de tentar satisfazer o criterio do Flow com dados corretos ou
  runAs, e nunca silenciosamente. Aplicado: ordem de ataque no `runtime-blockers.md`
  + obrigacao de documentar a limitacao (nao cobre trigger/persistencia) no
  relatorio e checkpoint + oferta ao humano (desativar Flow em sandbox de teste).

### R-0018 — Bloqueios de runtime, regra do platô e retrospectiva imediata
- **Status:** ✅ Aplicada (PR #16)
- **Data:** 2026-07-19
- **Gatilho:** O run real do CaseHandler revelou 3 gaps estruturais: (a) so
  tratavamos bloqueio de DEPLOY (`blockedByDependency`), nao de RUNTIME (Flow,
  config ausente, governor limit) — por esse buraco passaram os 3 atalhos; (b)
  cobertura parada em 35% por 3 iteracoes com testes crescendo nao disparava nenhum
  alarme; (c) a retrospectiva so no fim do run perdia o detalhe das decisoes
  comprometedoras (o usuario precisou pedir manualmente).
- **Melhoria:** Nova `references/runtime-blockers.md` (o que nunca fazer + o que
  fazer por tipo de bloqueio + regra do platô + meta honesta); SKILL.md: passo 3
  distingue causa teste vs causa org, passo 4 ganha a regra do platô (2 iteracoes
  paradas → diagnostico obrigatorio + testes nomeiam linhas-alvo), Passo 0 avalia
  alcancabilidade e re-pactua a meta, encerramento ganha secoes "Achados de
  producao" e "Limitacoes de cobertura", Regra de Ouro 5 (proibicoes nomeadas:
  remover cenario, engolir excecao, mega-teste), retrospectiva ganha excecao de
  registro IMEDIATO para friccao grave.

### R-0019 — Framework de decisao quando o teto so aparece DEPOIS do Passo 0
- **Status:** ✅ Aplicada (PR #17)
- **Data:** 2026-07-19
- **Gatilho:** Rodando o CaseHandler ja com R-0018, a regra do platô funcionou (35%
  parado virou 38% com diagnostico ativo) e o run chegou honestamente a um
  "bloqueio identificado (a confirmar)" na iteracao 6 — mas isso so ficou claro
  DEPOIS de cavar fundo, nao no Passo 0. A "Meta honesta" so cobria avaliacao
  antecipada.
- **Problema:** Faltava um roteiro para quando o teto de cobertura so se revela no
  meio do run (apos diagnosticar `uncoveredLines` via regra do platô) — o agente
  nao tinha um formato concreto de pergunta/opcoes pra apresentar ao usuario, nem
  um lugar pra registrar a resposta e nao perguntar de novo ao retomar.
- **Melhoria:** `runtime-blockers.md` ganha "Quando o teto so fica claro DEPOIS de ja
  rodar iteracoes" — pedido de confirmacao com 3 opcoes nomeadas (org com config
  completa / aceitar meta re-pactuada e concluir / scaffold do que for metadata,
  sendo honesto sobre o que nao e scaffoldable). SKILL.md conecta a regra do platô
  a este framework quando o diagnostico aponta bloqueio de ambiente. `run-state.md`
  ganha campo pra registrar a decisao no checkpoint, pra nao re-perguntar ao retomar.

### R-0020 — Inventario mecanico de metodos no Passo 0 (nao so "ler e entender")
- **Status:** ✅ Aplicada (PR #18)
- **Data:** 2026-07-19
- **Gatilho:** No CaseHandler (2790 linhas), a leitura inicial da classe so notou 5
  metodos; a sessao passou iteracoes inteiras testando so um sexto da classe achando
  que era o todo. Os 31 metodos reais so foram descobertos por acidente, ao preparar
  um grep de assinaturas para o fan-out. O usuario perguntou: "a primeira atividade
  nao deveria ser o levantamento de todos os metodos?" — e a resposta e sim.
- **Problema:** O Passo 0 pedia "mapear o que cobrir" de forma generica (ler e
  entender), sem exigir um levantamento MECANICO e exaustivo antes de comecar a
  escrever testes. Em classes grandes, leitura humana/LLM subestima a extensao real.
- **Melhoria:** Passo 0 ganha um item 2 obrigatorio: grep de assinaturas de metodo
  ANTES de mapear cenarios, produzindo uma tabela metodo→linhas que vira a fonte de
  verdade do run (cobertura rastreada por metodo, nao so agregado da classe). Classe
  grande (>10-15 metodos) avalia a estrategia de decomposicao por metodo DESDE JA
  (nao no meio do run, por acidente).

### R-0021 — Decomposicao por metodo (fan-out) para classes grandes
- **Status:** ✅ Aplicada (PR #18)
- **Data:** 2026-07-19
- **Gatilho:** Com 31 metodos independentes e ~1064 linhas nao cobertas, a sessao
  planejou usar Workflow (fan-out de sub-agentes) — mas nossa skill so previa loop
  sequencial (R-0013 tinha descartado sub-agentes explicitamente, sob a premissa de
  que tudo era dependente; nao e o caso quando os metodos sao independentes).
- **Problema:** Sem uma estrutura definida, fan-out real corre 3 riscos: deploy
  concorrente colidindo na org, escrita concorrente no mesmo arquivo de teste
  (perda de trabalho), e as Regras de Ouro nao viajando com cada sub-agente (cada
  um podendo reinventar os atalhos que o loop sequencial evita).
- **Melhoria:** Nova `references/parallel-methods.md`: quando usar (metodos
  independentes, inventario grande), os 3 riscos nomeados, e a estrutura segura —
  **autoria em paralelo** (cada agente so retorna codigo, nao escreve nem deploya),
  **merge/deploy/checkpoint sequenciais** (um passo so, feito pelo orquestrador).
  Prompt minimo obrigatorio por agente do fan-out especificado (linhas-alvo,
  delegacao ao craft oficial, proibicoes nomeadas, reportar bloqueio de runtime
  em vez de decidir sozinho).

### R-0022 — [campo] Checkpoint duplicado/divergente quebra retomada
- **Status:** ✅ Aplicada (PR #19)
- **Data:** 2026-07-19 (registrada em campo; processada e aplicada aqui)
- **Gatilho:** Dois arquivos de estado para a mesma classe (`CaseHandler.md` 37%/it7
  vs `CaseHandler-Copia.md` 60%/it1) obrigaram a remedir a cobertura do zero.
- **Melhoria aplicada:** `run-state.md` define UM arquivo canonico por classe e
  proibe copias (`-Copia`/`-backup`); historico vai DENTRO do arquivo ou no git;
  Passo 0 para e pergunta se houver mais de um `state/<Classe>*.md` (ponto nomeado).

### R-0023 — [campo] Nunca truncar (tail/head) a saida do apex-coverage.mjs
- **Status:** ✅ Aplicada (PR #19)
- **Gatilho:** `| tail -5` cortou o JSON de cobertura; a sessao teve que rodar todo
  o ciclo deploy+teste de novo (minutos) para reobter o que ja tinha sido gerado.
- **Melhoria aplicada:** `sf-cli-and-coverage.md` abre com a regra: saida SEMPRE
  redirecionada para arquivo (`> cov-atual.json` + stderr), nunca canalizada por
  `tail`/`head`/`grep` antes de salva. Reforcada na "Dieta de contexto" do SKILL.md.

### R-0024 — [campo] Circuit-breaker ao investigar UMA falha especifica
- **Status:** ✅ Aplicada (PR #19)
- **Gatilho:** ~8 tool calls investigando um unico teste falho (esperado 2, obteve 1)
  sem convergir — leitura de producao em 4 trechos + Apex anonimo contra a org.
- **Melhoria aplicada:** SKILL.md passo 3: causa nao clara em 2-3 passos → UM deploy
  com diagnostico dirigido, seguindo com o resto do lote em paralelo; se nem assim
  fechar, registrar como pendencia no checkpoint e reportar no fim da iteracao. Uma
  falha pontual nunca trava o avanco das demais linhas-alvo.

### R-0025 — Disciplina de execucao: autonomia por padrao, lote por deploy, dieta de contexto
- **Status:** ✅ Aplicada (PR #19)
- **Data:** 2026-07-19
- **Gatilho:** Feedback direto do usuario apos o run do CaseHandler: "levando muito
  mais tempo e interacoes do que o previsto" + "ele fica me perguntando se aprovo,
  tenho que ficar preso na frente do PC". E o achado de que o passo 4 do proprio
  SKILL.md instruia "adicione UM metodo de teste" por iteracao (um-por-vez).
- **Melhoria aplicada:** Nova secao "⚡ Disciplina de execucao" no SKILL.md:
  (1) autonomia por padrao — perguntar SO nos 5 pontos nomeados (producao/scaffold/
  meta/estado ambiguo/parada), todo o resto decide-e-reporta; (2) lote maximo por
  deploy — exito medido em "linhas-alvo eliminadas por deploy", nunca um teste por
  vez (passo 4 corrigido); (3) dieta de contexto — ler producao por intervalos do
  inventario, output para arquivo, checkpoint como fonte (nao rederivar), replies
  curtas durante o loop.

### R-0026 — Benchmark humano×agente + minerar testes existentes como receita de dado
- **Status:** ✅ Aplicada (PR #19)
- **Data:** 2026-07-19
- **Gatilho:** Comparacao objetiva com a classe de teste HUMANA que roda em producao
  (CaseHandler_tst): humano 2423 linhas/23 testes/**9 asserts**/0 @TestSetup (o
  setToQueueTest tem ~700 linhas e ZERO assert); agente 1905 linhas/117 testes/
  **130 asserts** de valor exato com mensagem/0 try-catch de fachada. O agente perdia
  so em cobertura bruta (61% vs 75%+) — e a causa era DML: o humano faz 54 DMLs de
  Case (prova de que o Flow E satisfazivel), o agente tinha ido para memoria.
- **Melhoria aplicada:** `runtime-blockers.md` (Flow) e Passo 0 item 4 ganham o
  "atalho de ouro": ANTES de decifrar automacao na unha ou ir para memoria, minerar
  classes de teste existentes que ja inserem o objeto — elas sao a receita comprovada
  do dado que passa. Benchmark registrado aqui como evidencia de que as Regras de
  Ouro produzem teste categoricamente superior em verificacao (14x asserts).

### R-0027 — MVP deployavel como PADRAO; verificacao exaustiva vira `--rigoroso` (opt-in)
- **Status:** ✅ Aplicada (PR #19)
- **Data:** 2026-07-19
- **Gatilho:** Definicao de produto pelo usuario: "nao preciso de uma classe de teste
  que ganharia premios; preciso de uma que passe na cobertura da plataforma com 99%+
  — minimo viavel para deployar entre ambientes".
- **Problema:** As Regras de Ouro exigiam assert exaustivo por padrao. Isso (a) nao e
  exigido pela plataforma para deploy; (b) cada assert de valor exato e um ponto de
  quebra entre ambientes (config diverge — o baseline humano com 9 asserts sobrevive
  a qualquer sandbox); (c) grande parte das iteracoes queimadas em campo foi
  corrigindo asserts de expectativa errada.
- **Melhoria aplicada:** SKILL.md ganha "🎯 Objetivo de qualidade": **MVP deployavel
  e o PADRAO** (>= 99%, todos passando, portavel; asserts so quando baratos/estaveis;
  guardas de config permitidas como portabilidade; bulk recomendado mas deve PASSAR).
  Regras de Ouro reorganizadas em **Travas (sempre)** — nunca tocar producao, sem
  SeeAllData/IDs hardcoded (quebram a portabilidade que o MVP exige), nunca fingir
  cobertura, nunca remover teste que passa, todos os testes passam — e **Regras de
  qualidade [rigoroso]** (assert exato+mensagem, 1 comportamento/metodo, bulk
  mandatorio, sem guardas), aplicadas so com `--rigoroso`. Condicao de conclusao,
  passo 3, runtime-blockers, guided-mode e parallel-methods alinhados aos modos.
  Nota tecnica preservada: excecao no meio do metodo corta cobertura das linhas
  seguintes — dado real segue sendo a melhor tatica DE COBERTURA mesmo no MVP.

### R-0028 — [campo] Caminho do state file divergia entre ferramentas (Claude Code × OpenCode)
- **Status:** ✅ Aplicada (PR desta sessao)
- **Data:** 2026-07-19
- **Gatilho:** O usuario rodou a skill no Claude Code (state em
  `.claude/apex-test-loop/state/`) e no OpenCode (state em
  `.opencode/skills/apex-test-loop/state/`) — dois silos, progresso nao compartilhado
  ao trocar de ferramenta.
- **Problema:** O caminho do checkpoint estava atrelado a pasta da ferramenta
  (`.claude`/`.opencode`), entao o mesmo projeto tinha estados diferentes conforme
  quem rodava; a retomada de um nao enxergava o outro.
- **Melhoria:** Padronizado um caminho **neutro** na raiz do projeto —
  `<projeto>/.apex-test-loop/state/<Classe>.md` (fora de `.claude`/`.opencode`).
  `run-state.md` e Passo 0 do SKILL.md atualizados, com instrucao de MIGRAR estado
  antigo achado sob `.claude`/`.opencode`. Nota adicional: os SCRIPTS (dentro da
  skill) seguem o prefixo da ferramenta; so o STATE e neutro/compartilhado.

### R-0029 — Centralizar padroes agnosticos em references/ + separar os dois ledgers
- **Status:** ✅ Aplicada (PR desta sessao)
- **Data:** 2026-07-19
- **Gatilho:** Um run em OpenCode gerou um `RECOMMENDATIONS.md` ad-hoc, especifico de
  UMA classe (10 licoes com nomes de metodo/mock reais), salvo localmente e perdido
  entre sessoes. Alem disso, a sessao alucinou um `apex-retrospective.mjs` inexistente.
- **Problema:** (a) Nao havia lugar versionado e AGNOSTICO para padroes de teste
  reutilizaveis; (b) confundia-se aprendizado da skill (R-XXXX) com padrao de teste
  (P-XXXX); (c) a retrospectiva parecia exigir um script.
- **Melhoria:** Novo `references/apex-test-loop-recommendations.md` (versionado) para
  padroes AGNOSTICOS `P-XXXX` + `references/contribution-guidelines.md` (como
  contribuir sem citar classe). SKILL.md: tabela de destino do aprendizado (friccao
  da skill → RECOMMENDATIONS.md; padrao reutilizavel → references/), e nota de que a
  retrospectiva e reflexao (sem script). Adicionado tambem `FeatureManagement`/
  custom permission como categoria NOMEADA de linha inalcancavel em
  `runtime-blockers.md`, e `--ignore-conflicts` (com ressalva) nos erros comuns de
  `sf-cli-and-coverage.md`.

### R-0030 — Endurecer o guard (find/mv/rm-dir) e reconhecer o falso-positivo por texto
- **Status:** ✅ Aplicada (parcial — gaps fechados; falso-positivo aceito como trade-off)
- **Data:** 2026-07-19
- **Gatilho:** Uma revisao tecnica da skill encontrou (a) que o `guard.mjs` NAO
  bloqueava `find ... -delete`, `mv`/`move` de `.cls`/`.trigger`, nem `rm -rf` de um
  DIRETORIO (`force-app`/`classes`) — apesar de o "NUNCA FACA" do SKILL.md prometer
  bloqueio para esses casos; e (b) que o guard, por casar o TEXTO inteiro do comando,
  bloqueia de forma dura comandos benignos que apenas *mencionam* essas strings (ex.:
  um `grep "sf project delete"` ou um `node -e` de teste com essas strings como dado).
- **Problema:** o SKILL.md superdimensionava a garantia ("bloqueio duro") para padroes
  que na verdade escapavam; e a mesma regra por texto gera fricção em trabalho legitimo.
- **Melhoria:** (1) tres regras novas em `DESTRUCTIVE_RULES` do `guard.mjs` — `find`
  com `-delete` sobre codigo Apex; `rm/rmdir` de diretorio `force-app`/`classes`; e
  `mv`/`move` de `.cls`/`.trigger` — validadas por 13 casos (destrutivos bloqueiam,
  benignos passam). (2) SKILL.md reescreveu o box do guard para listar o conjunto
  ESPECIFICO coberto e assumir a **limitacao honesta** (casamento por texto, nao
  criptografico; falso-positivo seguro possivel). O falso-positivo em comando benigno
  fica **aceito de proposito** (fail-safe: preferimos bloquear um comando benigno a
  deixar passar um destrutivo). Melhoria futura possivel: inspecionar so o verbo/token
  inicial do comando, ou rebaixar casos ambiguos de `deny` para `ask`.

### R-0031 — Inventario do Passo 0 portavel (grep quebra no Windows/OpenCode)
- **Status:** ✅ Aplicada (orientacao) — vinda de run em campo (OpenCode/DeepSeek, CustomerData_ctr)
- **Data:** 2026-07-19
- **Gatilho:** Num run no OpenCode (Windows), o `grep -n "^\s*(public|private...)"` do
  Passo 0 (inventario de metodos) nao funcionou como esperado — alternacao `(a|b)` exige
  `-E`, e `rg` nao estava disponivel. O agente perdeu tempo achando alternativa.
- **Problema:** O Passo 0 sugere um comando `grep` Unix-assumido que nao e portavel
  entre shells/ferramentas.
- **Melhoria:** Usar a **ferramenta Grep do proprio agente** (Claude Code e OpenCode
  tem busca embutida) OU um one-liner Node (Node ja e requisito do `apex-coverage.mjs`)
  em vez de depender do `grep` do shell. O comando `grep` no SKILL.md fica como
  ILUSTRACAO do padrao a buscar, nao como comando literal obrigatorio. (Nao trocamos o
  texto do Passo 0 agora para nao inflar o diff; a orientacao vale.)

### R-0032 — Iteracao rapida com `--tests` ao depurar falha (COM ressalva de cobertura)
- **Status:** ✅ Aplicada (SKILL.md passo 3 + sf-cli-and-coverage.md)
- **Data:** 2026-07-19
- **Gatilho:** Em campo, cada tentativa de consertar 1-2 metodos re-rodava a suite
  inteira (`--class-names`, dezenas de testes, ~15s+) — o usuario perguntou "por que
  esta demorando tanto?".
- **Problema:** Ao DEPURAR uma falha, re-rodar todos os testes a cada tentativa e
  desperdicio de tempo de org.
- **Melhoria:** Passo 3 do SKILL.md ganha "Iteracao rapida": ao consertar poucos
  metodos, rodar SO eles com `sf apex run test --tests <Classe>Test.<m1>,<m2>
  --result-format human` (segundos). **RESSALVA CRITICA (que o run de campo NAO
  percebeu):** cobertura de um subset `--tests` e PARCIAL — nao e a cobertura real da
  classe. As `uncoveredLines` que DIRIGEM o loop tem de vir SEMPRE do run da classe
  inteira (`apex-coverage.mjs`/`--class-names`). Documentado nos dois arquivos. Sem
  essa ressalva, o loop mediria cobertura errada (subestimada) e caçaria linhas-fantasma.

### R-0033 — Fallback de comandos `sf` crus quando o `apex-coverage.mjs` falha
- **Status:** ✅ Aplicada (sf-cli-and-coverage.md) — com comandos CORRIGIDOS
- **Data:** 2026-07-19
- **Gatilho:** Em campo, o `apex-coverage.mjs` falhou por conflito de FORMATO de source
  (`sfdx` legado vs `source`/`sfdx-winter23`); sem fallback documentado, o loop ficou
  sem direcao e o agente improvisou comandos (alguns com flags inexistentes).
- **Problema:** A skill so previa o caminho feliz (o script); quando ele quebra, faltava
  um plano B de comandos crus.
- **Melhoria:** Nova secao "Fallback: comandos sf crus" em `sf-cli-and-coverage.md`:
  deploy do teste (2 passos, estaveis) + run completo (json, cobertura autoritativa) +
  run rapido (`--tests`, human, so passa/falha) + nota do conflito de formato de source.
  **Correcao importante:** o run de campo propôs flags ALUCINADAS (`sf project deploy
  start --run-tests ... --code-coverage`, `sf apex get test --class-names`) — essas NAO
  existem; a secao de fallback lista explicitamente essas flags como "nao use" para o
  proximo agente nao repetir o erro.

> **Nota de triagem (run de campo — OpenCode/DeepSeek V4 Flash Free, CustomerData_ctr 97%):**
> o agente tambem gerou um `AGENTS.md` na raiz com "otimizacoes". As BOAS ideias (lote
> por deploy, helper de mock, DataFactory, `startTest/stopTest` so no alvo) ja estao na
> skill (R-0025, P-0003/4/5). As ideias REJEITADAS por serem tecnicamente erradas:
> (a) `--result-format human` como padrao — quebra o parse determinístico (o loop
> precisa de `json`); (b) flags inexistentes no deploy/`get test` (acima); (c) "evitar
> `--synchronous`" — sync e o certo para UMA classe e retorna a cobertura direto; (d)
> "validar sintaxe com `sf apex parse`" — nao ha compilacao local confiavel de Apex.
> Um `AGENTS.md` divergente na raiz confunde runs futuros — o certo e a skill ser a
> fonte unica; as partes corretas ja foram absorvidas aqui.

### R-0034 — [campo] Bulk DML em trigger pesada estoura CPU → split em grupos com startTest/stopTest proprio
- **Status:** ✅ Aplicada (esta sessao) — proposta em campo (OpenCode, CaseHandler), processada e refinada aqui
- **Data:** 2026-07-20 (campo) / 2026-07-21 (processada)
- **Gatilho:** `testDML_Update_CoversUpdateCaseAllSMS` (CaseHandlerTest) atualizava 12
  `Case` num unico `startTest/stopTest`; cada Case disparava o `Case_trg` inteiro (~200
  `if` em `setToQueue` + ~35 `getDescribe` em `setIdSubCategoryItau`). 12× de uma vez
  estourava os ~10s de CPU. Confirmado em maquina do usuario (rodando a classe isolada).
- **Problema:** a skill orientava bulk 251+ e lote maximo por deploy, mas NAO alertava
  que DML de muitos registros num mesmo `startTest/stopTest` estoura CPU quando a
  trigger e pesada; faltava heuristica de "quantos registros por `startTest`" e o
  padrao de split preventivo.
- **Melhoria aplicada:** `runtime-blockers.md` (secao 1) ganha o caso "bulk DML numa
  trigger pesada" com a correcao por SPLIT (grupos de ~3-4 registros, cada um com
  `startTest/stopTest` proprio = orcamento de CPU fresco), a heuristica de tamanho
  (dimensionar BEM abaixo do teto; split preventivo se a trigger tem `getDescribe`/
  muitos `if`) e a nota de que os N cenarios sao PRESERVADOS no split (nunca reduzir
  variedade — contraste com A-0002). SKILL.md passo 3 aponta o caso e a correcao.
- **Refinamento sobre a proposta de campo:** a proposta tratava o "12 estoura" como
  determinístico; na verdade e **dependente de carga** (ver R-0036) — o mesmo teste
  passa numa org vazia. Por isso a resposta completa nao e so "split quando falhar", e
  tambem "split preventivo dos que estao lentos mas passando" (R-0036).

### R-0035 — [campo] Varredura por OUTROS bulks grandes ao diagnosticar CPU limit
- **Status:** ✅ Aplicada (esta sessao) — proposta em campo, grep corrigido
- **Data:** 2026-07-20 (campo) / 2026-07-21 (processada)
- **Gatilho:** ao corrigir o CPU limit acima, a boa pratica foi varrer a classe por
  OUTROS testes com bulk DML >= 5 registros (achou-se so 1, mas poderiam existir mais
  igualmente frageis) e aplicar o mesmo split.
- **Problema:** a skill nao instruia essa varredura — a tendencia e focar so no teste
  que falhou e ignorar vizinhos na mesma beira.
- **Melhoria aplicada:** SKILL.md passo 3 (ramo CPU) e `runtime-blockers.md` (secao 1)
  ganham a **varredura preventiva obrigatoria** por lotes grandes vizinhos.
  **Correcao sobre a proposta de campo:** o grep sugerido misturava regex basica e
  estendida (`\|` com `(insert|update)`) — alem de o R-0031 ja ter registrado que
  `grep` de shell quebra entre ferramentas/OS. A skill manda usar a **ferramenta Grep
  do agente** (Claude Code / OpenCode tem busca embutida), nao `grep` de shell.

### R-0036 — Portao de estabilidade: sinalizar testes lentos (CPU-fragil) antes de concluir
- **Status:** ✅ Aplicada (esta sessao)
- **Data:** 2026-07-21
- **Gatilho:** O usuario gerou classes de teste com o agente (cobertura >99%), passou-as
  a um dev do time, e o dev viu **17 de 419 testes falharem** — mas ao rodar a mesma
  classe na propria maquina, o usuario viu **so 1 falha** (CPU limit num bulk DML). Mesma
  suite, contagens diferentes: puramente **carga da org**. O loop tinha declarado
  ">99%, pronto" sobre uma unica execucao, entregando testes frageis.
- **Problema (o gap que R-0034/R-0035 nao fecham):** o criterio de conclusao do loop
  (`>=99% + todos passando`) media UMA execucao e nao tinha NENHUM conceito de margem/
  estabilidade. Um teste que consome ~9s de CPU **passa numa org vazia e estoura numa
  cheia** — um deploy-blocker latente que o loop dava por "concluido". O sinal (tempo
  por metodo) existia no JSON do run mas o `apex-coverage.mjs` jogava fora.
- **Melhoria aplicada:** (1) `apex-coverage.mjs` passa a extrair o tempo por metodo e
  emitir `slowTests` (metodos >= `--slow-ms`, padrao 8000ms; wall-clock, proxy honesto
  de CPU) + `slowMs`, ordenados desc — sinal deterministico de fragilidade, aditivo
  (nao quebra o contrato existente). (2) SKILL.md passo 4 ganha o **Portao de
  estabilidade**: so conclui com `slowTests` vazio (ou risco aceito explicitamente pelo
  usuario e registrado no checkpoint); os lentos sao divididos ANTES de concluir. (3)
  `runtime-blockers.md` (secao 1) explica a intermitencia por carga. Distinto da Trava 5
  ("teste falhando"): esta camada pega o teste que **ainda nao falhou, mas vai**.

<!-- A skill anexa novas propostas ABAIXO desta linha, como R-0037, R-0038... -->
