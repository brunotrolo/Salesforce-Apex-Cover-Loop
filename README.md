# Salesforce-LoopAgentApex

Skill de **loop agente** para o Claude Code que gera e melhora **classes de teste
Apex** de forma auto-corretiva, ate atingir cobertura **real** e alta (meta padrao
`>= 99%`) para uma classe de producao especifica.

Voce informa uma classe (`/apex-test-loop AccountService`), e o Claude Code entra
num ciclo fechado:

```
escrever teste  ->  deploy (sf)  ->  rodar teste + cobertura  ->  ler linhas nao cobertas
      ^                                                                     |
      +----------------------  melhorar o cenario que falta  <--------------+
```

O loop so termina quando a cobertura atinge a meta **com asserts significativos**,
ou quando bate uma condicao de parada segura (e ai gera um relatorio para o humano).

## O que faz diferente

- **Cobertura por cenario real, nao por numero.** Regras anti-cheat proibem inflar
  a porcentagem (mexer na formatacao da classe de producao, testes sem assert etc.).
- **Sinal deterministico.** Um script auxiliar (`scripts/apex-coverage.mjs`) roda o
  teste, faz o parse do JSON do `sf` e devolve **exatamente as linhas nao cobertas**,
  em vez de o agente adivinhar.
- **Seguranca contra acoes destrutivas.** A skill so CRIA/edita a classe de TESTE.
  Apagar, mover ou sobrescrever a classe de producao (no disco ou na org), rodar
  deploy destrutivo ou excluir org/registros e **proibido em tres camadas**:
  instrucoes no `SKILL.md`, regras `deny` e um hook `PreToolUse` que inspeciona
  cada comando (veja "Travas de seguranca" abaixo).
- **`catch`/DML tratado na ordem certa.** Primeiro forcar falha real com dado
  invalido / `System.runAs`; depois Stub API / injecao de dependencia; e so como
  ultimo recurso um hook `@TestVisible` na classe de producao — sempre sinalizado
  para revisao humana, nunca commitado silenciosamente.
- **Callouts e assincrono sem sustos.** Classes com HTTP/SOAP ou
  `@future`/Queueable/Batch/Schedulable sao detectadas ANTES de escrever o teste,
  aplicando `Test.setMock` e os padroes de `startTest/stopTest` corretos — em vez
  de queimar iteracoes com falhas de plataforma.

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

**2) Coloque a skill no lugar certo.** A estrutura precisa ficar exatamente assim,
dentro do seu projeto Salesforce (a pasta `.claude` comeca com ponto e pode ficar
"invisivel" no explorador de arquivos):

```
meu-projeto-salesforce/
└── .claude/
    └── skills/
        └── apex-test-loop/
            ├── SKILL.md
            ├── scripts/
            └── references/
```

Copie a pasta inteira `apex-test-loop` (deste repositorio) para la:

```bash
# por PROJETO (vale so nesse projeto):
cp -R .claude/skills/apex-test-loop /caminho/do/seu-projeto-sfdx/.claude/skills/

# OU global (vale em TODOS os seus projetos no seu computador):
cp -R .claude/skills/apex-test-loop ~/.claude/skills/
```

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

### Rodar sem ficar aprovando a cada comando

Por padrao, o Claude Code pede confirmacao antes de rodar comandos que mudam algo
fora do chat. Para o loop rodar liso, o `.claude/settings.json` deste repositorio
**libera geral** o trabalho normal — **mantendo** as travas de seguranca ativas:

```json
{
  "permissions": {
    "allow": ["Bash(*)", "PowerShell(*)", "Write", "Edit"],
    "deny": [
      "Bash(sf project delete *)", "Bash(sf org delete *)", "Bash(sf data delete *)",
      "PowerShell(sf project delete *)", "PowerShell(sf org delete *)", "PowerShell(sf data delete *)"
    ]
  },
  "hooks": { "PreToolUse": [ /* guard.mjs — ver abaixo */ ] }
}
```

