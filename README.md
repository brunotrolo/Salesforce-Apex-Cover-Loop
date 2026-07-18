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

### O loop pede aprovacao a cada iteracao — como rodar sem interrupcao

Por padrao, o Claude Code pede confirmacao antes de rodar comandos que mudam algo
fora do chat (aqui, cada deploy/teste na sua org). Este repositorio ja vem com um
**`.claude/settings.json`** que libera especificamente os comandos que a skill
`apex-test-loop` precisa repetir a cada volta do loop:

```json
{
  "permissions": {
    "allow": [
      "Bash(node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs *)",
      "Bash(sf project deploy start *)",
      "Bash(sf apex run test *)",
      "Bash(sf org display*)",
      "Bash(sf config get*)",
      "PowerShell(node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs *)",
      "PowerShell(sf project deploy start *)",
      "PowerShell(sf apex run test *)",
      "PowerShell(sf org display*)",
      "PowerShell(sf config get*)"
    ]
  }
}
```

Com isso, o loop roda do inicio ao fim **sem interromper a cada iteracao** — mas o
"raio de acao" livre fica limitado so a esses comandos. Qualquer coisa fora do
escopo da skill (`git push --force`, `rm -rf`, `sf org delete`, editar arquivos
fora do projeto etc.) continua pedindo aprovacao normalmente, como sempre.

> ⚠️ **No Windows, `Bash` e `PowerShell` sao categorias de permissao
> DIFERENTES.** Se voce nao tem o Git Bash instalado, o Claude Code usa o
> PowerShell como shell padrao — e regras `Bash(...)` **nao** cobrem comandos
> rodados por ele (por isso o arquivo acima ja inclui as duas versoes, `Bash(...)`
> e `PowerShell(...)`, para os mesmos comandos). Se mesmo assim continuar pedindo
> aprovacao a cada comando, confirme qual shell esta ativo com `claude --debug`
> (procure por "Using shell: ..." no log) — ou instale o Git Bash e passe a usar
> as regras `Bash(...)`.

- Este arquivo e **versionado** (vale para quem clonar o repositorio). Se preferir
  algo so seu, mova o mesmo conteudo para `.claude/settings.local.json` (nao
  versionado) em vez de `.claude/settings.json`.
- Para revisar ou revogar a qualquer momento: edite/apague as linhas em
  `.claude/settings.json`, ou rode `/permissions` dentro do Claude Code.

### Travas de seguranca (a skill NUNCA apaga a classe de producao)

A skill so pode **criar/editar a classe de TESTE**. Apagar, mover ou sobrescrever a
classe de producao (no disco ou na org), rodar deploy destrutivo, ou excluir
org/registros e bloqueado em **tres camadas independentes**, ja incluidas no
`.claude/settings.json` deste repositorio:

1. **Instrucoes no `SKILL.md`** — uma secao "🚫 NUNCA FACA" no topo, lida antes de
   qualquer acao.
2. **Regras `permissions.deny`** — bloqueio duro (sem aprovacao possivel) de
   `sf project delete`, `sf org delete` e `sf data delete` (Bash e PowerShell).
3. **Hook `PreToolUse` (`scripts/guard.mjs`)** — inspeciona o comando inteiro e
   nega tambem o que as regras de prefixo nao alcancam: deploy destrutivo
   (`--pre`/`--post-destructive-changes`) e exclusao de arquivos `.cls`/`.cls-meta.xml`.

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
> script auxiliar por baixo dos panos:
> ```bash
> node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
>   --class AccountService --test AccountServiceTest --deploy \
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
  scripts/
    apex-coverage.mjs               # deploy + run test + parse -> JSON com linhas nao cobertas
    guard.mjs                       # hook PreToolUse: bloqueia comandos destrutivos
  references/
    guided-mode.md                  # roteiro do modo guiado (passo a passo para leigos)
    sf-cli-and-coverage.md          # comandos sf, flags e formato do JSON de cobertura
    testing-dml-and-exceptions.md   # como cobrir catch/DML na ordem certa
    callouts-and-async.md           # Test.setMock (HTTP/SOAP) e @future/Queueable/Batch/Schedulable
    quality-checklist.md            # matriz de cenarios, exigencia de asserts, anti-patterns
    templates/
      ExampleTest.cls               # esqueleto de classe de teste
      ExampleTest.cls-meta.xml      # metadata da classe de teste
```

## Observacoes

- A meta padrao e `>= 99%`. 100% nem sempre e alcancavel (linhas genuinamente
  inatingiveis); nesses casos a skill **documenta** a linha em vez de forcar um
  caminho artificial.
- A cobertura lida no loop e a atribuivel a classe de teste dedicada. A metrica
  org-wide (minimo 75% para deploy em producao) e diferente e depende de todos os
  testes da org.
