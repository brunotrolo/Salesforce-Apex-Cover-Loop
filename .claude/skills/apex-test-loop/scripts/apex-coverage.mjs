#!/usr/bin/env node
// apex-coverage.mjs
// ---------------------------------------------------------------------------
// Deploy (opcional) + roda UMA classe de teste Apex com cobertura via o
// Salesforce CLI (sf) e imprime um JSON compacto com as LINHAS NAO COBERTAS
// da classe de producao sob teste.
//
// E o "sinal deterministico" do loop da skill apex-test-loop: em vez de o
// agente ler um JSON gigante do sf, ele le algo como:
//   { "coveredPercent": 84, "uncoveredLines": [12,13,45], "failures": [] }
//
// Uso:
//   node apex-coverage.mjs --class MinhaClasse [--test MinhaClasseTest] \
//        [--org alias] [--test-only | --deploy] [--extra ApexClass:TestDataFactory,...] \
//        [--slow-ms 8000]
//   --test-only  deploya SOMENTE a classe de teste (PADRAO recomendado do loop).
//   --deploy     deploya producao + teste (so se a producao for nova/alterada).
//   (sem --test-only nem --deploy: nao deploya — so mede o que JA esta na org.)
//   --slow-ms N  limiar (ms) para sinalizar metodos LENTOS/FRAGEIS em "slowTests"
//                (padrao 8000). Fragilidade de CPU latente, nao falha — ver SKILL.md.
//
// IMPORTANTE (constraint do Salesforce): testes Apex SEMPRE rodam na ORG, nunca
// na maquina local. Para a org executar um teste NOVO/ALTERADO, o codigo do teste
// PRECISA ser deployado antes (senao a org roda a versao antiga). Por isso o loop
// deploya a classe de teste (--test-only) a cada iteracao em que o teste muda.
//
// Requisitos: sf CLI instalado e autenticado; Node 18+.
// ---------------------------------------------------------------------------

import { spawnSync } from 'node:child_process';

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const className = arg('class');
const testName = arg('test') || (className ? `${className}Test` : undefined);
const org = arg('org');
const doDeploy = !!arg('deploy', false); // deploy classe de producao + teste
const testOnly = !!arg('test-only', false); // deploy SOMENTE a classe de teste (recomendado)
const extra = arg('extra'); // "ApexClass:Foo,ApexClass:Bar"
// Limiar (ms de wall-clock) acima do qual um metodo de teste e sinalizado como
// LENTO/FRAGIL. Nao e CPU exato (RunTime inclui DML/SOQL que nao contam CPU), mas e
// o melhor proxy deterministico disponivel no JSON do run: metodos lentos costumam
// ser os que "raspam" o limite de CPU e falham INTERMITENTEMENTE conforme a carga da
// org (mesma suite pode falhar 17 numa org cheia e 1 numa vazia). Ajustavel: --slow-ms N.
const slowMs = Number(arg('slow-ms', 8000)) || 8000;
const willDeploy = doDeploy || testOnly;

if (!className || !testName) {
  console.error(
    'Uso: node apex-coverage.mjs --class <ApexClass> [--test <TestClass>] ' +
      '[--org <alias>] [--test-only | --deploy] [--extra ApexClass:Foo,ApexClass:Bar]\n' +
      '  --test-only  deploy SOMENTE a classe de teste (recomendado: a classe de\n' +
      '               producao ja esta na org e NAO deve ser reenviada/sobrescrita).\n' +
      '  --deploy     deploy da classe de producao + teste (use so se a classe de\n' +
      '               producao e nova ou mudou legitimamente).'
  );
  process.exit(2);
}

const orgArgs = org ? ['--target-org', org] : [];

// No Windows o sf e um .cmd, e o Node moderno exige shell para executa-lo.
// (Os args aqui sao nomes de classe/alias simples — sem risco de quoting.)
const IS_WINDOWS = process.platform === 'win32';

function runSf(args) {
  const res = spawnSync('sf', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: IS_WINDOWS,
  });
  if (res.error && res.error.code === 'ENOENT') {
    emit(
      {
        phase: 'preflight',
        error:
          'Salesforce CLI (sf) nao encontrado no PATH. Instale: ' +
          'https://developer.salesforce.com/tools/salesforcecli e autentique com "sf org login web".',
      },
      1
    );
  }
  return res;
}

