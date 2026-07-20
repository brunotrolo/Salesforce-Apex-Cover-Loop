# Salesforce Apex Cover Loop

Arquitetura **hibrida** para o Claude Code criar **classes de teste Apex** no **minimo viavel deployavel**: meta padrao `>= 99%` de cobertura com **todos os testes passando** (o que Salesforce exige para deploy). Quer verificacao exaustiva? Use `--rigoroso`.

```
escrever teste  →  deploy (sf)  →  rodar + cobertura  →  ler linhas nao cobertas
      ↑                                                             ↓
      +--- melhorar o cenario que falta, em loop até a meta --------+
```

**Como funciona:**
- **Craft** (mocks, asserts, bulk, DML, dados de teste) → skills oficiais Salesforce importadas neste projeto.
- **Orquestracao** (loop inteligente, travas de seguranca, guiado em PT, scaffold) → nossa `apex-test-loop`.

Voce informa uma classe → o Claude entra num ciclo fechado ate atingir a meta com testes passando. Se travar, ele diagnostica e explica.

---

## ⚡ Comeco rapido

### 1. Pre-requisitos

- [Salesforce CLI v2](https://developer.salesforce.com/tools/salesforcecli) (`sf`), autenticado: `sf org login web --alias minhaOrg`
- Node 18+
- Projeto SFDX com `force-app/*/classes/`

### 2. Instale — UM comando

Rode **de dentro da pasta do seu projeto** (onde esta `force-app`):

**Windows (PowerShell):**
```powershell
git clone --depth 1 https://github.com/brunotrolo/Salesforce-Apex-Cover-Loop.git .skill-tmp; New-Item -ItemType Directory -Force .claude | Out-Null; Copy-Item -Recurse -Force .skill-tmp\.claude\* .claude\; Remove-Item -Recurse -Force .skill-tmp
```

**Mac / Linux / Git Bash:**
```bash
git clone --depth 1 https://github.com/brunotrolo/Salesforce-Apex-Cover-Loop.git .skill-tmp && mkdir -p .claude && cp -r .skill-tmp/.claude/. .claude/ && rm -rf .skill-tmp
```

> **Para atualizar:** rode o mesmo comando de novo. Para mais detalhes (alternativas, contribuir melhorias), veja [INFORMACOES-COMPLEMENTARES.md](./INFORMACOES-COMPLEMENTARES.md).

### 3. Abra o Claude Code

```bash
claude
```

A skill carrega automaticamente.

### 4. Use

```
/apex-test-loop AccountService
```

ou naturalmente:
> "crie teste para AccountService"
> "aumente cobertura da AccountService"

O loop cicla até atingir >= 99% de cobertura com testes passando.

**Primeira vez?** Use `--guiado`:
```
/apex-test-loop AccountService --guiado
```

Ele ensina passo a passo e pede sua confirmacao.

---

## 🔒 Seguranca

A skill **nunca mexe na classe de producao** — bloqueio em 3 camadas (instrucoes, regras deny, hook). Apagar/sobrescrever producao é impossivel mesmo em modo bypass. Detalhes em [INFORMACOES-COMPLEMENTARES.md](./INFORMACOES-COMPLEMENTARES.md).

---

## 📖 Documentacao Completa

Para tudo o mais (travas de seguranca, modo bypass, estrutura, memoria de estado, autoaprendizado, contribuir de volta, troubleshooting), veja:

**→ [INFORMACOES-COMPLEMENTARES.md](./INFORMACOES-COMPLEMENTARES.md)**

Inclui:
- Skills oficiais importadas
- Pre-requisitos detalhados
- Instalacao (metodos alternativos, global vs por projeto)
- Rodar na Web (claude.ai/code)
- Travas de seguranca (3 camadas, testes)
- Estrutura de arquivos
- Memoria de estado (checkpoints)
- Autoaprendizado (recomendacoes R-XXXX)
- Contribuir de volta (clone vs copia)
- Observacoes (100%, DML, Flow, dependencias, plateau)
