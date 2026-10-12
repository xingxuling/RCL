import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortableNativeTarget } from '../src/index.mjs';
import { compileReality } from '../src/compiler.mjs';

test('portable public API exposes explicit targets and rejects unknown targets', () => {
  assert.throws(() => createPortableNativeTarget('invented-runtime'), /TARGET_UNSUPPORTED/u);
});

test('portable WASI API compiles with the RCL compiler and rejects another program root', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-portable-api-'));
  const target = createPortableNativeTarget('wasm-vm');
  try {
    const source = 'reality PortableApi { facet value : Number = 1.5 }';
    const file = path.join(directory, 'source.rcl'), artifact = path.join(directory, 'source.rbc');
    fs.writeFileSync(file, source); const compiled = target.compile(file, artifact);
    assert.ok(compiled.bytecode.length > 0);
    const execution = target.execute(artifact, compileReality(source).programRoot);
    assert.equal(execution.result.state.value, 1.5);
    assert.throws(() => target.execute(artifact, '0'.repeat(64)), /SOURCE_ROOT_MISMATCH/u);
  } finally { target.dispose(); fs.rmSync(directory, { recursive: true, force: true }); }
});
