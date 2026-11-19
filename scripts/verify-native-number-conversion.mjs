import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { wslPath } from '../src/portable-native-vm.mjs';
import { verifyNativeSemanticStateRoot } from '../src/semantic-state-root.mjs';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'output/selfhost/number-conversion');
const file = path.join(directory, 'corpus.rbc');
const distro = process.env.RCL_K400_WSL_DISTRO ?? 'RCL-K400-Alpine';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const requested = process.argv.slice(2);
const targets = requested.length ? [...new Set(requested)] : ['windows', 'linux', 'wasi'];
assert.ok(targets.every(target => ['windows', 'linux', 'wasi'].includes(target)));
fs.mkdirSync(directory, { recursive: true });

const magnitudeLimit = 0x7ffn << 52n;
const sign = 1n << 63n;
const bits = Buffer.alloc(8);
const values = new Set();
function admit(raw) {
  if (raw < 0n || (raw & (sign - 1n)) >= magnitudeLimit) return;
  bits.writeBigUInt64LE(raw);
  values.add(String(bits.readDoubleLE()));
}
for (let exponent = 0n; exponent < 2047n; exponent++) {
  for (const delta of [-2n, -1n, 0n, 1n, 2n]) admit((exponent << 52n) + delta);
}
let seed = 0x1234567890abcdefn;
for (let index = 0; index < 4096; index++) {
  seed = BigInt.asUintN(64, seed * 6364136223846793005n + 1442695040888963407n);
  admit(seed);
}
const inputs = [...values];
const expectedAlgorithm = 'rcl.semantic-state-root.v2';
const env = { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: expectedAlgorithm };
const vmFiles = {
  windows: 'native/rclvm.exe',
  linux: 'native/linux/rclvm',
  wasi: 'native/wasi/rclvm.wasm',
};
const counts = Object.fromEntries(targets.map(target => [target, { bitMismatches: 0, textMismatches: 0, cases: 0 }]));

function execute(target, bytes) {
  if (target === 'windows') {
    assert.equal(process.platform, 'win32');
    return runNativeBytecode(bytes, { requireNativeStateRoot: true, stateRootAlgorithm: expectedAlgorithm });
  }
  const vm = path.join(root, vmFiles[target]);
  const [command, args] = target === 'linux'
    ? ['wsl.exe', ['-d', distro, '--', 'env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=' + expectedAlgorithm, wslPath(vm), wslPath(file)]]
    : [process.execPath, [path.join(root, 'scripts/run-native-wasi.mjs'), vm, file]];
  const run = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr || run.error?.message);
  return verifyNativeSemanticStateRoot(JSON.parse(run.stdout), { requireNativeRoot: true, expectedAlgorithm });
}

const examples = [];
for (let start = 0; start < inputs.length; start += 256) {
  const batch = inputs.slice(start, start + 256);
  const facets = batch.flatMap((text, index) => [
    `facet value${index} : Number = number_from_text(${JSON.stringify(text)})`,
    `facet text${index} : Text = text(value${index})`,
  ]);
  const bytes = compileRealityToBytecode('reality Binary64Corpus { ' + facets.join(' ') + ' }');
  fs.writeFileSync(file, bytes);
  for (const target of targets) {
    const { state } = execute(target, bytes);
    assert.equal(Object.keys(state).length, batch.length * 2);
    const tally = counts[target];
    tally.cases += batch.length;
    for (const [index, text] of batch.entries()) {
      const parsed = state[`value${index}`], rendered = state[`text${index}`];
      const bitMismatch = !Object.is(parsed, Number(text)), textMismatch = rendered !== text;
      if (bitMismatch) tally.bitMismatches++;
      if (textMismatch) tally.textMismatches++;
      if ((bitMismatch || textMismatch) && examples.length < 20) examples.push({ target, text, parsed, rendered });
    }
  }
}

const report = {
  format: 'rcl.native-number-conversion-corpus.v1',
  ok: Object.values(counts).every(entry => entry.bitMismatches === 0 && entry.textMismatches === 0),
  inputCount: inputs.length,
  inputSha256: sha256(inputs.join('\n')),
  vmSourceSha256: sha256(fs.readFileSync(path.join(root, 'native/rclvm.c'))),
  numberFormatHeaderSha256: sha256(fs.readFileSync(path.join(root, 'native/number_format_ryu.h'))),
  targets: Object.fromEntries(targets.map(target => [target, {
    ...counts[target], executableSha256: sha256(fs.readFileSync(path.join(root, vmFiles[target]))),
  }])),
  exampleMismatches: examples,
};
fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
