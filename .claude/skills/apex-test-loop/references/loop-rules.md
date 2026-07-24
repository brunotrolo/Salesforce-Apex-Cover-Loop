# Regras do loop — fonte única (lida por todos os agentes)

Este arquivo é a **única** fonte de regras de negócio do `apex-test-loop`. O
orquestrador e os 4 subagentes especialistas (`apex-test-writer`,
`apex-deploy-runner`, `apex-coverage-analyst`, `apex-state-recorder`) leem daqui —
nenhum deles deve reimplementar ou reinterpretar estas regras no próprio prompt.
Se uma regra precisar mudar, muda-se **aqui**, uma vez só.

## Meta de qualidade

- **Piso fixo: cobertura real da ORG ≥ 99%, todos os testes passando, sem testes
  lentos (`slowTests` vazio).** Isto é o MVP deployável — padrão.
- O agente **nunca** abaixa esse piso por conta própria. Se 99% parecer inatingível,
  o loop **para** e apresenta opções ao humano — só o dono do projeto decide mudar
  a régua.
- **`--rigoroso` (opt-in do usuário):** assert de valor exato com mensagem em todo
  método via classe `Assert` moderna, 1 comportamento por método, bulk 251+
  mandatório para triggers/handlers/`@InvocableMethod`. Nunca engolir exceção com
  try/catch nem guardar assert com `isEmpty()`.
- **MVP padrão (sem `--rigoroso`):** guardas de portabilidade (`isEmpty()`,
  try/catch de config) são aceitas como tática de portabilidade entre ambientes.
  Bulk 251+ é recomendado, não mandatório.

## Critério de conclusão (dois portões, ambos objetivos)

**Portão 1 — iteração rápida (a cada rodada do loop):** medido com
`sf apex run test` (barato, itera rápido):

```
coveredPercent >= 99  E  failures == []  E  slowTests == []
```

**Portão 2 — confirmação oficial de deployabilidade (UMA vez, só ao bater o
Portão 1):** o loop NÃO conclui direto no Portão 1. Quando o Portão 1 é atingido, o
`apex-deploy-runner` roda a **validação oficial de deploy** — o mesmo gate que a
Salesforce aplica a um deploy real de produção (cobertura é o que prevalece para
deployar, não só "os testes passaram"):

```bash
node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
  --class <Classe> --test <Classe>Test --validate [--org <alias>] [--extra ...]
```

Isso executa `sf project deploy validate --test-level RunSpecifiedTests` — é
**check-only** (simula o deploy inteiro e NÃO grava nada na org), incluindo a classe
de produção + a de teste no `--metadata`. O loop só declara `concluido` quando:

```
deployWouldSucceed == true  E  coveredPercent >= 99  E  failures == []
```

vindo do `phase: "validate"`. Se o Portão 2 falhar (ex.: a cobertura agregada da org
ficou abaixo do mínimo, ou uma dependência derruba a validação) apesar do Portão 1 ter
passado, isso NÃO é conclusão — é `continuar`/`bloqueado`, e o motivo real vem em
`validateError`.

Rationale: `apex run test` é rápido para iterar, mas o veredito de "isso deployaria
em produção?" é do `deploy validate`. Iterar com o primeiro e confirmar com o segundo
dá velocidade nas iterações e a certeza real (o critério que a equipe usa) na
conclusão. **Nunca** rodar `--validate` a cada iteração (é mais pesado) — só uma vez,
ao final. Nenhum agente conclui por inferência, estimativa ou "parece que está pronto".

**⛔ O Portão 2 é AUTOMÁTICO e OBRIGATÓRIO — NUNCA pergunte ao humano se deve rodá-lo
(falha real observada).** Num run real, ao bater o Portão 1 (99%, 28/28 passando), o
loop apresentou o Portão 2 como um "próximo passo possível" e **perguntou "Quer
prosseguir com o Portão 2?"** — parando para aguardar o humano. Isso está ERRADO:
bater o Portão 1 é exatamente o gatilho que **dispara** o Portão 2 sozinho, sem pausa.
Regras:

- Ao atingir o Portão 1, a próxima ação é **imediatamente** rodar o `--validate` —
  não peça confirmação, não liste o Portão 2 como opção, não termine o turno com uma
  pergunta. O Portão 2 é parte do critério de conclusão, não um extra opcional.
- "Rodar o Portão 2" **NÃO** é um ponto de decisão humana (ver lista abaixo). Tratar
  como se fosse é violação da autonomia de 100% do orquestrador.
