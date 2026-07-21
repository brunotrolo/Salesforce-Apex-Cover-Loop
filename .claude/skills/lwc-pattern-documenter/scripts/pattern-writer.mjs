#!/usr/bin/env node
/**
 * pattern-writer.mjs — Deterministic merge writer for the LWC design system doc.
 *
 * WHY THIS EXISTS: the write step must NEVER depend on the model remembering to
 * preserve the rest of the file. A weak model once overwrote the whole
 * design-patterns.md (wiping a previously documented journey) instead of appending a
 * new section. This script does the merge mechanically:
 *   - New journey   -> APPEND its section; every existing journey stays intact.
 *   - Existing one  -> REPLACE only that journey's `## Padrao: <name>` section,
 *                      keeping the header, order, and all other journeys.
 * And it upserts journeys-index.json the same safe way (never zeroes the array).
 *
 * Usage:
 *   node pattern-writer.mjs \
 *     --journey "Consorcio" \
 *     --components compA,compB,compC \
 *     --section /path/to/section.md        # the approved Markdown for THIS journey
 *
 *   # section can also come from stdin instead of --section:
 *   cat section.md | node pattern-writer.mjs --journey "X" --components a,b,c --stdin
 *
 * Optional:
 *   --out-dir <dir>   base dir (default: .lwc-pattern-documenter/lwc-design-system)
 *   --dry-run         print the merged files to stdout, write nothing
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_OUT_DIR = '.lwc-pattern-documenter/lwc-design-system';
const DOC_HEADER = '# Design Patterns LWC — Documentação por Jornada';
const SECTION_PREFIX = '## Padrao:'; // matches "## Padrao:" and "## Padrão:"

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    journey: '',
    components: [],
    sectionFile: '',
    stdin: false,
    outDir: DEFAULT_OUT_DIR,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--journey': opts.journey = args[++i] || ''; break;
      case '--components': opts.components = (args[++i] || '').split(',').map(c => c.trim()).filter(Boolean); break;
      case '--section': opts.sectionFile = args[++i] || ''; break;
      case '--stdin': opts.stdin = true; break;
      case '--out-dir': opts.outDir = args[++i] || DEFAULT_OUT_DIR; break;
      case '--dry-run': opts.dryRun = true; break;
      default: break;
    }
  }
  return opts;
}

function today() {
  // Normal node script (not a Workflow) — new Date() is fine here.
  return new Date().toISOString().slice(0, 10);
}

// Normalize a journey heading for comparison (accent + case insensitive-ish).
function normHeading(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Split the doc body into an ordered list of { name, text } sections plus the header.
function parseDoc(content) {
  const lines = content.split('\n');
  let header = '';
  const sections = [];
  let current = null;
  const headerLines = [];
  let inSection = false;

  for (const line of lines) {
    const m = line.match(/^##\s+Padr[aã]o:\s*(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { name: m[1].trim(), lines: [line] };
      inSection = true;
    } else if (inSection) {
      current.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }
  if (current) sections.push(current);

  header = headerLines.join('\n').replace(/\s+$/, '');
  return {
    header,
    sections: sections.map(s => ({ name: s.name, text: s.lines.join('\n').replace(/\s+$/, '') })),
  };
}

function buildDoc(header, sections) {
  const parts = [];
  const h = (header && header.trim()) ? header.trim() : DOC_HEADER;
  parts.push(h);
  parts.push(''); // blank line after header
  for (const s of sections) {
    parts.push(s.text.trim());
    parts.push(''); // blank line between sections
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

// Ensure the provided section markdown starts with a `## Padrao: <journey>` heading.
function ensureSectionHeading(sectionMd, journey) {
  const trimmed = sectionMd.replace(/^\s+/, '').replace(/\s+$/, '');
  if (/^##\s+Padr[aã]o:/.test(trimmed)) return trimmed;
  return `## Padrao: ${journey}\n\n${trimmed}`;
}

function mergeDoc(existingContent, journey, sectionMd) {
  const section = ensureSectionHeading(sectionMd, journey);
  const target = normHeading(journey);

  if (!existingContent || !existingContent.trim()) {
    // Fresh file.
    return buildDoc(DOC_HEADER, [{ name: journey, text: section }]);
  }

  const { header, sections } = parseDoc(existingContent);
  const idx = sections.findIndex(s => normHeading(s.name) === target);

  if (idx >= 0) {
    // Existing journey -> replace ONLY that section, keep position.
    sections[idx] = { name: journey, text: section };
  } else {
    // New journey -> append, keep all existing.
    sections.push({ name: journey, text: section });
  }
  return buildDoc(header, sections);
}

function mergeIndex(existingJson, journey, components) {
  let arr = [];
  if (existingJson && existingJson.trim()) {
    try {
      const parsed = JSON.parse(existingJson);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      // Corrupt index — do NOT silently discard; fail loudly.
      throw new Error('journeys-index.json existe mas nao e um JSON de array valido. Corrija manualmente antes de gravar (nao vou sobrescrever para nao perder jornadas).');
    }
  }

  const target = normHeading(journey);
  const idx = arr.findIndex(e => e && normHeading(e.journey) === target);
  const entry = {
    journey,
    components: components.length ? components : (idx >= 0 ? arr[idx].components : []),
    lastScan: today(),
  };
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);
  return arr;
}

function main() {
  const opts = parseArgs();

  if (!opts.journey) {
    console.error('ERRO: --journey e obrigatorio.');
    process.exit(1);
  }

  let sectionMd = '';
  if (opts.stdin) {
    sectionMd = fs.readFileSync(0, 'utf8');
  } else if (opts.sectionFile) {
    if (!fs.existsSync(opts.sectionFile)) {
      console.error(`ERRO: arquivo de secao nao encontrado: ${opts.sectionFile}`);
      process.exit(1);
    }
    sectionMd = fs.readFileSync(opts.sectionFile, 'utf8');
  } else {
    console.error('ERRO: forneca a secao via --section <arquivo> ou --stdin.');
    process.exit(1);
  }
  if (!sectionMd.trim()) {
    console.error('ERRO: a secao Markdown esta vazia. Nao vou gravar.');
    process.exit(1);
  }

  const outDir = opts.outDir;
  const docPath = path.join(outDir, 'design-patterns.md');
  const indexPath = path.join(outDir, 'journeys-index.json');

  const existingDoc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  const existingIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

  const beforeJourneys = existingDoc ? parseDoc(existingDoc).sections.map(s => s.name) : [];

  const mergedDoc = mergeDoc(existingDoc, opts.journey, sectionMd);
  const mergedIndex = mergeIndex(existingIndex, opts.journey, opts.components);

  const afterJourneys = parseDoc(mergedDoc).sections.map(s => s.name);

  // SAFETY INVARIANT: writing journey N must never drop journeys 1..N-1.
  const lost = beforeJourneys.filter(b => !afterJourneys.some(a => normHeading(a) === normHeading(b)));
  if (lost.length > 0) {
    console.error(`ERRO DE INTEGRIDADE: o merge perderia jornada(s): ${lost.join(', ')}. Abortando sem gravar.`);
    process.exit(2);
  }

  const isNew = !beforeJourneys.some(b => normHeading(b) === normHeading(opts.journey));

  if (opts.dryRun) {
    console.log('===== design-patterns.md (merged) =====');
    console.log(mergedDoc);
    console.log('===== journeys-index.json (merged) =====');
    console.log(JSON.stringify(mergedIndex, null, 2));
    console.log('\n[dry-run] nada foi gravado.');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(docPath, mergedDoc, 'utf8');
  fs.writeFileSync(indexPath, JSON.stringify(mergedIndex, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    ok: true,
    action: isNew ? 'appended' : 'updated',
    journey: opts.journey,
    journeysBefore: beforeJourneys.length,
    journeysAfter: afterJourneys.length,
    allJourneys: afterJourneys,
    docPath,
    indexPath,
  }, null, 2));
}

main();
