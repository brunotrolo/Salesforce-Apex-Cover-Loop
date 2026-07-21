#!/usr/bin/env node
/**
 * pattern-extractor.mjs — Deterministic LWC pattern extraction.
 *
 * Reads .js / .html / .css / .js-meta.xml for a set of components and emits a JSON
 * with per-component signals + a journey-level aggregate. The agent INTERPRETS this
 * JSON (it does not re-read raw files and guess). Same philosophy as apex-coverage.mjs:
 * the script extracts mechanically; the human/agent judges and writes.
 *
 * The aggregate field names here are the CONTRACT consumed by references/extraction-
 * signals.md and SKILL.md — keep them in sync.
 *
 * Usage:
 *   node pattern-extractor.mjs --list <dir>                       # list LWC folders
 *   node pattern-extractor.mjs --components a,b,c --journey "X"   # extract signals
 *   [--lwc-dir force-app/main/default/lwc]                        # base dir override
 */

import fs from 'fs';
import path from 'path';

// ------------------------------- helpers -----------------------------------

function namingStyle(name) {
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'lowercase';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
  if (/[-_]/.test(name)) return name.includes('-') ? 'kebab-case' : 'snake_case';
  return 'other';
}

function commonPrefix(names) {
  if (!names.length) return '';
  // longest leading lowercase word shared by all (>=3 chars)
  let prefix = names[0];
  for (const n of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < n.length && prefix[i] === n[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  // trim to a word boundary (stop before an uppercase mid-word)
  const m = prefix.match(/^[a-z]+/);
  const word = m ? m[0] : '';
  return word.length >= 3 ? word : '';
}

function sortedCounts(obj) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ item: key, count }));
}

// -------------------------- per-file extractors ----------------------------

