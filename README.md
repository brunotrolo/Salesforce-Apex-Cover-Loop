# Salesforce-LoopAgentApex

Arquitetura **hibrida** para o Claude Code criar **classes de teste Apex** com
cobertura **real** e alta (meta padrao `>= 99%`):

- **Craft (o "como" fazer)** vem das **skills oficiais da Salesforce** (`forcedotcom/
  sf-skills`, Apache-2.0) importadas neste projeto — mocks, asserts, data factory,
  bulk, async, DML, objetos/campos, debug de logs.
- **Orquestracao (o nosso valor)** e a skill **`apex-test-loop`**: o **agent loop** de
  cobertura, as **travas de seguranca**, o **modo guiado em portugues** e o **modo
  scaffold** (dev/treino).

Voce informa uma classe (`/apex-test-loop AccountService`), e o Claude Code entra
num ciclo fechado, **delegando o craft** as skills oficiais:

```
escrever teste  ->  deploy (sf)  ->  rodar teste + cobertura  ->  ler linhas nao cobertas
      ^                                                                     |
      +----------------------  melhorar o cenario que falta  <--------------+
```

O loop so termina quando a cobertura atinge a meta **com asserts significativos**,
ou quando bate uma condicao de parada segura (e ai gera um relatorio para o humano).

## O que faz diferente

- **Craft oficial + orquestracao nossa.** Nao reinventamos o "como escrever um bom
  teste" — isso vem das skills oficiais mantidas pela Salesforce. A nossa camada e o
  loop que **dirige** o processo ate a meta, com seguranca e UX.
- **Cobertura por cenario real, nao por numero.** Regras anti-cheat proibem inflar
  a porcentagem (mexer na classe de producao, testes sem assert, asserts de range).
- **Sinal deterministico.** Um script auxiliar (`scripts/apex-coverage.mjs`) roda o
  teste, faz o parse do JSON do `sf` e devolve **exatamente as linhas nao cobertas**,
  em vez de o agente adivinhar.
- **Seguranca contra acoes destrutivas (3 camadas).** A `apex-test-loop` so cria/edita
  a classe de TESTE. Apagar/mover/deletar producao, org ou registros e **bloqueio duro**
  (`deny` + hook); **sobrescrever** producao existente **pede aprovacao** (`ask`) — assim
  a `platform-apex-generate` refatora producao com o seu ok, e nunca ha sobrescrita
  **silenciosa** (o bug que originou tudo isso). Veja "Travas de seguranca".

## Skills oficiais importadas (craft)

Importamos **na integra** 7 skills do `forcedotcom/sf-skills` (Apache-2.0, snapshot
`v1.31.0`) para `.claude/skills/`. Elas fornecem o craft; a nossa `apex-test-loop`
delega a elas. Detalhes/atribuicao em `.claude/skills/VENDOR-ATTRIBUTION.md`.

| Skill oficial | Para que a nossa loop a usa |
|---|---|
| `platform-apex-test-generate` | escrever/melhorar a classe de teste (mocks, asserts, bulk 251+, async, DML) |
| `platform-apex-test-run` | rodar teste, analisar cobertura, padroes de fix |
| `platform-data-manage` | criar/seedar dados de teste (TestDataFactory, bulk) |
| `platform-apex-logs-debug` | diagnosticar falha por log / governor limit |
| `platform-apex-generate` | autorar/refatorar producao (fora do loop, com aprovacao) |
| `platform-custom-object-generate` | criar objeto `__c` faltante (modo scaffold) |
| `platform-custom-field-generate` | criar campo `__c`/`__mdt` faltante (modo scaffold) |

Cada uma tem os proprios gatilhos (TRIGGER / DO NOT TRIGGER), entao **coexistem sem
colisao**: a `apex-test-loop` dispara no "cobrir a classe X ate ~99% em loop"; as
oficiais, em pedidos diretos ("escreva um teste", "rode os testes", "crie um objeto").

## Pre-requisitos (na maquina onde o loop roda)

