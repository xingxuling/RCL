#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, DEFAULT_NATIVE_VM_PATH } from '../src/native-vm.mjs';

let vmPath = DEFAULT_NATIVE_VM_PATH, reportPath = 'output/native-sequence-concat.json', sizes = [4096, 16384];
const seen = new Set();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index], value = process.argv[index + 1];
  if (!['--vm', '--report', '--sizes'].includes(flag) || !value || value.startsWith('--') || seen.has(flag)) throw Error('RCL_SEQUENCE_BENCHMARK_ARGUMENT_INVALID');
  seen.add(flag);
  if (flag === '--vm') vmPath = path.resolve(value);
  if (flag === '--report') reportPath = path.resolve(value);
  if (flag === '--sizes') {
    if (!/^[1-9][0-9]*(,[1-9][0-9]*)*$/u.test(value)) throw Error('RCL_SEQUENCE_BENCHMARK_ARGUMENT_INVALID');
    sizes = value.split(',').map(Number);
    if (sizes.length > 6 || sizes.some(size => !Number.isSafeInteger(size) || size > 100000)) throw Error('RCL_SEQUENCE_BENCHMARK_ARGUMENT_INVALID');
  }
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-sequence-benchmark-'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = {
  format: 'rcl.native-sequence-concat-observation.v1', ok: true,
  vmPath: path.resolve(vmPath), vmSha256: sha(fs.readFileSync(vmPath)), samples: [],
  boundary: 'Local observed durations and exact integer sequence/state checks; no portable latency guarantee or publisher authentication.',
};
try {
  const warmupStarted = performance.now();
  const warmup = runNativeBytecode(compileRealityToBytecode('reality SequenceWarmup { facet value : Number = 1 }'), {
    vmPath, timeout: 60000, stateRootAlgorithm: 'rcl.semantic-state-root.v2',
  });
  report.warmup = { elapsedMs: performance.now() - warmupStarted, matches: warmup.state.value === 1 };
  report.ok &&= report.warmup.matches;
  for (const size of sizes) {
    const source = `reality ConcatWorkload {
      reckon build(index : Number, values : Sequence) -> Sequence = choose(index >= ${size}, values,
        build(index + 1, sequence_concat(values, sequence_append(empty_sequence(), index))))
      facet stream : Sequence = build(0, empty_sequence())
      facet count : Number = length(stream)
      facet first : Number = sequence_get(stream, 0)
      facet last : Number = sequence_get(stream, ${size - 1})
    }`;
    const bytes = compileRealityToBytecode(source), bytecodePath = path.join(directory, `concat-${size}.rbc`);
    fs.writeFileSync(bytecodePath, bytes);
    const started = performance.now();
    const result = runNativeBytecode(bytecodePath, { vmPath, timeout: 60000, stateRootAlgorithm: 'rcl.semantic-state-root.v2' });
    const elapsedMs = performance.now() - started;
    const matches = result.state.count === size && result.state.first === 0 && result.state.last === size - 1
      && Array.isArray(result.state.stream) && result.state.stream.length === size
      && result.state.stream.every((value, index) => value === index);
    report.ok &&= matches;
    report.samples.push({ size, elapsedMs, matches, stateRoot: result.semanticStateRoot ?? result.stateRoot,
      sourceSha256: sha(source), bytecodeSha256: sha(bytes), executedInstructions: result.metrics?.instructions ?? null });
  }
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