function parseJsonLoose(stdout) {
  if (!stdout) return null;
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function emit(obj, exitCode) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// 1) Deploy opcional. Por padrao (--test-only) envia SOMENTE a classe de teste,
//    porque a classe de producao ja esta na org e nao deve ser reenviada nem
//    sobrescrita. --deploy (produção + teste) so para classe nova/alterada.
//    --test-level NoTestRun evita rodar TODOS os testes da org so por deployar
//    (os testes rodam separadamente no passo 2).
// ---------------------------------------------------------------------------
if (willDeploy) {
  const meta = testOnly
    ? [`ApexClass:${testName}`]
    : [`ApexClass:${className}`, `ApexClass:${testName}`];
  if (typeof extra === 'string') {
    for (const m of extra.split(',')) if (m.trim()) meta.push(m.trim());
  }
  const dArgs = ['project', 'deploy', 'start'];
  for (const m of meta) dArgs.push('--metadata', m);
  dArgs.push('--test-level', 'NoTestRun', '--json', ...orgArgs);

  const d = runSf(dArgs);
  const dj = parseJsonLoose(d.stdout || '');
  const deployOk = d.status === 0 && dj && dj.status === 0;

  if (!deployOk) {
    let failures = [];
    const result = dj?.result || {};

    // sf moderno: result.files[] com state 'Failed' + error/lineNumber
    for (const f of result.files || []) {
      if ((f.state || '').toLowerCase() === 'failed' || f.error) {
        failures.push({
          file: f.fullName || f.filePath,
          line: f.lineNumber,
          column: f.columnNumber,
          problem: f.error || f.problemType,
        });
      }
    }
    // sfdx antigo: result.details.componentFailures
    if (!failures.length) {
      const cf = result.details?.componentFailures || result.componentFailures || [];
      for (const f of Array.isArray(cf) ? cf : [cf]) {
        if (f && f.problem) {
          failures.push({ file: f.fullName || f.fileName, line: f.lineNumber, problem: f.problem });
        }
      }
    }

    // A falha e "culpa" do teste, ou de dependencia/classe de producao?
    const testFile = testName.toLowerCase();
    const testCaused = failures.some((f) => String(f.file || '').toLowerCase().includes(testFile));
    const prodOrDepCaused = failures.some(
      (f) => !String(f.file || '').toLowerCase().includes(testFile)
    );

    emit(
      {
        phase: 'deploy',
        deploySucceeded: false,
        deployErrors: failures.length
          ? failures
          : [{ problem: dj?.message || 'Deploy falhou. Veja "raw".' }],
        // Sinaliza para o agente NAO recriar/apagar/stubar a classe de producao.
        blockedByDependency: prodOrDepCaused && !testCaused,
        hint:
          prodOrDepCaused && !testCaused
            ? 'A falha NAO e da classe de teste, e de uma dependencia (objeto __c, ' +
              'Custom Metadata __mdt, ou outra classe) ausente. NUNCA recrie/apague/' +
              'sobrescreva a CLASSE SOB TESTE. Uso real: ofereca (a) rodar so o teste se ' +
              'a producao ja estiver na org; (b) "sf project retrieve start"; (c) apontar ' +
              'a org certa. Dev/treino sem a org: com sinal do usuario (--scaffold), crie o ' +
              'MINIMO das dependencias como arquivos NOVOS (__c/__mdt sao metadata XML, nao ' +
              'Apex) — veja references/scaffolding-dependencies.md.'
            : 'Erro provavelmente na classe de TESTE — ajuste o teste e rode de novo.',
        raw: failures.length ? undefined : (d.stdout || d.stderr || '').slice(0, 4000),
      },
      1
    );
  }
}

// ---------------------------------------------------------------------------
// 2) Roda a classe de teste com cobertura, de forma sincrona
// ---------------------------------------------------------------------------
const tArgs = [
  'apex',
  'run',
  'test',
  '--class-names',
  testName,
  '--code-coverage',
  '--result-format',
  'json',
  '--synchronous',
  '--wait',
  '10',
  ...orgArgs,
];

const t = runSf(tArgs);
const tj = parseJsonLoose(t.stdout || '');

if (!tj || !tj.result) {
  emit(
    {
      phase: 'test',
      error: 'Nao foi possivel ler o resultado do teste a partir da saida do sf.',
      raw: (t.stdout || t.stderr || '').slice(0, 4000),
    },
    1
  );
}

const r = tj.result;
const summary = r.summary || {};
const tests = r.tests || [];

const failures = tests
  .filter((x) => (x.Outcome || x.outcome) !== 'Pass')
  .map((x) => ({
    method: `${x.ApexClass?.Name || x.apexClass?.name || testName}.${x.MethodName || x.methodName}`,
    message: x.Message || x.message,
    stackTrace: x.StackTrace || x.stackTrace,
  }));

// Sinal de FRAGILIDADE (nao e falha): metodos cujo tempo de execucao passa de
// `slowMs`. Sao os candidatos a estourar CPU de forma INTERMITENTE numa org
// carregada — mesmo passando agora. O loop deve trata-los como deploy-blockers
// latentes (dividir em grupos menores com startTest/stopTest proprio) ANTES de
// declarar a classe pronta. Veja SKILL.md (passo 4) e runtime-blockers.md (secao 1).
const slowTests = tests
  .map((x) => ({
    method: `${x.ApexClass?.Name || x.apexClass?.name || testName}.${x.MethodName || x.methodName}`,
    runtimeMs: Number(x.RunTime ?? x.runTime ?? x.runtime ?? 0),
  }))
  .filter((x) => Number.isFinite(x.runtimeMs) && x.runtimeMs >= slowMs)
  .sort((a, b) => b.runtimeMs - a.runtimeMs);

// Localiza a cobertura da classe sob teste
const covListRaw = r.coverage?.coverage || r.coverage || [];
const covList = Array.isArray(covListRaw) ? covListRaw : [];
const entry = covList.find((c) => (c.name || c.Name) === className);

// Cobertura colateral: outras classes/triggers executadas por este teste.
// Util para o agente saber que uma trigger/helper tambem foi exercitada.
const otherClassesTouched = covList
  .filter((c) => (c.name || c.Name) !== className)
  .map((c) => ({ name: c.name || c.Name, coveredPercent: c.coveredPercent }));

let coveredPercent = null;
let totalLines = null;
let coveredLines = null;
let uncoveredLines = [];

if (entry) {
  const lines = entry.lines || {};
  const nums = Object.keys(lines);
  uncoveredLines = nums
    .filter((n) => Number(lines[n]) === 0)
    .map(Number)
    .sort((a, b) => a - b);
  totalLines = entry.totalLines ?? nums.length;
  coveredLines = entry.totalCovered ?? nums.length - uncoveredLines.length;
  coveredPercent =
    entry.coveredPercent ?? (totalLines ? Math.round((coveredLines / totalLines) * 100) : null);
}

emit(
  {
    phase: 'test',
    deploySucceeded: willDeploy ? true : undefined,
    testOutcome: summary.outcome || (failures.length ? 'Failed' : 'Passed'),
    testsRan: summary.testsRan ?? tests.length,
    passing: summary.passing,
    failing: summary.failing ?? failures.length,
    failures,
    // Metodos lentos (>= slowMs) — fragilidade de CPU latente, NAO falha. Dividir
    // antes de concluir (passo 4 do SKILL.md). Ausente quando nenhum passou do limiar.
    slowTests: slowTests.length ? slowTests : undefined,
    slowMs: slowTests.length ? slowMs : undefined,
    class: className,
    coverageFound: !!entry,
    coveredPercent,
    totalLines,
    coveredLines,
    uncoveredLines,
    // Se a classe nao apareceu na cobertura, liste o que apareceu (ajuda a
    // diagnosticar nome errado, trigger, ou teste que nao exercita a classe).
    availableCoverage: entry ? undefined : covList.map((c) => c.name || c.Name),
    otherClassesTouched: otherClassesTouched.length ? otherClassesTouched : undefined,
  },
  failures.length || !entry ? 1 : 0
);
