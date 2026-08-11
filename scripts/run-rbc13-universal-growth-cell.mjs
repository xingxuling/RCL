#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRbc13UniversalGrowthCell,
  renderRbc13UniversalGrowthCellMarkdown,
} from '../src/rbc13-universal-growth-cell.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-universal-growth-cell'));
const report = buildRbc13UniversalGrowthCell({ root: ROOT });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'docs', 'RBC13_FIRST_UNIVERSAL_GROWTH_CELL_v0.1.md'), renderRbc13UniversalGrowthCellMarkdown(report));
process.stdout.write(`${JSON.stringify({
  output: path.join(outputDir, 'report.json'),
  status: report.status,
  root: report.root,
  workload: report.workload.id,
  native: report.native.status,
  wasmVm: report.wasmVmSupport.compile.status,
  blockerClass: report.blockerClass,
  universalGrowthEligible: report.universalGrowthEligible,
}, null, 2)}\n`);
if (report.status !== 'VERIFIED') process.exitCode = 2;