- [Salesforce CLI v2](https://developer.salesforce.com/tools/salesforcecli) (`sf`),
  autenticado numa org (scratch org ou sandbox): `sf org login web --alias minhaOrg`.
- Node 18+ (para o script auxiliar).
- Um projeto SFDX com a estrutura `force-app/**/classes/`.

## Guia para leigos — como instalar e usar

Nao precisa ser especialista. O Claude Code carrega skills **automaticamente** a
partir da pasta `.claude/skills/` do projeto. Escolha o seu caminho abaixo.

> **Onde o loop roda de verdade?** O ciclo de cobertura depende do **Salesforce CLI
> (`sf`)** conectado a uma org. Isso funciona de forma simples no **Claude Code via
> CLI (no seu computador)**. Na **Web** (claude.ai/code) ha uma limitacao importante
> — explicada no fim desta secao.

### Caminho A — Claude Code via CLI (no seu computador) — recomendado

**1) Instale o que o loop precisa (uma vez so):**

- Salesforce CLI: veja https://developer.salesforce.com/tools/salesforcecli
- Conecte a sua org (abre o navegador para login):
  ```bash
  sf org login web --alias minhaOrg
  ```
- Node 18+ (para o script auxiliar): confira com `node --version`.

**2) Copie TUDO — nao so a `apex-test-loop`.** A skill delega o "craft" (escrever
teste, rodar, criar dados/objetos/campos) para 7 skills **oficiais** da Salesforce
importadas neste repositorio. Se voce copiar so `apex-test-loop/`, a delegacao **nao
encontra** essas skills no seu projeto e falha silenciosamente. Copie a pasta
`.claude/skills/` **inteira** (a pasta `.claude` comeca com ponto e pode ficar
"invisivel" no explorador de arquivos):

```
meu-projeto-salesforce/
└── .claude/
    ├── settings.json              ← travas de seguranca (deny/ask) + guard
    └── skills/
        ├── apex-test-loop/        ← a nossa (orquestracao)
        ├── platform-apex-test-generate/
        ├── platform-apex-test-run/
        ├── platform-apex-generate/
        ├── platform-apex-logs-debug/
        ├── platform-data-manage/
        ├── platform-custom-object-generate/
        ├── platform-custom-field-generate/
        ├── VENDOR-ATTRIBUTION.md
        └── VENDOR-sf-skills-LICENSE-Apache-2.0.txt
```

```bash
# por PROJETO (vale so nesse projeto):
cp -R .claude/skills /caminho/do/seu-projeto-sfdx/.claude/
cp .claude/settings.json /caminho/do/seu-projeto-sfdx/.claude/

# OU global (vale em TODOS os seus projetos no seu computador):
cp -R .claude/skills ~/.claude/
```

> Ja tem um `.claude/settings.json` no seu projeto? **Nao sobrescreva** — mescle o
> bloco `permissions` (`deny`) e `hooks.PreToolUse` deste repositorio com o seu (veja
> "Travas de seguranca" abaixo).

**3) Abra o Claude Code dentro do projeto.** No terminal, entre na pasta do projeto
e rode:

```bash
claude
```

Ao abrir, ele varre `.claude/skills/` e ja carrega a skill. Se voce editar o
`SKILL.md` com o Claude aberto, a mudanca e detectada sozinha — **nao existe** um
comando "recarregar skills".

**4) Confira se a skill apareceu (opcional).** Dentro do chat do Claude Code, digite:

```
/skills
```

Isso abre um menu com as skills disponiveis; a `apex-test-loop` deve estar na lista.

**5) Dispare o loop.** Informe uma classe Apex real do seu projeto — das duas formas
funciona:

```
/apex-test-loop AccountService
```

ou, em linguagem natural:

> "crie a classe de teste para a AccountService"
> "aumente a cobertura da classe AccountService"

O Claude assume o papel de Loop Agent: acha a classe, escreve/melhora a
`AccountServiceTest`, faz o deploy, roda os testes com cobertura e repete o ciclo
ate a meta (`>= 99%`) — ou para e explica se travar em algo.

