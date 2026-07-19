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

<!-- A skill anexa novas propostas ABAIXO desta linha, como R-0014, R-0015... -->
