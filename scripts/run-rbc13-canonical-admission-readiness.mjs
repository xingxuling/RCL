#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRbc13CanonicalAdmissionReadiness } from '../src/rbc13-canonical-admission-readiness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const explicitOutput = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const outputPath = path.resolve(explicitOutput ?? path.join(ROOT, 'output', 'rbc13-canonical-admission-readiness', 'report.json'));

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
}

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const input = {
  number: read('output/rbc13-number-encoding-v2/corpus-report.json'),
  native: read('output/rbc13-domain-native-promotion/native-promotion-final-2026-08-09.json'),
  performance: read('output/rbc13-execution-benchmark/report.json'),
  aiGenerate: read('output/rbc13-ai-generate-json-schema/report.json'),
  aiThreshold: read('output/rbc13-ai-assimilation-threshold/ai_assimilation_threshold_results.json'),
  universal: read('output/universal-stress-rbc13-domain/wasm-vm-algorithm-candidate.json'),
  growthCell: read('output/rbc13-universal-growth-cell/report.json'),
  legacyClosure: read('output/rbc13-legacy-evidence-closure/report.json'),
  legacy: {
    v1FocusedStatus: arg('legacy-v1', 'UNVERIFIED'),
    v1FocusedRoot: arg('legacy-v1-root', null),
    fullSuiteStatus: arg('legacy-full', 'UNVERIFIED'),
    fullSuiteRoot: arg('legacy-full-root', null),
  },
  selfhost: {
    fixedpointStatus: arg('selfhost-fixedpoint', 'UNVERIFIED'),
    fixedpointRoot: arg('selfhost-fixedpoint-root', null),
    examplesStatus: arg('selfhost-examples', 'UNVERIFIED'),
    examplesRoot: arg('selfhost-examples-root', null),
    stage40Status: arg('selfhost-stage40', 'UNVERIFIED'),
    stage40Root: arg('selfhost-stage40-root', null),
  },
  versionContract: {
    status: arg('version-contract', 'UNVERIFIED'),
    root: arg('version-contract-root', null),
  },
};

const report = buildRbc13CanonicalAdmissionReadiness(input);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, verdict: report.verdict, canonicalReady: report.canonicalReady, blockingGates: report.blockingGates, root: report.root }, null, 2));
