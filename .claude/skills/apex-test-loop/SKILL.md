---
name: apex-test-loop
description: >-
  Gera ou melhora a classe de teste Apex do Salesforce para UMA classe de
  producao especifica, rodando um loop auto-corretivo (deploy -> run test ->
  ler cobertura -> melhorar) via Salesforce CLI (sf) ate atingir cobertura
  real e alta (meta padrao >= 99%). Use quando o usuario pedir para "criar/gerar
  classe de teste Apex", "cobrir a classe X com testes", "aumentar a cobertura",
  ou invocar /apex-test-loop <NomeDaClasse>. O foco e cobertura por CENARIOS
  REAIS com asserts significativos -- nunca inflar a porcentagem. Oferece um
  MODO GUIADO (passo a passo, linguagem simples, para leigos), acionado por
  --guiado/--passo-a-passo ou por pedidos como "me ensine", "sou iniciante",
  "nunca usei isso".
---

# Apex Test Loop — Loop agente de cobertura de testes Apex

Objetivo: dada UMA classe de producao Apex, produzir uma classe de teste que
alcance cobertura alta e **real** (meta padrao **>= 99%**), num ciclo fechado:
escrever teste → fazer deploy → rodar teste com cobertura → ler as linhas nao
cobertas → melhorar → repetir, ate a meta ou ate uma condicao de parada segura.

## 🚫 NUNCA FACA (proibicoes absolutas — leia ANTES de qualquer acao)

Esta skill **CRIA e edita apenas a classe de TESTE** (`<Classe>Test.cls`). A classe
de producao e **intocavel**, com uma unica excecao pontual e sinalizada: o hook de
testabilidade de DML (veja `references/testing-dml-and-exceptions.md`). Fora disso,
voce **NUNCA**, em hipotese alguma:

1. **Apaga, move ou renomeia a classe de producao** `<Classe>.cls` nem o seu
   `<Classe>.cls-meta.xml` — nem no disco, nem na org.
2. **Sobrescreve a classe de producao.** Antes de QUALQUER `Write`/`Edit`, confirme
   que o caminho termina em `...Test.cls` (a classe de TESTE). Jamais escreva no
   arquivo de producao (salvo o hook de DML, com aviso explicito).
3. **Roda comandos que apagam arquivos** (`rm`, `del`, `Remove-Item`, `unlink`,
   `find ... -delete`) sobre `.cls`/`.cls-meta.xml` ou qualquer arquivo do projeto.
4. **Roda deploy destrutivo ou exclusao na org**: `sf project delete source`,
   `sf project delete tracking`, deploy com `--pre-destructive-changes` /
   `--post-destructive-changes` / `destructiveChanges.xml`, `sf org delete`,
   `sf data delete`.
5. **Apaga outras classes, testes ou dados** que voce nao criou nesta sessao.
6. **Mexe na classe de producao para "resolver" teste que falha ou cobertura baixa.**
   Se um teste falha ou a cobertura nao sobe, a resposta e **SEMPRE ajustar a classe
   de TESTE** — nunca a de producao.

Se qualquer acao sua fosse remover, mover ou substituir algo da producao ou da org:
**PARE e pergunte ao humano.** Na duvida, nao faca.

> Reforco fora do modelo: o `.claude/settings.json` deste projeto BLOQUEIA os
> comandos destrutivos acima em duas camadas independentes — regras `deny` e um
> hook `PreToolUse` (`scripts/guard.mjs`) que inspeciona o comando inteiro — de
> modo que essas acoes falham mesmo que algo tente executa-las.

## Entrada

O usuario informa a classe de producao, por exemplo:
`/apex-test-loop AccountService` ou "crie a classe de teste para AccountService".

Se o nome nao foi dado, pergunte qual classe cobrir antes de começar.

### Dois modos de execucao

- **Automatico (padrao)**: roda o loop inteiro sozinho e apresenta o resultado no
  fim. Use quando o usuario ja conhece o processo.
- **Guiado (passo a passo, para leigos)**: conduz UMA etapa por vez, em linguagem
  simples, ensinando o conceito e **pedindo confirmacao** antes de acoes que mexem
  na org. Entre neste modo quando o usuario usar `--guiado`/`--passo-a-passo`, ou
  disser coisas como "me ensine", "passo a passo", "sou iniciante", "nunca usei
  isso". Na duvida sobre o nivel do usuario, **ofereca** o modo guiado antes de
  começar. O roteiro completo esta em `references/guided-mode.md`.

