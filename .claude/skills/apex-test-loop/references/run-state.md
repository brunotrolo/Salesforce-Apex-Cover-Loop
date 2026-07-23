# Memoria de estado do run (checkpoint por classe)

> **V2 (multiagente):** quem le/escreve este arquivo é sempre o agente
> `apex-state-recorder` — é o único com permissão de escrita fora da classe de teste,
> allowlist fechada (ver `.claude/agents/apex-state-recorder.md` e `classifyStateWrite`
> em `scripts/guard.mjs`). Os demais agentes (`apex-orchestrator`, `apex-test-writer`,
> `apex-deploy-runner`, `apex-coverage-analyst`) só leem este arquivo via ele, nunca
> escrevem diretamente.

A memoria externa do loop: um arquivo Markdown **por classe**, no projeto do usuario,
que registra **onde o run parou** — para retomar apos interrupcao, troca de sessao ou
compactacao de contexto, **sem recomecar do zero**.

> Nao confundir com o `RECOMMENDATIONS.md` (memoria LONGA: o que a skill aprendeu
> entre runs). Este arquivo e a memoria de **estado de UM run** sobre UMA classe.

## Onde fica (caminho NEUTRO de ferramenta — padrao unico)

```
<projeto>/.apex-test-loop/state/<Classe>.md
```

- **Caminho neutro por design (aprendido em campo).** O mesmo projeto pode ser rodado
  por ferramentas diferentes (Claude Code usa `.claude/`, OpenCode usa `.opencode/`).
  Num run real, o state acabou salvo em `.claude/apex-test-loop/state/` por uma
  ferramenta e em `.opencode/skills/apex-test-loop/state/` por outra — dois silos,
  progresso perdido na troca. Por isso o estado vive em `<projeto>/.apex-test-loop/`
  (na RAIZ do projeto, **fora** de `.claude`/`.opencode`): qualquer ferramenta que
  rode a skill le e escreve no MESMO lugar.
- **Migracao:** se no Passo 0 voce encontrar estado antigo em
  `.claude/apex-test-loop/state/` ou `.opencode/**/state/`, **mova** para o caminho
  neutro (`git mv` se versionado) e siga a partir dele — nunca mantenha os dois.
- Fora da pasta da skill (a skill pode ser atualizada/substituida; o estado e do projeto).
- Escrever `.md` e liberado pelo guard (so `.cls`/`.trigger` de producao e protegido).
- O arquivo e legivel por humanos — o usuario pode abrir e entender o progresso.

> Nota sobre os SCRIPTS da skill (`apex-coverage.mjs`, `guard.mjs`): esses vivem
> DENTRO da pasta da skill, entao o caminho deles acompanha onde a skill esta
> instalada — `.claude/skills/apex-test-loop/scripts/...` no Claude Code,
> `.opencode/skills/apex-test-loop/scripts/...` no OpenCode. Use o prefixo da
> ferramenta em que voce esta rodando. So o STATE (acima) e neutro e compartilhado.

### UM arquivo canonico por classe — copias sao PROIBIDAS (aprendido em campo)

Num run real existiam `CaseHandler.md` E `CaseHandler-Copia.md` com numeros
completamente divergentes (37% vs 60%, iteracao 7 vs 1) — a sessao teve que REMEDIR
a cobertura do zero so para descobrir qual era o verdadeiro, e o contador de parada
de seguranca ficou sem base. Regras:

- **Nunca crie** `-Copia`, `-backup`, `-old` ou qualquer arquivo irmao do checkpoint.
  Precisa "guardar a versao anterior antes de mudar"? Use `git`, ou uma secao
  `## Historico` DENTRO do proprio arquivo. O canonico e `state/<Classe>.md`, unico.
- **No Passo 0**, se houver mais de um arquivo casando com `state/<Classe>*.md`:
  PARE e pergunte ao usuario qual e o valido (ponto nomeado de decisao humana) —
  nunca escolha sozinho nem tente "mesclar" numeros divergentes por conta propria.
  Apos a resposta, delete o invalido e siga com um so.

## Quando ler e escrever (o ciclo)

