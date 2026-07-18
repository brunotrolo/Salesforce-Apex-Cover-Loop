# Callouts e codigo assincrono — os dois maiores bloqueadores do loop

Se a classe de producao faz **callout** (HTTP/SOAP) ou roda **assincrono**
(`@future`, Queueable, Batch, Schedulable), o teste FALHA ou nao cobre nada se
voce nao aplicar os padroes abaixo. Detecte isso no Passo 0 e ja escreva o
primeiro teste do jeito certo — evita iteracoes desperdicadas.

## 1) Callouts HTTP — `Test.setMock` e obrigatorio

Teste nao pode fazer callout real: a plataforma lanca
`System.CalloutException: Methods defined as TestMethod do not support Web
service callouts`. Todo caminho que passa por `Http.send()` exige um mock:

```apex
@IsTest
global class MinhaClasseCalloutMock implements HttpCalloutMock {
    global HTTPResponse respond(HTTPRequest req) {
        HttpResponse res = new HttpResponse();
        res.setHeader('Content-Type', 'application/json');
        res.setBody('{"status":"ok","id":"123"}');
        res.setStatusCode(200);
        return res;
    }
}
```

No teste, registre o mock ANTES do codigo que faz o callout:

```apex
@IsTest
static void deveProcessarRespostaDoServico() {
    Test.setMock(HttpCalloutMock.class, new MinhaClasseCalloutMock());
    Test.startTest();
    String resultado = MinhaClasse.chamarServico();
    Test.stopTest();
    Assert.areEqual('123', resultado, 'deveria extrair o id da resposta');
}
```

Padroes que o loop vai precisar:

- **Cenario de erro (4xx/5xx)**: um segundo mock (ou o mesmo com flag) devolvendo
  `setStatusCode(500)` — cobre o ramo `if (res.getStatusCode() != 200)`.
- **Excecao de rede**: o `respond()` pode lancar
  (`throw new CalloutException('timeout simulado')`) para cobrir o
  `catch (CalloutException e)`.
- **Varios endpoints na mesma transacao**: um unico mock que decide pela URL
  (`if (req.getEndpoint().contains('/pedidos')) {...}`).
- **Resposta grande/fixa**: `StaticResourceCalloutMock` com o JSON num Static
  Resource.
- **SOAP** (classes geradas por WSDL): use `WebServiceMock` +
  `Test.setMock(WebServiceMock.class, ...)` em vez de `HttpCalloutMock`.

## 2) Assincrono — `Test.startTest()/stopTest()` forca a execucao

Codigo enfileirado entre `startTest()` e `stopTest()` **executa de forma sincrona
no `stopTest()`**. Os asserts vem SEMPRE depois do `stopTest()`.

### `@future`
```apex
Test.startTest();
MinhaClasse.metodoFuture(contaIds);   // enfileira
Test.stopTest();                       // executa aqui
// agora consulte o banco e faca os asserts
```

### Queueable
```apex
Test.startTest();
System.enqueueJob(new MeuQueueable(dados));
Test.stopTest();
```
⚠️ **Chaining e proibido em teste**: se o `execute()` do Queueable enfileira o
proximo job (`System.enqueueJob` dentro do `execute`), o teste estoura. A classe
de producao deve proteger o elo da corrente:
```apex
if (!Test.isRunningTest()) {
    System.enqueueJob(new ProximoJob());
}
```
(Esse e um ajuste legitimo de producao — sinalize para revisao, como no caso do
hook de DML.)

### Batch (`Database.Batchable`)
Em teste, o batch roda **uma unica chamada de `execute()`** — crie **menos de 200
registros** para caber tudo em um chunk:
```apex
Test.startTest();
Database.executeBatch(new MeuBatch(), 200);
Test.stopTest();
// asserts sobre o efeito do batch no banco
```
Cubra `start`, `execute` e `finish` — o `finish` so e coberto se o batch rodar
ate o fim dentro do start/stop.

### Schedulable
```apex
String CRON = '0 0 3 * * ?';
Test.startTest();
String jobId = System.schedule('TesteAgendado', CRON, new MeuSchedulable());
Test.stopTest();  // o execute() do agendamento roda aqui

CronTrigger ct = [SELECT CronExpression, TimesTriggered FROM CronTrigger WHERE Id = :jobId];
Assert.areEqual(CRON, ct.CronExpression, 'expressao cron incorreta');
```

### Platform Events
Publicou evento no teste? Force a entrega antes dos asserts:
```apex
Test.getEventBus().deliver();
```

## 3) Pegadinha: `AuraHandledException` esconde a mensagem

Em metodos `@AuraEnabled`, `throw new AuraHandledException('msg')` faz
`e.getMessage()` devolver **"Script-thrown exception"** no teste — o assert de
mensagem falha e o loop fica confuso. Duas saidas:

1. Se a producao usa o padrao `setMessage` (ideal), o assert de mensagem funciona:
   ```apex
   AuraHandledException e = new AuraHandledException(msg);
   e.setMessage(msg);
   throw e;
   ```
2. Se a producao so passa a mensagem no construtor, **asserte o tipo** da excecao
   (e nao a mensagem) — nao "conserte" a producao so por causa do teste, a menos
   que o time aprove o padrao acima.

## Checklist rapido de deteccao (Passo 0)

| Achou na classe...                          | Entao o teste precisa de...                    |
| ------------------------------------------- | ---------------------------------------------- |
| `Http`, `HttpRequest`, `Http.send`          | `Test.setMock(HttpCalloutMock...)` + cenario de erro |
| Stub de WSDL / `WebServiceCallout.invoke`   | `Test.setMock(WebServiceMock...)`              |
| `@future`                                   | start/stop + asserts depois do stop            |
| `implements Queueable`                      | `enqueueJob` em start/stop; checar chaining    |
| `implements Database.Batchable`             | < 200 registros; cobrir start/execute/finish   |
| `implements Schedulable`                    | `System.schedule` + assert em `CronTrigger`    |
| `EventBus.publish`                          | `Test.getEventBus().deliver()`                 |
| `AuraHandledException`                      | assert por tipo (ou padrao setMessage)         |
