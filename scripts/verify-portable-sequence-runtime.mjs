#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { createPortableNativeTarget } from '../src/portable-native-vm.mjs';
import { readSelfHostedCompilerSource } from '../src/selfhost-compiler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const targets = [], seen = new Set();
let reportPath = path.join(ROOT, 'output/portable-sequence-parity.json');
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index], value = process.argv[index + 1];
  if (!value || value.startsWith('--') || !['--target', '--report'].includes(flag) || (flag === '--report' && seen.has(flag))) throw Error('RCL_PORTABLE_SEQUENCE_ARGUMENT_INVALID');
  seen.add(flag);
  if (flag === '--target') {
    if (!['windows', 'wasm-vm', 'linux'].includes(value) || targets.includes(value)) throw Error('RCL_PORTABLE_SEQUENCE_ARGUMENT_INVALID');
    targets.push(value);
  } else reportPath = path.resolve(value);
}
if (!targets.length) targets.push(process.platform === 'win32' ? 'windows' : 'linux');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-portable-sequence-'));
const report = { format: 'rcl.portable-sequence-parity.v1', ok: true,
  sourceSha256: sha(fs.readFileSync(path.join(ROOT, 'native/rclvm.c'))), compilerArtifactSha256: sha(fs.readFileSync(path.join(ROOT, 'selfhost/compiler.rbc'))), targets: [],
  boundary: 'Local native/WASI/WSL execution and exact byte/state checks. No Android/device, GPU, K400-cell, portable latency, or security-sandbox acceptance.' };
function manifest(file, artifacts) {
  const value = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const source of value.sources) assert.equal(sha(fs.readFileSync(path.join(ROOT, source.path))), source.sha256, source.path);
  for (const [artifact, digest] of artifacts(value)) assert.equal(sha(fs.readFileSync(path.join(ROOT, artifact))), digest, artifact);
  return { file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) };
}
const programs = [
  ['ordered', `reality Ordered {
    reckon build(n : Number, values : Sequence) -> Sequence = choose(n == 4096, values, build(n + 1, sequence_concat(values, sequence_append(empty_sequence(), n))))
    facet values : Sequence = build(0, empty_sequence())
    facet count : Number = length(values)
    facet label : Text = "RCL🦊中文"
  }`],
  ['aliases', `reality Aliases {
    facet seed : Sequence = sequence_append(sequence_append(empty_sequence(), 1), "🦊")
    facet pair : Sequence = sequence_concat(seed, seed)
    facet nested : Sequence = sequence_append(sequence_concat(pair, seed), pair)
    facet equal : Truth = sequence_concat(seed, seed) == pair
    facet position : Span = make_span(0, 2, 3, 4)
    facet token : Token = make_token("IDENT", "field", position)
    facet metadata : Sequence = sequence_concat(sequence_append(empty_sequence(), token), sequence_append(empty_sequence(), position))
  }`],
  ['release', `reality Release {
    reckon left(n : Number, values : Sequence) -> Number = choose(n == 50000, length(values), left(n + 1, sequence_concat(values, sequence_append(empty_sequence(), n))))
    reckon right(n : Number, values : Sequence) -> Number = choose(n == 50000, length(values), right(n + 1, sequence_concat(sequence_append(empty_sequence(), n), values)))
    facet left : Number = left(0, empty_sequence())
    facet right : Number = right(0, empty_sequence())
  }`],
];
try {
  for (const environment of targets) {
    const entry = { environment, ok: false, checks: [], manifests: [] }; report.targets.push(entry);
    let target;
    try {
      if (environment === 'linux') entry.manifests.push(manifest('native/linux/build-manifest.json', value => [['native/linux/rclvm', value.binary.sha256], ['native/linux/rclc', value.compiler.sha256]]));
      if (environment === 'wasm-vm') entry.manifests.push(manifest('native/wasi/build-manifest.json', value => [['native/wasi/rclvm.wasm', value.wasm.sha256]]));
      target = createPortableNativeTarget(environment); entry.binding = target.binding;
      for (const [name, source] of programs) {
        const input = path.join(directory, `${environment}-${name}.rcl`), output = path.join(directory, `${environment}-${name}.rbc`), bytes = compileRealityToBytecode(source);
        fs.writeFileSync(input, source);
        const compiled = target.compile(input, output); assert.deepEqual(compiled.bytecode, bytes);
        const expected = runNativeBytecode(bytes, { stateRootAlgorithm: 'rcl.semantic-state-root.v2' });
        const actual = target.execute(output, expected.sourceRoot).result;
        assert.deepEqual(actual.state, expected.state); assert.equal(actual.stateRoot, expected.stateRoot);
        if (name === 'ordered') assert.deepEqual(actual.state.values, Array.from({ length: 4096 }, (_, i) => i));
        if (name === 'release') { assert.equal(actual.state.left, 50000); assert.equal(actual.state.right, 50000); }
        if (name === 'aliases') assert.equal(actual.state.equal, true);
        entry.checks.push({ name, bytecodeSha256: sha(bytes), stateRoot: actual.stateRoot, compileMs: compiled.ms });
      }
      for (const [name, source, code] of [
        ['overflow', 'reality Overflow { reckon grow(n : Number, values : Sequence) -> Number = choose(n == 0, length(values), grow(n - 1, sequence_concat(values, values))) facet count : Number = grow(64, sequence_append(empty_sequence(), 1)) }', 'RCL_NATIVE_OOM'],
        ['divide-zero', 'reality Divide { facet value : Number = 1 / 0 }', 'RCL_NATIVE_DIVIDE_ZERO'],
      ]) {
        const file = path.join(directory, `${environment}-${name}.rbc`); fs.writeFileSync(file, compileRealityToBytecode(source));
        assert.throws(() => target.execute(file), error => error.message.includes(code));
        entry.checks.push({ name, rejectedWith: code });
      }
      if (environment === 'wasm-vm') {
        entry.manifests.push(manifest('native/wasi-compiler/build-manifest.json', value => [['native/wasi-compiler/rclc.wasm', value.binary.sha256]]));
        const source = path.join(directory, 'full-compiler.rcl'), expected = fs.readFileSync(path.join(ROOT, 'selfhost/compiler.rbc'));
        fs.writeFileSync(source, readSelfHostedCompilerSource());
        let input = path.join(ROOT, 'selfhost/compiler.rbc');
        for (let generation = 1; generation <= 2; generation++) {
          const output = path.join(directory, `wasi-c${generation}.rbc`);
          const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-sequence-wasi-compiler.mjs'), path.join(ROOT, 'native/wasi-compiler/rclc.wasm'), input, source, output], { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
          assert.equal(run.status, 0, run.stderr + run.stdout); assert.deepEqual(fs.readFileSync(output), expected);
          entry.checks.push({ name: `wasi-native-self-compilation-${generation}`, bytecodeSha256: sha(expected), metrics: JSON.parse(run.stdout) }); input = output;
        }
      }
      entry.ok = true;
    } catch (error) { report.ok = false; entry.error = { code: error.code ?? null, message: error.message }; }
    finally { target?.dispose(); }
  }
} finally {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); assert.ok(path.basename(directory).startsWith('rcl-portable-sequence-'));
  fs.rmSync(directory, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: report.ok, targets: report.targets.map(item => ({ environment: item.environment, ok: item.ok, checks: item.checks.length, error: item.error })), reportPath }));
if (!report.ok) process.exitCode = 1;
