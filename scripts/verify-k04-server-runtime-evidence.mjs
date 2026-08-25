#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK04ServerCandidate } from './verify-k04-server-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k04-server-runtime-contract.v0.1.json');
const DEFAULT_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-server-runtime-v0.1.json');

export async function verifyK04ServerRuntimeEvidence(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const evidencePath = path.resolve(options.evidencePath ?? DEFAULT_EVIDENCE_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const report = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K04_SERVER_RUNTIME_ROOT_MISMATCH');
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K04_SERVER_RUNTIME_CONTRACT_MISMATCH');
  const current = await verifyK04ServerCandidate({ sourcePath: path.join(ROOT, contract.sourcePath), specPath: path.join(ROOT, contract.specPath) });
  const rounds = report.runtime?.rounds ?? [];
  const admitted = report.format === 'rcl.k04.server-runtime-evidence.v0.1'
    && report.status === 'PASS'
    && current.status === 'PASS'
    && report.runtime.manifestRoot === current.manifestRoot
    && rounds.length === contract.requiredRounds
    && rounds.every((round) => round.status === 'PASS' && round.manifestRoot === current.manifestRoot)
    && report.runtime.successfulRounds === contract.requiredRounds
    && report.performance?.status === 'PASS'
    && report.performance.transactionSamples?.length === contract.requiredRounds
    && report.performance.transactionP95Ms <= contract.budgets.transactionP95Ms
    && report.performance.startupProxyP95Ms <= contract.budgets.startupMs
    && Object.values(report.gates ?? {}).every((gate) => gate === 'PASS');
  return { admitted, status: admitted ? 'PASS_ROOTED_LOOPBACK_SERVER_RUNTIME' : 'FAIL_SERVER_RUNTIME', reportRoot: report.reportRoot, verifiedAt: report.generatedAt, manifestRoot: current.manifestRoot, performance: report.performance, eligibleCells: contract.eligibleCells, evidencePath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await verifyK04ServerRuntimeEvidence();
  console.log(JSON.stringify(result, null, 2));
  if (!result.admitted) process.exitCode = 1;
}