**Primeira vez? Use o modo guiado.** Ele conduz **uma etapa por vez**, explica cada
passo em linguagem simples e **pede sua confirmacao** antes de enviar qualquer coisa
para a org:

```
/apex-test-loop AccountService --guiado
```

ou peca em linguagem natural: **"me ensine passo a passo a criar o teste da
AccountService"**, **"sou iniciante"**. No modo guiado a qualidade nao muda — so o
jeito de conversar (ele ensina enquanto faz). Quando ja tiver pratica, use sem o
`--guiado` para rodar o ciclo inteiro de uma vez.

### Rodar sem ficar aprovando NADA (modo bypass, ja ativado)

Por padrao, o Claude Code pede confirmacao antes de rodar comandos ou editar
arquivos. Isso incomoda num loop que roda dezenas de vezes. Por isso o
`.claude/settings.json` deste repositorio ja vem com **`bypassPermissions`**: zero
prompts pra qualquer ferramenta (Bash, PowerShell, Write, Edit, leitura, etc.) —
**mantendo as travas de seguranca ativas**:

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
  "hooks": { "PreToolUse": [ /* guard.mjs — ver abaixo */ ] }
}
```

Por que isso e seguro mesmo no bypass (confirmado na doc oficial do Claude Code):
- **`deny` continua valendo em `bypassPermissions`** — comandos destrutivos seguem
  bloqueados, mesmo com zero prompts para o resto.
- **O hook `PreToolUse` (`guard.mjs`) tambem continua valendo** — "hook decisions
  don't bypass permission rules... Claude Code evaluates deny and ask rules
  regardless of what a PreToolUse hook returns". O guarda que impede
  apagar/sobrescrever a producao **funciona igual**, com ou sem bypass.

**O que muda de verdade:** nenhum prompt de aprovacao pra nada — nem Bash/PowerShell,
nem escrever/editar arquivo, nem ler. So continuam parando: os `deny` acima, o guard,
e alguns *circuit-breakers* do proprio Claude Code (ex.: `rm -rf /`).

**Avisos honestos:**
- **Na primeira sessao**, o Claude Code mostra **um aviso unico** pedindo para voce
  aceitar a responsabilidade por acoes sem checagem de permissao — e uma tela que so
  aparece uma vez (fica salva na sua conta), nao da pra pular por configuracao.
- **So funciona no Claude Code local (CLI).** Na sessao Web (claude.ai/code), este
  campo e **ignorado silenciosamente** — a sessao la sempre pede aprovacao normal
  (nao ha como ativar bypass na Web).
- Se o seu administrador tiver bloqueado bypass via configuracao gerenciada
  (`disableBypassPermissionsMode`), este campo tambem e ignorado — o Claude Code
  volta ao modo normal sem avisar por que.

- Arquivo **versionado**. Prefere algo so seu (nao querer bypass pra sempre nesse
  projeto)? Remova a linha `defaultMode` daqui e ponha em
  `.claude/settings.local.json` (nao versionado) so quando quiser usar.
- Quer voltar a pedir aprovacao (mais cauteloso)? Apague a linha `"defaultMode":
  "bypassPermissions"`, ou rode `/permissions` no Claude Code para trocar o modo
  na hora.

### Travas de seguranca (a skill NUNCA apaga a classe de producao)

A skill so pode **criar/editar a classe de TESTE**. Apagar, mover ou sobrescrever a
classe de producao (no disco ou na org), rodar deploy destrutivo, ou excluir
org/registros e bloqueado em **tres camadas independentes**, ja incluidas no
`.claude/settings.json` deste repositorio:

1. **Instrucoes no `SKILL.md`** — uma secao "🚫 NUNCA FACA" no topo, lida antes de
   qualquer acao.
2. **Regras `permissions.deny`** — bloqueio duro (sem aprovacao possivel) de
   `sf project delete`, `sf org delete` e `sf data delete` (Bash e PowerShell).
3. **Hook `PreToolUse` (`scripts/guard.mjs`)** — inspeciona cada acao com **duas
   respostas**:
   - **`deny` (bloqueio duro)** para **comandos** destrutivos: `sf project/org/data
     delete`, deploy com `--pre`/`--post-destructive-changes`, e `rm`/`del`/`Remove-Item`
     de `.cls`/`.cls-meta.xml`. Nao ha aprovacao possivel.
   - **`ask` (pede aprovacao)** quando um `Write`/`Edit` **sobrescreve** um `.cls`/
     `.trigger` de **PRODUCAO ja existente** (inclui a classe sob teste) — foi o vetor
     do bug. A `apex-test-loop` nunca faz isso; mas a `platform-apex-generate` pode
     refatorar producao **com o seu ok**, e nunca ha sobrescrita **silenciosa**.
     **Criar arquivo NOVO e liberado** (nunca destroi nada) — e o que permite o modo
     scaffold criar stubs de dependencias faltantes.

Se voce ja tem `.claude/settings.json` no seu projeto, **mescle** o bloco `deny` e o
`hooks.PreToolUse` (nao substitua o arquivo). O guard usa o Node, ja exigido pela
skill.

> ⚠️ **Limite honesto:** o bloqueio por texto e forte para comandos diretos, mas
> nao e uma fronteira absoluta — wrappers exoticos (`npx`, `docker exec`), variaveis
> de ambiente ou substituicao de comando podem, em tese, escapar. Por isso as tres
> camadas coexistem. Mantenha o habito de revisar o que o agente faz em uma org
> real, e prefira uma **scratch org** descartavel para os primeiros testes.
>
> Para testar o guard voce mesmo: peca ao agente para rodar (por exemplo)
> `sf project delete source ...` — ele deve ser **bloqueado** com uma mensagem da
> skill, sem sequer oferecer aprovacao.

> Dica: para apontar outra org ou incluir utilitarios no deploy, o agente usa o
> script auxiliar por baixo dos panos. Note o **`--test-only`**: envia so a classe
> de teste, porque a de producao ja esta na org e nao deve ser reenviada:
> ```bash
> node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
>   --class AccountService --test AccountServiceTest --test-only \
>   --org minhaOrg --extra ApexClass:TestDataFactory
> ```

### Caminho B — Claude Code via Website (claude.ai/code)

**1) Conecte este repositorio.** No claude.ai/code, conecte a conta do GitHub e
selecione o repositorio que contem `.claude/skills/apex-test-loop/`. Ao iniciar uma
sessao, o Claude clona o repo e **carrega automaticamente** as skills que estao em
`.claude/skills/` do projeto (skills pessoais em `~/.claude/skills/` **nao** valem na
Web — precisam estar no repositorio).

**2) Dispare do mesmo jeito.** No chat da sessao web, use `/apex-test-loop
AccountService` ou peca em linguagem natural, igual ao CLI.

**⚠️ Limitacao importante da Web (leia antes):** a sessao web roda num ambiente na
nuvem que, por padrao, **nao tem o Salesforce CLI (`sf`) instalado, nao tem a sua org
autenticada e nao suporta login interativo**. Ou seja, o passo de **deploy + rodar
testes** do loop **nao funciona na Web sem configuracao extra** do ambiente (script
de setup para instalar o `sf`, liberacao de rede e credenciais nao-interativas).

Na pratica:
- Use a **Web** para escrever, revisar e ajustar a skill e as classes de teste.
- Rode o **loop de cobertura de verdade no CLI local** (Caminho A), onde o `sf` esta
  instalado e conectado a sua org.
- Se voce realmente precisa rodar na Web, e necessario configurar o ambiente da
  sessao (instalar o `sf` via script de setup, ajustar a politica de rede e fornecer
  credenciais da org de forma nao-interativa). Isso e trabalho de setup avancado.

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
      sf-cli-and-coverage.md        # contrato do apex-coverage.mjs + comandos sf de fallback
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

> O craft (mocks, asserts, data factory, bulk, async, DML) agora vive nas skills
> oficiais — por isso a nossa `apex-test-loop` ficou enxuta (so o loop + seguranca +
> guiado + scaffold).

## Memoria de estado (o loop lembra onde parou)

O loop salva um **checkpoint por classe** em
`.claude/apex-test-loop/state/<Classe>.md` no seu projeto: cobertura atual, iteracao,
linhas que faltam, o que ja foi feito e o **proximo passo**. Na pratica:

- Fechou o terminal no meio? Caiu a sessao? E so dizer **"continue de onde paramos"**
  (ou `/apex-test-loop CardHandler` de novo) — ele le o checkpoint e **retoma dali**,
  sem recomecar do zero.
- O arquivo e um Markdown legivel: voce pode abrir e ver o progresso a qualquer momento.
- Se o loop parou **bloqueado** (ex.: dependencia faltando), o checkpoint guarda o
  motivo e o que voce precisa decidir — resolvido isso, ele retoma.

> Nao confundir com o `RECOMMENDATIONS.md` (a memoria LONGA, do que a skill aprende
> entre runs). O checkpoint e a memoria de UM run sobre UMA classe.

## Autoaprendizado (a skill sugere melhorias a si mesma)

No fim de cada run **com friccao real** (o guard bloqueou algo, uma dependencia
travou, precisou de decisao humana, faltou orientacao numa referencia...), a skill
anexa recomendacoes de melhoria em `.claude/skills/apex-test-loop/RECOMMENDATIONS.md`
— com um ID, o gatilho real, o problema e a mudanca proposta, no status `🟡 Proposta`.
Em runs limpos, nao registra nada (evita ruido).

Como o arquivo viaja junto com a skill, ele fica atualizado na copia dentro do seu
projeto. Quando quiser incorporar, **basta pedir**: *"leia as recomendacoes e ajuste
a skill se concordar"*. Ai cada item vira `🟢 Aprovada` / `⚪ Reprovada` (com motivo)
/ `✅ Aplicada` (com o PR), e as aprovadas sao implementadas. O historico das
melhorias ja aplicadas (`R-0001` em diante, com o PR de cada uma) esta la como
exemplo do formato — inclusive a propria arquitetura hibrida e a memoria de estado
nasceram desse ciclo.

## Observacoes

- A meta padrao e `>= 99%`. 100% nem sempre e alcancavel (linhas genuinamente
  inatingiveis); nesses casos a skill **documenta** a linha em vez de forcar um
  caminho artificial.
- A cobertura lida no loop e a atribuivel a classe de teste dedicada. A metrica
  org-wide (minimo 75% para deploy em producao) e diferente e depende de todos os
  testes da org.
- **Dependencias faltando (modo dev/treino):** se voce baixou so a classe (sem a org
  com `__c`/`__mdt`/classes de apoio), o loop nao trava de vez. Em **uso real** ele
  para e pede para apontar a org com o schema. Em **dev/treino**, com seu ok
  (`--scaffold` ou "estou treinando, sem a org"), ele cria o **minimo** das
  dependencias faltantes como **arquivos novos** (`__c`/`__mdt` viram metadata XML,
  nao Apex) — **sem nunca tocar na classe sob teste**. Detalhes em
  `references/scaffolding-dependencies.md`. Ideal: uma **scratch org** descartavel.
- **Teste falhando por causa da ORG (Flow, config ausente, limite de CPU):** o loop
  NAO "da um jeitinho" (remover o teste, engolir a excecao com try/catch) — isso e
  proibido pelas Regras de Ouro. Ele diagnostica a causa, tenta o caminho legitimo
  (criar o dado real, dividir o teste) e, se for limitacao genuina do ambiente,
  **para e te explica as opcoes** — inclusive re-pactuando a meta com transparencia
  ("neste ambiente o alcancavel e X%, porque..."). Problemas do codigo de producao
  descobertos pelos testes (ex.: SOQL em loop) viram a secao **"Achados de
  producao"** no relatorio final — reportados, nunca corrigidos por conta propria.
  Detalhes em `references/runtime-blockers.md`.
- **Cobertura empacada?** Se a % ficar parada por 2 iteracoes enquanto os testes
  aumentam, o loop para de escrever testes e diagnostica quais linhas continuam
  descobertas (regra do platô) — testes novos passam a mirar linhas especificas.