## Passo 0 — Contexto e SEGURANCA (rodar UMA vez, antes do loop)

**Antes de tudo — checagem de seguranca (obrigatoria):**
- Rode `git status` para partir de uma arvore limpa e saber o que muda.
- A classe de producao `<Classe>.cls` e **somente leitura** para esta skill. Voce
  nao faz backup "para poder mexer" — voce simplesmente **nao mexe**. Se, no fim,
  algo tivesse mesmo que mudar na producao (so o hook de DML), isso e proposto ao
  humano, nunca aplicado direto. Nunca a delete, mova, renomeie, sobrescreva nem
  crie "stub" no lugar dela (releia a secao 🚫 NUNCA FACA).

1. **Localizar a classe**: busque `**/classes/<Classe>.cls` dentro de `force-app`
   (ou do(s) `packageDirectories` do `sfdx-project.json`). Se houver mais de uma,
   confirme com o usuario. Leia a classe **inteira** — a versao REAL do repositorio,
   nunca uma versao recriada/modificada.
2. **Mapear o que precisa ser coberto**: metodos, ramos (`if/else`, ternario,
   `switch`), loops, `try/catch`, DML (insert/update/delete/upsert), SOQL/SOSL,
   chamadas a outras classes, `@AuraEnabled`/`@InvocableMethod`/web services,
   `with/without/inherited sharing`, e excecoes custom lancadas.
   **Detecte tratamento especial ANTES de escrever**: se a classe tem callout
   (`Http`, WSDL) ou assincrono (`@future`, Queueable, Batchable, Schedulable,
   Platform Events), leia `references/callouts-and-async.md` primeiro — sem
   `Test.setMock`/padroes de async o teste falha e o loop desperdica iteracoes.
3. **Detectar utilitarios de dados**: procure `TestDataFactory`, `TestFactory`,
   `*TestData*`. Se existir, **use-o** para criar registros (evita quebrar em
   validation rules / campos obrigatorios). Se nao existir e a org tiver muitas
   regras, considere criar um helper minimo em vez de repetir setup em cada teste.
4. **Descobrir a org alvo**: `sf config get target-org` (ou pergunte o alias).
   Confirme que ha org autenticada: `sf org display`. Se o `sf` nao estiver
   instalado/autenticado, pare e oriente o usuario.
5. **Dependencias: repo vs org.** A classe de producao ja costuma estar **na org**
   (com suas dependencias: objetos custom, Custom Metadata, outras classes). O loop
   deploya **somente a classe de teste** (`--test-only`) — nao reenvia a producao.
   Se a classe referencia metadados que nao estao no repo local, tudo bem: eles ja
   estao na org. So traga algo com `sf project retrieve start` se realmente faltar
   na org (nunca recrie do nada).
6. **Baseline (se o teste ja existe)**: quando `<Classe>Test.cls` ja existir,
   leia-a e rode o script UMA vez **sem alterar nada** para medir a cobertura
   atual. Dai **melhore a classe existente** — preserve os testes bons, complete
   os cenarios que faltam. Nao reescreva do zero sem motivo.

> Nota sobre **Triggers**: para cobrir uma trigger, o gatilho e fazer DML no
> objeto dentro do teste (insert/update/delete de registros). O fluxo do loop e
> o mesmo — a cobertura da trigger aparece no JSON junto com a das classes
> (campo `otherClassesTouched` do script).

## O loop (repetir os passos 1→4)

1. **Escrever/atualizar** `force-app/**/classes/<Classe>Test.cls` **e** o
   `<Classe>Test.cls-meta.xml` (veja `references/templates/`). Cubra os cenarios
   mapeados no passo 0 — cada caminho relevante vira um metodo `@IsTest` com
   **assert significativo** (veja as Regras de Ouro abaixo).

2. **Deploy do TESTE + rodar cobertura** usando o script auxiliar (determinístico).
   Use **`--test-only`**: envia somente a classe de teste, porque a classe de
   producao ja esta na org e **nao deve ser reenviada nem sobrescrita**:

   ```bash
   node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
     --class <Classe> --test <Classe>Test --test-only [--org <alias>] \
     [--extra ApexClass:TestDataFactory]
   ```

   Ele deploya so o teste (+ extras), roda de forma sincrona e imprime um JSON
   compacto: `coveredPercent`, `uncoveredLines`, `failures`. Use `--deploy` (produção
   + teste) **somente** se a classe de producao for nova/alterada legitimamente —
   o que, nesta skill, quase nunca acontece. Se o script nao rodar no ambiente do
   usuario, use os comandos `sf` crus de `references/sf-cli-and-coverage.md`.

