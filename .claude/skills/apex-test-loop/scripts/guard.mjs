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

import { existsSync } from 'node:fs';

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
// Bloqueia SOBRESCREVER/EDITAR a classe/trigger de PRODUCAO que JA EXISTE (foi
// o vetor do bug: a classe sob teste foi sobrescrita). Regras:
//  - arquivo de teste (nome comeca/termina com "test") ou factory  -> permitido;
//  - .cls/.trigger de producao que NAO existe ainda (arquivo NOVO) -> permitido
//    (criar um stub de dependencia faltante nunca destroi nada — habilita o modo
//     scaffold);
//  - .cls/.trigger de producao que JA EXISTE                       -> BLOQUEADO
//    (nunca sobrescrever/editar a producao existente, incl. a classe sob teste).
// `existsOverride` (opcional) permite testar sem tocar no disco.
export function classifyWrite(filePath, existsOverride) {
  const p = String(filePath || '');
  const lower = p.toLowerCase();

  const isApexClass = lower.endsWith('.cls') || lower.endsWith('.cls-meta.xml');
  const isTrigger = lower.endsWith('.trigger') || lower.endsWith('.trigger-meta.xml');
  if (!isApexClass && !isTrigger) return { blocked: false }; // metadata (.object/.field/.md) e outros: ok

  // Classe/trigger de TESTE (ou factory de teste): sempre pode criar/editar.
  const name = baseName(lower)
    .replace(/-meta\.xml$/, '')
    .replace(/\.(cls|trigger)$/, '');
  const isTestName = /^test/.test(name) || /test$/.test(name);
  const isFactory = /factory$/.test(name) || name.includes('testdata');
  if (isTestName || isFactory) return { blocked: false };

  // Producao: so bloqueia se o arquivo JA EXISTE (sobrescrita/edicao destrutiva).
  const exists = existsOverride !== undefined ? existsOverride : fileExists(p);
  if (!exists) return { blocked: false }; // arquivo novo -> criar stub/scaffold e permitido

  return {
    blocked: true,
    why:
      'sobrescrita/edicao da classe/trigger de PRODUCAO existente ' +
      baseName(p) +
      ' (a skill nunca altera producao existente — incl. a classe sob teste; ' +
      'so cria/edita a classe de TESTE ou arquivos NOVOS de scaffold)',
  };
}

function baseName(p) {
  const parts = String(p).split(/[\\/]/);
  return parts[parts.length - 1] || String(p);
}

function fileExists(p) {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
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
