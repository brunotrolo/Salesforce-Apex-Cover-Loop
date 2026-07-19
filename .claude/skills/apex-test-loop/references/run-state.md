# Memoria de estado do run (checkpoint por classe)

A memoria externa do loop: um arquivo Markdown **por classe**, no projeto do usuario,
que registra **onde o run parou** — para retomar apos interrupcao, troca de sessao ou
compactacao de contexto, **sem recomecar do zero**.

> Nao confundir com o `RECOMMENDATIONS.md` (memoria LONGA: o que a skill aprendeu
> entre runs). Este arquivo e a memoria de **estado de UM run** sobre UMA classe.

## Onde fica

```
<projeto>/.claude/apex-test-loop/state/<Classe>.md
```

- Fora da pasta da skill (a skill pode ser atualizada/substituida; o estado e do projeto).
- Escrever `.md` e liberado pelo guard (so `.cls`/`.trigger` de producao e protegido).
- O arquivo e legivel por humanos — o usuario pode abrir e entender o progresso.

## Quando ler e escrever (o ciclo)

1. **Passo 0 (antes de tudo):** verifique se `state/<Classe>.md` existe.
   - Existe com `status: em_andamento` ou `pausado_bloqueado` → **ofereca retomar**:
     resuma ao usuario onde parou ("cobertura 88%, iteracao 3/6, falta o else da
     linha 45") e continue dali. So recomece do zero se o usuario pedir.
   - Existe com `status: concluido` → run novo (a classe mudou?): confirme com o
     usuario e recomece o arquivo.
   - Nao existe → crie a partir do template abaixo antes da primeira iteracao.
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
- meta_cobertura: 99
- org: <alias>
- modo: automatico                <!-- automatico | guiado | scaffold -->
- iteracao: 0/6
- cobertura_atual: (sem baseline)
- historico_cobertura: —
- linhas_nao_cobertas: —
- atualizado_em: <AAAA-MM-DD HH:MM>

## Feito
- [ ] Passo 0: classe localizada e mapeada
- [ ] Baseline medida (se teste ja existia)

## Proximo passo
- <uma frase concreta e acionavel>

## Bloqueios / decisoes do humano
- (vazio)
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
- atualizado_em: 2026-07-19 14:32

## Feito
- [x] Passo 0: classe em force-app/main/default/classes/CardHandler.cls; callout detectado
- [x] Iteracao 1: happy path + negativos (72%) — CardHandlerTest criada
- [x] Iteracao 2: catch de DML via mock (88%)

## Proximo passo
- Cobrir o ramo else da linha 45 (cenario: Card__c sem CardsInfo vinculado)

## Bloqueios / decisoes do humano
- (vazio)
```
