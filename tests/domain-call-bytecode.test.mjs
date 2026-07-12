import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode, runRealityNative } from '../src/native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('literal domain_call emits RBC 1.3 with one structured request argument', () => {
  const decoded = decodeBytecode(compileRealityToBytecode(`reality DomainLiteral {
    facet result.value : Text = domain_call("core", "echo", "hello")
  }`));
  const instruction = decoded.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.deepEqual(
    { flags: instruction.flags, domain: decoded.strings[instruction.a], operation: decoded.strings[instruction.b], argc: instruction.c },
    { flags: 0, domain: 'core', operation: 'echo', argc: 1 },
  );
});

test('dynamic domain_call emits target values on the stack and RBC 1.3', () => {
  const decoded = decodeBytecode(compileRealityToBytecode(`reality DomainDynamic {
    facet target.domain : Text = "core"
    facet target.operation : Text = "echo"
    facet result.value : Text = domain_call(target.domain, target.operation, "hello")
  }`));
  const instruction = decoded.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.deepEqual({ flags: instruction.flags, a: instruction.a, b: instruction.b, argc: instruction.c }, { flags: 1, a: 0, b: 0, argc: 1 });
});

test('RBC 1.1 and 1.2 feature selection remains unchanged', () => {
  assert.deepEqual(decodeBytecode(compileRealityToBytecode('reality Base { facet value : Number = 1 }')).version, { major: 1, minor: 1 });
  assert.deepEqual(decodeBytecode(compileRealityToBytecode('reality Mod { facet value : Number = 7 % 3 }')).version, { major: 1, minor: 2 });
});

test('reference runtime dispatches the internal domain_call contract', async () => {
  const result = await runReality('reality DomainReference { facet result.value : Text = domain_call("core", "echo", "hello") }');
  assert.equal(result.state['result.value'], 'hello');
});

test('native VM dispatches literal and dynamic internal domain calls', () => {
  const literal = runRealityNative('reality DomainNative { facet result.value : Text = domain_call("core", "echo", "hello") }');
  assert.equal(literal.state['result.value'], 'hello');

  const dynamic = runRealityNative(`reality DomainNativeDynamic {
    facet target.domain : Text = "core"
    facet target.operation : Text = "echo"
    facet result.value : Text = domain_call(target.domain, target.operation, "hello")
  }`);
  assert.equal(dynamic.state['result.value'], 'hello');
});

test('Quantify, Observe and Learn lower the small-data agent into RBC 1.3', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'small-data-agent.rcl'), 'utf8');
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  const domainCalls = decoded.instructions.filter(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.ok(domainCalls.length >= 9);
  assert.ok(domainCalls.some(item => decoded.strings[item.a] === 'quantitative' && decoded.strings[item.b] === 'measure'));
  assert.ok(domainCalls.some(item => decoded.strings[item.a] === 'knowledge' && decoded.strings[item.b] === 'claim'));
});

test('native VM executes the Quantify -> Observe -> Learn -> Realize chain', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'small-data-agent.rcl'), 'utf8');
  const result = runNativeBytecode(compileRealityToBytecode(source));

  assert.equal(result.state['room.heater'], true);
  assert.equal(result.state['caretaker.actions'], 1);
  assert.equal(result.state['sensor.temperature'].confidence, 0.98);
  assert.equal(result.state['sight.temperature'].value, 8);
  assert.equal(result.state['mind.cold'].value, true);
  assert.equal(result.state['mind.should_heat'].confidence, 0.95);
});

test('Interpret, Understand and Create lower the cognitive agent into RBC 1.3', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'cognitive-creation-agent.rcl'), 'utf8');
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  const calls = decoded.instructions.filter(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  for (const [domain, operation] of [['language', 'utterance'], ['language', 'intent'], ['understanding', 'model'], ['creation', 'candidate'], ['creation', 'select']]) {
    assert.ok(calls.some(item => decoded.strings[item.a] === domain && decoded.strings[item.b] === operation), `${domain}.${operation} was not emitted`);
  }
});

test('native VM executes the Learn -> Interpret -> Understand -> Create -> Realize chain', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'cognitive-creation-agent.rcl'), 'utf8');
  const result = runNativeBytecode(compileRealityToBytecode(source));

  assert.equal(result.state['greenhouse.light'], true);
  assert.equal(result.state['caretaker.actions'], 1);
  assert.equal(result.state['command.activate_light'].active, true);
  assert.equal(result.state['situation.authorized_request'].value, true);
  assert.equal(result.state['solutions.chosen'].value, 'activate');
  assert.equal(result.state['solutions.chosen'].status, 'selected');
});

