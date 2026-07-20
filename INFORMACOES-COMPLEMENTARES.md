# Informacoes Complementares — Salesforce Apex Cover Loop

> **Comeco rapido:** [README.md](./README.md) (2 min) ← → **INFORMACOES-COMPLEMENTARES.md** (referencia detalhada)

---

## O que faz diferente

Arquitetura **hibrida**:

- **Craft (o "como" fazer)** vem das **skills oficiais da Salesforce** (`forcedotcom/sf-skills`, Apache-2.0) importadas neste projeto — mocks, asserts, data factory, bulk, async, DML, objetos/campos, debug de logs.
- **Orquestracao (o nosso valor)** e a skill **`apex-test-loop`**: o **agent loop** de cobertura, as **travas de seguranca**, o **modo guiado em portugues** e o **modo scaffold** (dev/treino).

```
escrever teste  →  deploy (sf)  →  rodar teste + cobertura  →  ler linhas nao cobertas
      ↑                                                                 ↓
      +----------- melhorar o cenario que falta, em loop --------+
```

**Diferenciais:**

- **Craft oficial + orquestracao nossa.** Nao reinventamos o "como escrever um bom teste" — isso vem das skills oficiais mantidas pela Salesforce. A nossa camada e o loop que **dirige** o processo ate a meta, com seguranca e UX.
- **Dois niveis de qualidade.** Padrao = **MVP deployavel** (cobertura + testes passando + portabilidade; asserts so quando baratos/estaveis — menos falhas entre ambientes). Opcional = **`--rigoroso`** (assert de valor exato com mensagem em todo metodo).
- **Sinal deterministico.** Um script auxiliar (`scripts/apex-coverage.mjs`) roda o teste, faz o parse do JSON do `sf` e devolve **exatamente as linhas nao cobertas**.
- **Seguranca contra acoes destrutivas (3 camadas).** A `apex-test-loop` so cria/edita a classe de TESTE. Apagar/mover/deletar producao e **bloqueio duro** (`deny` + hook); **sobrescrever** producao **pede aprovacao** (`ask`).

---

## Skills oficiais importadas

Importamos **na integra** 7 skills do `forcedotcom/sf-skills` (Apache-2.0, snapshot `v1.31.0`) para `.claude/skills/`. Elas fornecem o craft; a nossa `apex-test-loop` delega a elas.

| Skill oficial | Para que a nossa loop a usa |
|---|---|
| `platform-apex-test-generate` | escrever/melhorar a classe de teste (mocks, asserts, bulk 251+, async, DML) |
| `platform-apex-test-run` | rodar teste, analisar cobertura, padroes de fix |
| `platform-data-manage` | criar/seedar dados de teste (TestDataFactory, bulk) |
| `platform-apex-logs-debug` | diagnosticar falha por log / governor limit |
| `platform-apex-generate` | autorar/refatorar producao (fora do loop, com aprovacao) |
| `platform-custom-object-generate` | criar objeto `__c` faltante (modo scaffold) |
| `platform-custom-field-generate` | criar campo `__c`/`__mdt` faltante (modo scaffold) |

Cada uma tem os proprios gatilhos (TRIGGER / DO NOT TRIGGER), entao **coexistem sem colisao**: a `apex-test-loop` dispara no "cobrir a classe X ate ~99% em loop"; as oficiais, em pedidos diretos.

Detalhes/atribuicao em `.claude/skills/VENDOR-ATTRIBUTION.md`.

---

## Rodar sem ficar aprovando NADA (modo bypass, ja ativado)

