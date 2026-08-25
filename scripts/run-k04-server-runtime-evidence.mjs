#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK04ServerCandidate } from './verify-k04-server-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k04-server-runtime-contract.v0.1.json');
const OUTPUT_PATH = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-server-runtime-v0.1.json'));

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
const sourcePath = path.join(ROOT, contract.sourcePath);
const specPath = path.join(ROOT, contract.specPath);
const rounds = [];
for (let index = 0; index < contract.requiredRounds; index += 1) {
  const started = performance.now();
  const verification = await verifyK04ServerCandidate({ sourcePath, specPath });
  rounds.push({
    index,
    status: verification.status,
    reportRoot: verification.reportRoot,
    manifestRoot: verification.manifestRoot,
    transactionElapsedMs: verification.transactionElapsedMs,
    fullReplayElapsedMs: performance.now() - started,
  });
}
const transactionSamples = rounds.map((round) => round.transactionElapsedMs);
const fullReplaySamples = rounds.map((round) => round.fullReplayElapsedMs);
const transactionP95Ms = percentile(transactionSamples, 0.95);
const startupProxyP95Ms = percentile(fullReplaySamples, 0.95);
const pass = rounds.length === contract.requiredRounds
  && rounds.every((round) => round.status === 'PASS')
  && new Set(rounds.map((round) => round.manifestRoot)).size === 1
  && transactionP95Ms <= contract.budgets.transactionP95Ms
  && startupProxyP95Ms <= contract.budgets.startupMs;
const payload = {
  format: 'rcl.k04.server-runtime-evidence.v0.1',
  generatedAt: new Date().toISOString(),
  status: pass ? 'PASS' : 'FAIL',
  contractRoot: evidenceRoot(contract),
  eligibleCells: contract.eligibleCells,
  runtime: {
    host: `${process.platform}-${process.arch}`,
    node: process.version,
    transport: 'HTTP_LOOPBACK_127_0_0_1_EPHEMERAL_PORT',
    rounds,
    successfulRounds: rounds.filter((round) => round.status === 'PASS').length,
    manifestRoot: rounds[0]?.manifestRoot ?? null,
  },
  performance: {
    transactionSamples,
    fullReplaySamples,
    transactionP95Ms,
    startupProxyP95Ms,
    transactionP95BudgetMs: contract.budgets.transactionP95Ms,
    startupProxyP95BudgetMs: contract.budgets.startupMs,
    status: pass ? 'PASS' : 'FAIL',
  },
  gates: {
    EXECUTE: pass ? 'PASS' : 'FAIL',
    CORRECT: pass ? 'PASS' : 'FAIL',
    ROBUST: pass ? 'PASS' : 'FAIL',
    PERFORMANCE: pass ? 'PASS' : 'FAIL',
    EVIDENCE: pass ? 'PASS' : 'FAIL'
  },
  evidenceBoundary: contract.evidenceBoundary,
};
const report = { ...payload, reportRoot: evidenceRoot({ ...payload, generatedAt: undefined }) };
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, reportRoot: report.reportRoot, successfulRounds: report.runtime.successfulRounds, performance: report.performance, outputPath: OUTPUT_PATH }, null, 2));
if (!pass) process.exitCode = 1;