test('Energy, Element, Science, Embodiment and Spirit lower into RBC 1.3', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'foundation-closure.rcl'), 'utf8');
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  const calls = decoded.instructions.filter(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  for (const [domain, operation] of [['energy', 'scale'], ['element', 'species'], ['element', 'compound'], ['science', 'claim'], ['science', 'experiment'], ['body', 'state'], ['spirit', 'state']]) {
    assert.ok(calls.some(item => decoded.strings[item.a] === domain && decoded.strings[item.b] === operation), `${domain}.${operation} was not emitted`);
  }
});

test('native VM executes the full foundation-closure domain chain', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'foundation-closure.rcl'), 'utf8');
  const result = runNativeBytecode(compileRealityToBytecode(source));

  assert.equal(result.state['grid.source'].value, 60);
  assert.equal(result.state['grid.load'].value, 36);
  assert.equal(result.state['matter.water'].category, 'compound');
  assert.equal(result.state['lab.replication'].consistent, true);
  assert.equal(result.state['lab.accepted'].value, true);
  assert.equal(result.state['vessel.state'].maintained, true);
  assert.equal(result.state['mind.state'].integrated, true);
});

test('Reflect, Advance, Live, Propagate and Inherit lower into deterministic transactions', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'eight-domain-foundation.rcl'), 'utf8');
  const decoded = decodeBytecode(compileRealityToBytecode(source));

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.ok(decoded.instructions.filter(item => item.name === 'BEGIN_TX').length >= 10);
  assert.ok(decoded.instructions.some(item => item.name === 'CHECK_PRESERVE'));
  assert.ok(decoded.instructions.some(item => item.name === 'DOMAIN_CALL'));
});

test('native VM executes the eight-domain state-dynamics chain', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'eight-domain-foundation.rcl'), 'utf8');
  const result = runNativeBytecode(compileRealityToBytecode(source));

  assert.equal(result.state['self_model.revision'], 1);
  assert.equal(result.state['world.stone.velocity'].value, -19.62);
  assert.ok(Math.abs(result.state['world.stone.position'].value - 0.19) < 1e-12);
  assert.equal(result.state['creature.energy'], 0.9);
  assert.equal(result.state['brain.response'], 0.5);
  assert.equal(result.state['lineage.motion_bias'], 0.22);
  assert.ok(Math.abs(result.state['telemetry.altitude'].value.value - 0.19) < 1e-12);
});

test('Synchronize lowers spacetime clocks and coordinates into RBC 1.3', () => {
  const source = `reality NativeSpacetime {
    spacetime chronos {
      frame world dimensions 3 topology "euclidean"
      clock simulation : Time = seconds(0) tick seconds(1) rate 2
      coordinate lamp = point("world", meters(1), meters(2), meters(3), seconds(0)) target "greenhouse.light" clock simulation
      preserve chronos.simulation >= seconds(0)
    }
    synchronize chronos steps 3
  }`;
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  const calls = decoded.instructions.filter(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.ok(calls.some(item => decoded.strings[item.a] === 'spacetime' && decoded.strings[item.b] === 'point'));
  assert.ok(calls.some(item => decoded.strings[item.a] === 'spacetime' && decoded.strings[item.b] === 'retime'));
});

test('native VM executes the spacetime synchronization chain', () => {
  const source = `reality NativeSpacetime {
    spacetime chronos {
      frame world dimensions 3 topology "euclidean"
      clock simulation : Time = seconds(0) tick seconds(1) rate 2
      coordinate lamp = point("world", meters(1), meters(2), meters(3), seconds(0)) target "greenhouse.light" clock simulation
      preserve chronos.simulation >= seconds(0)
    }
    synchronize chronos steps 3
  }`;
  const result = runNativeBytecode(compileRealityToBytecode(source));

  assert.equal(result.state['chronos.simulation'].value, 6);
  assert.equal(result.state['chronos.lamp'].t.value, 6);
  assert.equal(result.state['chronos.lamp'].target, 'greenhouse.light');
});

test('native compiler rejects meta directives that do not yet have real state semantics', () => {
  const source = fs.readFileSync(path.join(ROOT, 'examples', 'meta-runtime-foundation.rcl'), 'utf8');
  assert.throws(
    () => compileRealityToBytecode(source),
    error => error?.message?.includes("cannot execute 'Accelerate'")
      && error?.message?.includes("cannot execute 'Compress'")
      && error?.message?.includes("cannot execute 'Restore'"),
  );
});
