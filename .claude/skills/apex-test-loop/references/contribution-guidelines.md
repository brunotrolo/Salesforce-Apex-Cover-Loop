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

## Como Contribuir (Workflow)

0. **PREFLIGHT — confirme que dá para commitar (evita perder a contribuição):**
   ```bash
   git rev-parse --is-inside-work-tree 2>/dev/null && git remote -v
   ```
   - **Deu `true` + mostrou um `origin`** → é um clone com remote; siga para o passo 1.
   - **Deu `fatal: not a git repository`** → esta pasta foi BAIXADA (zip), não clonada:
     não tem `.git`, então NENHUM commit/push funciona. **Pare e avise o usuário**
     com a receita de correção abaixo — NÃO tente `git init` numa pasta baixada (cria
     um repo órfão que não empurra pra main). A recomendação foi salva em disco, mas
     **só entra no GitHub depois que a pasta virar um clone.**

1. **Encontre o próximo ID livre** em `references/apex-test-loop-recommendations.md`
   (exemplo: se P-0010 existe, use P-0011)

2. **Escreva a recomendação** no formato acima (agnóstico, sem nome de classe)

3. **Commit direto no GitHub (main):**
   ```bash
   git add .claude/skills/apex-test-loop/references/apex-test-loop-recommendations.md
   git commit -m "docs: padrão P-XXXX — <titulo>"
   git push origin main   # se falhar por rede, tente de novo; se falhar por auth, veja abaixo
   ```

4. **Notifique o usuário:**
   > "Registrei 1 padrão (P-XXXX — <Titulo>) em references/ baseado neste run. 
   > Serve como referência para próximas classes."

## ⚠️ Se o `git push` falhar (ou "not a git repository") — receita pro leigo

O problema mais comum em campo: a pasta do projeto foi **baixada** (zip/download),
não **clonada**. Pasta baixada não tem `.git` → o agente salva no disco mas **não
consegue enviar pro GitHub** (foi exatamente o que aconteceu num run real).

**Solução definitiva (fazer UMA vez): usar um CLONE, não um download.**

```bash
# 1) Clonar o repo (cria .git + remote + rastreio da main automaticamente):
git clone https://github.com/brunotrolo/Salesforce-LoopAgentApex.git

# 2) Trabalhar SEMPRE dentro dessa pasta clonada (o OpenCode aponta pra ela).
#    A partir daí, git add/commit/push funcionam.
```

**Se o push pedir senha/der erro de autenticação** (o Git precisa provar quem é você):
- **Opção A (mais fácil): GitHub CLI** — instale o `gh` e rode `gh auth login`
  (ele guarda a credencial; o `git push` passa a funcionar sozinho).
- **Opção B: Personal Access Token** — crie um token em github.com → Settings →
  Developer settings → Tokens, e use-o como senha no primeiro push (o Git guarda).

**Enquanto a pasta não for um clone:** as recomendações ficam salvas localmente, mas
não sobem sozinhas. O agente deve DIZER isso ao usuário (não fingir que subiu) e
apontar esta receita — nunca deixar o trabalho "perdido no disco" sem avisar.

## Exemplos Reais

- **P-0001** (FeatureManagement): teste não pode ativar feature flags de org
- **P-0002** (Callouts): mock inteligente que distingue token-endpoint de API
- **P-0003** (Duplicação): extrair lógica comum em método privado
- **P-0009** (Meta realista): classes com Flow bloqueado têm teto de 85-90%

---

**Todas as P-XXXX vivem em:** `references/apex-test-loop-recommendations.md` (versionado no git)

**Histórico da skill (R-0001 em diante):** `.claude/skills/apex-test-loop/RECOMMENDATIONS.md` (local)