1. **Passo 0 (antes de tudo):** verifique se `state/<Classe>.md` existe.
   - Existe com `status: em_andamento` ou `pausado_bloqueado` → **ofereca retomar**:
     resuma ao usuario onde parou ("cobertura 88%, iteracao 3/6, falta o else da
     linha 45") e continue dali. So recomece do zero se o usuario pedir.
   - Existe com `status: concluido` → run novo (a classe mudou?): confirme com o
     usuario e recomece o arquivo.
   - Nao existe → crie a partir do template abaixo antes da primeira iteracao.
1b. **Antes do PRIMEIRO deploy (GATE DE PRÉ-DEPLOY):** preencha a seção
   `## Inventário de cenários` com TODOS os cenários do mapa do Passo 0 (checklist por
   método) e autore a classe de teste cobrindo todos eles. Marque `[x]` cada cenário
   quando o teste dele estiver **escrito** (não quando passar). Só deploye com o
   inventário esgotado. Isso impede o drip-feed (deploy prematuro) — crítico com
   modelos menores via OpenCode.
2. **Ao fim de CADA iteracao do loop:** atualize `iteracao`, `cobertura_atual`,
   `historico_cobertura`, `linhas_nao_cobertas`, marque o que foi feito e escreva o
   **proximo passo** em uma frase concreta.
3. **No encerramento:** `status: concluido` + resumo final.
4. **Na parada de seguranca / bloqueio:** `status: pausado_bloqueado` + o motivo
   exato e o que o humano precisa decidir. E este arquivo que torna a retomada
   trivial depois que o humano resolver.

## Regras

- **Atualize DE VERDADE a cada iteracao** — um estado velho e pior que nenhum
  (mentiria para o proximo run). A atualizacao e parte do passo 4 do loop, nao um
  extra opcional.
- **Proximo passo sempre acionavel**: "cobrir o ramo else da linha 45 (cenario de
  valor nulo)" — nunca "continuar melhorando".
- **Curto**: isto e um checkpoint, nao um diario. Historico de cobertura em uma
  linha; feitos como checklist enxuto.
- No **modo guiado**, mencione ao usuario que o progresso esta salvo ("se a gente
  parar aqui, eu retomo deste ponto depois").

## Template

```markdown
# Estado do loop — <Classe>

- status: em_andamento            <!-- em_andamento | concluido | pausado_bloqueado -->
- meta_cobertura: 99               <!-- PISO FIXO >=99. O agente NUNCA escreve menos. Linhas inalcancaveis se documentam uma a uma; se 99 for inatingivel, PARE e reporte ao humano (nao abaixe o numero). -->
- org: <alias>
- modo: automatico                <!-- automatico | guiado | scaffold -->
- iteracao: 0/6
- cobertura_atual: (sem baseline)
- historico_cobertura: —
- linhas_nao_cobertas: —
- cenarios: 0/0 escritos       <!-- escritos na classe de teste / total do inventario -->
- atualizado_em: <AAAA-MM-DD HH:MM>

## Inventário de cenários (o GATE DE PRÉ-DEPLOY preenche ANTES do 1º deploy)
<!-- Todos os cenários do mapa do Passo 0, por método. Autore TODOS antes de deployar.
     Marque [x] quando o teste do cenário estiver ESCRITO (não quando passar). -->
- [ ] <metodo1> — <ramo/caso a cobrir>
- [ ] <metodo1> — <outro ramo>
- [ ] <metodo2> — <caso de erro / exceção>

## Feito
- [ ] Passo 0: classe localizada e mapeada
- [ ] Inventário de cenários materializado (gate de pré-deploy)
- [ ] Baseline medida (se teste ja existia)

## Proximo passo
- <uma frase concreta e acionavel>

## Bloqueios / decisoes do humano
- (vazio)                          <!-- a meta NAO cai de 99 (piso fixo). Se ha linhas
                                         inalcancaveis, liste-as aqui como excecoes
                                         documentadas (linha + motivo concreto). Se 99
                                         for inatingivel no ambiente, registre a
                                         pergunta feita ao humano e a resposta dele —
                                         assim, ao retomar, o agente NAO pergunta de novo -->
```

## Exemplo preenchido (meio do run)

```markdown
# Estado do loop — CardHandler

- status: em_andamento
- meta_cobertura: 99
- org: devsandbox
- modo: automatico
- iteracao: 3/6
- cobertura_atual: 88
- historico_cobertura: 0 -> 72 -> 88
- linhas_nao_cobertas: [45, 77]
- cenarios: 12/14 escritos
- atualizado_em: 2026-07-19 14:32

## Inventário de cenários
- [x] processCards — happy path (lista valida)
- [x] processCards — lista vazia
- [x] processCards — catch de DmlException (mock)
- [ ] processCards — else da linha 45 (Card__c sem CardsInfo)
- [ ] resolveInfo — linha 77 (retorno nulo do callout)
<!-- ...demais itens... -->

## Feito
- [x] Passo 0: classe em force-app/main/default/classes/CardHandler.cls; callout detectado
- [x] Inventario materializado (14 cenarios) + autorados 12 antes do 1o deploy
- [x] Iteracao 1: happy path + negativos (72%) — CardHandlerTest criada
- [x] Iteracao 2: catch de DML via mock (88%)

## Proximo passo
- Cobrir o ramo else da linha 45 (cenario: Card__c sem CardsInfo vinculado)

## Bloqueios / decisoes do humano
- (vazio)
```