Por padrao, o Claude Code pede confirmacao antes de rodar comandos. Em um loop que roda dezenas de vezes, isso incomoda. Por isso o `.claude/settings.json` deste repositorio ja vem com **`bypassPermissions`**: zero prompts pra qualquer ferramenta (Bash, PowerShell, Write, Edit, leitura, etc.) — **mantendo as travas de seguranca ativas**:

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": ["Bash(*)", "PowerShell(*)", "Write", "Edit"],
    "deny": [
      "Bash(sf project delete *)", "Bash(sf org delete *)", "Bash(sf data delete *)",
      "PowerShell(sf project delete *)", "PowerShell(sf org delete *)", "PowerShell(sf data delete *)"
    ]
  },
  "hooks": { "PreToolUse": [ /* guard.mjs */ ] }
}
```

**Por que isso e seguro mesmo no bypass:**
- **`deny` continua valendo em `bypassPermissions`** — comandos destrutivos seguem bloqueados.
- **O hook `PreToolUse` (`guard.mjs`) tambem continua valendo** — "hook decisions don't bypass permission rules". O guarda que impede apagar/sobrescrever producao **funciona igual**, com ou sem bypass.

**O que muda de verdade:** nenhum prompt de aprovacao pra nada — nem Bash/PowerShell, nem escrever/editar. So continuam parando: os `deny` acima, o guard, e circuit-breakers do Claude Code.

**Avisos:**
- **Na primeira sessao**, o Claude Code mostra um aviso unico pedindo para aceitar responsabilidade (fica salvo na sua conta).
- **So funciona no CLI local**. Na Web (claude.ai/code), este campo e ignorado silenciosamente.
- Se o admin bloqueou bypass via `disableBypassPermissionsMode`, este campo tambem e ignorado.

**Quer trocar?** Remova a linha `"defaultMode": "bypassPermissions"` e ponha em `.claude/settings.local.json` so quando quiser usar. Ou rode `/permissions` no Claude Code para trocar na hora.

---

## Travas de seguranca

A skill so pode **criar/editar a classe de TESTE**. Apagar, mover ou sobrescrever a classe de producao (no disco ou na org), rodar deploy destrutivo, ou excluir org/registros e bloqueado em **tres camadas independentes**:

### Camada 1: Instrucoes (SKILL.md)

Uma secao "🚫 NUNCA FACA" no topo, lida antes de qualquer acao.

### Camada 2: Regras deny (permissions.deny)

Bloqueio duro (sem aprovacao possivel) de:
- `sf project delete`
- `sf org delete`
- `sf data delete`

Aplicado a Bash e PowerShell.

### Camada 3: Hook PreToolUse (guard.mjs)

Inspeciona cada acao com **duas respostas**:

- **`deny` (bloqueio duro)** para **comandos** destrutivos:
  - `sf project/org/data delete`
  - Deploy com `--pre`/`--post-destructive-changes`
  - `rm`/`del`/`Remove-Item` de `.cls`/`.cls-meta.xml`
  - `find ... -delete` sobre codigo Apex
  - `rm -rf` de `force-app`/`classes`
  - `mv`/`move` de `.cls`/`.trigger`

- **`ask` (pede aprovacao)** quando um `Write`/`Edit` **sobrescreve** um `.cls`/`.trigger` de **PRODUCAO ja existente** — foi o vetor do bug. A `apex-test-loop` nunca faz isso; mas a `platform-apex-generate` pode refatorar producao **com o seu ok**. **Criar arquivo NOVO e liberado** — permite o modo scaffold criar stubs.

### Limite honesto

O bloqueio por texto e forte para comandos diretos, mas nao e uma fronteira absoluta — wrappers exoticos (`npx`, `docker exec`), variaveis de ambiente ou substituicao de comando podem, em tese, escapar. Por isso as tres camadas coexistem. 

**Mantenha o habito de revisar** o que o agente faz em uma org real. Prefira uma **scratch org** descartavel para os primeiros testes. Para testar o guard voce mesmo: peca ao agente para rodar `sf project delete source ...` — ele deve ser **bloqueado** com uma mensagem da skill.

---

## Estrutura

```
.claude/skills/
  apex-test-loop/                   # A NOSSA skill (orquestracao)
    SKILL.md                        # o loop, delegacao, regras de ouro, parada
    RECOMMENDATIONS.md              # livro-razao de autoaprendizado
    scripts/
      apex-coverage.mjs             # deploy + run test + parse -> JSON com linhas nao cobertas
      guard.mjs                     # hook PreToolUse: deny destrutivo / ask sobrescrita de producao
    references/
      run-state.md                  # memoria de estado: checkpoint por classe (retomar o loop)
      runtime-blockers.md           # falha por causa da ORG (Flow/config/limites): o que (nao) fazer
      parallel-methods.md           # classes grandes: fan-out por metodo com autoria paralela/deploy sequencial
      guided-mode.md                # roteiro do modo guiado (para leigos, PT)
      scaffolding-dependencies.md   # orquestracao do scaffold dev (__c/__mdt/classes)
      sf-cli-and-coverage.md        # comandos sf crus (deploy/run/cobertura) + fallback quando o script falha
      contribution-guidelines.md    # como registrar aprendizados (R-XXXX)
      apex-test-loop-recommendations.md  # banco de dados de padroes descobertos
      quality-checklist.md          # checklist final antes de marcar "done"
      testing-dml-and-exceptions.md # padroes de teste para DML e excecoes
      callouts-and-async.md         # padroes de teste para callouts e async
  platform-apex-test-generate/      # \
  platform-apex-test-run/           #  |
  platform-apex-generate/           #  |  7 skills OFICIAIS importadas (craft),
  platform-apex-logs-debug/         #  |  snapshot Apache-2.0 do forcedotcom/sf-skills
  platform-data-manage/             #  |
  platform-custom-object-generate/  #  |
  platform-custom-field-generate/   # /
  VENDOR-ATTRIBUTION.md             # de onde vieram as oficiais + licenca
  VENDOR-sf-skills-LICENSE-Apache-2.0.txt
