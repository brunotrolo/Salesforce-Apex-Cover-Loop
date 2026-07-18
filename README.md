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
- **`catch`/DML tratado na ordem certa.** Primeiro forcar falha real com dado
  invalido / `System.runAs`; depois Stub API / injecao de dependencia; e so como
  ultimo recurso um hook `@TestVisible` na classe de producao — sempre sinalizado
  para revisao humana, nunca commitado silenciosamente.

## Pre-requisitos (na maquina onde o loop roda)

- [Salesforce CLI v2](https://developer.salesforce.com/tools/salesforcecli) (`sf`),
  autenticado numa org (scratch org ou sandbox): `sf org login web --alias minhaOrg`.
- Node 18+ (para o script auxiliar).
- Um projeto SFDX com a estrutura `force-app/**/classes/`.

## Instalacao

A skill vive em `.claude/skills/apex-test-loop/`. Duas formas de usar:

1. **Por projeto** — copie a pasta `.claude/skills/apex-test-loop` para dentro do
   seu projeto Salesforce:
   ```bash
   cp -R .claude/skills/apex-test-loop /caminho/do/seu-projeto-sfdx/.claude/skills/
   ```
2. **Global (todos os projetos)** — copie para o seu diretorio de skills do usuario:
   ```bash
   cp -R .claude/skills/apex-test-loop ~/.claude/skills/
   ```

Abra o Claude Code no projeto Salesforce e a skill fica disponivel.

## Uso

No Claude Code, dentro do projeto Salesforce:

```
/apex-test-loop AccountService
```

ou em linguagem natural: **"crie a classe de teste para AccountService"** /
**"aumente a cobertura da classe AccountService"**. O agente localiza a classe,
escreve/melhora `AccountServiceTest`, faz deploy, roda os testes e itera ate a meta.

Para mudar a org alvo ou incluir utilitarios no deploy, o agente usa o script:

```bash
node .claude/skills/apex-test-loop/scripts/apex-coverage.mjs \
  --class AccountService --test AccountServiceTest --deploy \
  --org minhaOrg --extra ApexClass:TestDataFactory
```

## Estrutura

```
.claude/skills/apex-test-loop/
  SKILL.md                          # o loop, as regras de ouro e a condicao de parada
  scripts/
    apex-coverage.mjs               # deploy + run test + parse -> JSON com linhas nao cobertas
  references/
    sf-cli-and-coverage.md          # comandos sf, flags e formato do JSON de cobertura
    testing-dml-and-exceptions.md   # como cobrir catch/DML na ordem certa
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
