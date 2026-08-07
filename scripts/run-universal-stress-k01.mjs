#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRESS_STATUS,
  evidenceRoot,
} from '../src/universal-program-stress.mjs';
import { runK01SelfhostProbe } from '../src/universal-stress-k01-selfhost-adapter.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'output', 'universal-stress-v0.1', 'K01');
const aiContractPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, 'examples', 'universal-stress', 'k01-ai-generation-contract.json');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildAiEvidence(contract) {
  if (!contract) return null;
  if (contract.schema !== 'rcl.universal-stress.k01.ai-generation-contract.v0.1') {
    throw new Error(`RCL_STRESS_K01_AI_SCHEMA:${contract.schema ?? 'missing'}`);
  }

  const trials = Array.isArray(contract.trials) ? contract.trials : [];
  const successful = trials.filter((trial) =>
    trial.status === STRESS_STATUS.PASS
    && Array.isArray(trial.evidence)
    && trial.evidence.length > 0,
  );

  return {
    status: successful.length >= Number(contract.requiredTrials ?? 3)
      ? STRESS_STATUS.PASS
      : STRESS_STATUS.UNVERIFIED,
    successfulTrials: successful.length,
    requiredTrials: Number(contract.requiredTrials ?? 3),
    evidence: successful.flatMap((trial) => trial.evidence),
    trialIds: trials.map((trial) => ({ id: trial.id, status: trial.status })),
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const aiContract = readJsonIfExists(aiContractPath);
const aiEvidence = buildAiEvidence(aiContract);
const result = runK01SelfhostProbe({
  repositoryRoot: root,
  aiGenerationEvidence: aiEvidence,
});

const payloadWithoutRoot = {
  schema: 'rcl.universal-stress.k01.report.v0.1',
  task: {
    id: 'K01',
    name: 'self-hosting compiler',
    environment: 'compiler-runtime',
    programFamily: 'self-hosting',
  },
  generatedAt: new Date().toISOString(),
  infrastructure: {
    selfhostVerifier: 'scripts/verify-rcl-selfhost-all.mjs',
    aiGenerationContract: path.relative(root, aiContractPath).replaceAll(path.sep, '/'),
  },
  receipt: result.receipt,
  aiGeneration: aiEvidence,
  claim: result.claim,
  status: result.status,
  evidenceBoundary: [
    'K01 means compiler self-hosting, not whole-runtime fullSelfHosting.',
    'A trusted bootstrap/native VM boundary is allowed; the compiler must reproduce itself after bootstrap.',
    'AI_GENERATE remains UNVERIFIED until the declared compiler-evolution trials have independent receipts.',
    'No missing gate is upgraded to PASS.',
  ],
};

const payload = {
  ...payloadWithoutRoot,
  reportRoot: evidenceRoot(payloadWithoutRoot),
};

const jsonPath = path.join(outputDir, 'k01-report.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const gateLines = result.claim
  ? Object.entries(result.claim.gates).map(([name, gate]) => `- ${name}: **${gate.status}** — ${gate.note ?? ''}`)
  : ['- No claim generated: self-host summary was not produced.'];

const markdown = `# RCL Universal Stress K01 — Self-hosting Compiler\n\n`
  + `**Status:** ${payload.status}\n\n`
  + `**Report root:** \`${payload.reportRoot}\`\n\n`
  + `## Gates\n\n${gateLines.join('\n')}\n\n`
  + `## AI generation\n\n`
  + `- Successful compiler-evolution trials: ${aiEvidence?.successfulTrials ?? 0}/${aiEvidence?.requiredTrials ?? 3}\n`
  + `- AI gate: ${aiEvidence?.status ?? STRESS_STATUS.UNVERIFIED}\n\n`
  + `## Boundary\n\n`
  + `K01 does not require the entire RCL runtime/compiler toolchain to be authored in RCL. It requires the RCL-authored compiler artifact to compile its own source after bootstrap, reproduce a byte-identical next generation, execute through the declared native boundary, and preserve behavior.\n`;

const mdPath = path.join(outputDir, 'k01-report.md');
fs.writeFileSync(mdPath, markdown, 'utf8');

console.log(JSON.stringify({
  status: payload.status,
  reportRoot: payload.reportRoot,
  jsonPath,
  markdownPath: mdPath,
  gates: result.claim
    ? Object.fromEntries(Object.entries(result.claim.gates).map(([name, gate]) => [name, gate.status]))
    : null,
}, null, 2));

if (payload.status === STRESS_STATUS.FAIL) process.exitCode = 1;
