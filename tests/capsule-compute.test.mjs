import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { runReality } from '../src/runtime.mjs';
import { verifyNativeParity } from '../src/native-vm.mjs';
import { expandResourceChoice } from '../examples/world-capsule/capsule-compute.mjs';

const cases = [[20,30,0],[30,30,0],[40,30,0],[20,30,10],[0,0,0],[0,50,49],[0.25,0.5,0.25]];
for (const [available, required, confirmedCredit] of cases) {
  test(`expanded capsule equals explicit RCL: ${available}/${required}/${confirmedCredit}`, async () => {
    const expanded = expandResourceChoice({available,required,confirmedCredit});
    const explicit = `reality ExplicitPurchase {
      facet result.usable : Number = 0
      facet result.margin : Number = 0
      facet result.feasible : Truth = false
      subject calculator { warrant result.write on result }
      emergence calculate {
        cause calculator
        when true
        needs result.write on result
        alter result.usable <- ${available} + ${confirmedCredit}
        alter result.margin <- (${available} + ${confirmedCredit}) - ${required}
        alter result.feasible <- (${available} + ${confirmedCredit}) >= ${required}
        witness "explicit:purchase"
      }
      realize calculate
    }`;
    const a = await runReality(expanded.source);
    const b = await runReality(explicit);
    for (const key of ['result.usable','result.margin','result.feasible']) assert.deepEqual(a.state[key], b.state[key]);
    assert.equal(a.state['result.feasible'], available + confirmedCredit >= required);
    assert.ok(a.history.length > 0);
    assert.ok(a.history.every(h => h.status === 'realized' && h.hostCalls.length === 0));
    assert.deepEqual(a.history[0].witnesses, ['capsule:resource-choice:compute']);
    assert.deepEqual(expanded.graph.selected.map(c => c.id), ['commerce-resource','individual-agent']);
    assert.ok(expanded.graph.selected.every(c => Object.keys(c.slots).length === 6));
  });
}
test('reject invalid quantities and overflow', () => {
  for (const value of [-1, NaN, Infinity, '20', undefined]) assert.throws(() => expandResourceChoice({available:value,required:30,confirmedCredit:0}), /INVALID_AMOUNT/);
  assert.throws(() => expandResourceChoice({available:Number.MAX_VALUE,required:0,confirmedCredit:Number.MAX_VALUE}), /AMOUNT_OVERFLOW/);
});
const readJson = name => JSON.parse(fs.readFileSync(new URL('../examples/world-capsule/' + name, import.meta.url)));
const sample = {available:20,required:30,confirmedCredit:0};
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
test('reject invalid or absent root and altered root member', () => {
  for (const mutate of [c=>{c.meaningRoot='0'.repeat(64)},c=>{delete c.meaningRoot},c=>{c.slots.constraints.push('new-rule')}]) {
    const rootRegistry=readJson('root-capsules.v0.1.json');
    mutate(rootRegistry.capsules.find(c=>c.id==='commerce-resource'));
    assert.throws(()=>expandResourceChoice(sample,{rootRegistry}),/MEMBER_MEANING_ROOT_MISMATCH/);
  }
});
test('reject missing slots, member, middle fields, duplicate identities', () => {
  const rootRegistry=readJson('root-capsules.v0.1.json');
  delete rootRegistry.capsules.find(c=>c.id==='commerce-resource').slots.constraints;
  assert.throws(()=>expandResourceChoice(sample,{rootRegistry}),/INVALID_MEMBER_SLOTS/);
  rootRegistry.capsules=rootRegistry.capsules.filter(c=>c.id!=='commerce-resource');
  assert.throws(()=>expandResourceChoice(sample,{rootRegistry}),/INVALID_MEMBER_SLOTS/);
  const midRegistry=readJson('mid-capsules.v0.4.json');
  delete midRegistry.capsules.find(c=>c.id==='resource-choice').memberMeaningRoots;
  assert.throws(()=>expandResourceChoice(sample,{midRegistry}),/MID_MEANING_ROOT_MISMATCH/);
  assert.throws(()=>expandResourceChoice(sample,{midRegistry:{}}),/INVALID_MID_REGISTRY/);
  const duplicate=readJson('mid-capsules.v0.4.json');
  duplicate.capsules.push(duplicate.capsules.find(c=>c.id==='resource-choice'));
  assert.throws(()=>expandResourceChoice(sample,{midRegistry:duplicate}),/INVALID_MID_IDENTITY/);
  const roots=readJson('root-capsules.v0.1.json');roots.capsules.push(roots.capsules[0]);
  assert.throws(()=>expandResourceChoice(sample,{rootRegistry:roots}),/INVALID_ROOT_REGISTRY/);
});
test('reject a modified capsule even with recomputed self root', () => {
  const midRegistry=readJson('mid-capsules.v0.4.json');
  const c=midRegistry.capsules.find(c=>c.id==='resource-choice');c.version='0.5.0';
  const {meaningRoot,...body}=c;c.meaningRoot=hash(body);
  assert.throws(()=>expandResourceChoice(sample,{midRegistry}),/MID_MEANING_ROOT_MISMATCH/);
});
test('reject unknown constraint version, missing map fields and modified operators', () => {
  const computeMap=readJson('resource-choice-compute-map.v0.1.json');computeMap.version='0.2.0';
  assert.throws(()=>expandResourceChoice(sample,{computeMap}),/UNSUPPORTED_COMPUTE_VERSION/);
  computeMap.version='0.1.0';delete computeMap.bindings;
  assert.throws(()=>expandResourceChoice(sample,{computeMap}),/COMPUTE_MAP_ROOT_MISMATCH/);
  const modified=readJson('resource-choice-compute-map.v0.1.json');modified.outputs.feasible.expression[0]='add';
  assert.throws(()=>expandResourceChoice(sample,{computeMap:modified}),/COMPUTE_MAP_ROOT_MISMATCH/);
  assert.throws(()=>expandResourceChoice(null),/INVALID_INPUT/);
});
test('repeat expansion and execution are deterministic; repeated realize has no accumulation', async () => {
  const a=expandResourceChoice(sample), b=expandResourceChoice(sample);
  assert.deepEqual(a,b);
  const first=await runReality(a.source), second=await runReality(b.source);
  assert.deepEqual(first.state,second.state);
  const repeated=await runReality(a.source.replace('  realize evaluate\n}', '  realize evaluate\n  realize evaluate\n}'));
  assert.deepEqual(repeated.state,first.state);
  assert.equal(repeated.history.length,2);
  assert.ok(repeated.history.every(h=>h.status==='realized'&&h.hostCalls.length===0));
});
test('finite small and large quantities lower without exponent notation', async () => {
  for (const available of [1e-7, 1e21, Number.MIN_VALUE, Number.MAX_VALUE]) {
    const expanded=expandResourceChoice({available,required:available,confirmedCredit:0});
    const result=await runReality(expanded.source);
    assert.equal(result.state['result.usable'],available);
    assert.equal(result.state['result.feasible'],true);
  }
});
test('reject invalid declared registry root', () => {
  const rootRegistry=readJson('root-capsules.v0.1.json');rootRegistry.registryRoot='0'.repeat(64);
  assert.throws(()=>expandResourceChoice(sample,{rootRegistry}),/REGISTRY_ROOT_MISMATCH/);
});
test('expanded capsule executes with native VM state, roots and history parity', async () => {
  for (const input of [sample, {available:20,required:30,confirmedCredit:10}, {available:0.25,required:0.5,confirmedCredit:0.25}]) {
    const {source}=expandResourceChoice(input);
    const parity=await verifyNativeParity(source);
    assert.equal(parity.ok,true);
    assert.equal(parity.native.state['result.feasible'],input.available+input.confirmedCredit>=input.required);
    assert.equal(parity.native.history.length,1);
  }
});
test('reject silently changed middle capsule', () => {
  const midRegistry = JSON.parse(fs.readFileSync(new URL('../examples/world-capsule/mid-capsules.v0.4.json', import.meta.url)));
  midRegistry.capsules.find(c => c.id === 'resource-choice').derivedExports.push('unverified');
  assert.throws(() => expandResourceChoice({available:20,required:30,confirmedCredit:0},{midRegistry}), /MID_MEANING_ROOT_MISMATCH/);
});
