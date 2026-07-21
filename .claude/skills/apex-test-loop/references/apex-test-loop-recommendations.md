# Recomendações e Lições Aprendidas — apex-test-loop

Registro vivo de melhorias para a **skill** e padrões descobertos em execuções reais. Agnóstico a classe específica — servem como guideline para todos os runs futuros.

---

## Seção 1: Recomendações para a Skill (R-0001 em diante)

Veja `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` (detalhado). Resumo:

| ID | Status | Tema | Aplicação |
|----|--------|------|-----------|
| R-0001 a R-0007 | ✅ | Segurança (guard, permissions, deploy test-only) | Travas do SKILL.md |
| R-0008 a R-0010 | ✅ | Permissões e portabilidade | settings.json |
| R-0011 | ✅ | Bulk 251+, assert valor exato | Regras de Ouro |
| R-0012 | ✅ | State file por classe | run-state.md |
| R-0013 | 🟡 | Plugin do Claude Code | Futuro |
| R-0014 | ✅ | bypassPermissions mode | settings.json |
| R-0015 a R-0021 | ✅ | Runtime blockers, fan-out, checkpoint | SKILL.md, parallel-methods.md |
| R-0022 a R-0027 | ✅ | MVP deployable default, circuit-breaker, autonomia, benchmark | SKILL.md, runtime-blockers.md |
| R-0028 | ✅ | Caminho neutro do state (Claude Code × OpenCode) | run-state.md, SKILL.md |
| R-0029 | ✅ | Centralizar padrões agnósticos + split de ledgers | references/, SKILL.md, contribution-guidelines.md |
| R-0030 | ✅ | Endurecer guard (find/mv/rm-dir) + falso-positivo por texto assumido | guard.mjs, SKILL.md |
| R-0031 | ✅ | Inventario do Passo 0 portavel (grep quebra no Windows) | SKILL.md (orientacao) |
| R-0032 | ✅ | Iteracao rapida com `--tests` ao depurar (c/ ressalva de cobertura) | SKILL.md, sf-cli-and-coverage.md |
| R-0033 | ✅ | Fallback de comandos `sf` crus (flags alucinadas corrigidas) | sf-cli-and-coverage.md |
| R-0034 | ✅ | Bulk DML em trigger pesada estoura CPU → split c/ startTest proprio | runtime-blockers.md, SKILL.md |
| R-0035 | ✅ | Varredura por outros bulks grandes ao achar CPU limit (grep corrigido) | SKILL.md, runtime-blockers.md |
| R-0036 | ✅ | Portao de estabilidade: `slowTests` sinaliza CPU-fragil antes de concluir | apex-coverage.mjs, SKILL.md, runtime-blockers.md |

---

## Seção 2: Padrões de Teste (Lições de Campo)

Descobertos em execuções reais. **Aplicam-se a qualquer classe.**

### P-0001 — Linhas Inalcançáveis por Feature Flags / Permissões

**Padrão:** Chamadas a `FeatureManagement.checkPermission()`, `Organization.getOrgType()` ou permissões de org retornam valores fixos em teste e não podem ser sobrescritos.

**Estratégia:**
1. **Aceitar como limitação:** Excluir da meta de cobertura via code review.
2. **Refatorar (altera produção):** Injetar dependência via `@TestVisible` wrapper.
   ```apex
   @TestVisible
   private static Boolean isFeatureEnabled() {
       return FeatureManagement.checkPermission('FEATURE_X');
   }
   ```
3. **Documentar:** Registrar no state file (`state/<Classe>.md`) com motivo — "FeatureManagement, inalcançável em teste".

**Recomendação:** Estratégia 1 (aceitar). Não refatore produção para cobrir teste.

---

### P-0002 — Mock de Múltiplos Callouts (Token + API Sequencial)

**Padrão:** Classes que fazem HTTP callouts sequenciais — ex.: obter token, depois invocar API com token.

**Estratégia:**
Criar mock inteligente que distingue token-endpoint de API-endpoint:

```apex
public class TokenAwareCalloutMock implements HttpCalloutMock {
    private List<HttpResponse> responses = new List<HttpResponse>();
    
    public HttpResponse respond(HttpRequest req) {
        String url = req.getEndpoint();
        if (url.contains('access-token') || url.contains('oauth')) {
            return buildTokenResponse();
        }
        HttpResponse res = responses.remove(0);
        return res;
    }
}
```

**Benefício:** Uma classe mock reutilizável para **qualquer web service** que herde de auth → API.

**Recomendação:** Adicionar ao TestDataFactory ou utilitário compartilhado do projeto (não em cada test class).

