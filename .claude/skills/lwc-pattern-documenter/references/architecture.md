# Arquitetura — as 2 skills de LWC e o porque das regras

Contexto de design da `lwc-pattern-documenter` (Skill 1) e da futura
`lwc-pattern-generator` (Skill 2). Mantido DENTRO da skill para ser portatil: copiar a
pasta `.claude/skills/lwc-pattern-documenter/` leva junto toda a documentacao.

## 1. Duas skills, uma cadeia

```
Skill 1: lwc-pattern-documenter  (ESTA)   → LE componentes, DOCUMENTA padroes por jornada
                                             (risco baixo: so escreve .md/.json)
Skill 2: lwc-pattern-generator   (FUTURA)  → LE o design-patterns.md, GERA componente novo
                                             alinhado, delegando o craft as skills oficiais
```

Skill 1 e o **cerebro** (aprende e registra o design system). Skill 2 e o **corpo** (gera
codigo). Validar o cerebro primeiro — barato e sem risco — antes de arriscar geracao.

## 2. Ownership & Delegation

- **Skill 1 OWNS:** leitura de LWC, extracao de padroes, escrita de
  `.lwc-pattern-documenter/lwc-design-system/{design-patterns.md, journeys-index.json}`.
- **Skill 1 NAO delega craft** — ela nao gera nada.
- **Skill 2 (futura) OWNS:** geracao/edicao de LWC; **delega** o craft de autoria para as
  skills oficiais da Salesforce `experience-lwc-generate` (autoria LWC: wire, Apex/GraphQL,
  a11y, Jest) e `design-systems-slds-apply` (estilo SLDS: blueprints, styling hooks).
- **Fronteira dura:** Skill 1 nunca escreve LWC/Apex/metadata; Skill 2 nunca "conserta"
  um conflito de padrao sozinha — negocia com o usuario.

## 3. As 4 regras de curadoria (secao 4 — o coracao da Skill 1)

Por que cada uma existe:

1. **Selecao hibrida (caminhos OU menu).** O usuario e quem sabe quais LWCs representam a
   jornada; a skill nao adivinha. Sempre pergunta o modo.
2. **Minimo de 3 componentes.** 1-2 componentes provam coincidencia, nao convencao. Abaixo
   de 3, a extracao para — documentar "padrao" de 2 arquivos gera ruido que a Skill 2
   herdaria como se fosse regra.
3. **Divergencia e documentada, nunca decidida.** Se os componentes discordam (token vs
   cor hardcoded), a skill registra as duas variantes e marca "inconsistente". Escolher a
   maioria automaticamente esconderia uma decisao que e do usuario — e a Skill 2 geraria
   com base numa escolha que ninguem tomou conscientemente.
4. **Lista canonica de jornadas.** Antes de criar secao nova, checa o index para nao
   fragmentar o documento por variacao de digitacao ("Atendimento" vs "Atendimento ao
   Cliente"). Confirma com o usuario quando o nome novo parece um ja existente.

## 4. Por que tudo e deterministico (scripts, nao "o modelo lembra")

Duas etapas mecanicas, espelhando a filosofia do `apex-coverage.mjs` do apex-test-loop:

- **`pattern-extractor.mjs`** — extrai os sinais (regex, nao AST). O agente recebe JSON
  estruturado para JULGAR, em vez de arquivos crus para adivinhar.
- **`pattern-writer.mjs`** — faz o MERGE dos dois arquivos de saida. Motivo concreto: um
  modelo fraco reescrevendo o arquivo inteiro ja APAGOU uma jornada ja documentada. O
  writer garante append/replace seguro e aborta se fosse perder alguma jornada. A escrita
  nunca pode depender de o modelo lembrar de preservar o resto.

## 5. Documentar × Gerar (por que a "receita" importa)

Para DOCUMENTAR basta frequencia ("9/9 usam lightning-card"). Para GERAR um componente
perfeito, a Skill 2 precisa da **receita** — o "como montar". Por isso a Skill 1 captura
como sinais de primeira classe: estrutura (`html.skeleton`, `modalSkeleton`), vocabulario
SLDS (`commonSldsClasses`), superficie de utilitarios (`sharedUtils`), forma da chamada
Apex (`apexCallStyle`), loading/erro (`spinnerUsers`, `toast`). Sem isso o documento diz
"o que aparece" mas nao "como reproduzir".

## 6. Coexistencia com apex-test-loop

Instalacao puramente aditiva: sem `settings.json` proprio, escreve so em
`.lwc-pattern-documenter/`, convive com o guard da apex-test-loop (que libera .md/.json e
leitura de LWC). Ver secao "Coexistencia" do `SKILL.md`.
