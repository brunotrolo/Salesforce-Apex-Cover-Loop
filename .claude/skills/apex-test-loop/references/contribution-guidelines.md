# Guia de Contribuição — Recomendações e Padrões

Quando rodar esta skill (`apex-test-loop`) em uma classe, se encontrar fricção real (bloqueio, decisão ambígua, achado), compartilhe a lição como padrão agnóstico.

## Quando contribuir

Registre uma recomendação (P-XXXX) se:
- ✅ Encontrou padrão duplicado em múltiplas classes
- ✅ Resolveu um bloqueio (Feature Flags, mocks, Flow, config)
- ✅ Descobriu uma meta realista que difere de 99%
- ✅ Achou um anti-padrão perigoso

**Não** registre:
- ❌ Problema específico de UMA classe (é achado de produção, não padrão)
- ❌ Decisão já coberta pelo SKILL.md
- ❌ Duplicação — verifique `references/apex-test-loop-recommendations.md` primeiro

## Formato mínimo

```markdown
### P-XXXX — Título Genérico (não mencione a classe)

**Padrão:** [O que apareceu em campo, generalizado]

**Estratégia:** [Solução aplicável a qualquer classe]

**Recomendação:** [Quando e como aplicar]
```

## Exemplo

```markdown
### P-0011 — Assertions Instáveis Divergindo Entre Ambientes

**Padrão:** Asserção espera valor exato (ex: `amount = 100.00`), mas sandbox 
retorna versão diferente (`100.0`, precisão float). Teste passa local, falha 
em outra org.

**Estratégia:**
- MVP: usar guarda de config `if (result != null)` em vez de valor exato
- `--rigoroso`: investigar divergência (setting customizado, versão SF, precisão config)

**Recomendação:** MVP permite guardas; `--rigoroso` proíbe. Documentar no 
checkpoint qual ambiente causa divergência.
```

## Como Contribuir (Workflow) — LOCAL, sem `git push`

> 🚫 **A skill NUNCA faz `git add/commit/push` de recomendações.** Cada dev roda uma
> **cópia** do `.claude/` dentro do próprio projeto — não é um clone do repo-casa, e
> ninguém tem acesso de escrita a ele. Se 10 pessoas empurrassem pra `main`, uma
> sobrescreveria a recomendação da outra. Por isso **tudo fica LOCAL no disco do dev**;
> a consolidação no repo é **central e manual**, feita pelo mantenedor.

1. **Encontre o próximo ID livre** em `references/apex-test-loop-recommendations.md`
   (P-XXXX) — se `P-0010` existe, use `P-0011`.

2. **Escreva a recomendação** no formato acima (agnóstico, sem nome de classe) e
   **salve o arquivo** (é só editar o `.md` — permitido). **NÃO** rode `git add`,
   `git commit` nem `git push`.

3. **Notifique o usuário deixando claro que é LOCAL:**
   > "Registrei 1 padrão (P-XXXX — <Titulo>) no arquivo **local**
   > `references/apex-test-loop-recommendations.md`, dentro do seu projeto. Ele fica
   > aqui no seu disco — quando o mantenedor abrir a coleta, é só enviar este arquivo."

## Como as melhorias chegam ao repo-casa (papel do mantenedor)

A consolidação NÃO é feita pelo agente durante o run. Periodicamente, **o dono do
repo** (não o dev):

1. **Coleta** os arquivos locais (`RECOMMENDATIONS.md` e/ou
   `apex-test-loop-recommendations.md`) de cada dev que rodou a skill.
2. **Lê e faz a curadoria**: junta itens equivalentes, descarta ruído e duplicata, e
   acrescenta ao repo **apenas o que é relevante e sem sobreposição**.
3. **Commita centralmente** — só ele tem acesso de escrita, então entra num único
   lugar, sem conflito de push entre devs.
4. Os devs **puxam a versão curada** rodando o comando de instalação de novo.

Assim, N devs geram aprendizado **em paralelo**, sem push, sem acesso ao repo e sem
pisar no trabalho um do outro. A junção é um passo humano, central.

## Exemplos Reais

- **P-0001** (FeatureManagement): teste não pode ativar feature flags de org
- **P-0002** (Callouts): mock inteligente que distingue token-endpoint de API
- **P-0003** (Duplicação): extrair lógica comum em método privado
- **P-0009** (Meta realista): classes com Flow bloqueado têm teto de 85-90%

---

**Todas as P-XXXX vivem em:** `references/apex-test-loop-recommendations.md` — **local** na
cópia do seu projeto; os itens no repo-casa foram curados pelo mantenedor.

**Histórico da skill (R-0001 em diante):** `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` (local)
