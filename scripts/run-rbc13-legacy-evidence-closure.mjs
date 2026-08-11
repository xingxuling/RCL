#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRbc13LegacyEvidenceClosure,
  renderRbc13LegacyEvidenceClosureMarkdown,
} from '../src/rbc13-legacy-evidence-closure.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-legacy-evidence-closure'));
const report = buildRbc13LegacyEvidenceClosure({ root: ROOT });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'docs', 'A3_LEGACY_EVIDENCE_CLOSURE_REPORT_v0.1.md'), renderRbc13LegacyEvidenceClosureMarkdown(report));
process.stdout.write(`${JSON.stringify({
  output: path.join(outputDir, 'report.json'),
  status: report.status,
  root: report.root,
  expectedCaseCount: report.summary.expectedCaseCount,
  verifiedReceiptCount: report.summary.verifiedReceiptCount,
  missing: report.summary.missing,
  duplicate: report.summary.duplicate,
  stale: report.summary.stale,
  altered: report.summary.altered,
  replayMismatches: report.summary.replayMismatches,
}, null, 2)}\n`);
if (report.status !== 'VERIFIED') process.exitCode = 2;
