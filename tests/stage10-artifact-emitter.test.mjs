import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapCompilerStage10,
  bootstrapCompilerStage11,
  decodeBytecode,
  runNativeBytecode,
  runReality,
  runRealityNative,
} from '../src/index.mjs';

const hexBytesProbe = `
reality HexBytesProbe {
  facet bytes.magic : Sequence = hex_bytes("52434c42")
  facet bytes.length : Number = length(bytes.magic)
  facet bytes.valid : Truth =
    semantic_assert(
      bytes.length == 4
        and sequence_get(bytes.magic, 0) == 82
        and sequence_get(bytes.magic, 1) == 67
        and sequence_get(bytes.magic, 2) == 76
        and sequence_get(bytes.magic, 3) == 66,
      "RCL_HEX_BYTES_PROBE_FAILED",
      "hex-bytes-probe",
      make_span(0, 1, 1, 0))
}
`;

test('hex_bytes decodes byte sequences in JS and native runtimes', async () => {
  const reference = await runReality(hexBytesProbe);
  const native = runRealityNative(hexBytesProbe);

  assert.deepEqual(reference.state['bytes.magic'], [82, 67, 76, 66]);
  assert.deepEqual(native.state['bytes.magic'], [82, 67, 76, 66]);
  assert.equal(reference.state['bytes.valid'], true);
  assert.equal(native.state['bytes.valid'], true);
});

test('Stage-10 RCL artifact emits the next compiler RBC in native VM', () => {
  const report = bootstrapCompilerStage10({ write: false });
  const decodedEmitter = decodeBytecode(report.emitterArtifact);

  assert.equal(report.stage, 'compiler-artifact-emitter-v0.20');
  assert.equal(report.emittedCompilerMatchesExpected, true);
  assert.equal(report.emittedCompilerExecutes, true);
  assert.equal(decodedEmitter.instructions.some(instruction => instruction.builtin === 'HEX_BYTES'), true);
  assert.deepEqual(report.emittedCompilerArtifact, report.stage9.compilerArtifactN);

  const emittedRun = runNativeBytecode(report.emittedCompilerArtifact);
  assert.equal(emittedRun.status, 'ok');
  assert.equal(emittedRun.state['compiler.fixedpoint_signature_supported'], true);
});

test('Stage-11 RCL artifact structurally re-encodes the next compiler RBC in native VM', () => {
  const report = bootstrapCompilerStage11({ write: false });
  const decodedEmitter = decodeBytecode(report.emitterArtifact);
  const builtins = new Set(decodedEmitter.instructions.map(instruction => instruction.builtin).filter(Boolean));

  assert.equal(report.stage, 'structured-compiler-artifact-emitter-v0.21');
  assert.equal(report.emittedCompilerMatchesExpected, true);
  assert.equal(report.emittedCompilerExecutes, true);
  assert.equal(builtins.has('HEX_BYTES'), false);
  assert.equal(builtins.has('BYTES_U32LE'), true);
  assert.equal(builtins.has('BYTES_I32LE'), true);
  assert.equal(builtins.has('BYTES_F64LE'), true);
  assert.deepEqual(report.emittedCompilerArtifact, report.stage9.compilerArtifactN);

  const emittedRun = runNativeBytecode(report.emittedCompilerArtifact);
  assert.equal(emittedRun.status, 'ok');
  assert.equal(emittedRun.state['compiler.fixedpoint_signature_supported'], true);
});