---

### P-0003 — Duplicação de Lógica de Transformação de Dados

**Padrão:** Mesma transformação (map→aggregate, list→tree, parse→group) aparece em 3+ métodos da produção, exigindo 3+ testes separados.

**Estratégia:**
1. **Antes de testar:** Grep a classe por duplos (nomes de variáveis, padrões de loop).
2. **Extrair método privado reutilizável:**
   ```apex
   private static void processTransaction(Map<String, TransactionGroup> mapCards, 
                                          Transaction tx, List<Transaction> results) {
       // lógica comum
   }
   ```
3. **UM único teste cobrindo a função.**

**Benefício:** Reduz testes de 3× para 1×, reduz risco de regressão, mais fácil manter.

**Recomendação:** Inventário mecanico do Passo 0 (R-0020) deve rodar grep de padrões duplicados antes de mapear cenários.

---

### P-0004 — Mock Responses Longos em JSON Inline

**Padrão:** Respostas de API mockadas como strings JSON gigantes (50+ linhas) direto no test.

**Problema:** Difícil ler, manter, reutilizar.

**Estratégia:**
1. **Builders de teste:**
   ```apex
   public class ApiResponseBuilder {
       public static String buildSuccessResponse(Map<String, Object> overrides) {
           // constrói JSON dinamicamente
       }
   }
   ```
2. **StaticResource (se o arquivo é grande):**
   ```apex
   String mockJson = [SELECT Body FROM StaticResource WHERE Name='MockApiResponse'].Body.toString();
   ```
3. **Métodos auxiliares nomeados:**
   ```apex
   private static String buildResponseJson(List<Map<String, Object>> items) { ... }
   ```

**Recomendação:** Usar builders em `.../classes/` compartilhadas; StaticResource só se >200 linhas.

---

### P-0005 — Unificar Mocks Similares

**Padrão:** Vários mocks com propósitos similares (SequentialHttpCalloutMock, TokenAwareCalloutMock, etc.) fragmentam o código.

**Estratégia:**
Criar UM mock flexível com bandeiras:
```apex
public class FlexibleHttpCalloutMock implements HttpCalloutMock {
    private Map<String, HttpResponse> byEndpoint = new Map<String, HttpResponse>();
    private List<HttpResponse> sequential = new List<HttpResponse>();
    
    public HttpResponse respond(HttpRequest req) {
        if (byEndpoint.containsKey(req.getEndpoint())) {
            return byEndpoint.get(req.getEndpoint());
        }
        return sequential.remove(0);
    }
}
```

**Recomendação:** Consolidar em UMA classe mock reutilizável no projeto.

---

### P-0006 — Naming de Testes Descritivo

**Padrão:** Nomes genéricos (`testMethod1`, `testValid`) não dizem qual branch está coberto.

**Estratégia:**
```apex
// ❌ Ruim
private static void testProcessRecords() { ... }

// ✅ Bom
private static void testProcessRecords_SuccessWithMultipleItems() { ... }
private static void testProcessRecords_EmptyInputList() { ... }
private static void testProcessRecords_CalloutTimeoutRecovery() { ... }
```

**Padrão:** `test<MethodName>_<Scenario>` onde `<Scenario>` = branch/edge case/error.

**Recomendação:** Aplicar sistematicamente — nome do teste = documentação da cobertura.

---

### P-0007 — Deploy com Conflitos de Source Tracking

**Padrão:** Projeto com source tracking (scratch org, dev org) tem metadados deployados por outros usuários ou fora do CLI; deploy falha sem flag.

**Estratégia:**
```bash
sf project deploy start --ignore-conflicts --test-level RunSpecifiedTests
```

**Automação (package.json):**
```json
{
  "scripts": {
    "test:deploy": "sf project deploy start --ignore-conflicts --test-level RunSpecifiedTests --wait 30"
  }
}
```

**Recomendação:** Documentar no README do projeto; adicionar ao script da skill se aplicável.

---

### P-0008 — Ruído de Flow Coverage no Output

**Padrão:** Output de deploy inclui dezenas de flows/processes não relacionados (0% coverage).

**Estratégia:**
Filtrar saída do script `apex-coverage.mjs` para mostrar apenas:
- Classe alvo
- Dependências diretas (classes invocadas)

Exemplo:
```json
{
  "coverage": {
    "coverage": [
      { "name": "TargetClass", ... },
      { "name": "DirectDependency1", ... }
    ]
  },
  "filtered_out": ["Case_Treatment (Flow)", "EmailManager (Flow)", ...]
}
```

