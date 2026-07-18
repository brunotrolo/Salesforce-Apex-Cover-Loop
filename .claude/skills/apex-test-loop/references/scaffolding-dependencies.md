# Scaffolding de dependencias faltantes (modo dev/treino)

Quando a classe de producao referencia dependencias que **nao existem no ambiente**
(objeto `__c`, Custom Metadata `__mdt`, outra classe Apex), o deploy falha com
`blockedByDependency: true`. Ha dois caminhos — escolha conforme o cenario.

## Primeiro: qual e o cenario?

- **Voce TEM a org onde a classe ja roda** (produção/sandbox/scratch com o schema):
  **nao crie nada**. Aponte para essa org e rode so o teste (`--test-only`), ou
  traga o que falta com `sf project retrieve start`. Este e o caminho correto em
  uso real. **Nao scaffolde por cima de dependencias reais.**
- **Voce esta CRIANDO/TREINANDO a skill, sem a org completa** (baixou so a classe):
  ai sim, o modo **scaffold** cria o MINIMO das dependencias faltantes para a
  classe compilar e o teste rodar. E opt-in: so faca quando o usuario sinalizar
  (disse que esta em dev/treino, passou `--scaffold`, ou confirmou a "Opcao B").

## Regra de ouro do scaffold

- **A CLASSE SOB TESTE continua intocavel.** Scaffold cria **arquivos NOVOS** de
  dependencia — nunca edita/recria a classe sob teste (o guard bloqueia sobrescrever
  arquivo existente; criar arquivo novo e liberado).
- **Minimo necessario**: so os membros/campos que a classe realmente referencia.
- **Marque como scaffold** (comentario no topo) e **reporte tudo** que criou, para o
  usuario saber o que e sintetico.
- Nunca substitua uma dependencia REAL existente por stub (o guard tambem impede).

## Como criar cada tipo (o ponto que trava as pessoas)

`__c` e `__mdt` **NAO sao Apex** — nao da para stubar como classe. Sao **metadata**.

### 1) Classe/interface Apex faltante -> stub `.cls` novo
`force-app/main/default/classes/MetadataDAO.cls`:
```apex
// SCAFFOLD gerado por apex-test-loop (dependencia ausente no ambiente de dev).
// Minimo para compilar; substitua pela classe real ao usar a org verdadeira.
public with sharing class MetadataDAO {
    public static Object getValue(String key) { return null; }
}
```
+ o `MetadataDAO.cls-meta.xml` (use o template). Espelhe apenas as assinaturas que
a classe sob teste chama.

### 2) Objeto customizado `__c` faltante -> metadata de objeto + campos
`force-app/main/default/objects/Card__c/Card__c.object-meta.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Card</label>
    <pluralLabel>Cards</pluralLabel>
    <nameField><label>Card Name</label><type>Text</type></nameField>
    <deploymentStatus>Deployed</deploymentStatus>
    <sharingModel>ReadWrite</sharingModel>
</CustomObject>
```
Cada campo custom usado pela classe (ex.: `Amount__c`) em
`force-app/main/default/objects/Card__c/fields/Amount__c.field-meta.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Amount__c</fullName>
    <label>Amount</label>
    <type>Number</type>
    <precision>18</precision>
    <scale>2</scale>
</CustomField>
```

### 3) Custom Metadata Type `__mdt` faltante -> tipo + registro
O tipo em `force-app/main/default/objects/CardBlock__mdt/CardBlock__mdt.object-meta.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Card Block</label>
    <pluralLabel>Card Blocks</pluralLabel>
    <visibility>Public</visibility>
</CustomObject>
```
Campos do MDT como no item 2 (dentro de `.../CardBlock__mdt/fields/`). Se a classe
le registros via `getInstance`/SOQL, crie um registro em
`force-app/main/default/customMetadata/CardBlock.Default.md-meta.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" label="Default">
    <values><field>Codigo__c</field><value xsi:type="xsd:string"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">X</value></values>
</CustomMetadata>
```

### 4) Objetos/campos padrao (Account, Contact...) -> ja existem
Nao scaffolde; use direto.

## Deploy no modo scaffold

Como objeto/MDT/classe/teste sao novos na org de dev, faca **um deploy inicial do
conjunto** (nao so o teste). Numa scratch org com source tracking:
```bash
sf project deploy start --source-dir force-app --test-level NoTestRun --target-org <alias>
```
Depois disso, o loop volta ao normal com `--test-only` (tudo ja esta na org) e voce
itera a cobertura. Uma **scratch org descartavel** e o lugar ideal para isso.

## Ao terminar

Liste no resumo final tudo que foi scaffoldado (classes stub, objetos, campos, MDT),
deixando claro que e **sintetico para dev** e que, na org real, essas dependencias
ja existem — entao o teste deve ser validado contra a org verdadeira antes de
confiar 100% na cobertura.
