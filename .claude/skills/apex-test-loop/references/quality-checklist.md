# Checklist de qualidade — testes que protegem, nao so cobrem

Use como criterio de aceite de cada classe de teste gerada. Cobertura alta com
testes fracos e uma falsa sensacao de seguranca.

## Matriz de cenarios (cubra o que se aplica a classe)

- **Happy path** — dados validos completos; o processo termina com sucesso e o
  efeito esperado e verificado (registro criado/atualizado com os campos certos).
- **Caminhos negativos** — entradas invalidas, campos faltando, listas vazias,
  `null`, valores de borda; o sistema reage como projetado (erro tratado, excecao
  esperada, mensagem correta).
- **Ramos condicionais** — cada `if/else`, ternario e item de `switch` exercitado
  por ao menos um teste. As `uncoveredLines` do JSON apontam quais faltam.
- **Excecoes** — cada `catch` coberto por um cenario que realmente dispara o erro
  (veja `testing-dml-and-exceptions.md`), validando a mensagem/tratamento.
- **Bulk (200 registros)** — obrigatorio para triggers, handlers e
  `@InvocableMethod`; garante ausencia de SOQL/DML dentro de loop e respeito a
  governor limits.
- **Permissoes** — `System.runAs` para perfis/usuarios diferentes quando o codigo
  depende de sharing/CRUD/FLS.
- **Assincrono** — `Test.startTest()/stopTest()` envolvendo `@future`, Queueable,
  Batch ou Schedulable para forcar a execucao dentro do teste.

## Asserts — obrigatorios e significativos

- Todo metodo `@IsTest` tem ao menos um `Assert.*` que verifica **comportamento**.
- Prefira a classe moderna `Assert` (`Assert.areEqual(esperado, real, msg)`,
  `Assert.isTrue`, `Assert.isNotNull`, `Assert.fail`) a `System.assert*`.
- Sempre inclua a **mensagem** no assert (facilita diagnostico).
- Valide o **efeito colateral**, nao so o retorno: re-consulte via SOQL o registro
  afetado e confira os campos; verifique contagem de registros; verifique a
  mensagem exata da excecao com `Assert.isTrue(e.getMessage().contains('...'))`.
- Padrao de excecao esperada:

```apex
try {
  MinhaClasse.metodoQueDeveFalhar(entradaRuim);
  Assert.fail('Deveria ter lancado excecao');
} catch (MinhaExcecaoCustom e) {
  Assert.areEqual('Mensagem esperada', e.getMessage(), 'mensagem de erro incorreta');
}
```

## Estrutura e estilo

- `@IsTest` na classe e em cada metodo; classe de teste separada `<Classe>Test`.
- `@TestSetup` para criar dados compartilhados uma vez.
- Use o `TestDataFactory` do projeto, se existir; nao repita setup complexo.
- Nomes descritivos: `deveCriarContaQuandoDadosValidos`,
  `deveLancarErroQuandoCampoObrigatorioFaltando`.
- Um cenario por metodo — testes pequenos e focados.
- Nao deixe `System.debug` no lugar de assert.

## Anti-patterns proibidos

- Metodo de teste sem assert (so executa codigo).
- `@IsTest(SeeAllData=true)` sem necessidade real de metadados.
- IDs hardcoded (`'001...'`) ou dependencia de dados preexistentes na org.
- Editar a classe de producao (formatacao/linhas) para inflar a porcentagem.
- Deletar/enfraquecer asserts so para o teste passar.
- Loop de teste que apenas repete o happy path para "empurrar" a cobertura sem
  cobrir ramos novos.

## Definicao de pronto

- [ ] `coveredPercent >= 99` (ou a meta combinada) reportado pelo `sf`.
- [ ] Todos os testes passam (`failures` vazio).
- [ ] Cada metodo tem assert significativo.
- [ ] Cenarios happy + negativo + excecao (+ bulk quando aplicavel) presentes.
- [ ] Nenhuma edicao em producao alem de hook de testabilidade sinalizado.
- [ ] Linhas restantes (se houver) documentadas como inalcancaveis e justificadas.
