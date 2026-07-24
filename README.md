<p align="center">
  <img src="assets/banner.svg" width="880" alt="Salesforce Apex Cover Loop">
</p>

<p align="center">
  <em>O agente autônomo que leva sua classe Apex a &#8805;99% de cobertura &#8212; com segurança embutida.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/brunotrolo/Salesforce-Apex-Cover-Loop?style=flat-square&color=00A1E0&label=stars" alt="Stars">
  <img src="https://img.shields.io/badge/coverage-%E2%89%A599%25-04E1CB?style=flat-square" alt="Coverage ≥99%">
  <img src="https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20OpenCode-032D60?style=flat-square" alt="Works with Claude Code and OpenCode">
  <img src="https://img.shields.io/badge/craft-Salesforce%20sf--skills-00A1E0?style=flat-square" alt="Salesforce sf-skills">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <b>📄 README</b> &nbsp;·&nbsp; <a href="./INFORMACOES.md">📖 Informações</a> &nbsp;·&nbsp; <a href="./LICENSE">⚖️ MIT License</a>
</p>

---

Arquitetura **hibrida** para o Claude Code criar **classes de teste Apex** no **minimo viavel deployavel**: meta padrao `>= 99%` de cobertura com **todos os testes passando** (o que Salesforce exige para deploy). Quer verificacao exaustiva? Use `--rigoroso`.

**Loop de contexto único + governança em fonte única:** um único agente conduz o ciclo
inteiro (escrever → deploy → medir → analisar → melhorar) numa só sessão, acumulando
contexto do começo ao fim, ate bater os **dois portões de conclusão**:

```
escrever teste → deploy (sf) → rodar + cobertura → analisar linhas descobertas
      ↑                                                          ↓
      +---------------- melhorar, em loop ------------------------+
                          ↓
     Portão 1 (>=99% via sf apex run test, a cada iteração)
                          ↓
     Portão 2 (confirmação oficial via sf project deploy validate, UMA vez)
                          ↓
                     concluído
```

**Como funciona:**
- **Craft** (mocks, asserts, bulk, DML, dados de teste) → skills oficiais Salesforce importadas neste projeto.
- **Orquestracao** (o loop, travas de seguranca, guiado em PT, scaffold) → nossa `apex-test-loop`, com toda regra de negócio numa fonte única (`references/loop-rules.md`).

Voce informa uma classe → o loop entra num ciclo fechado ate atingir a meta com testes passando **e** a confirmação oficial de deployabilidade (`deploy validate`). Se travar, ele diagnostica e explica.

> **Nota de arquitetura:** uma versão intermediária dividiu o loop em 5 subagentes
> (orquestrador + 4 especialistas). A passagem de contexto entre eles se mostrou frágil
> sob interrupção e com modelos menores, então voltamos ao **contexto único** — mantendo
> a governança estrutural (fonte única de regras, dois portões, guard). Detalhes em
> `RECOMMENDATIONS.md` (R-0040/R-0042).

---

## ⚡ Comeco rapido

### 1. Pre-requisitos

- [Salesforce CLI v2](https://developer.salesforce.com/tools/salesforcecli) (`sf`), autenticado: `sf org login web --alias minhaOrg`
- Node 18+
- Projeto SFDX com `force-app/*/classes/`

> **Opcional — rodar de graça com [OpenCode](https://opencode.ai)** (sem key, sem GPU):
> ```bash
> npm install -g opencode-ai
> opencode   # no app: /models → escolha "DeepSeek V4 Flash Free" (OpenCode Zen)
> ```
> Modelo grátis já embutido, sem API key nem login. A skill funciona igual no OpenCode (mesmo `.claude/skills/`). **[Detalhes em Informações](./INFORMACOES.md#rodar-no-opencode-com-deepseek-flash-free)**.

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

> **Deu erro de SSL no `git clone`?** (comum em máquina corporativa com proxy que
> inspeciona SSL — mensagem `SSL certificate problem: self-signed certificate in
> certificate chain`). Rode **uma vez** e tente o clone de novo:
> ```bash
> git config --global http.sslBackend schannel
> ```
> Isso faz o Git usar o repositório de certificados do **Windows** (que já confia no CA
> da sua empresa), em vez do bundle próprio dele. Só funciona no Windows (Git Bash /
> PowerShell). **Nunca** use `git config --global http.sslVerify false` como atalho —
> desliga a verificação de certificado para *todos* os repositórios, um risco de segurança.
>
> **Erro `rm: cannot remove '.skill-tmp': Device or resource busy` no fim?** A cópia já
> deu certo (a skill está em `.claude/`) — só a pasta temporária ficou travada por algum
> processo (antivírus/Explorer). Feche o que estiver acessando a pasta e apague `.skill-tmp`
> manualmente; não precisa rodar o clone de novo.

> **Para atualizar:** rode o mesmo comando de novo. Para mais detalhes (alternativas, contribuir melhorias), veja [INFORMACOES.md](./INFORMACOES.md).

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

A skill **nunca mexe na classe de producao** — bloqueio em 3 camadas (instrucoes, regras deny, hook). Apagar/sobrescrever producao é impossivel mesmo em modo bypass. Detalhes em [INFORMACOES.md](./INFORMACOES.md).

---

## 📖 Documentacao Completa

Para tudo o mais (travas de seguranca, modo bypass, estrutura, memoria de estado, autoaprendizado, contribuir de volta, troubleshooting), veja:

**→ [INFORMACOES.md](./INFORMACOES.md)**

Inclui:
- Skills oficiais importadas
- Pre-requisitos detalhados
- Instalacao (metodos alternativos, global vs por projeto)
- Rodar na Web (claude.ai/code)
- Travas de seguranca (3 camadas, testes)
- Estrutura de arquivos
- Memoria de estado (checkpoints)
- Autoaprendizado (recomendacoes R-XXXX)
- Contribuir de volta (recomendacoes locais → coleta central)
- Observacoes (100%, DML, Flow, dependencias, plateau)

---

<p align="center">
  ⭐ <b><a href="https://github.com/brunotrolo/Salesforce-Apex-Cover-Loop/stargazers">Dê uma star no repo</a></b> para ser avisado quando novas skills e melhorias saírem.
</p>

<p align="center">
  <sub>
    Craft de teste vindo das <b><a href="https://github.com/forcedotcom/sf-skills">skills oficiais da Salesforce</a></b> (<code>forcedotcom/sf-skills</code>, Apache-2.0) &nbsp;·&nbsp;
    <a href="https://developer.salesforce.com/tools/salesforcecli">Salesforce CLI</a> &nbsp;·&nbsp;
    <a href="https://docs.claude.com/en/docs/claude-code">Claude Code</a>
  </sub>
</p>

<p align="center">
  <sub>Orquestração, travas de segurança e autoaprendizado © <a href="https://github.com/brunotrolo">brunotrolo</a> · <a href="./LICENSE">MIT</a>. Skills <code>platform-*</code> redistribuídas sob Apache-2.0 (ver <code>.claude/skills/VENDOR-ATTRIBUTION.md</code>).</sub>
</p>
