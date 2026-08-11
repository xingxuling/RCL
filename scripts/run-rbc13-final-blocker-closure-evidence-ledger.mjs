#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildRbc13FinalBlockerClosureEvidenceLedger,
  renderRbc13FinalBlockerClosureEvidenceLedger,
  renderRbc13PolybodyParityEvidence,
} from '../src/rbc13-final-blocker-closure-evidence-ledger.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = path.join(ROOT, 'output', 'rbc13-final-blocker-closure');
const REPORT_PATH = path.join(OUTPUT_DIR, 'evidence-ledger.json');
const FULL_SUITE_RECEIPT_PATH = path.join(OUTPUT_DIR, 'full-suite-receipt.json');
const LEDGER_PATH = path.join(ROOT, 'docs', 'RBC13_FINAL_BLOCKER_CLOSURE_EVIDENCE_LEDGER_v0.1.md');
const POLYBODY_PATH = path.join(ROOT, 'docs', 'RBC13_POLYBODY_ORGAN_PARITY_EVIDENCE_v0.1.md');

function read(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : {};
}

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const item = process.argv.find(value => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function numberArg(name) {
  const value = Number(arg(name, '0'));
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid --${name}; expected a non-negative integer`);
  return value;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

const fullSuite = {
  status: arg('full-status', 'VERIFIED'),
  total: numberArg('full-total'),
  pass: numberArg('full-pass'),
  fail: numberArg('full-fail'),
  skipped: numberArg('full-skipped'),
  cancelled: numberArg('full-cancelled'),
};
if (fullSuite.total === 0 || fullSuite.fail !== 0 || fullSuite.pass + fullSuite.fail + fullSuite.skipped + fullSuite.cancelled !== fullSuite.total) {
  throw new Error(`Full-suite receipt is not a closed 0-fail count: ${JSON.stringify(fullSuite)}`);
}

const versionContractFiles = ['VERSION-CONTRACT.json', 'COMPONENT-VERSIONS.json', 'DOWNSTREAM-CONSUMERS.json'];
const versionContracts = Object.fromEntries(versionContractFiles.map(file => [file, read(file)]));
const input = {
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  sourceHead: git(['rev-parse', 'HEAD']),
  pullRequest: arg('pull-request', '#39 research/evidence branch'),
  fullSuite,
  number: read('output/rbc13-number-encoding-v2/corpus-report.json'),
  native: read('output/rbc13-domain-native-promotion/native-promotion-final-2026-08-09.json'),
  performance: read('output/rbc13-execution-benchmark/report.json'),
  aiCompatibility: read('output/rbc13-ai-assimilation-compatibility/compatibility_surface_results.json'),
  wasmGrowthCell: read('output/rbc13-wasm-graph-growth-cell/report.json'),
  legacyClosure: read('output/rbc13-legacy-evidence-closure/report.json'),
  versionContract: {
    status: arg('version-status', 'VERIFIED'),
    contracts: versionContracts,
  },
  selfhost: {
    fixedpointStatus: arg('selfhost-fixedpoint-status', 'VERIFIED'),
    examplesReport: read('output/selfhost/example-parity.json'),
    stage40Report: read('output/selfhost/stage40-verification.json'),
  },
};

const report = buildRbc13FinalBlockerClosureEvidenceLedger(input);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(FULL_SUITE_RECEIPT_PATH, `${JSON.stringify(report.fullSuite, null, 2)}\n`);
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
fs.writeFileSync(LEDGER_PATH, renderRbc13FinalBlockerClosureEvidenceLedger(report));
if (report.a12.crossBodyParity) {
  fs.writeFileSync(POLYBODY_PATH, renderRbc13PolybodyParityEvidence(report));
}

process.stdout.write(`${JSON.stringify({
  output: REPORT_PATH,
  ledger: LEDGER_PATH,
  polybody: report.a12.crossBodyParity ? POLYBODY_PATH : null,
  status: report.status,
  blockingGates: report.readiness.blockingGates,
  fullSuite: report.fullSuite,
  root: report.root,
}, null, 2)}\n`);