Por que isso e seguro (confirmado na doc oficial do Claude Code):
- **`deny` sempre vence o `allow`** — os comandos destrutivos seguem bloqueados,
  mesmo com o `allow` amplo.
- **O hook `PreToolUse` roda ANTES do `allow`** e pode bloquear — entao o guarda que
  impede apagar/sobrescrever a producao **continua valendo**, mesmo liberando geral.

Resultado: **sem prompts** no trabalho normal (inclusive no Windows/PowerShell, que
tinha um bug de `/` vs `\` nas regras escopadas); o que e destrutivo continua barrado.

- Arquivo **versionado**. Prefere algo so seu? Ponha o mesmo conteudo em
  `.claude/settings.local.json` (nao versionado).
- Quer voltar a pedir aprovacao? Troque `Bash(*)`/`PowerShell(*)` pelas regras
  escopadas (so os comandos da skill), ou rode `/permissions` no Claude Code.
- Quer **zero** prompts de tudo (nao so shell)? `"defaultMode": "bypassPermissions"`
  tambem preserva `deny` + hook — porem e mais amplo; use so em ambiente confiavel.

### Travas de seguranca (a skill NUNCA apaga a classe de producao)

A skill so pode **criar/editar a classe de TESTE**. Apagar, mover ou sobrescrever a
classe de producao (no disco ou na org), rodar deploy destrutivo, ou excluir
org/registros e bloqueado em **tres camadas independentes**, ja incluidas no
`.claude/settings.json` deste repositorio:

1. **Instrucoes no `SKILL.md`** — uma secao "🚫 NUNCA FACA" no topo, lida antes de
   qualquer acao.
2. **Regras `permissions.deny`** — bloqueio duro (sem aprovacao possivel) de
   `sf project delete`, `sf org delete` e `sf data delete` (Bash e PowerShell).
3. **Hook `PreToolUse` (`scripts/guard.mjs`)** — inspeciona cada acao e nega tambem
   o que as regras de prefixo nao alcancam:
   - **comandos** destrutivos (deploy com `--pre`/`--post-destructive-changes`,
     `rm`/`del`/`Remove-Item` de `.cls`/`.cls-meta.xml`);
   - **escrita de arquivo** (`Write`/`Edit`) que **sobrescreve** uma classe/trigger de
     **PRODUCAO ja existente** — foi o vetor do bug real. O guard bloqueia editar/
     sobrescrever qualquer `.cls`/`.trigger` que **ja existe** e nao e teste (inclui
     a classe sob teste). **Criar arquivo NOVO e liberado** (nunca destroi nada) —
     e o que permite o modo scaffold criar stubs de dependencias faltantes.

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
.claude/skills/apex-test-loop/
  SKILL.md                          # o loop, as regras de ouro e a condicao de parada
  RECOMMENDATIONS.md                # livro-razao de melhorias da propria skill (autoaprendizado)
  scripts/
    apex-coverage.mjs               # deploy + run test + parse -> JSON com linhas nao cobertas
    guard.mjs                       # hook PreToolUse: bloqueia comandos destrutivos + escrita na producao
  references/
    guided-mode.md                  # roteiro do modo guiado (passo a passo para leigos)
    sf-cli-and-coverage.md          # comandos sf, flags e formato do JSON de cobertura
    testing-dml-and-exceptions.md   # como cobrir catch/DML na ordem certa
    callouts-and-async.md           # Test.setMock (HTTP/SOAP) e @future/Queueable/Batch/Schedulable
    scaffolding-dependencies.md     # modo dev: criar o minimo de dependencias faltantes (__c/__mdt/classes)
    quality-checklist.md            # matriz de cenarios, exigencia de asserts, anti-patterns
    templates/
      ExampleTest.cls               # esqueleto de classe de teste
      ExampleTest.cls-meta.xml      # metadata da classe de teste
```

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
melhorias ja aplicadas (PRs #5–#8) esta la como exemplo do formato.

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
