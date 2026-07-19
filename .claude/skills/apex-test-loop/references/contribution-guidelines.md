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
- ❌ Duplicação — verifique `docs/apex-test-loop-recommendations.md` primeiro

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

## Como Contribuir (Workflow)

1. **Encontre o próximo ID livre** em `docs/apex-test-loop-recommendations.md`
   (exemplo: se P-0010 existe, use P-0011)

2. **Escreva a recomendação** no formato acima (agnóstico, sem nome de classe)

3. **Commit direto no GitHub:**
   ```bash
   git add docs/apex-test-loop-recommendations.md
   git commit -m "docs: padrão P-XXXX — <titulo>" \
     --author="User <user@example.com>"
   git push origin <branch>
   ```

4. **Notifique o usuário:**
   > "Registrei 1 padrão (P-XXXX — <Titulo>) em docs/ baseado neste run. 
   > Serve como referência para próximas classes."

## Exemplos Reais

- **P-0001** (FeatureManagement): teste não pode ativar feature flags de org
- **P-0002** (Callouts): mock inteligente que distingue token-endpoint de API
- **P-0003** (Duplicação): extrair lógica comum em método privado
- **P-0009** (Meta realista): classes com Flow bloqueado têm teto de 85-90%

---

**Todas as P-XXXX vivem em:** `docs/apex-test-loop-recommendations.md` (versionado no git)

**Histórico da skill (R-0001 a R-0027):** `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` (local)