- Só existe pergunta ao humano DEPOIS do Portão 2 se ele **falhar** por limitação de
  ambiente que exija decisão (aí sim vira `bloqueado`) — nunca ANTES de rodá-lo.

## Autonomia do orquestrador (V2)

O `apex-orchestrator` é **100% autônomo** — não pausa para aprovação a cada
iteração. Ele só para nos pontos nomeados abaixo (decisão humana) ou no critério de
conclusão acima.

## Pontos nomeados de decisão humana (únicas pausas legítimas)

1. Precisa editar ou sobrescrever a classe de **produção** existente.
2. Precisa ativar o **modo scaffold** (criar objeto/campo faltante em dev/treino).
3. A meta de 99% parece **inatingível** neste ambiente.
4. **Estado ambíguo** — mais de um checkpoint casando com `state/<Classe>*.md`, ou
   histórico de cobertura inconsistente entre eles.
5. **Parada de segurança** sem saída clara (ver abaixo).

Esta lista é **exaustiva**: se a pausa que você está prestes a fazer não é uma destas
cinco, você **não pode** parar para perguntar. Em particular, **rodar o Portão 2 NÃO
está aqui** — é automático e obrigatório (ver critério de conclusão). Perguntar "quer
prosseguir com o Portão 2?", "quer que eu valide o deploy?", ou listar o Portão 2 como
"próximo passo possível" são todos violações desta regra.

## Parada de segurança (emergência, não critério normal de saída)

Após 6 iterações sem evolução de cobertura, ou erro crônico de deploy que não
converge: o loop **para** (não continua rodando indefinidamente), grava
`status: pausado_bloqueado` com o motivo exato, e apresenta ao humano o que precisa
ser decidido. Isto é diferente do critério de conclusão — é uma trava contra loop
infinito, não uma forma aceitável de "terminar" o trabalho.

## Regra do platô

Se `coveredPercent` ficar parado por 2 iterações seguidas enquanto testes crescem,
o `apex-coverage-analyst` para de gerar prompts genéricos ("melhore a cobertura") e
passa a nomear a linha/ramo exato ainda descoberto em cada prompt.

## Portão de estabilidade

Testes com duração ≥8s (`slowTests`) são deploy-blockers latentes (CPU-frágeis: a
mesma suíte pode passar numa org vazia e falhar numa org carregada). Precisam ser
divididos em grupos com `startTest/stopTest` próprios **antes** de o loop poder
concluir — mesmo com cobertura e testes 100% passando.

## Travas de segurança (sempre, qualquer modo — absolutas)

1. Nunca alterar a classe de **produção** (nem para inflar cobertura).
2. Sem `@IsTest(SeeAllData=true)` e sem IDs hardcoded.
3. Nunca fingir cobertura impossível — documentar linhas inalcançáveis, uma a uma,
   com o motivo.
4. Nunca remover ou degradar um teste que já passa.
5. Todos os testes DEVEM passar — nenhuma exceção "temporária".
6. Nenhum comando destrutivo (`sf project/org/data delete`, deploy destrutivo,
   apagar/mover `.cls`/`.trigger`) — reforçado por `settings.json` (deny) e
   `scripts/guard.mjs` (hook `PreToolUse`), independente do prompt.

## Divisão de responsabilidade (quem decide o quê)

| Agente | Decide | Nunca decide |
|---|---|---|
| `apex-orchestrator` | parar/continuar o loop; ordem de invocação | qualidade do teste; interpretação de cobertura |
| `apex-test-writer` | como escrever o cenário pedido | se o loop deve parar; se a meta deve baixar |
| `apex-deploy-runner` | nada — só executa e devolve dado bruto | qualquer interpretação do resultado |
| `apex-coverage-analyst` | próximo passo (continuar/concluído/bloqueado) | abaixar a meta; pular trava de segurança |
| `apex-state-recorder` | onde e como registrar (dentro da allowlist) | qual checkpoint duplicado é válido |

## Paralelismo — quando faz sentido

- Escrever → rodar → analisar é **sequencial** dentro de uma classe (nunca testar
  algo ainda não escrito).
- `apex-state-recorder` pode gravar a iteração N em paralelo ao início da escrita da
  iteração N+1 (não há dependência de dado).
- Classes diferentes, cada uma com seu loop sequencial próprio, podem rodar em
  paralelo entre si.
