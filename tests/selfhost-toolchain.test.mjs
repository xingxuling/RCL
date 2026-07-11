import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH,
  compileSourceSelfHosted,
  readSelfHostedCompilerSource,
} from '../src/selfhost-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('checked-in self-hosted compiler artifact is its current JS bootstrap fixed point', () => {
  assert.equal(fs.existsSync(DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH), true);
  const source = readSelfHostedCompilerSource();
  const reference = Buffer.from(compileRealityToBytecode(source));
  assert.deepEqual(fs.readFileSync(DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH), reference);
});

test('production self-hosted compiler compiles core and transactional rule programs', { timeout: 120_000 }, () => {
  for (const relative of [
    'examples/selfhost-core/reckon-choose.rcl',
    'examples/selfhost-core/emergence-multi.rcl',
    'examples/selfhost-core/resonance-multi.rcl',
    'examples/rcl-native-absorption-kernel.rcl',
    'examples/whole-language-parser-target.rcl',
    'examples/selfhost-core/dynamic-provider-v12.rcl',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.deepEqual(compileSourceSelfHosted(source), compileRealityToBytecode(source), relative);
  }
});

test('production self-hosted compiler rejects invalid native-core sources', { timeout: 120_000 }, () => {
  for (const source of [
    'realty Misspelled { facet world.value : Number = 1 }',
    'reality Trailing { facet world.value : Number = 1 } trailing',
    'reality Unclosed { facet world.value : Number = 1',
    'reality UnknownTop { mystery unsupported }',
    'reality UnknownPath { facet world.value : Number = missing.value }',
    'reality UnknownCall { facet world.value : Number = missing_call(1) }',
    'reality WrongLiteral { facet world.value : Number = "one" }',
    'reality UnsupportedNative { physical universe { } }',
  ]) {
    assert.throws(() => compileRealityToBytecode(source));
    assert.throws(() => compileSourceSelfHosted(source));
  }
});

test('production self-hosted compiler selects RBC 1.2 only for feature instructions', { timeout: 120_000 }, () => {
  const dynamic = decodeBytecode(compileSourceSelfHosted(fs.readFileSync(path.join(ROOT, 'examples/selfhost-core/dynamic-provider-v12.rcl'), 'utf8')));
  assert.equal(dynamic.version.minor, 2);
  assert.ok(dynamic.instructions.some(instruction => instruction.op === 35 && instruction.flags === 1));

  const literal = decodeBytecode(compileSourceSelfHosted('reality LiteralProvider { facet provider.reply : Text = provider_call("echo", "echo.text", "request") }'));
  assert.equal(literal.version.minor, 1);
  assert.ok(literal.instructions.some(instruction => instruction.op === 35 && instruction.flags === 0));

  const mod = decodeBytecode(compileSourceSelfHosted('reality ModFeature { facet math.value : Number = 11 % 4 }'));
  assert.equal(mod.version.minor, 2);
  assert.ok(mod.instructions.some(instruction => instruction.op === 44));
});
