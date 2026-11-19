import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { compileReality } from '../src/compiler.mjs';
import { resolveRclCapabilityPolicy } from '../src/absorption-kernel.mjs';
const compiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-metadata-syntax-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const program = declaration => `reality Metadata { ${declaration} }`;
function reject(declaration) {
  const source = program(declaration), input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc'), retained = Buffer.from('retained-metadata-output');
  assert.throws(() => compileRealityToBytecode(source), declaration);
  fs.writeFileSync(input, source); fs.writeFileSync(output, retained);
  assert.throws(() => runNativeCompiler(compiler, input, output), declaration);
  assert.deepEqual(fs.readFileSync(output), retained);
}
test('effects reject unknown or quoted clauses, wrong header and value token types', () => {
  for (const declaration of [
    'effect E { mystery native }', 'effect E { "deterministic" true }',
    'effect "E" {}', 'effect E "{" }', 'effect E { deterministic "true" }',
    'effect E { deterministic maybe }', 'effect E { evidence_required "false" }',
    'effect E { replay fixed }', 'effect E { description fixed }',
  ]) reject(declaration);
});
test('stores reject unknown or quoted clauses, wrong header and value token types', () => {
  for (const declaration of [
    'store S { mystery "message" }', 'store S { "branch" main }',
    'store "S" {}', 'store S "{" }', 'store S { branch "main" }', 'store S { commit main }',
  ]) reject(declaration);
});
test('valid effects and stores preserve reference bytecode', () => {
  for (const declaration of [
    'effect E {}', 'store S {}',
    'effect E { deterministic true replay "fixed" evidence_required false description "local" lowers_to native }',
    'store S { branch main branch feature commit "first" commit "second" }',
  ]) {
    const source = program(declaration), input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc');
    fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), declaration);
  }
});


test('capability policies reject unknown clauses, malformed grants and wrong value tokens', () => {
  for (const declaration of [
    'capability_policy P { mystery }', 'capability_policy P { "require_deterministic_replay" }',
    'capability_policy "P" {}', 'capability_policy P "{" }',
    'capability_policy P { allow world.write wrong world }',
    'capability_policy P { allow world.write "on" world }',
    'capability_policy P { budget "max_rules" 1 }',
    'capability_policy P { budget max_rules "1" }',
    'capability_policy P { require_deterministic_replay "false" }',
  ]) reject(declaration);
});
test('valid capability policies preserve optional replay and grant metadata', () => {
  for (const declaration of [
    'capability_policy P {}', 'capability_policy P { require_deterministic_replay }',
    'capability_policy P { require_deterministic_replay false }',
    'capability_policy P { budget max_rules 1 budget max_rules 3 }',
    'capability_policy P { budget z 1 budget a 2 budget z 3 budget b 4 }',
    'capability_policy P { allow world.write on world allow_effect Warrant, Evidence deny_effect HostCall allow_host echo.text budget max_rules 2 require_deterministic_replay true }',
  ]) {
    const source = program(declaration), input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc');
    fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), declaration);
  }
});


test('prototype-named budget keys remain ordinary data through compilation and normalization', () => {
  const source = program('capability_policy P { budget __proto__ 1 budget constructor 2 budget toString 3 budget max_rules 4 budget __proto__ 5 }');
  const compiled = compileReality(source), declaration = compiled.capabilityPolicies[0];
  for (const [key, value] of [['__proto__', 5], ['constructor', 2], ['toString', 3], ['max_rules', 4]]) {
    assert.equal(Object.hasOwn(declaration.budget, key), true, key);
    assert.equal(declaration.budget[key], value, key);
  }
  const normalized = resolveRclCapabilityPolicy(compiled).policy.budget;
  assert.deepEqual(Object.keys(normalized).sort(), ['__proto__', 'constructor', 'maxRules', 'toString'].sort());
  assert.equal(normalized.__proto__, 5); assert.equal(normalized.constructor, 2); assert.equal(normalized.toString, 3); assert.equal(normalized.maxRules, 4);
  const input = path.join(directory, 'prototype-budget.rcl'), output = path.join(directory, 'prototype-budget.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
  assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
  assert.notDeepEqual(compileRealityToBytecode(source), compileRealityToBytecode(source.replace('budget __proto__ 5', 'budget __proto__ 6')));
});

test('canonical facet and budget keys follow reference order for BMP identifiers', () => {
  const keys = ['龍', '中a', '中', 'é', 'Z', 'α', '中٢', 'A', '_', '한'];
  const facets = keys.map((key, index) => `facet ${key} : Number = ${index}`);
  const budget = keys.map((key, index) => `budget ${key} ${index}`);
  // Include a shared prefix and a repeated Unicode budget key.
  for (const [index, facetSource] of [facets, [...facets].reverse()].entries()) {
    const budgetSource = (index === 0 ? budget : [...budget].reverse()).join(' ');
    const source = program(facetSource.join(' ') + ' facet 中.子 : Number = 11 '
      + `capability_policy P { ${budgetSource} budget 中 23 }`);
    const input = path.join(directory, 'unicode-keys.rcl');
    const output = path.join(directory, 'unicode-keys.rbc');
    fs.writeFileSync(input, source);
    assert.deepEqual(runNativeCompiler(compiler, input, output).bytecode, compileRealityToBytecode(source));
  }
});


test('dialects reject unknown or quoted clauses and malformed declaration values', () => {
  for (const declaration of [
    'dialect D { mystery "text" }', 'dialect D { "invariant" "text" }',
    'dialect "D" {}', 'dialect D "{" }', 'dialect D { version v1 }',
    'dialect D { layer "semantic" }', 'dialect D { description text }', 'dialect D { invariant text }',
    'dialect D { operation O { mystery Evidence } }',
    'dialect D { operation O { "effect" Evidence } }',
    'dialect D { operation "O" {} }', 'dialect D { operation O "{" } }',
  ]) reject(declaration);
});
test('valid dialects and operation metadata preserve reference bytecode', () => {
  for (const declaration of [
    'dialect D {}',
    'dialect D { version "1" layer semantic domain world.local description "local" invariant "kept" lowers_to native, machine operation O { input Text output Number effect Evidence effects Warrant, Authority lowers_to native } }',
  ]) {
    const source = program(declaration), input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc');
    fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
    assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source), declaration);
  }
});


test('metadata name paths and lists require real dot and comma separators', () => {
  for (const declaration of [
    'effect E { lowers_to native "," machine }',
    'dialect D { domain world "." local }',
    'capability_policy P { allow world "." write on world }',
    'capability_policy P { allow_effect Warrant "," Evidence }',
  ]) reject(declaration);
  const source = program('dialect D { domain world.local lowers_to native, machine } capability_policy P { allow world.write on world.local allow_effect Warrant, Evidence }');
  const input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
  assert.deepEqual(fs.readFileSync(output), compileRealityToBytecode(source));
});