function extractJs(src) {
  const s = {
    imports: [], localModules: [], apexImports: [],
    decorators: { api: 0, track: 0, wire: 0 },
    apiMembers: [], wireAdapters: [], events: [], lifecycle: [],
    apexCalls: { then: false, await: false, tryCatch: false, refreshApex: false },
    toastVariants: [], loadingState: false, labels: [],
    wireUses: false, apexUses: false,
  };

  const importMatches = src.match(/import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g) || [];
  s.imports = importMatches.map(m => (m.match(/from\s+['"]([^'"]+)['"]/) || [])[1]).filter(Boolean);
  s.localModules = s.imports.filter(i => /^c\/\w+/.test(i));
  s.apexImports = s.imports.filter(i => i.startsWith('@salesforce/apex/'));

  s.decorators.api = (src.match(/@api\b/g) || []).length;
  s.decorators.track = (src.match(/@track\b/g) || []).length;
  s.decorators.wire = (src.match(/@wire\b/g) || []).length;

  s.apiMembers = (src.match(/@api\s+(?:get\s+|set\s+)?(\w+)/g) || [])
    .map(m => (m.match(/@api\s+(?:get\s+|set\s+)?(\w+)/) || [])[1]).filter(Boolean);
  s.apiMembers = [...new Set(s.apiMembers)];

  s.wireAdapters = (src.match(/@wire\s*\(\s*(\w+)/g) || [])
    .map(m => (m.match(/@wire\s*\(\s*(\w+)/) || [])[1]).filter(Boolean);

  s.events = [...new Set((src.match(/new\s+CustomEvent\s*\(\s*['"]([^'"]+)['"]/g) || [])
    .map(m => (m.match(/new\s+CustomEvent\s*\(\s*['"]([^'"]+)['"]/) || [])[1]).filter(Boolean))];

  s.lifecycle = ['connectedCallback', 'renderedCallback', 'disconnectedCallback', 'errorCallback']
    .filter(hook => src.includes(hook));

  s.apexCalls.then = /\.then\s*\(/.test(src);
  s.apexCalls.await = /\bawait\s+\w/.test(src);
  s.apexCalls.tryCatch = /\btry\s*\{/.test(src);
  s.apexCalls.refreshApex = /refreshApex/.test(src);

  s.toastVariants = (src.match(/variant\s*:\s*['"]([^'"]+)['"]/g) || [])
    .map(m => (m.match(/variant\s*:\s*['"]([^'"]+)['"]/) || [])[1])
    .filter(v => ['error', 'success', 'warning', 'info'].includes(v));
  s.toastVariants = [...new Set(s.toastVariants)];

  s.loadingState = /\b(isLoading|showSpinner|loading)\b\s*[=:]/.test(src);
  s.labels = [...new Set((src.match(/@salesforce\/label\/c\.(\w+)/g) || [])
    .map(m => m.replace('@salesforce/label/c.', '')))];

  s.wireUses = s.decorators.wire > 0;
  s.apexUses = s.apexImports.length > 0;
  return s;
}

function htmlSkeleton(src, maxDepth = 3, maxLines = 14) {
  const lines = [];
  let depth = 0;
  const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
  const tagRegex = /<(\/?)([\w-]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tagRegex.exec(src)) !== null && lines.length < maxLines) {
    const [, isClose, tagName, attrs, selfClose] = m;
    if (isClose) { depth = Math.max(0, depth - 1); continue; }
    const structural = /^(lightning-|c-)/.test(tagName) ||
      ['div', 'section', 'template', 'header', 'footer', 'main', 'article', 'nav', 'ul', 'ol'].includes(tagName);
    if (structural && depth <= maxDepth) {
      const cls = (attrs.match(/class\s*=\s*["']([^"']*)/) || [])[1] || '';
      const sldsHint = cls.split(/\s+/).filter(c => c.startsWith('slds-')).slice(0, 2).join('.');
      const dir = (attrs.match(/\b(lwc:if|lwc:elseif|lwc:else|for:each|if:true|if:false)/) || [])[1] || '';
      let label = tagName;
      if (sldsHint) label += `.${sldsHint}`;
      if (dir) label += ` [${dir}]`;
      lines.push('  '.repeat(depth) + label);
    }
    if (!voidTags.has(tagName) && !selfClose) depth++;
  }
  return lines.join('\n');
}

function extractHtml(src) {
  const s = {
    skeleton: '', rootTag: '', customTags: [], slots: [], lightningTags: [],
    aria: [], roles: [], hasTabindex: false, hasAlt: false, sldsClasses: [],
    directives: [], hasSpinner: false, hasModal: false, a11yScore: 0,
  };
  s.rootTag = (src.match(/<([\w-]+)[\s>]/) || [])[1] || '';
  s.skeleton = htmlSkeleton(src);
  s.customTags = [...new Set((src.match(/<(c-[\w-]+)/g) || []).map(m => m.replace('<', '')))];
  s.lightningTags = [...new Set((src.match(/<(lightning-[\w-]+)/g) || []).map(m => m.replace('<', '')))];
  s.slots = [...new Set((src.match(/<slot\b[^>]*\bname\s*=\s*['"]([^'"]+)['"]/g) || [])
    .map(m => (m.match(/name\s*=\s*['"]([^'"]+)['"]/) || [])[1]).filter(Boolean))];
  if (/<slot\b(?![^>]*\bname=)/.test(src)) s.slots.push('(default)');
  s.aria = [...new Set(src.match(/aria-[\w-]+/g) || [])];
  s.roles = [...new Set((src.match(/role\s*=\s*['"]([^'"]+)['"]/g) || [])
    .map(m => (m.match(/role\s*=\s*['"]([^'"]+)['"]/) || [])[1]).filter(Boolean))];
  s.hasTabindex = /tabindex\s*=/.test(src);
  s.hasAlt = /\balt\s*=/.test(src);
  s.directives = [...new Set((src.match(/\b(lwc:if|lwc:elseif|lwc:else|for:each|if:true|if:false|iterator:)/g) || []))];
  const classBlobs = (src.match(/class\s*=\s*["']([^"']*)["']/g) || [])
    .map(m => (m.match(/["']([^"']*)["']/) || [])[1] || '').join(' ');
  s.sldsClasses = [...new Set(classBlobs.split(/\s+/).filter(c => c.startsWith('slds-')))];
  s.hasSpinner = /<lightning-spinner/.test(src);
  s.hasModal = /slds-modal\b/.test(src);
  s.a11yScore = s.aria.length + s.roles.length + (s.hasTabindex ? 1 : 0) + (s.hasAlt ? 1 : 0);
  return s;
}

function extractCss(src) {
  const s = { customPropsConsumed: [], customPropsDefined: [], usesHost: false, hardcodedColors: [], usesSlds: false };
  s.customPropsConsumed = [...new Set((src.match(/var\s*\(\s*(--[\w-]+)/g) || [])
    .map(m => (m.match(/(--[\w-]+)/) || [])[1]))];
  s.customPropsDefined = [...new Set((src.match(/(--[\w-]+)\s*:/g) || [])
    .map(m => (m.match(/(--[\w-]+)/) || [])[1]))];
  s.usesHost = /:host/.test(src);
  s.hardcodedColors = [...new Set(src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\s*\([^)]+\)/g) || [])];
  s.usesSlds = /slds-/.test(src);
  return s;
}

function extractMeta(src) {
  const s = { apiVersion: '', isExposed: false, targets: [] };
  s.apiVersion = (src.match(/<apiVersion>([^<]+)<\/apiVersion>/) || [])[1] || '';
  s.isExposed = (src.match(/<isExposed>([^<]+)<\/isExposed>/) || [])[1] === 'true';
  s.targets = (src.match(/<target>([^<]+)<\/target>/g) || [])
    .map(m => (m.match(/<target>([^<]+)<\/target>/) || [])[1]).filter(Boolean);
  return s;
}

// -------------------------- component + aggregate ---------------------------

function extractComponent(dir) {
  const name = path.basename(dir);
  const result = { name, path: dir, naming: {}, js: {}, html: {}, css: {}, meta: {}, hasTest: false, errors: [] };
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

  result.naming = { style: namingStyle(name) };
  const js = read(path.join(dir, `${name}.js`));
  if (js !== null) result.js = extractJs(js); else result.errors.push('no .js');
  const html = read(path.join(dir, `${name}.html`));
  if (html !== null) result.html = extractHtml(html); else result.html = {};
  const css = read(path.join(dir, `${name}.css`));
  if (css !== null) result.css = extractCss(css); else result.css = {};
  const meta = read(path.join(dir, `${name}.js-meta.xml`));
  if (meta !== null) result.meta = extractMeta(meta);
  result.hasTest = fs.existsSync(path.join(dir, `${name}.test.js`));
  return result;
}

// Resolve the API surface of shared local utilities (c/xUtil) imported by many.
function resolveSharedUtils(components, lwcDir) {
  const usage = {}; // module -> Set(componentNames)
  for (const c of components) {
    for (const mod of (c.js.localModules || [])) {
      const modName = mod.replace(/^c\//, '');
      if (!usage[modName]) usage[modName] = new Set();
      usage[modName].add(c.name);
    }
  }
  const shared = [];
  for (const [modName, users] of Object.entries(usage)) {
    if (users.size < 2) continue; // shared = used by 2+
    const jsPath = path.join(lwcDir, modName, `${modName}.js`);
    let exportsList = [];
    if (fs.existsSync(jsPath)) {
      const src = fs.readFileSync(jsPath, 'utf8');
      const fnExports = (src.match(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g) || [])
        .map(m => { const mm = m.match(/function\s+(\w+)\s*\(([^)]*)\)/); return `${mm[1]}(${mm[2].trim()})`; });
      const constExports = (src.match(/export\s+const\s+(\w+)/g) || [])
        .map(m => (m.match(/export\s+const\s+(\w+)/) || [])[1]);
      const namedExports = (src.match(/export\s*\{\s*([^}]+)\s*\}/g) || [])
        .flatMap(m => (m.match(/\{\s*([^}]+)\s*\}/)[1]).split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean));
      const classExports = (src.match(/export\s+(?:default\s+)?class\s+(\w+)/g) || [])
        .map(m => 'class ' + (m.match(/class\s+(\w+)/) || [])[1]);
      exportsList = [...new Set([...fnExports, ...constExports, ...namedExports, ...classExports])];
    }
    shared.push({ module: `c/${modName}`, importedBy: users.size, components: [...users].sort(), exports: exportsList });
  }
  return shared.sort((a, b) => b.importedBy - a.importedBy);
}

function computeSpecificsAndPartials(components, agg) {
  const n = components.length;
  const dims = {
    slots: c => c.html.slots || [],
    events: c => c.js.events || [],
    lightningTags: c => c.html.lightningTags || [],
    customTags: c => c.html.customTags || [],
    sldsClasses: c => c.html.sldsClasses || [],
    imports: c => c.js.imports || [],
    apiMembers: c => c.js.apiMembers || [],
    wireAdapters: c => c.js.wireAdapters || [],
    labels: c => c.js.labels || [],
    directives: c => c.html.directives || [],
    aria: c => c.html.aria || [],
    hardcodedColors: c => c.css.hardcodedColors || [],
    tokens: c => c.css.customPropsDefined || [],
  };

  // count each (dim,item) across components
  const counts = {}; // dim -> item -> Set(componentNames)
  for (const [dim, get] of Object.entries(dims)) {
    counts[dim] = {};
    for (const c of components) {
      for (const item of get(c)) {
        (counts[dim][item] = counts[dim][item] || new Set()).add(c.name);
      }
    }
  }

  // specifics: item appears in exactly 1 component
  const specifics = {}; // component -> [{dim,item}]
  const partials = {};   // dim -> [{item,count}]
  for (const [dim, items] of Object.entries(counts)) {
    for (const [item, set] of Object.entries(items)) {
      if (set.size === 1) {
        const comp = [...set][0];
        (specifics[comp] = specifics[comp] || []).push({ dim, item });
      } else if (set.size >= 2 && set.size < n) {
        (partials[dim] = partials[dim] || []).push({ item, count: set.size });
      }
    }
  }
  for (const dim of Object.keys(partials)) partials[dim].sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
  agg.componentSpecifics = specifics;
  agg.partialConventions = partials;
}

function detectDivergences(components, agg) {
  const div = {};
  const withTokens = components.filter(c => (c.css.customPropsConsumed || []).length > 0).map(c => c.name);
  const withHardcoded = components.filter(c => (c.css.hardcodedColors || []).length > 0).map(c => c.name);
  if (withTokens.length && withHardcoded.length) {
    div.colorStrategy = { variants: [
      { strategy: 'design tokens (var(--))', components: withTokens },
      { strategy: 'hardcoded colors', components: withHardcoded },
    ] };
  }
  const styles = {};
  components.forEach(c => { const st = c.naming.style; (styles[st] = styles[st] || []).push(c.name); });
  if (Object.keys(styles).length > 1) {
    div.namingStyle = { variants: Object.entries(styles).map(([strategy, comps]) => ({ strategy, components: comps })) };
  }
  agg.divergences = div;
}

function aggregate(components, lwcDir) {
  const n = components.length;
  const agg = {
    totalComponents: n,
    minComponentsMet: n >= 3,
    naming: { dominantStyle: '', styleCounts: {}, commonPrefix: '' },
    html: {
      rootTags: [], allCustomTags: [], commonSldsClasses: [], allLightningTags: [],
      componentsWithSlots: 0, spinnerUsers: 0, modalUsers: 0, a11yAvg: 0,
      representativeSkeleton: null, modalSkeleton: null,
    },
    js: {
      commonApiMembers: [], allApiMembers: [], wireAdapters: [], allImports: [],
      allEvents: [], apexCallStyle: { then: 0, await: 0, tryCatch: 0, refreshApex: 0 },
      toast: { users: 0, variants: [] }, labelUsers: 0, allLabels: [],
      loadingStateUsers: 0, wireUsers: 0, apexUsers: 0, sharedUtils: [],
    },
    css: { allTokensSeen: [], componentsWithHardcodedColors: [], componentsUsingHost: 0, colorStrategy: [] },
    tests: { componentsWithTests: 0, total: n },
    componentSpecifics: {}, partialConventions: {}, divergences: {}, warnings: [],
  };

  // naming
  const styleCounts = {}; const names = components.map(c => c.name);
  components.forEach(c => { styleCounts[c.naming.style] = (styleCounts[c.naming.style] || 0) + 1; });
  agg.naming.styleCounts = styleCounts;
  agg.naming.dominantStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  agg.naming.commonPrefix = commonPrefix(names);

  // html
  const rootTags = {}, customTags = {}, sldsClasses = {}, lightningTags = {};
  const toastVariants = {}, apiMembers = {}, wireAdapters = {}, imports = {}, events = {};
  let a11ySum = 0;
  components.forEach(c => {
    if (c.html.rootTag) rootTags[c.html.rootTag] = (rootTags[c.html.rootTag] || 0) + 1;
    (c.html.customTags || []).forEach(t => customTags[t] = (customTags[t] || 0) + 1);
    (c.html.sldsClasses || []).forEach(t => sldsClasses[t] = (sldsClasses[t] || 0) + 1);
    (c.html.lightningTags || []).forEach(t => lightningTags[t] = (lightningTags[t] || 0) + 1);
    if ((c.html.slots || []).length) agg.html.componentsWithSlots++;
    if (c.html.hasSpinner) agg.html.spinnerUsers++;
    if (c.html.hasModal) agg.html.modalUsers++;
    a11ySum += (c.html.a11yScore || 0);
  });
  agg.html.rootTags = sortedCounts(rootTags);
  agg.html.allCustomTags = sortedCounts(customTags);
  agg.html.commonSldsClasses = sortedCounts(sldsClasses);
  agg.html.allLightningTags = sortedCounts(lightningTags);
  agg.html.a11yAvg = n ? Number((a11ySum / n).toFixed(1)) : 0;

  // representative skeleton = component with the deepest/longest skeleton (most structure)
  const bySkeleton = components.filter(c => c.html.skeleton).sort((a, b) => (b.html.skeleton.length - a.html.skeleton.length));
  if (bySkeleton[0]) agg.html.representativeSkeleton = { component: bySkeleton[0].name, skeleton: bySkeleton[0].html.skeleton };
  const modalComp = components.filter(c => c.html.hasModal).sort((a, b) => (b.html.skeleton.length - a.html.skeleton.length))[0];
  if (modalComp) agg.html.modalSkeleton = { component: modalComp.name, skeleton: modalComp.html.skeleton };

  // js
  const toastSet = new Set();
  components.forEach(c => {
    (c.js.apiMembers || []).forEach(m => apiMembers[m] = (apiMembers[m] || 0) + 1);
    (c.js.wireAdapters || []).forEach(w => wireAdapters[w] = (wireAdapters[w] || 0) + 1);
    (c.js.imports || []).forEach(i => imports[i] = (imports[i] || 0) + 1);
    (c.js.events || []).forEach(e => events[e] = (events[e] || 0) + 1);
    (c.js.toastVariants || []).forEach(v => toastVariants[v] = (toastVariants[v] || 0) + 1);
    if ((c.js.toastVariants || []).length || /ShowToastEvent/.test('')) { /* counted below */ }
    if (c.js.apexCalls?.then) agg.js.apexCallStyle.then++;
    if (c.js.apexCalls?.await) agg.js.apexCallStyle.await++;
    if (c.js.apexCalls?.tryCatch) agg.js.apexCallStyle.tryCatch++;
    if (c.js.apexCalls?.refreshApex) agg.js.apexCallStyle.refreshApex++;
    if ((c.js.labels || []).length) agg.js.labelUsers++;
    agg.js.allLabels.push(...(c.js.labels || []));
    if (c.js.loadingState) agg.js.loadingStateUsers++;
    if (c.js.wireUses) agg.js.wireUsers++;
    if (c.js.apexUses) agg.js.apexUsers++;
    if ((c.js.toastVariants || []).length) toastSet.add(c.name);
  });
  agg.js.commonApiMembers = sortedCounts(apiMembers);
  agg.js.allApiMembers = Object.keys(apiMembers).sort();
  agg.js.wireAdapters = sortedCounts(wireAdapters);
  agg.js.allImports = sortedCounts(imports);
  agg.js.allEvents = sortedCounts(events);
  agg.js.allLabels = [...new Set(agg.js.allLabels)];
  agg.js.toast = { users: toastSet.size, variants: sortedCounts(toastVariants) };
  agg.js.sharedUtils = resolveSharedUtils(components, lwcDir);

  // css
  const tokens = new Set();
  components.forEach(c => {
    (c.css.customPropsConsumed || []).forEach(t => tokens.add(t));
    if ((c.css.hardcodedColors || []).length) agg.css.componentsWithHardcodedColors.push({ component: c.name, colors: c.css.hardcodedColors });
    if (c.css.usesHost) agg.css.componentsUsingHost++;
  });
  agg.css.allTokensSeen = [...tokens].sort();
  const colorFreq = {};
  agg.css.componentsWithHardcodedColors.forEach(x => x.colors.forEach(col => colorFreq[col] = (colorFreq[col] || 0) + 1));
  agg.css.colorStrategy = sortedCounts(colorFreq);

  // tests
  agg.tests.componentsWithTests = components.filter(c => c.hasTest).length;

  computeSpecificsAndPartials(components, agg);
  detectDivergences(components, agg);

  if (!agg.minComponentsMet) agg.warnings.push(`Apenas ${n} componente(s): minimo de 3 nao atingido. NAO documente esta jornada — peca mais exemplos (regra 2).`);
  const missing = components.filter(c => c.errors.length);
  if (missing.length) agg.warnings.push(`Componentes sem .js (ou ilegiveis): ${missing.map(c => c.name).join(', ')}.`);

  return agg;
}

// --------------------------------- CLI -------------------------------------

function listLWCs(baseDir) {
  if (!fs.existsSync(baseDir)) { console.error(`LWC directory not found: ${baseDir}`); return []; }
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('__'))
    .map(e => e.name).sort();
}

function main() {
  const args = process.argv.slice(2);
  let listDir = null, components = [], journey = '', lwcDir = 'force-app/main/default/lwc';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') listDir = args[++i] || lwcDir;
    else if (args[i] === '--components') components = (args[++i] || '').split(',').map(c => c.trim()).filter(Boolean);
    else if (args[i] === '--journey') journey = args[++i] || '';
    else if (args[i] === '--lwc-dir') lwcDir = args[++i] || lwcDir;
  }

  if (listDir) {
    console.log(JSON.stringify({ dir: listDir, list: listLWCs(listDir) }, null, 2));
    return;
  }
  if (!components.length || !journey) {
    console.error('Usage:');
    console.error('  --list <dir>                       List LWC folders');
    console.error('  --components a,b,c --journey "X"    Extract signals (min 3)');
    console.error('  [--lwc-dir <dir>]                  Base dir (default force-app/main/default/lwc)');
    process.exit(1);
  }

  const results = components.map(name => extractComponent(path.join(lwcDir, name)));
  const agg = aggregate(results, lwcDir);
  console.log(JSON.stringify({ journey, extractedAt: new Date().toISOString(), lwcDir, components: results, aggregate: agg }, null, 2));
}

main();
