import crypto from 'node:crypto';
import fs from 'node:fs';
import { compileWorldCapsules, loadWorldCapsuleRegistry } from './capsule-compiler-v0.1.mjs';

const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const root = v => crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');

// Explicit bounded semantics, separate from natural-language route confidence.
// Credit means confirmed usable credit, not inferred availability.
export const COMPUTE_SPEC = Object.freeze({
  capsule: 'resource-choice', version: '0.1.0',
  relation: 'usable = available + confirmedCredit',
  constraint: 'feasible = usable >= required',
  scope: 'single purchase, same currency, no fees, finite nonnegative amounts',
  backend: 'RCL JavaScript interpreter; no host adapters or training'
});

export const COMPUTE_MAP_ROOT = 'cfe2e7607f1aabbf265c2ee958a8ac1370e3567530cacb7d58d99fb76596fd17';
const readMap = () => JSON.parse(fs.readFileSync(new URL('./resource-choice-compute-map.v0.1.json', import.meta.url), 'utf8'));
// RCL numeric literals do not accept exponent notation.
function decimal(value) {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa, power] = text.split('e');
  const digits = mantissa.replace('.','');
  const point = (mantissa.indexOf('.') < 0 ? mantissa.length : mantissa.indexOf('.')) + Number(power);
  return point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length
    ? digits + '0'.repeat(point - digits.length) : digits.slice(0,point) + '.' + digits.slice(point);
}
function expression(node, inputs) {
  if (typeof node === 'string' && Object.hasOwn(inputs,node)) return 'input.' + node;
  if (!Array.isArray(node) || node.length !== 3) throw new Error('INVALID_EXPRESSION');
  const op = {add:'+',subtract:'-',gte:'>='}[node[0]];
  if (!op) throw new Error('UNSUPPORTED_OPERATOR');
  return `(${expression(node[1],inputs)} ${op} ${expression(node[2],inputs)})`;
}

export function expandResourceChoice(input, { midRegistry, rootRegistry, computeMap = readMap() } = {}) {
  if (!computeMap || computeMap.schema !== 'rcl.capsule-compute-map.v0.1' || computeMap.version !== '0.1.0') throw new Error('UNSUPPORTED_COMPUTE_VERSION');
  if (root(computeMap) !== COMPUTE_MAP_ROOT) throw new Error('COMPUTE_MAP_ROOT_MISMATCH');
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const mid = midRegistry ?? JSON.parse(fs.readFileSync(new URL('./mid-capsules.v0.4.json', import.meta.url), 'utf8'));
  if (!Array.isArray(mid?.capsules)) throw new Error('INVALID_MID_REGISTRY');
  if (mid.capsules.filter(c => c.id === computeMap.capsule).length !== 1) throw new Error('INVALID_MID_IDENTITY');
  const capsule = mid.capsules.find(c => c.id === computeMap.capsule);
  if (!capsule || capsule.status !== 'PROMOTED') throw new Error('CAPSULE_NOT_PROMOTED');
  const { meaningRoot, ...body } = capsule;
  if (root(body) !== meaningRoot || meaningRoot !== computeMap.midMeaningRoot) throw new Error('MID_MEANING_ROOT_MISMATCH');
  if (JSON.stringify(capsule.members) !== JSON.stringify(['commerce-resource', 'individual-agent'])) throw new Error('UNSUPPORTED_MEMBERS');
  const registry = rootRegistry ?? loadWorldCapsuleRegistry().registry;
  if (!Array.isArray(registry?.capsules) || new Set(registry.capsules.map(c=>c.id)).size !== registry.capsules.length) throw new Error('INVALID_ROOT_REGISTRY');
  const byId = new Map(registry.capsules.map(c=>[c.id,c]));
  capsule.members.forEach((id, i) => {
    const member = byId.get(id);
    if (!member || !member.slots || !['objects','state','relations','constraints','dynamics','evidence'].every(k=>Array.isArray(member.slots[k]))) throw new Error('INVALID_MEMBER_SLOTS');
    const { meaningRoot: memberRoot, ...memberBody } = member;
    if (root(memberBody) !== memberRoot || memberRoot !== capsule.memberMeaningRoots[i]) throw new Error('MEMBER_MEANING_ROOT_MISMATCH');
  });
  const {registryRoot, ...registryBody} = registry;
  if (root(registryBody) !== registryRoot) throw new Error('REGISTRY_ROOT_MISMATCH');
  for (const binding of computeMap.bindings) {
    if (!byId.get(binding.member)?.slots[binding.slot]?.includes(binding.atom)) throw new Error('SEMANTIC_BINDING_MISSING');
  }
  const values = Object.keys(computeMap.inputs).map(k => {
    const value = input[k];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('INVALID_AMOUNT:' + k);
    return value;
  });
  if (!Number.isFinite(values[0] + values[2])) throw new Error('AMOUNT_OVERFLOW');
  const graph = compileWorldCapsules(capsule.members,{registry});
  const inputFacets = Object.entries(computeMap.inputs).map(([k,type])=>`facet input.${k} : ${type} = ${decimal(input[k])}`).join('\n  ');
  const resultFacets = Object.entries(computeMap.outputs).map(([k,v])=>`facet result.${k} : ${v.type} = ${v.type === 'Truth' ? 'false' : '0'}`).join('\n  ');
  const alterations = Object.entries(computeMap.outputs).map(([k,v])=>`alter result.${k} <- ${expression(v.expression,computeMap.inputs)}`).join('\n    ');
  const source = `reality ResourceChoiceCompute {
  ${inputFacets}
  ${resultFacets}
  subject solver { warrant result.write on result }
  emergence evaluate {
    cause solver
    when true
    needs result.write on result
    ${alterations}
    preserve result.usable >= 0
    witness "capsule:resource-choice:compute"
  }
  realize evaluate
}`;
  const evidence = { midMeaningRoot: meaningRoot, graphRoot: graph.graphRoot,
    computeMapRoot: COMPUTE_MAP_ROOT, computeSpecRoot: root(COMPUTE_SPEC), sourceRoot: crypto.createHash('sha256').update(source).digest('hex') };
  return { source, graph, evidence, spec: COMPUTE_SPEC };
}
