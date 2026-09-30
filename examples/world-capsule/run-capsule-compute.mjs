import fs from 'node:fs';
import { runReality } from '../../src/runtime.mjs';
import { expandResourceChoice } from './capsule-compute.mjs';

const expanded = expandResourceChoice({ available: 20, required: 30, confirmedCredit: 10 });
const result = await runReality(expanded.source);
if (!result.history.length || result.history.some(h => h.status !== 'realized' || h.hostCalls.length)) throw new Error('COMPUTATION_NOT_REALIZED');
const report = {
  schema: 'rcl.capsule-compute-evidence.v0.1', generatedAt: new Date().toISOString(),
  spec: expanded.spec, evidence: expanded.evidence,
  selected: expanded.graph.selected.map(c => c.id),
  outputs: Object.fromEntries(Object.entries(result.state).filter(([k]) => k.startsWith('result.'))),
  history: result.history.map(h => ({ rule:h.rule, status:h.status, witnesses:h.witnesses, hostCalls:h.hostCalls })),
  boundary: 'bounded numerical inference; no training, language understanding, native binary execution or external provider'
};
fs.writeFileSync(new URL('./resource-choice-expanded.rcl', import.meta.url), expanded.source + '\n');
fs.writeFileSync(new URL('./capsule-compute-evidence.json', import.meta.url), JSON.stringify(report,null,2) + '\n');
console.log(JSON.stringify(report,null,2));
