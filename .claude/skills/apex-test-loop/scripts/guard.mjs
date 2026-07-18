#!/usr/bin/env node
// guard.mjs — Guarda de seguranca (hook PreToolUse) da skill apex-test-loop.
// ---------------------------------------------------------------------------
// Le o JSON da chamada de ferramenta no stdin e devolve uma decisao "deny"
// (bloqueio duro, sem aprovacao) quando a acao e destrutiva. Cobre DOIS vetores:
//
//   1) Comandos (Bash/PowerShell): apagar codigo Apex, deploy destrutivo,
//      apagar org, apagar registros em massa. Pega ate flags NO MEIO do comando
//      que regras de prefixo (permissions.deny) nao alcancam.
//   2) Escrita de arquivo (Write/Edit): sobrescrever a classe de PRODUCAO
//      (`.cls`/`.trigger` que nao e classe de teste). Este foi o vetor do bug
//      original — a classe de producao foi sobrescrita pelo tool Write, por
//      baixo das travas de Bash.
//
// E a 3a camada de protecao (alem de permissions.deny e das instrucoes do
// SKILL.md). LIMITACAO honesta: matching por texto/caminho nao e uma fronteira
// criptografica — wrappers exoticos, variaveis de ambiente ou substituicao de
// comando podem, em tese, escapar. Por isso as instrucoes do SKILL.md continuam
// essenciais.
// ---------------------------------------------------------------------------

// --- Camada de COMANDOS ----------------------------------------------------
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

// Classificacao de comando: texto -> { blocked, why }.
export function classify(cmd) {
  const c = String(cmd || '').toLowerCase();
  for (const r of DESTRUCTIVE_RULES) {
    if (r.re.test(c)) return { blocked: true, why: r.why };
  }
  return { blocked: false };
}

// --- Camada de ESCRITA DE ARQUIVO ------------------------------------------
// Bloqueia escrever/editar a classe de PRODUCAO. A skill so pode escrever a
// classe de TESTE (nome comeca ou termina com "Test") ou o TestDataFactory.
export function classifyWrite(filePath) {
  const p = String(filePath || '');
  const lower = p.toLowerCase();

  const isMeta = lower.endsWith('-meta.xml');
  const isApexClass = lower.endsWith('.cls') || lower.endsWith('.cls-meta.xml');
  const isTrigger = lower.endsWith('.trigger') || lower.endsWith('.trigger-meta.xml');
  if (!isApexClass && !isTrigger) return { blocked: false };

  // Trigger e sempre codigo de producao — a skill nunca escreve triggers.
  if (isTrigger) {
    return {
      blocked: true,
      why: 'escrita em arquivo de TRIGGER de producao (' + baseName(p) + ')',
    };
  }

  // Nome-base da classe, sem caminho e sem extensao/-meta.
  const name = baseName(lower).replace(/-meta\.xml$/, '').replace(/\.cls$/, '');
  const isTestName = /^test/.test(name) || /test$/.test(name); // comeca ou termina com "test"
  const isFactory = /factory$/.test(name) || name.includes('testdata');
  if (isTestName || isFactory) return { blocked: false };

  return {
    blocked: true,
    why:
      'sobrescrita da classe de PRODUCAO ' +
      name +
      (isMeta ? '.cls-meta.xml' : '.cls') +
      ' (a skill so cria/edita a classe de TESTE; produção e intocavel)',
  };
}

function baseName(p) {
  const parts = String(p).split(/[\\/]/);
  return parts[parts.length - 1] || String(p);
}

// --- Mensagem e hook -------------------------------------------------------
function denyMessage(why) {
  return (
    'BLOQUEADO pela skill apex-test-loop: acao proibida — ' +
    why +
    '. Esta skill so pode CRIAR/editar a classe de TESTE; nunca apagar, mover ou ' +
    'substituir a classe de producao (no disco ou na org). Se voce realmente ' +
    'precisa alterar a producao, faca manualmente/fora do agente, com revisao humana.'
  );
}

function runHook() {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let ti = {};
    try {
      ti = JSON.parse(raw || '{}').tool_input || {};
    } catch {
      process.exit(0); // nao conseguiu parsear -> nao bloqueia
    }

    let verdict = { blocked: false };
    if (ti.command !== undefined) {
      verdict = classify(ti.command);
    } else if (ti.file_path !== undefined) {
      verdict = classifyWrite(ti.file_path);
    } else {
      // fallback: varre o JSON inteiro por padrao de comando destrutivo
      verdict = classify(JSON.stringify(ti));
    }

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