```

O craft (mocks, asserts, data factory, bulk, async, DML) vive nas skills oficiais — por isso a nossa `apex-test-loop` ficou enxuta (so o loop + seguranca + guiado + scaffold).

---

## Memoria de estado

O loop salva um **checkpoint por classe** num caminho **neutro de ferramenta** — `.apex-test-loop/state/<Classe>.md` na raiz do seu projeto (fora de `.claude`/`.opencode`, para Claude Code e OpenCode lerem o MESMO estado):

- Cobertura atual
- Iteracao numero
- Linhas que faltam
- O que ja foi feito
- **Proximo passo**

**Na pratica:**

- Fechou o terminal no meio? Caiu a sessao? E so dizer **"continue de onde paramos"** (ou `/apex-test-loop CardHandler` de novo) — ele le o checkpoint e **retoma dali**, sem recomecar do zero.
- O arquivo e um Markdown legivel: voce pode abrir e ver o progresso a qualquer momento.
- Se o loop parou **bloqueado** (ex.: dependencia faltando), o checkpoint guarda o motivo e o que voce precisa decidir — resolvido isso, ele retoma.

> Nao confundir com o `RECOMMENDATIONS.md` (a memoria LONGA, do que a skill aprende entre runs). O checkpoint e a memoria de UM run sobre UMA classe.

---

## Autoaprendizado

No fim de cada run **com friccao real** (o guard bloqueou algo, uma dependencia travou, precisou de decisao humana, faltou orientacao numa referencia...), a skill anexa recomendacoes de melhoria em `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` — com um ID, o gatilho real, o problema e a mudanca proposta, no status `🟡 Proposta`. Em runs limpos, nao registra nada (evita ruido).

Como o arquivo viaja junto com a skill, ele fica atualizado na copia dentro do seu projeto. Quando quiser incorporar, **basta pedir**: *"leia as recomendacoes e ajuste a skill se concordar"*. Ai cada item vira `🟢 Aprovada` / `⚪ Reprovada` (com motivo) / `✅ Aplicada` (com o PR), e as aprovadas sao implementadas.

O historico das melhorias ja aplicadas (`R-0001` em diante, com o PR de cada uma) esta la como exemplo do formato — inclusive a propria arquitetura hibrida e a memoria de estado nasceram desse ciclo.

### Contribuir de volta (empurrar melhorias para a `main`)

O metodo de instalacao **copia** o `.claude` para o seu projeto — otimo para RODAR o loop, mas essa pasta **nao e um clone** deste repositorio, entao o agente nao consegue `git push` de dali.

**Opcao 1: Trazer para o repositorio-casa (simples)**
1. Rode o loop no seu projeto normalmente
2. Quando ele anexar recomendacoes ao `RECOMMENDATIONS.md`, traga esse arquivo para uma sessao **neste repositorio** (que e um clone com `origin`)
3. Revisao/vet e `git push` acontecem aqui
4. No seu projeto, rode o comando de instalacao de novo para puxar a versao atualizada

**Opcao 2: Trabalhar dentro de um clone (o agente empurra sozinho)**
Em vez de copiar o `.claude`, **clone** este repo e trabalhe dentro dele, colocando seu codigo Salesforce (`force-app` + `sfdx-project.json`) na mesma pasta — se for confidencial, adicione-o ao `.gitignore`. Assim o loop roda e o agente comita/empurra melhorias direto na `main`.

**Troubleshooting:** O erro classico e `fatal: not a git repository` — acontece quando a pasta foi **baixada (zip)** em vez de **clonada**. Pasta baixada nao tem `.git` → nenhum commit/push funciona.

**Solucao:** use um CLONE, nao um download.
```bash
git clone https://github.com/brunotrolo/Salesforce-Apex-Cover-Loop.git
```

Se o push pedir senha/der erro de autenticacao:
- **Opcao A:** `gh auth login` (GitHub CLI) guarda a credencial
- **Opcao B:** Personal Access Token em github.com → Settings → Developer settings → Tokens

---

## Troubleshooting & Observacoes

### Meta de cobertura

Meta padrao: `>= 99%`. 100% nem sempre e alcancavel (linhas genuinamente inatingiveis); nesses casos a skill **documenta** a linha em vez de forcar um caminho artificial.

Cobertura medida: atribuivel a classe de teste dedicada. Metrica org-wide (minimo 75% para deploy) e diferente e depende de todos os testes da org.

### Dependencias faltando (modo dev/treino)

Se voce baixou so a classe (sem a org com `__c`/`__mdt`/classes de apoio):

- Em **uso real**: loop para e pede para apontar a org com o schema
- Em **dev/treino**, com seu ok (`--scaffold` ou "estou treinando, sem a org"): loop cria o **minimo** das dependencias faltantes como **arquivos novos** (`__c`/`__mdt` viram metadata XML, nao Apex) — **sem nunca tocar na classe sob teste**

Detalhes em `references/scaffolding-dependencies.md`. Ideal: uma **scratch org** descartavel.

### Teste falhando por causa da ORG

Flow, config ausente, limite de CPU? O loop **NAO remove teste que passa nem entrega teste falhando** (Travas). 

Ele diagnostica a causa e tenta o caminho legitimo primeiro:
- No **MVP padrao**: guardas de portabilidade (try/catch, `isEmpty()`) sao aceitas como fallback
- No **`--rigoroso`**: nao

Em ambos, se for limitacao genuina do ambiente, **para e te explica as opcoes** — inclusive re-pactuando a meta com transparencia ("neste ambiente o alcancavel e X%, porque...").

Problemas de producao descobertos pelos testes (ex.: SOQL em loop) viram a secao **"Achados de producao"** no relatorio final — reportados, nunca corrigidos por conta propria.

Detalhes em `references/runtime-blockers.md`.

### Cobertura empacada (plateau)

Se a % ficar parada por 2 iteracoes enquanto os testes aumentam, o loop para de escrever testes e diagnostica quais linhas continuam descobertas (regra do platô) — testes novos passam a mirar linhas especificas.
