import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import {
  RBC13_DOMAIN_BYTECODE_VERSION,
  RBC13_DOMAIN_CALL_OPCODE,
  assembleRbc13DomainCallProgram,
  decodeRbc13DomainCallCandidate,
} from '../src/rbc13-domain-bytecode-candidate.mjs';

test('canonical compiler remains RBC 1.1/1.2 and never emits candidate opcode 45', () => {
  const decoded = decodeBytecode(compileRealityToBytecode('reality Base { facet world.ready : Truth = true }'));
  assert.ok(decoded.version.minor <= 2);
  assert.equal(decoded.instructions.some(item => item.op === RBC13_DOMAIN_CALL_OPCODE), false);
});

test('candidate assembler emits literal DOMAIN_CALL under RBC 1.3', () => {
  const decoded = decodeRbc13DomainCallCandidate(assembleRbc13DomainCallProgram({
    calls: [{ domain: 'core', operation: 'echo', args: ['hello'], target: 'result.echo' }],
  }));
  assert.deepEqual(decoded.version, RBC13_DOMAIN_BYTECODE_VERSION);
  const call = decoded.instructions.find(item => item.op === RBC13_DOMAIN_CALL_OPCODE);
  assert.equal(call.name, 'DOMAIN_CALL');
  assert.equal(call.flags, 0);
  assert.equal(call.domain, 'core');
  assert.equal(call.operation, 'echo');
  assert.equal(call.argc, 1);
});

test('candidate assembler emits dynamic DOMAIN_CALL while canonical decoder remains backward compatible', () => {
  const bytes = assembleRbc13DomainCallProgram({
    calls: [{ domain: 'core', operation: 'echo', args: [42], target: 'result.dynamic', dynamic: true }],
  });
  const generic = decodeBytecode(bytes);
  assert.equal(generic.instructions.some(item => item.name === 'UNKNOWN_45'), true);
  const decoded = decodeRbc13DomainCallCandidate(bytes);
  const call = decoded.instructions.find(item => item.op === RBC13_DOMAIN_CALL_OPCODE);
  assert.equal(call.flags, 1);
  assert.equal(call.domain, undefined);
  assert.equal(call.operation, undefined);
  assert.equal(call.argc, 1);
});
