import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

function rootsForSource(name, source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-root-drift-${name}-`));
  const sourcePath = path.join(directory, `${name}.rcl`);
  const rbcPath = path.join(directory, `${name}.rbc`);
  fs.writeFileSync(sourcePath, source, 'utf8');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', sourcePath, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(compiled.status, 'ok', `${name} self-host compile failed`);
  const nativeDecoded = decodeBytecode(fs.readFileSync(rbcPath));
  const bootstrapDecoded = decodeBytecode(Buffer.from(compileRealityToBytecode(source)));
  return {
    name,
    sameRoot: nativeDecoded.sourceRoot === bootstrapDecoded.sourceRoot,
    nativeRoot: nativeDecoded.sourceRoot,
    bootstrapRoot: bootstrapDecoded.sourceRoot,
    sameStringsExceptRoot: JSON.stringify(nativeDecoded.strings.slice(2)) === JSON.stringify(bootstrapDecoded.strings.slice(2)),
    sameNumbers: JSON.stringify(nativeDecoded.numbers) === JSON.stringify(bootstrapDecoded.numbers),
    sameInstructions: JSON.stringify(nativeDecoded.instructions) === JSON.stringify(bootstrapDecoded.instructions),
  };
}

const cases = [
  ['facet', `reality RootFacet {\n  facet x : Number = 1\n}`],
  ['reckon-add', `reality RootAdd {\n  reckon add(a : Number, b : Number) -> Number = a + b\n  facet x : Number = add(1, 2)\n}`],
  ['recursion', `reality RootRecursion {\n  reckon count(n : Number) -> Number = choose(n <= 0, 0, count(n - 1) + 1)\n  facet x : Number = count(3)\n}`],
  ['or-chain', `reality RootOr {\n  reckon valid(kind : Text) -> Truth = kind == "a" or kind == "b" or kind == "c" or kind == "d"\n  facet x : Truth = valid("a")\n}`],
  ['and-chain', `reality RootAnd {\n  reckon valid(x : Number) -> Truth = x > 0 and x < 2 and x != 3\n  facet x : Truth = valid(1)\n}`],
  ['not-call', `reality RootNot {\n  reckon positive(x : Number) -> Truth = x > 0\n  facet x : Truth = not positive(0)\n}`],
  ['sequence-nested', `reality RootSequence {\n  reckon pair(a : Number, b : Number) -> Sequence = sequence_append(sequence_append(empty_sequence(), a), b)\n  reckon nested(a : Number, b : Number) -> Sequence = sequence_append(sequence_append(empty_sequence(), "tag"), pair(a, b))\n  facet x : Number = sequence_get(sequence_get(nested(1, 2), 1), 0)\n}`],
  ['seven-params', `reality RootParams {\n  reckon f(a : Number, b : Number, c : Number, d : Number, e : Number, f : Number, g : Number) -> Number = a + b + c + d + e + f + g\n  facet x : Number = f(1, 2, 3, 4, 5, 6, 7)\n}`],
  ['large-integer-div', `reality RootLargeInteger {\n  reckon epsilon() -> Number = 1 / 100000000\n  facet x : Number = epsilon()\n}`],
  ['portable-decimals', `reality RootDecimals {\n  facet a : Number = 0.01\n  facet b : Number = 0.1\n  facet c : Number = 0.5\n  facet d : Number = 0.9\n  facet e : Number = 0.999\n  facet f : Number = 0.9995\n  facet g : Number = 0.9900000002\n}`],
  ['micro-decimal-known-gap', `reality RootMicroDecimal {\n  facet x : Number = 0.000001\n}`],
  ['nested-choose', `reality RootChoose {\n  reckon pick(kind : Text, x : Number) -> Number = choose(kind == "a", x, choose(kind == "b", x + 1, choose(kind == "c", x + 2, x + 3)))\n  facet x : Number = pick("a", 1)\n}`],
  ['config-shape', `reality RootConfig {\n  reckon make_config(kind : Text, learning_rate : Number, beta1 : Number, beta2 : Number, epsilon : Number, weight_decay : Number, gradient_clip : Number) -> Sequence = sequence_append(sequence_append(sequence_append(sequence_append(sequence_append(sequence_append(sequence_append(empty_sequence(), "OptimizerConfig"), kind), learning_rate), beta1), beta2), epsilon), sequence_append(sequence_append(empty_sequence(), weight_decay), gradient_clip))\n  facet x : Sequence = make_config("adamw", 0.01, 0.9, 0.999, 1 / 100000000, 0.1, 1)\n}`],
];

test('K08 diagnostic freezes the known 1e-6 literal source-root canonicalization gap', { timeout: 180_000 }, () => {
  const results = cases.map(([name, source]) => rootsForSource(name, source));
  const mismatches = results.filter(item => !item.sameRoot);
  assert.deepEqual(mismatches.map(item => item.name), ['micro-decimal-known-gap'], `unexpected root parity matrix: ${JSON.stringify(results, null, 2)}`);
  const known = mismatches[0];
  assert.equal(known.sameStringsExceptRoot, true);
  assert.equal(known.sameNumbers, true);
  assert.equal(known.sameInstructions, true);
});
