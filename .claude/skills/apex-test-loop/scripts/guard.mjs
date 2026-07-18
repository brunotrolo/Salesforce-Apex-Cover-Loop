#!/usr/bin/env node
// guard.mjs — Guarda de seguranca (hook PreToolUse) da skill apex-test-loop.
// ---------------------------------------------------------------------------
// Le o JSON da chamada de ferramenta no stdin. Se o comando Bash/PowerShell
// casar com um padrao DESTRUTIVO (apagar codigo Apex, deploy destrutivo, apagar
// org, apagar registros em massa), devolve uma decisao "deny" — bloqueio duro,
// sem possibilidade de aprovacao. Caso contrario fica em silencio e deixa o
// fluxo normal de permissao seguir.
//
// Esta e a 3a camada de protecao (alem de permissions.deny e das instrucoes do
// SKILL.md). Pega inclusive os flags destrutivos NO MEIO do comando, que regras
// de prefixo (deny) nao conseguem alcancar (ex.: sf project deploy start com
// --post-destructive-changes).
//
// LIMITACAO honesta: matching por texto nao e uma fronteira criptografica.
// Wrappers exoticos (npx/docker exec), indirecao por variavel de ambiente ou
// substituicao de comando podem, em tese, escapar. Por isso as instrucoes do
// SKILL.md continuam sendo essenciais.
// ---------------------------------------------------------------------------

// Regras destrutivas. Exportadas para permitir teste unitario da classificacao.
export const DESTRUCTIVE_RULES = [
  {
    re: /\bsf\b[\s\S]*\bproject\b[\s\S]*\bdelete\b/,
    why: 'sf project delete (apaga codigo-fonte Apex do disco e/ou da org)',
  },
  {
    re: /\bsf\b[\s\S]*\borg\b[\s\S]*\bdelete\b/,
    why: 'sf org delete (apaga uma org)',
  },
  {
    re: /\bsf\b[\s\S]*\bdata\b[\s\S]*\bdelete\b/,
    why: 'sf data delete (apaga registros)',
  },
  {
    re: /destructive-?changes/,
    why: 'deploy destrutivo (--pre/--post-destructive-changes) apaga metadados da org',
  },
  {
    re: /\b(rm|rmdir|rd|unlink|del|erase|remove-item|ri)\b[\s\S]*\.cls\b/,
    why: 'exclusao de arquivo .cls / .cls-meta.xml (classe Apex)',
  },
];

// Classificacao pura: recebe o texto do comando, devolve { blocked, why }.
export function classify(cmd) {
  const c = String(cmd || '').toLowerCase();
  for (const r of DESTRUCTIVE_RULES) {
    if (r.re.test(c)) return { blocked: true, why: r.why };
  }
  return { blocked: false };
}

function denyMessage(why) {
  return (
    'BLOQUEADO pela skill apex-test-loop: comando destrutivo proibido — ' +
    why +
    '. Esta skill so pode CRIAR/editar a classe de TESTE; nunca apagar, mover ou ' +
    'substituir a classe de producao (no disco ou na org). Se voce realmente ' +
    'precisa fazer isso, faca manualmente, fora do agente.'
  );
}

function runHook() {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let cmd = '';
    try {
      const input = JSON.parse(raw || '{}');
      cmd = (input.tool_input && input.tool_input.command) || '';
      if (!cmd) cmd = JSON.stringify(input.tool_input || {});
    } catch {
      process.exit(0); // nao conseguiu parsear -> nao bloqueia
    }

    const verdict = classify(cmd);
    if (verdict.blocked) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: denyMessage(verdict.why),
          },
        })
      );
    }
    process.exit(0);
  });
}

// So roda o hook (le stdin) quando executado diretamente pelo Claude Code.
// Quando importado (em testes), apenas as funcoes acima ficam disponiveis.
import { fileURLToPath } from 'node:url';
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) runHook();