3. **Ler o resultado**:
   - `phase: "deploy"` + `blockedByDependency: true` → a falha e da **classe de
     producao ou de uma dependencia** (metadado/objeto/classe faltando ou que nao
     compila), **nao do teste**. Siga o `hint`: **NAO recrie, apague, sobrescreva
     nem stube a producao**. Reporte como "classe bloqueada" e ofereca ao usuario:
     (a) rodar so o teste se a producao ja estiver na org; (b) trazer a dependencia
     com `sf project retrieve start`; (c) apontar a org correta. **Pare o loop** ate
     o humano decidir.
   - `phase: "deploy"` + falha na **classe de teste** → erro de compilação do teste.
     Corrija o TESTE conforme `deployErrors[].problem`/`line` e volte ao passo 2.
   - `failures` nao vazio → algum assert/dado falhou. Leia `message`/`stackTrace`,
     corrija **o teste** e volte ao passo 2. **Nunca** remova o assert só para passar.
   - Passou → observe `coveredPercent` e `uncoveredLines`.

4. **Decidir**:
   - Se `coveredPercent >= 99` (meta) **e** todo metodo tem assert real → **concluir**
     (vá para o Encerramento).
   - Senão → abra a classe de producao **exatamente nas `uncoveredLines`**, entenda
     QUAL cenario falta (um ramo `else`? um `catch`? um item de `switch`? um loop que
     nunca roda vazio/cheio?), adicione **um metodo de teste especifico** para aquele
     caminho (com assert) e volte ao passo 2. Para `catch`/DML difícil, veja
     `references/testing-dml-and-exceptions.md`; para callout/assincrono que nao
     cobre, veja `references/callouts-and-async.md`.

## ⛔ Regras de Ouro (inegociaveis — anti-cheat)

Estas regras existem porque cobertura sem verificacao e apenas "execucao de codigo",
nao teste. Voce **NAO PODE**:

1. **Alterar a classe de producao para inflar cobertura.** Proibido mexer em
   formatacao, quebras de linha, indentacao, chaves ou comentarios do `.cls` de
   producao com o objetivo de reduzir linhas contadas. A unica edicao permitida em
   producao e um hook de testabilidade legítimo — e só nas condições da regra de
   DML (veja o arquivo de DML), sempre **sinalizado para revisao humana**, nunca
   silencioso.
2. **Entregar teste sem assert.** Todo metodo `@IsTest` deve validar comportamento
   com a classe `Assert` (`Assert.areEqual`, `Assert.isTrue`, `Assert.isNotNull`,
   `Assert.fail`...). Asserts triviais tipo `Assert.areEqual(1, 1)` sao invalidos.
   Valide: mudancas no banco (re-consulte via SOQL), retornos de metodo, e a
   **mensagem exata** dentro de blocos `catch`.
3. **Usar atalhos proibidos.** Sem `@IsTest(SeeAllData=true)` (salvo dependencia
   inevitavel de metadados), sem IDs hardcoded, sem depender de dados da org.
4. **Fingir cobertura impossivel.** Se restarem linhas comprovadamente inalcançaveis,
   **documente-as** no relatorio final em vez de forçar um caminho artificial.

Boas praticas obrigatorias: `@TestSetup` para dados compartilhados;
`Test.startTest()`/`Test.stopTest()` ao redor do codigo sob teste; `System.runAs`
para cenarios de permissao; e **teste em massa (200 registros)** para triggers,
handlers e `@InvocableMethod` (garante que nao ha SOQL/DML dentro de loop).
Checklist completo em `references/quality-checklist.md`.

## Condicao de parada e encerramento

- **Parada de seguranca**: se apos **6 iteracoes** a cobertura nao evoluir, ou
  houver erro crônico de deploy/compilação, PARE e gere um relatorio com: a(s)
  linha(s) que travaram, o motivo (validation rule, trigger externa, dependencia
  de dado, limite de plataforma) e uma recomendacao para o desenvolvedor humano.
- **Encerramento com sucesso**: apresente um resumo curto — cobertura final,
  metodos de teste criados e o cenario que cada um valida (happy path, negativos,
  excecoes, bulk). Se algum hook de testabilidade foi adicionado a producao,
  **destaque isso em separado** para revisao.

