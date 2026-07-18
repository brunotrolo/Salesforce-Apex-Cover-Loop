# Cobrindo `catch` / `DmlException` — na ordem certa

Testar blocos `catch` de DML e notoriamente dificil no Apex: a plataforma tenta
impedir o dado invalido antes do seu codigo rodar. Siga esta ordem — do menos
invasivo (nao toca em producao) ao mais invasivo (ultimo recurso).

## Nivel 1 — Forcar uma falha REAL com dado invalido (preferido)

Isto testa o comportamento de verdade. Escolha o gatilho conforme o codigo:

- **Campo obrigatorio faltando** — `insert new Account();` (sem `Name`) lanca
  `DmlException`. Use quando o codigo faz `insert`/`update` que lanca (all-or-none).
- **Violacao de validation rule** — insira um registro que quebre uma regra de
  negocio conhecida da org.
- **Duplicidade / unique / external id** — insira dois registros com o mesmo valor
  de um campo unico.
- **Permissao insuficiente** — rode dentro de `System.runAs(usuarioSemAcesso)` para
  provocar erro de FLS/CRUD.
- **FK invalida / registro pai apagado** — aponte um lookup para um Id inexistente.

```apex
@IsTest
static void deveTratarErroDeDmlAoInserirContaInvalida() {
  Test.startTest();
  Boolean caiuNoCatch = false;
  try {
    MinhaClasse.criarConta(null); // caminho que faz insert de Account sem Name
  } catch (Exception e) {
    caiuNoCatch = true;
  }
  Test.stopTest();
  // Se a classe TRATA o erro internamente, nao verifique a excecao aqui:
  // consulte o estado/registro de log que a classe gravou e valide com Assert.
  Assert.isTrue(caiuNoCatch || true, 'ajuste conforme a classe propaga ou trata');
}
```

> Atencao: `insert registro` (all-or-none) **lanca**; ja `Database.insert(lista,
> false)` **nao lanca** — retorna `SaveResult[]` com `isSuccess() == false`. Se o
> codigo usa a forma parcial, o `catch` de `DmlException` nunca dispara: nesse caso,
> teste o ramo que percorre `sr.getErrors()` em vez de esperar excecao.

## Nivel 2 — Mock via Stub API ou injecao de dependencia

Quando a classe delega a operacao a uma dependencia injetavel, troque-a por um
mock que lanca — sem sujar producao.

- **Stub API nativa** (`System.StubProvider` + `Test.createStub(Tipo.class, mock)`):
  crie um provider cujo `handleMethodCall` lanca `new DmlException('...')` no metodo
  que faz o DML.
- **Injecao de dependencia** (ex.: uma interface `IDml` ou o Unit of Work do
  fflib): passe uma implementacao de teste que lanca. E a arquitetura mais limpa a
  longo prazo, mas exige que a classe ja aceite a dependencia.

Prefira este nivel ao Nivel 3 sempre que a classe permitir injecao.

## Nivel 3 — Hook `@TestVisible` na classe de producao (ULTIMO recurso)

So use se os niveis 1 e 2 forem inviaveis, e apos ~2 iteracoes sem sucesso. Muitos
times **proibem** logica de teste em codigo de producao — por isso:

- **Confirme com o humano** antes de commitar (ou deixe claramente sinalizado no
  relatorio final para revisao). Nao faca silenciosamente.
- Mantenha o hook **inerte em producao**, guardado por `Test.isRunningTest()`:

```apex
public with sharing class MinhaClasse {
  @TestVisible private static Boolean forceDmlException = false;

  public static void salvar(Registro r) {
    try {
      if (Test.isRunningTest() && forceDmlException) {
        throw new DmlException('Falha de DML simulada para cobertura de teste.');
      }
      insert r;
    } catch (DmlException e) {
      // ... tratamento real que queremos cobrir ...
    }
  }
}
```

No teste:

```apex
@IsTest
static void deveCobrirCatchDeDmlComHook() {
  MinhaClasse.forceDmlException = true;
  Test.startTest();
  MinhaClasse.salvar(new Registro());
  Test.stopTest();
  // valide o efeito do tratamento (log gravado, flag, mensagem), com Assert real.
  Assert.isTrue(/* estado esperado apos o catch */ true, 'catch deve ter tratado o erro');
}
```

## Regra de decisao rapida

1. Da pra quebrar com dado invalido / runAs? → **Nivel 1**.
2. A classe aceita dependencia injetavel? → **Nivel 2** (Stub API / DI).
3. Nenhum dos dois, e o time autoriza? → **Nivel 3**, guardado e sinalizado.
4. Nada disso e possivel? → **nao force**: documente a linha como nao coberta no
   relatorio final e explique o porque.
