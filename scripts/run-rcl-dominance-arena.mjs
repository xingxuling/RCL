#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRESS_STATUS,
} from '../src/universal-program-stress.mjs';
import {
  runRclDominanceArena,
} from '../src/rcl-dominance-arena.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.resolve(root, process.argv[2] ?? 'examples/dominance-arena/compiler-toolchain.v0.1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const outputDir = path.resolve(root, process.argv[3] ?? `output/dominance-arena/${manifest.id}`);
const report = runRclDominanceArena(manifest, { repositoryRoot: root });

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, 'dominance-arena-report.json');
const markdownPath = path.join(outputDir, 'dominance-arena-report.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const axisLines = Object.values(report.scorecard.axes)
  .map(axis => `- ${axis.axis}: **${axis.status}** (${axis.passed}/${axis.required} direct units)`)
  .join('\n');
const referenceLines = report.references.length === 0
  ? '- No reference probes declared.'
  : report.references
    .map(reference => `- ${reference.id}: **${reference.status}**${reference.probeOnly ? ' (probe only)' : ''}`)
    .join('\n');
const markdown = [
  `# RCL Dominance Arena: ${report.arena.task.name ?? report.arena.task.id}`,
  '',
  `- Report root: \`${report.reportRoot}\``,
  `- Manifest root: \`${report.arena.manifestRoot}\``,
  `- Source revision: **${report.sourceRevision.value ?? 'UNVERIFIED'}**`,
  `- Candidate command: **${report.candidate.status}**`,
  `- Dominance result: **${report.dominance.status}**`,
  '',
  '## Three-axis scorecard',
  '',
  axisLines,
  '',
  '## Reference probes',
  '',
  referenceLines,
  '',
  '## Boundary',
  '',
  ...report.evidenceBoundary.map(note => `- ${note}`),
  '',
  'The current compiler-toolchain arena executes the RCL K01 verification path. Reference probes establish tool availability only; they are not equivalent compiler workload comparisons.',
  '',
].join('\n');
fs.writeFileSync(markdownPath, markdown, 'utf8');

console.log(JSON.stringify({
  status: report.candidate.status === STRESS_STATUS.PASS ? 'EXECUTED' : report.candidate.status,
  reportRoot: report.reportRoot,
  jsonPath,
  markdownPath,
  axes: Object.fromEntries(Object.entries(report.scorecard.axes).map(([key, value]) => [key, value.status])),
  dominanceComparisons: report.dominance.totalComparisons,
}, null, 2));

if (report.candidate.status === STRESS_STATUS.FAIL || report.candidate.status === STRESS_STATUS.BLOCKED) {
  process.exitCode = 1;
}
