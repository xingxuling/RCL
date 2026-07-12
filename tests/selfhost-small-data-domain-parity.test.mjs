import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from '../src/bytecode.mjs';
import { compileSourceSelfHosted } from '../src/selfhost-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assertSelfhostParity(source) {
  const expected = Buffer.from(compileRealityToBytecode(source));
  const actual = Buffer.from(compileSourceSelfHosted(source));
  assert.deepEqual(actual, expected);
  return decodeBytecode(actual);
}

test('self-hosted compiler is byte-identical for the small-data domain slice', { timeout: 120_000 }, () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'small-data-agent.rcl'), 'utf8');
  const program = assertSelfhostParity(source);

  assert.deepEqual(program.version, { major: 1, minor: 3 });
  assert.equal(program.instructions.length, 199);
  assert.ok(program.instructions.some(instruction => instruction.op === OPCODES.DOMAIN_CALL));
});

test('self-hosted quantitative derive lowering uses the projected measurement view', { timeout: 120_000 }, () => {
  const program = assertSelfhostParity(`reality SelfHostQuantitativeDerive {
    facet input.value : Number = 2
    quantitative stats {
      measure sample : Number = input.value
        uncertainty 0.1
        confidence 0.9
        unit "unit"
        scale ratio
        evidence "sample"
        calibrated by "calibration"
      derive doubled : Number = measure_value(stats.sample) * 2
      preserve stats.doubled >= 0
    }
    quantify stats
  }`);

  const projected = program.instructions.findIndex(instruction =>
    instruction.op === OPCODES.SET_PROJECTED_VIEW && instruction.a === 1);
  const derivedStore = program.instructions.findIndex(instruction =>
    instruction.op === OPCODES.STAGE_STORE && program.strings[instruction.a] === 'stats.doubled');
  assert.ok(projected >= 0 && projected < derivedStore);
});

test('self-hosted compiler is byte-identical for the cognition domain slice', { timeout: 120_000 }, () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'cognitive-creation-agent.rcl'), 'utf8');
  const program = assertSelfhostParity(source);

  assert.deepEqual(program.version, { major: 1, minor: 3 });
  assert.ok(program.instructions.some(instruction => instruction.op === OPCODES.AND));
  assert.ok(program.instructions.some(instruction => instruction.op === OPCODES.DOMAIN_CALL));
});
