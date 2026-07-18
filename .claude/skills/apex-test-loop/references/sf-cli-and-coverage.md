# Salesforce CLI (`sf`) — comandos e leitura de cobertura

Referencia para o loop. O script `scripts/apex-coverage.mjs` automatiza tudo isto;
use os comandos crus quando o script nao puder rodar ou para depurar.

## Pre-requisitos

- Salesforce CLI **v2** (`sf`, nao o legado `sfdx`). Verifique: `sf --version`.
- Uma org autenticada e definida como alvo. Verifique:
  - `sf org display` — mostra a org atual.
  - `sf config get target-org` — mostra o alias padrao.
  - Autenticar, se preciso: `sf org login web --alias minhaOrg`.

## 1) Deploy da classe + teste (obrigatorio antes de rodar)

`sf apex run test` roda o que **ja esta na org**. Entao, a cada iteracao, envie a
classe de producao e a classe de teste (e utilitarios como `TestDataFactory`):

```bash
sf project deploy start \
  --metadata ApexClass:MinhaClasse ApexClass:MinhaClasseTest \
  --json --target-org minhaOrg
```

- Em **scratch org / org com source tracking**, `sf project deploy start` (sem
  `--metadata`) envia tudo que mudou localmente — tambem funciona.
- Erros de **compilacao** aparecem aqui (em `result.files[].error` ou
  `result.details.componentFailures[].problem`). Trate-os antes de rodar o teste.

## 2) Rodar UMA classe de teste com cobertura

```bash
sf apex run test \
  --class-names MinhaClasseTest \
  --code-coverage \
  --detailed-coverage \
  --result-format json \
  --synchronous \
  --wait 10 \
  --target-org minhaOrg
```

Flags que importam:

- `--code-coverage` — **essencial**; sem ela nao vem cobertura.
- `--detailed-coverage` — cobertura por metodo de teste (opcional, ajuda a depurar).
- `--synchronous` — roda ja e retorna o resultado; so vale para **uma** classe.
- `--result-format json` — imprime JSON no stdout (facil de parsear).
- `--class-names` — nome da classe de teste. Para um metodo especifico use
  `--tests MinhaClasseTest.testCatchDml`.

> Observacao: a cobertura reportada aqui e a atribuivel a ESTA classe de teste.
> Isso e exatamente o sinal que o loop precisa (fazer o teste dedicado cobrir a
> classe). A cobertura "org-wide" e outra metrica (minimo 75% para deploy em prod).

## 3) Formato do JSON de cobertura

Campos relevantes de `result`:

```jsonc
{
  "result": {
    "summary": {
      "outcome": "Passed",
      "testsRan": 3,
      "passing": 3,
      "failing": 0,
      "testRunCoverage": "92%"
    },
    "tests": [
      { "ApexClass": { "Name": "MinhaClasseTest" },
        "MethodName": "testHappyPath", "Outcome": "Pass",
        "Message": null, "StackTrace": null }
    ],
    "coverage": {
      "coverage": [
        {
          "name": "MinhaClasse",
          "totalLines": 40,
          "totalCovered": 30,
          "coveredPercent": 75,
          "lines": { "3": 1, "4": 1, "7": 0, "8": 0 }
        }
      ]
    }
  }
}
```

Como ler:

- Ache em `result.coverage.coverage[]` o item cujo `name` == a classe de producao.
- `coveredPercent` = a porcentagem atual.
- `lines` mapeia `numeroDaLinha -> 1 (coberta) | 0 (nao coberta)`.
  As **linhas nao cobertas** sao as chaves com valor `0` — abra a classe de
  producao nessas linhas para descobrir qual cenario ainda falta.
- Falhas de teste: itens de `result.tests[]` com `Outcome != "Pass"` trazem
  `Message` e `StackTrace`.

## Erros comuns

- **"No test classes found"** → a classe de teste nao foi deployada (rode o passo 1).
- **Cobertura 0% mesmo passando** → faltou `--code-coverage`, ou o `name` no JSON
  nao bate com a classe de producao (confira o nome exato).
- **`--synchronous` reclama de multiplas classes** → rode uma classe de teste por vez.
- **Deploy falha em campos/objetos custom** → o metadado dependente nao esta na org;
  garanta que a org (scratch/sandbox) tem o mesmo schema do projeto.
