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

<!-- A skill anexa novas propostas ABAIXO desta linha, como R-0009, R-0010... -->
