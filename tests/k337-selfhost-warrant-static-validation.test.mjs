import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { compileSourceSelfHosted, readSelfHostedCompilerSource } from '../src/selfhost-compiler.mjs';

function withCandidateCompiler(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-static-warrant-'));
  try {
    const compilerPath = path.join(dir, 'compiler-c0.rbc');
    fs.writeFileSync(compilerPath, Buffer.from(compileRealityToBytecode(readSelfHostedCompilerSource())));
    return run(compilerPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function source({ warrant = 'world.write on world', need = 'world.write on world', actor = 'builder' } = {}) {
  return `reality StaticWarrant {
    facet world.value : Number = 0
    subject builder { warrant ${warrant} }
    emergence change {
      cause ${actor}
      when true
      needs ${need}
      alter world.value <- 1
    }
  }`;
}

test('K337 self-host candidate statically accepts an exact subject warrant', { timeout: 120_000 }, () => {
  withCandidateCompiler((compilerArtifactPath) => {
    const input = source();
    assert.deepEqual(
      compileSourceSelfHosted(input, { compilerArtifactPath }),
      compileRealityToBytecode(input),
    );
  });
});

test('K337 self-host candidate rejects a missing required warrant before target RBC emission', { timeout: 120_000 }, () => {
  withCandidateCompiler((compilerArtifactPath) => {
    const input = source({ warrant: 'world.read on world' });
    assert.throws(() => compileRealityToBytecode(input), /lacks warrant/u);
    assert.throws(
      () => compileSourceSelfHosted(input, { compilerArtifactPath }),
      /world\.write@world:change/u,
    );
  });
});

test('K337 self-host candidate preserves hierarchical warrant target matching', { timeout: 120_000 }, () => {
  withCandidateCompiler((compilerArtifactPath) => {
    const covered = source({ need: 'world.write on world.child' });
    assert.deepEqual(
      compileSourceSelfHosted(covered, { compilerArtifactPath }),
      compileRealityToBytecode(covered),
    );

    const outside = source({ warrant: 'world.write on world.child', need: 'world.write on world' });
    assert.throws(() => compileRealityToBytecode(outside), /lacks warrant/u);
    assert.throws(
      () => compileSourceSelfHosted(outside, { compilerArtifactPath }),
      /world\.write@world:change/u,
    );
  });
});

test('K337 self-host candidate rejects an unknown causing subject during static validation', { timeout: 120_000 }, () => {
  withCandidateCompiler((compilerArtifactPath) => {
    const input = source({ actor: 'intruder' });
    assert.throws(() => compileRealityToBytecode(input), /Unknown causing subject/u);
    assert.throws(
      () => compileSourceSelfHosted(input, { compilerArtifactPath }),
      /intruder/u,
    );
  });
});