**Recomendação:** Adicionar flag `--focus-class <ClassName>` ao script.

---

### P-0009 — Linhas Tipicamente Inalcançáveis por Tipo de Classe

> ⚠️ **A meta NÃO muda — é piso fixo ≥99% (Trava #6).** Este padrão mapeia QUAIS
> linhas costumam ser inalcançáveis por tipo de classe, para você **documentá-las uma
> a uma** como exceções — **nunca** para abaixar o número da meta. Se muitas linhas são
> bloqueadas e 99% fica inatingível no ambiente, a saída é apontar a org certa ou
> PARAR e o dono decidir (não escrever 85/90/95).

**Padrão:** o *tipo* da classe prevê ONDE moram as linhas dependentes de ambiente:

| Tipo | Onde costumam estar as linhas inalcançáveis | Exemplo |
|------|---------------------------------------------|---------|
| Sem Feature Flags / Permissions | quase nenhuma — 99% é normal | Controllers, helpers, parsers |
| Com FeatureManagement (1-5 linhas) | ramos atrás de `FeatureManagement.checkPermission` | Linhas bem localizadas |
| Com Flows bloqueando DML | caminhos pós-`insert`/`update` que o Flow barra | Campos validados por automação |
| Com Callouts não-mockáveis | timeouts/auth externa | Network timeouts, auth externa |

**Recomendação:** no Passo 0, antecipe ao usuário quais ramos podem ser inalcançáveis
neste ambiente; ao esbarrar neles, documente cada linha (linha + motivo) na seção
"Bloqueios / decisões do humano" do state file. A meta segue **99**.

---

### P-0010 — State File Como Fonte de Verdade

**Padrão:** Sem checkpoint, cada retomada gera do zero; com checkpoint duplicado, divergências obrigam remedir.

**Estratégia:**
- ✅ Caminho NEUTRO de ferramenta: `<projeto>/.apex-test-loop/state/<Classe>.md`
  (raiz do projeto, **fora** de `.claude`/`.opencode`) — ferramentas diferentes
  (Claude Code, OpenCode) leem/escrevem o MESMO estado, sem silos.
- ✅ UM arquivo canonico por classe (não -Copia, -v2, etc)
- ✅ Histórico de iterações DENTRO do arquivo
- ✅ Passo 0 verifica; se houver múltiplos ou estado antigo sob `.claude`/`.opencode`,
  move para o caminho neutro e segue de um só
- ✅ Passo 4 atualiza no fim de cada iteração (cobertura, linhas descobertas, decisões)

**Recomendação:** Automatizar check no Passo 0 (R-0022 implementado; caminho neutro
padronizado em `references/run-state.md`).

---

### P-0011 — Bulk DML em Trigger Pesada: Fragilidade de CPU Intermitente

**Padrão:** Um teste faz DML (`insert`/`update`) de vários registros num único
`Test.startTest()/stopTest()`, e cada registro dispara uma trigger que gasta muita CPU
por registro (`getDescribe`/`getRecordTypeInfos`, dezenas/centenas de `if` em cascata).
A soma estoura o limite de ~10s de CPU. O sintoma traiçoeiro: **depende da carga da
org** — o mesmo teste passa numa org vazia e estoura numa cheia, então a mesma suite
falha um número diferente de testes em máquinas diferentes.

**Estratégia:**
1. **Split, não redução.** Divida o método em grupos de poucos registros (comece por
   ~3-4), **cada grupo com seu próprio `Test.startTest()/stopTest()`** — cada
   `startTest` reseta o contador de CPU, dando orçamento fresco. Todos os cenários
   distintos continuam cobertos, só redistribuídos. Nunca remova o cenário (ver A-0002).
2. **Dimensione bem abaixo do teto.** "3-4" é ponto de partida; se um registro já custa
   CPU alta na trigger, use menos. Se a trigger tem `getDescribe`/muitos `if`, faça o
   split **preventivo**, sem esperar a falha.
3. **Detecte os frágeis que ainda passam.** Um método perto do teto é deploy-blocker
   latente. O `apex-coverage.mjs` sinaliza em `slowTests` (tempo por método >= `slowMs`);
   divida-os antes de concluir (portão de estabilidade, SKILL.md passo 4).
4. **Varra os vizinhos.** Ao achar um, procure outros lotes grandes na mesma classe
   (List com ~5+ registros em DML dentro de `startTest`) e aplique o mesmo split.

**Recomendação:** Uma trigger que gasta CPU alta por registro também é candidata a
**achado de produção** (escala mal em bulk real: describes não cacheados, `if` que
deveria ser `Map`) — reporte no encerramento, sem tocar na produção.

---

## Seção 3: Anti-Padrões (O Que Nunca Fazer)

Aprendidos de execuções reais — aplicáveis a qualquer classe.

### A-0001 — Try/Catch de Fachada Engolindo Erros de Produção

**Problema:** Teste falha porque produção lança exceção; ao invés de investigar, envolver em try/catch "para passar".

```apex
// ❌ Armadilha
try {
    controller.setEntitlement();
} catch (Exception e) {
    // silenciosamente falha
}
```

**Impacto:** Teste passa, mas produção quebra silenciosamente em produção.

**Solução:** Criar o dado necessário (Entitlements, Queues, custom settings) ou registrar no checkpoint como "limitação de ambiente".

---

### A-0002 — Remover Cenário Obrigatório porque Falhou

**Problema:** Teste bulk (251 registros) estourando CPU governor limit; ao invés de dividir/diagnosticar, remove o cenário "para passar".

**Impacto:** Classe fica sem cobertura de cenário real (bulk); regressão em produção invisível.

**Solução:** Cenários obrigatórios (bulk 251+, DML, async) são Travas — **nunca remover**. Diagnosticar com logs/apex anônimo; se for produção, reportar achado.

---

### A-0003 — Testes em Memória Silenciosos para Contornar Flow Bloqueado

**Problema:** Flow bloqueia DML; ao invés de satisfazê-lo, test fica "em memória" (sem insert) — pass, mas sem testar persistência.

**Impacto:** Cobertura de linha sim, cobertura de cenário não.

**Solução:** Ordem de ataque: satisfazer Flow (dados corretos) → runAs (permissões) → dado real (entity records) → ÚLTIMO: em memória (só lógica pura). Documentar a limitação no checkpoint.

---

### A-0004 — Hardcoded IDs ou SeeAllData=true para "Passar Rápido"

**Problema:** Teste usa ID fixo da sua org ou `@SeeAllData=true` para não ter que criar dado.

**Impacto:** Teste falha em sandbox/scratch org de qualquer outra pessoa; quebra MVP deployable.

**Solução:** Trava — **nunca fazer**. Usar TestDataFactory ou @TestSetup.

---

### A-0005 — Assert Removido Porque Diverge Entre Ambientes

**Problema:** Assert espera `totalAmount = 100.00`, mas em sandbox vem `100.0` (precisão); ao invés de investigar, remove o assert "para passar".

**Impacto:** Teste não verifica nada.

**Solução:** MVP permite guardas de config (`if (amount != null)`); `--rigoroso` proibe. Investigar por quê a precisão difere (config, custom setting, versão).

---

## Seção 4: Como Contribuir (Instruções pro Agente) — LOCAL, sem push

Quando rodar a skill `apex-test-loop` em uma classe:

1. **Se fricção REAL (bloqueio, decisão difícil, achado):** Adicione uma recomendação P-XXXX agnóstica a este arquivo.
2. **Formato mínimo:**
   ```markdown
   ### P-XXXX — <Titulo Genérico>
   
   **Padrão:** <o que apareceu em campo, não específico da classe>
   **Estratégia:** <solução genérica>
   **Recomendação:** <quando e como aplicar>
   ```
3. **Salve local e AVISE — NÃO faça `git push`.** 🚫 Nunca rode `git add/commit/push`
   de recomendações: esta é uma **cópia** da skill no projeto do dev, sem acesso de
   escrita ao repo-casa. Se 10 devs empurrassem, um sobrescreveria o outro. Só edite o
   `.md` e avise o usuário que o arquivo é **local** e deve ser enviado ao mantenedor
   quando ele abrir a coleta (ver `contribution-guidelines.md` → "papel do mantenedor").

4. **Nunca mencione classe específica** — escreva como se ensinando um padrão genérico.

---

## Referência Rápida

| Quando | Arquivo | Por quê |
|--------|---------|---------|
| Contribuir padrão agnóstico | `.claude/skills/apex-test-loop/references/apex-test-loop-recommendations.md` | **Local** no projeto do dev; curadoria central pelo mantenedor |
| Recomendação de skill | `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` | **Local**; histórico da evolução da skill |
| Estado de UM run | `.apex-test-loop/state/<Classe>.md` | Rastreabilidade da iteração |
| Guia de uso | `.claude/skills/apex-test-loop/SKILL.md` | Instruções executáveis |

---

**Atualizado em:** 2026-07-21  
**Versão:** 1.4 (36 recomendações da skill + 11 padrões de campo + 5 anti-padrões)
