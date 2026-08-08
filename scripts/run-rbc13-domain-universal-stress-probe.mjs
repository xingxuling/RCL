import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRbc13DomainUniversalStressCandidateCell } from '../src/rbc13-domain-universal-stress-probe.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const inputPath = path.resolve(process.argv[2] ?? path.join(
  ROOT,
  'output',
  'rbc13-domain-native-promotion',
  'native-promotion-final-2026-08-08.json',
));
const outputPath = path.resolve(process.argv[3] ?? path.join(
  ROOT,
  'output',
  'universal-stress-rbc13-domain',
  'wasm-vm-algorithm-candidate.json',
));

const suite = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const probe = buildRbc13DomainUniversalStressCandidateCell(suite);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(probe, null, 2)}\n`);
console.log(JSON.stringify({
  output: outputPath,
  status: probe.status,
  universalGrowthEligible: probe.universalGrowthEligible,
  specialCaseAudit: probe.cell.specialCaseAudit.status,
  root: probe.root,
}, null, 2));
