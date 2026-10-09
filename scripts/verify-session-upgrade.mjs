#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { compileRealitySessionNative } from '../src/session-compiler.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const count = 50;
const baselineIndex = process.argv.indexOf('--baseline-daemon');
const baselinePath = baselineIndex >= 0 ? path.resolve(process.argv[baselineIndex + 1]) : null;
const baselineCommit = 'afe83b231754e8ae3adeb8058356e87165f7ad91';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-upgrade-'));
const source = `reality SessionUpgradeProbe {
  input delta : Number = 1
  facet value : Number = 0
  subject worker { warrant value.write on value }
  emergence increment {
    cause worker when true needs value.write on value
    alter value <- value + delta preserve value <= 200
    witness "upgrade:increment"
  }
  realize increment
}`;
const legacySource = source.replace('input delta', 'facet delta');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let session;
try {
  let baseline = null;
  if (baselinePath) {
    const program = path.join(directory, 'baseline.rbc');
    const bytecode = compileRealityToBytecode(legacySource); fs.writeFileSync(program, bytecode);
    const run = spawnSync(baselinePath, [program], {
      input: Array(count).fill('RUN').concat('QUIT', '').join('\n'), encoding: 'utf8', timeout: 30_000,
      windowsHide: true, env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2' },
    });
    if (run.status !== 0) throw new Error('RCL_UPGRADE_BASELINE_PROCESS_FAILED:' + run.stderr);
    const messages = run.stdout.trim().split('\n').map(JSON.parse);
    const values = messages.slice(1).map(message => message.result?.state?.value);
    if (values.length !== count || !values.every(value => value === 1)) throw new Error('RCL_UPGRADE_BASELINE_PROFILE_CHANGED');
    baseline = { profile: 'v1.0-native-daemon-RUN', commit: baselineCommit, binaryRoot: hash(fs.readFileSync(baselinePath)),
      vm: messages[0].vm, sourceHash: hash(Buffer.from(legacySource)), bytecodeRoot: hash(bytecode),
      commands: count, values, finalValue: values.at(-1) };
  }
  const compiled = compileRealitySessionNative(source);
  session = await createNativeRealitySession(source, { bytecode: compiled.bytecode });
  const values = [], elapsed = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    const result = await session.invoke({ rule: 'increment', inputs: { delta: 1 } });
    elapsed.push(performance.now() - start); values.push(result.state.value);
    if (result.state.value !== i + 1) throw new Error('RCL_UPGRADE_SESSION_CONTINUITY_FAILED');
  }
  const sorted = [...elapsed].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(count * 0.95) - 1];
  if (p95 > 100) throw new Error('RCL_UPGRADE_SESSION_INVOCATION_BUDGET_EXCEEDED:' + p95);
  const report = {
    format: 'rcl.session-capability-upgrade.v1', status: 'PASS', baseline,
    current: { profile: 'v2.0-native-governed-session', commands: count, values, finalValue: values.at(-1),
      sourceHash: hash(Buffer.from(source)), compiler: compiled.evidence, native: session.snapshot().native,
      latencyScope: 'warm parent API invocation including native IPC and independent root verification',
      latencyMs: { p50: sorted[Math.floor(count / 2)], p95, maximum: sorted.at(-1), budgetP95: 100 } },
    demonstratedCapability: 'initialize once and retain admitted state across named native invocations',
    generalizationClaimed: false, k400CellsPromoted: false,
  };
  const output = path.join(ROOT, 'output/v2.0/session-upgrade.json'); fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, baselineFinalValue: baseline?.finalValue ?? null, currentFinalValue: values.at(-1),
    p95Ms: p95, sourceBound: report.current.native.sourceBound, output }, null, 2));
} finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
