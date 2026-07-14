import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from '../src/bytecode.mjs';
import { compileSourceSelfHosted } from '../src/selfhost-compiler.mjs';

function compileWithParity(source) {
  const bootstrap = Buffer.from(compileRealityToBytecode(source));
  const selfHosted = Buffer.from(compileSourceSelfHosted(source));
  assert.deepEqual(selfHosted, bootstrap);
  return decodeBytecode(selfHosted);
}

test('self-hosted domain_call emits the literal target ABI at RBC 1.3', { timeout: 120_000 }, () => {
  const decoded = compileWithParity(`reality SelfHostDomainLiteral {
    facet result.value : Text = domain_call("core", "echo", "hello")
  }`);
  const instruction = decoded.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.deepEqual(
    {
      flags: instruction.flags,
      domain: decoded.strings[instruction.a],
      operation: decoded.strings[instruction.b],
      argc: instruction.c,
    },
    { flags: 0, domain: 'core', operation: 'echo', argc: 1 },
  );
});

test('self-hosted domain_call preserves the dynamic target ABI', { timeout: 120_000 }, () => {
  const decoded = compileWithParity(`reality SelfHostDomainDynamic {
    facet target.domain : Text = "core"
    facet target.operation : Text = "echo"
    facet result.value : Text = domain_call(target.domain, target.operation, "hello")
  }`);
  const instruction = decoded.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);

  assert.deepEqual(decoded.version, { major: 1, minor: 3 });
  assert.deepEqual(
    { flags: instruction.flags, a: instruction.a, b: instruction.b, argc: instruction.c },
    { flags: 1, a: 0, b: 0, argc: 1 },
  );
});

test('self-hosted domain_call emits variadic literal and dynamic target ABI', { timeout: 120_000 }, () => {
  const literal = compileWithParity(`reality SelfHostDomainVariadic {
    facet result.length : Length = domain_call("quantity", "make", "Length", 2, "m")
  }`);
  const dynamic = compileWithParity(`reality SelfHostDomainDynamicVariadic {
    facet target.domain : Text = "quantity"
    facet target.operation : Text = "make"
    facet result.length : Length = domain_call(target.domain, target.operation, "Length", 3, "m")
  }`);

  const literalInstruction = literal.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);
  const dynamicInstruction = dynamic.instructions.find(item => item.op === OPCODES.DOMAIN_CALL);
  assert.deepEqual({ flags: literalInstruction.flags, argc: literalInstruction.c }, { flags: 0, argc: 3 });
  assert.deepEqual({ flags: dynamicInstruction.flags, argc: dynamicInstruction.c }, { flags: 1, argc: 3 });
});

test('self-hosted required-minor selection preserves RBC 1.1 and 1.2 bytes', { timeout: 120_000 }, () => {
  const base = compileWithParity('reality SelfHostBase { facet value : Number = 1 }');
  const mod = compileWithParity('reality SelfHostMod { facet value : Number = 7 % 3 }');
  const dynamicProvider = compileWithParity(`reality SelfHostProvider {
    facet provider.id : Text = "echo"
    facet provider.capability : Text = "echo.text"
    facet value : Text = provider_call(provider.id, provider.capability, "request")
  }`);

  assert.deepEqual(base.version, { major: 1, minor: 1 });
  assert.deepEqual(mod.version, { major: 1, minor: 2 });
  assert.deepEqual(dynamicProvider.version, { major: 1, minor: 2 });
});
