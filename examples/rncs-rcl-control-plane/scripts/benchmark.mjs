import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_NATIVE_VM_PATH } from '@taowind/reality-computation-language';
import { buildRclControlPlane, replayRuntimeBundle, createEmbeddedRuntimeBundle, LEGACY_MODULES } from '../src/index.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(packageRoot, '../../..');

function legacyScan(iterations) {
  const start = performance.now(); let last;
  for (let i = 0; i < iterations; i += 1) {
    last = Object.fromEntries(Object.entries(LEGACY_MODULES).map(([name, item]) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, item.manifest), 'utf8'));
      return [name, manifest[item.idField ?? 'id'] ?? manifest.format];
    }));
  }
  return { milliseconds: performance.now() - start, last };
}

const compiled = buildRclControlPlane();
const legacy = legacyScan(1000);
const processStart = performance.now();
for (let i = 0; i < 25; i += 1) replayRuntimeBundle(compiled.compiledRuntimeBundle);
const processMs = performance.now() - processStart;

const embedded = createEmbeddedRuntimeBundle(compiled.compiledRuntimeBundle);
await embedded.ready;
const daemonStart = performance.now();
const daemonRuns = [];
for (let i = 0; i < 250; i += 1) daemonRuns.push(await embedded.run({ resetState: i === 0 }));
const daemonMs = performance.now() - daemonStart;
await embedded.close();

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rncs-rcl-bench-'));
const bundlePath = path.join(temp, 'control-plane.rbc');
fs.writeFileSync(bundlePath, compiled.compiledRuntimeBundle.targetBytecode);
const directBinary = path.join(path.dirname(DEFAULT_NATIVE_VM_PATH), process.platform === 'win32' ? 'embedded_benchmark.exe' : 'embedded_benchmark');
const direct = spawnSync(directBinary, [bundlePath, '10000'], { encoding: 'utf8' });
fs.rmSync(temp, { recursive: true, force: true });
if (direct.status !== 0) throw new Error(direct.stderr || `embedded benchmark failed: ${direct.status}`);
const directResult = JSON.parse(direct.stdout);

const report = {
  format: 'rncs.rcl-control-plane.benchmark.v0.2',
  modules: Object.keys(compiled.modules).length,
  legacyManifestScans: { iterations: 1000, milliseconds: legacy.milliseconds, perIterationMs: legacy.milliseconds / 1000 },
  childProcessAotReplay: { iterations: 25, milliseconds: processMs, perRunMs: processMs / 25 },
  longLivedDaemonReplay: { iterations: 250, milliseconds: daemonMs, perRunMs: daemonMs / 250, nativeMedianHintMs: daemonRuns[125].daemonElapsedMs },
  directEmbeddedLibraryReplay: directResult,
  conclusion: 'The performance gain appears only after removing process startup. The direct embedded C library is the authoritative VM-core benchmark; daemon numbers include JSON and IPC overhead.',
};
fs.mkdirSync(path.join(packageRoot, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(packageRoot, 'evidence', 'benchmark-v0.2.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
