# Modo guiado — as 9 etapas, com mensagens (PT)

Roteiro detalhado do GUIA INICIAL obrigatorio do `SKILL.md`. Nunca pule para a escrita:
toda execucao passa por estas etapas. As mensagens abaixo sao sugestoes — adapte o tom,
mas mantenha os CHECKPOINTS (as pausas que pedem confirmacao do usuario).

---

## Etapa 1 — Mostrar o estado atual

Leia `.lwc-pattern-documenter/lwc-design-system/journeys-index.json`. Se existir e tiver
jornadas, liste-as. Se nao existir, avise que sera criado.

> "Estado atual do design system documentado:
> - **Sidebar Dados Cadastrais** (9 componentes, ultimo scan 2026-07-21)
> - **Consorcio** (18 componentes, ultimo scan 2026-07-21)
>
> Vamos documentar uma jornada nova ou atualizar uma dessas?"

## Etapa 2 — Jornada nova ou atualizacao?

Receba o nome. Compare com o index (regra 4). Se parecer com uma existente, confirme:

> "Ja existe **'Atendimento ao Cliente'**. Voce quer ATUALIZAR essa, ou e uma jornada
> diferente ('Atendimento B2B', por ex.)? Nao quero fragmentar o documento por variacao
> de nome."

## Etapa 3 — Modo de selecao (regra 1)

Sempre pergunte — nunca assuma:

> "Voce ja tem os caminhos/nomes dos LWCs dessa jornada, ou quer que eu liste os
> componentes do projeto pra voce escolher de um menu?"

Se listar, use:
```bash
node .claude/skills/lwc-pattern-documenter/scripts/pattern-extractor.mjs \
  --list force-app/main/default/lwc
```

## Etapa 4 — Confirmar a lista final

Antes de extrair, mostre a lista e peca o "ok":

> "Vou extrair os padroes destes N componentes: <lista>. Confirma?"

## Etapa 5 — Rodar o extrator e checar o minimo (regra 2)

```bash
node .claude/skills/lwc-pattern-documenter/scripts/pattern-extractor.mjs \
  --components compA,compB,compC --journey "Nome" > extract.json
```

Se `aggregate.minComponentsMet` for `false` (menos de 3): **PARE**, nao escreva nada.

> "Encontrei so 2 componentes validos. Preciso de no minimo 3 pra provar convencao (2 e
> coincidencia). Pode apontar mais exemplos dessa jornada?"

## Etapa 6 — Interpretar os sinais

Use `references/extraction-signals.md`. Traduza o JSON em convencoes legiveis. Registre
TUDO em tres camadas: (a) padroes compartilhados, (b) elementos especificos de 1
componente (`componentSpecifics`), (c) convencoes parciais (`partialConventions`). Nao
resuma a ponto de perder itens.

## Etapa 7 — Tratar divergencia (regra 3)

Para cada item em `aggregate.divergences`: documente as variantes, marque "inconsistente",
nunca decida. A decisao e do usuario.

## Etapa 8 — Preview + aprovacao

Mostre o Markdown EXATO da secao ANTES de salvar:

> "Este e o Markdown exato que vou gravar na secao de '<Jornada>'. Confere? Quer ajustar
> algo antes de eu salvar?"

So prossiga com o "ok" explicito.

## Etapa 9 — Escrever/atualizar (DETERMINISTICO — nao faca a mao)

> ⚠️ **NUNCA reescreva os arquivos de saida a mao.** Isso corrompe o documento (risco de
> apagar jornadas ja gravadas — bug real observado). **Use SEMPRE o writer deterministico**,
> que faz o merge por voce: jornada nova → ANEXA sem tocar nas existentes; jornada
> existente → substitui SO aquela secao, preservando as demais e a ordem.

1. Salve a secao Markdown aprovada na etapa 8 num arquivo temporario (ex.: `section.md`).
2. Rode o writer:
```bash
node .claude/skills/lwc-pattern-documenter/scripts/pattern-writer.mjs \
  --journey "Nome da Jornada" \
  --components compA,compB,compC \
  --section section.md
```
3. O writer:
   - **`design-patterns.md`**: se a jornada ja existe, substitui apenas a secao
     `## Padrao: <Nome>` dela; se e nova, anexa no fim. Preserva o cabecalho e todas as
     outras jornadas intactas.
   - **`journeys-index.json`**: faz upsert de `{ journey, components, lastScan }` — nova
     jornada adiciona; existente atualiza componentes + data. Nunca zera o array.
4. Confirme ao usuario quantas jornadas o documento tem agora (deve ser >= antes).

**Por que deterministico:** o merge nunca pode depender de o modelo lembrar de preservar o
resto do arquivo. O script garante que documentar a jornada N nao apaga as jornadas 1..N-1.