## Fase de retrospectiva (autoaprendizado da skill)

Sempre no **fim de cada run** (sucesso OU parada segura), reflita: *o que nesta
skill me atrapalhou e poderia ser melhorado?* O objetivo e a skill evoluir com a
experiencia real — nao encher de ruido.

**So registre proposta quando houve FRICCAO REAL**, por exemplo: o guard bloqueou
uma acao legitima; o deploy travou por dependencia; foram precisas muitas iteracoes
sem evoluir; precisou de decisao humana por ambiguidade; uma referencia
(`references/*.md`) nao cobria o caso; um comando/flag do `sf` estava incorreto;
um padrao de teste (callout/async/DML) faltou. **Em run limpo, nao registre nada.**

Para cada friccao (no maximo ~3 por run):
1. Abra `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` e **verifique se ja existe**
   item sobre o mesmo ponto (aberto ou aplicado). Se existir, **nao duplique** — no
   maximo adicione uma nota curta.
2. Senao, **anexe** (abaixo do marcador no fim do arquivo) uma nova entrada com o
   proximo `R-XXXX`, status `🟡 Proposta`, seguindo o schema do arquivo: gatilho real,
   problema e melhoria proposta **acionavel** (qual arquivo/regra/passo mudaria).
3. **Transporte** (a skill roda no projeto do usuario, nao no repo-casa):
   - O arquivo local ja fica atualizado — informe o caminho ao usuario.
   - Se o ambiente tiver acesso ao repositorio-casa no GitHub, voce **pode** abrir/
     atualizar uma Issue com as propostas (nao obrigatorio).
   - Diga ao usuario: *"registrei N recomendacao(oes); quando quiser, peca para eu
     ler as recomendacoes e ajustar a skill"*.

> Escrever neste `.md` e permitido (o guard so bloqueia escrita em `.cls`/`.trigger`
> de producao). **Nunca** transforme uma "melhoria" em desculpa para afrouxar as
> Regras de Ouro ou as travas de seguranca.

Quando o usuario pedir para **processar** as recomendacoes: para cada `Proposta`,
decida `🟢 Aprovada` / `⚪ Reprovada` (com motivo) / `✅ Aplicada`; aplique as
aprovadas na skill; e atualize o status no `RECOMMENDATIONS.md` com o PR/commit.

## Modo guiado (passo a passo para leigos)

Quando ativado, siga o roteiro de `references/guided-mode.md`. Em resumo:

- **Uma etapa por vez, em portugues simples.** Explique o QUE e o PORQUE de cada
  passo, mostre o comando que vai rodar e traduza o resultado (sem jargao de JSON).
- **Pausas obrigatorias para confirmacao** antes de: (a) o **primeiro deploy**
  (envia codigo para a org do usuario) e (b) **qualquer edicao na classe de
  producao**. Explique o risco e espere um "ok".
- **Ensine os conceitos** ao longo do caminho (classe de teste, cobertura, deploy,
  assert, cenario happy/negativo) — use o glossario do roteiro.
- **Mostre o progresso** a cada volta do loop (ex.: `72% -> 88% -> 99%`).
- **As Regras de Ouro continuam valendo.** O modo guiado muda so a forma de
  conversar; a exigencia de asserts reais e o anti-cheat permanecem inegociaveis.

## Referencias (leia conforme a necessidade)

- `references/guided-mode.md` — roteiro completo do modo guiado (o que dizer e
  perguntar em cada etapa, pontos de pausa e glossario para leigos).
- `references/sf-cli-and-coverage.md` — comandos `sf` crus, flags corretas, formato
  do JSON de cobertura, deploy em scratch org vs sandbox, e detecção de org.
- `references/testing-dml-and-exceptions.md` — como cobrir `catch`/`DmlException`
  na ordem certa (dado real → Stub API/DI → hook `@TestVisible` como ultimo recurso).
- `references/callouts-and-async.md` — `Test.setMock` para callouts HTTP/SOAP,
  padroes de `@future`/Queueable/Batch/Schedulable/Platform Events, e a pegadinha
  da `AuraHandledException`.
- `references/quality-checklist.md` — matriz de cenarios, exigencias de assert,
  nomenclatura e anti-patterns a evitar.
- `references/templates/` — esqueleto de classe de teste e do `.cls-meta.xml`.
- `RECOMMENDATIONS.md` — livro-razao de melhorias da propria skill (a fase de
  retrospectiva anexa propostas aqui; o humano aprova/reprova/aplica).
