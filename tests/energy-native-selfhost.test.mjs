import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { compileSourceSelfHosted } from '../src/selfhost-compiler.mjs';

const ENERGY_SOURCE = `reality EnergyProbe {
 energy grid {
  reservoir source : Energy = joules(100)
  reservoir load : Energy = joules(0)
  flow charge from source to load amount joules(40) efficiency 0.9 evidence "meter"
  preserve grid.source >= joules(0)
  witness "rcl:energy"
 }
 energize grid
}`;

test('Energy domain stays byte-identical through self-hosting and executes natively', { timeout: 120_000 }, () => {
  const referenceBytecode = Buffer.from(compileRealityToBytecode(ENERGY_SOURCE));
  const selfHostedBytecode = Buffer.from(compileSourceSelfHosted(ENERGY_SOURCE));
  assert.deepEqual(selfHostedBytecode, referenceBytecode);

  const native = runNativeBytecode(referenceBytecode);
  assert.equal(native.state['grid.source'].value, 60);
  assert.equal(native.state['grid.load'].value, 36);
  assert.equal(native.history.length, 1);
  assert.deepEqual(native.history[0].changes.map(change => [change.target, change.after.value]), [
    ['grid.source', 60],
    ['grid.load', 36],
  ]);
  assert.deepEqual(native.history[0].witnesses, ['domain:energize:grid']);
});
