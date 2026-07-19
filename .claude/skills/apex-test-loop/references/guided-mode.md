# Modo guiado — roteiro passo a passo (para leigos)

Use este roteiro quando o usuario pedir o modo guiado (`--guiado`, `--passo-a-passo`,
"me ensine", "sou iniciante", "nunca usei isso") ou quando parecer iniciante.

## Como conduzir

- **Uma etapa por vez.** Faca UMA coisa, explique, e so avance quando o usuario
  confirmar ("ok", "pode ir", "proximo"). Nao despeje tudo de uma vez.
- **Portugues simples.** Frases curtas. Sem jargao — ou explique o termo na hora
  (veja o Glossario). Uma pergunta por vez.
- **Mostre e traduza.** Sempre mostre o comando que vai rodar e, depois, traduza o
  resultado em linguagem humana (nunca cole JSON cru para o usuario).
- **Pausas obrigatorias** (espere um "ok" antes de continuar):
  1. antes do **primeiro deploy** (voce vai enviar codigo para a org dele);
  2. antes de **qualquer edicao na classe de producao** (explique o risco).
- **Qualidade nao muda.** Todas as Regras de Ouro do `SKILL.md` continuam valendo:
  asserts reais, nada de inflar cobertura. O modo guiado muda so o tom da conversa.

## Roteiro

### Etapa 1 — Boas-vindas e visao geral
**Antes de tudo**: se existir estado salvo da classe (`.claude/apex-test-loop/state/`),
ofereca retomar: *"Encontrei um progresso salvo: cobertura em 88%, faltava cobrir a
linha 45. Quer continuar de onde paramos?"*. Tranquilize tambem que **o progresso
fica salvo** a cada volta ("se a gente parar aqui, eu retomo deste ponto depois").

Explique, em poucas linhas, o que vamos fazer e o ciclo de 4 passos. Exemplo de fala:

> "Vamos criar (ou melhorar) a classe de teste da sua classe **X** para ela cobrir
> quase todo o codigo, testando situacoes de verdade. Funciona em ciclo: **1)** eu
> escrevo os testes, **2)** envio para a sua org, **3)** rodo e meço a cobertura,
> **4)** vejo o que faltou e melhoro — repetindo ate a meta (>= 99%). Vou te
> explicando cada passo. Posso comecar?"

### Etapa 2 — Checar o ambiente (e ensinar por que)
Precisamos de 3 coisas. Cheque uma a uma e diga como resolver se faltar:

1. **Salesforce CLI (`sf`)** — "e o programa que conversa com a sua org pelo
   terminal". Cheque `sf --version`. Se faltar → aponte
   https://developer.salesforce.com/tools/salesforcecli e pare ate instalar.
2. **Uma org conectada** — "org e o seu ambiente Salesforce (sandbox ou scratch)
   onde os testes vao rodar". Cheque `sf org display`. Se nao houver, oriente:
   `sf org login web --alias minhaOrg` ("vai abrir o navegador para voce logar").
   Se houver mais de uma, pergunte qual usar.
3. **A classe existe** — procure o arquivo `.cls` e confirme: "achei sua classe em
   `.../classes/X.cls`, e essa mesmo?".

### Etapa 3 — Explicar a classe e a meta
Leia a classe e explique, simples, o que ela faz e quais **situacoes** precisam de
teste ("o caminho que da certo", "quando falta um dado", "quando da erro"). Ensine:

> "**Cobertura** e a % das linhas do codigo que os testes fazem rodar. A meta e
> **>= 99%** — mas com testes que **conferem o resultado** (isso se chama
> *assert*), nao so 'passar o olho'. Cobertura alta sem conferir nada e falsa
> seguranca."

### Etapa 4 — Escrever o primeiro teste (mostrar e explicar)
Crie a classe de teste com os primeiros cenarios (comece pelo caminho feliz). Mostre
o que criou e explique cada metodo em 1 linha. Ensine de leve:

- `@IsTest` — "marca que isto e codigo de teste, nao vai para producao".
- `@TestSetup` — "cria os dados de exemplo uma vez, para todos os testes".
- `Assert` — "a linha que confere se o resultado saiu como esperado".

### Etapa 5 — PAUSA: pedir permissao para o deploy
Explique e **espere confirmacao**:

> "Agora preciso fazer o **deploy**: enviar a sua classe + o teste para a org
> **minhaOrg**, para poder rodar la. Isso atualiza esses arquivos na org. Posso
> enviar? Vou rodar este comando:"
> ```bash
> node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
>   --class X --test XTest --deploy --org minhaOrg
> ```

### Etapa 6 — Rodar e traduzir o resultado
Rode o script e traduza a saida para o usuario, sem JSON:

- Se falhou ao compilar: "o codigo do teste tem um erro na linha N: <mensagem>. Vou
  corrigir." → corrija e volte a Etapa 6.
- Se um teste falhou: "o teste tal esperava A mas veio B. Vou ajustar." → corrija.
- Se passou: "todos passaram. A cobertura agora esta em **X%**. Ainda faltam as
  linhas **N, M**, que correspondem a <situacao>."

### Etapa 7 — Melhorar o que faltou (ensinar o raciocinio)
Para cada linha nao coberta, explique o cenario que falta e o que vai adicionar:

> "A linha 45 so roda quando <condicao>. Vou criar um teste que provoca essa
> situacao e confere o resultado."

Se cair num `catch`/DML dificil, explique a estrategia em ordem (dado invalido real
→ mock → hook) aplicando o craft da skill **platform-apex-test-generate** (mocking).
**Se for preciso tocar na classe de producao**, isso e trabalho da
**platform-apex-generate** com aprovacao — PAUSE, explique o que muda e o risco, e so
faca com o "ok" do usuario, marcado para revisao.

### Etapa 8 — Repetir mostrando o progresso
A cada volta do loop, mostre a cobertura subindo (`72% -> 88% -> 99%`) e o que ainda
falta. Mantenha curto e comemore o avanco.

### Etapa 9 — Encerramento e aprendizado
Quando bater a meta, recapitule em linguagem simples:

- cobertura final e quantos testes foram criados;
- o que cada teste valida (caminho feliz, erros, exceções, massa);
- 2-3 licoes rapidas ("por que os asserts importam", "por que nunca trapacear a
  cobertura mexendo na classe de producao");
- como rodar sozinho da proxima vez: `/apex-test-loop OutraClasse`.

Se algum hook de testabilidade foi adicionado a producao, **destaque isso a parte**
para o usuario revisar/aprovar com o time.

Por fim, faca a **retrospectiva** (veja a fase no `SKILL.md`): se algo na skill te
atrapalhou neste run, registre em `RECOMMENDATIONS.md` e avise o usuario, em
linguagem simples — ex.: *"anotei 1 sugestao de melhoria da propria skill; quando
quiser, e so me pedir para revisar e aplicar"*. Em run tranquilo, nao anote nada.

## Glossario (use quando o termo aparecer)

- **Org** — seu ambiente Salesforce (sandbox, scratch org, producao).
- **Classe de producao** — o codigo "de verdade" que roda no sistema.
- **Classe de teste** — codigo que existe so para testar a classe de producao.
- **Cobertura** — % de linhas do codigo que os testes fazem executar.
- **Deploy** — enviar o codigo local para a org.
- **Assert** — verificacao de que o resultado saiu como esperado.
- **Caminho feliz / negativo** — cenario em que tudo da certo / em que algo falha.
- **Bulk** — testar com muitos registros (ex.: 200) de uma vez.
- **DML** — operacao de banco no Salesforce (insert/update/delete).
- **Governor limits** — limites da plataforma (ex.: nº de consultas por execucao).
- **Scratch org vs sandbox** — org descartavel de desenvolvimento vs copia de um
  ambiente para testes.
