/**
 * Esqueleto de classe de teste Apex — adapte ao gerar <Classe>Test.cls.
 * Troque "Example" pelo nome real da classe de producao e remova o que nao usar.
 */
@IsTest
private class ExampleTest {

    // Dados compartilhados criados uma unica vez. Prefira o TestDataFactory do
    // projeto, se existir (ex.: TestDataFactory.createAccounts(5)).
    @TestSetup
    static void setup() {
        Account a = new Account(Name = 'Conta Teste');
        insert a;
    }

    // Happy path: dados validos -> sucesso, com verificacao do efeito.
    @IsTest
    static void deveExecutarComSucessoQuandoDadosValidos() {
        Account a = [SELECT Id, Name FROM Account LIMIT 1];

        Test.startTest();
        Example.processar(a.Id);
        Test.stopTest();

        Account atualizada = [SELECT Id, Name FROM Account WHERE Id = :a.Id];
        Assert.areEqual('Valor Esperado', atualizada.Name, 'Name deveria ter sido atualizado');
    }

    // Caminho negativo: entrada invalida -> excecao esperada e mensagem correta.
    @IsTest
    static void deveLancarErroQuandoIdNulo() {
        Test.startTest();
        try {
            Example.processar(null);
            Assert.fail('Deveria ter lancado excecao para Id nulo');
        } catch (IllegalArgumentException e) {
            Assert.areEqual('Id obrigatorio', e.getMessage(), 'mensagem de erro incorreta');
        }
        Test.stopTest();
    }

    // Bulk: 200 registros -> sem SOQL/DML em loop, respeitando governor limits.
    @IsTest
    static void deveProcessarEmMassa() {
        List<Account> contas = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            contas.add(new Account(Name = 'Bulk ' + i));
        }
        insert contas;

        Test.startTest();
        Example.processarEmMassa(contas);
        Test.stopTest();

        Integer processadas = [SELECT COUNT() FROM Account WHERE Name LIKE 'Bulk %'];
        Assert.areEqual(200, processadas, 'todas as contas deveriam ter sido processadas');
    }
}
