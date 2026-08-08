import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { assembleRbc13DomainCallProgram } from '../src/rbc13-domain-bytecode-candidate.mjs';
import { materializeRbc13DomainVmWithPublicApi } from '../scripts/materialize-rbc13-domain-vm-public-api.mjs';
import { measurement, quantity } from '../src/quantity.mjs';
import { knowledgeClaim } from '../src/knowledge.mjs';
import { semanticStateRoot } from '../src/semantic-state-root.mjs';
import { compileNativeC, resolveNativeCCompiler } from '../src/native-c-compiler.mjs';

function parsePayload(run) {
  assert.ok(run.stdout.trim(), `${run.stdout}\n${run.stderr}`);
  return JSON.parse(run.stdout.trim());
}

function oracleError(fn) {
  try {
    fn();
    assert.fail('oracle was expected to throw');
  } catch (error) {
    if (error?.name === 'AssertionError') throw error;
    return {
      code: String(error?.code ?? error?.name ?? 'Error'),
      message: String(error?.message ?? error),
    };
  }
}

function assertNativeMatchesOracleError(run, expected) {
  assert.equal(run.status, 2, `${run.stdout}\n${run.stderr}`);
  const payload = parsePayload(run);
  assert.equal(payload.code, expected.code);
  assert.equal(payload.message, expected.message);
  return payload;
}

const compiler = resolveNativeCCompiler();

test('experimental RBC 1.3 opcode45 preserves positive and negative semantic identity', { skip: !compiler }, () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-domain-vm-'));
  const generated = path.join(temp, 'rclvm-rbc13-domain-candidate.c');
  const host = path.join(temp, 'domain-vm-opcode45-candidate');
  try {
    const currentNative = fs.readFileSync('native/rclvm.c', 'utf8');
    writeFileSync(generated, materializeRbc13DomainVmWithPublicApi(currentNative));
    const build = compileNativeC(compiler, {
      cwd: process.cwd(),
      includeDirs: ['native', temp],
      sources: [
        'native/rcl_domain_value.c',
        'native/rcl_domain_organ.c',
        'native/rcl_domain_admitted_organs.c',
        'native/domain_vm_opcode45_candidate_host.c',
      ],
      linkLibraries: process.platform === 'win32' ? ['bcrypt'] : ['crypto', 'm'],
      output: host,
    });
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

    const literalPath = path.join(temp, 'literal.rbc');
    writeFileSync(literalPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'core', operation: 'echo', args: ['hello'], target: 'result.echo' }],
    }));

    const denied = spawnSync(host, [literalPath], { encoding: 'utf8' });
    assert.equal(denied.status, 2, `${denied.stdout}\n${denied.stderr}`);
    const deniedPayload = parsePayload(denied);
    assert.equal(deniedPayload.code, 'RCL_DOMAIN_ORGAN_EVIDENCE_TIER');
    assert.equal(deniedPayload.message, 'RCL_DOMAIN_ORGAN_EVIDENCE_TIER: Organ has not reached required evidence tier');

    const admitted = spawnSync(host, [literalPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(admitted.status, 0, `${admitted.stdout}\n${admitted.stderr}`);
    const admittedPayload = parsePayload(admitted);
    assert.equal(admittedPayload.bytecodeVersion, '1.3');
    assert.equal(admittedPayload.state['result.echo'], 'hello');
    assert.equal(admittedPayload.stateRootAlgorithm, 'rcl.semantic-state-root.v1');
    assert.equal(admittedPayload.stateRoot, semanticStateRoot({ 'result.echo': 'hello' }));

    const dynamicPath = path.join(temp, 'dynamic.rbc');
    writeFileSync(dynamicPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'core', operation: 'echo', args: [42], target: 'result.dynamic', dynamic: true }],
    }));
    const dynamic = spawnSync(host, [dynamicPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(dynamic.status, 0, `${dynamic.stdout}\n${dynamic.stderr}`);
    const dynamicPayload = parsePayload(dynamic);
    assert.equal(dynamicPayload.state['result.dynamic'], 42);
    assert.equal(dynamicPayload.stateRoot, semanticStateRoot({ 'result.dynamic': 42 }));

    const quantityPath = path.join(temp, 'quantity.rbc');
    writeFileSync(quantityPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'quantity', operation: 'make', args: ['Temperature', 25, ''], target: 'result.quantity' }],
    }));
    const quantityRun = spawnSync(host, [quantityPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(quantityRun.status, 0, `${quantityRun.stdout}\n${quantityRun.stderr}`);
    const quantityPayload = parsePayload(quantityRun);
    assert.equal(quantityPayload.state['result.quantity'].kind, 'Quantity');
    assert.equal(quantityPayload.state['result.quantity'].type, 'Temperature');
    assert.equal(quantityPayload.state['result.quantity'].value, 25);
    assert.equal(quantityPayload.state['result.quantity'].unit, '°C');
    assert.equal(quantityPayload.stateRoot, semanticStateRoot({ 'result.quantity': quantity('Temperature', 25) }));

    const chainPath = path.join(temp, 'chain.rbc');
    writeFileSync(chainPath, assembleRbc13DomainCallProgram({
      program: 'Rbc13DomainChain',
      calls: [
        { domain: 'quantity', operation: 'make', args: ['Temperature', 25, ''], target: 'q.value' },
        { domain: 'quantity', operation: 'make', args: ['Temperature', 0.5, ''], target: 'q.uncertainty' },
        {
          domain: 'quantitative', operation: 'measure', target: 'measure.temp',
          args: ['Temperature', { $state: 'q.value' }, { $state: 'q.uncertainty' }, 0.9, '', 'ratio', ['sensor:e1', 'sensor:e1', 'sensor:e2'], 'sensor-A'],
        },
        {
          domain: 'knowledge', operation: 'claim', target: 'knowledge.temp',
          args: ['Temperature', { $state: 'q.value' }, 0.8, ['e1', 'e1', 'e2'], 'lab', 'local', 'provisional', ['dep:a', 'dep:a', 'dep:b'], 1, 'root-1'],
        },
      ],
    }));
    const chainRun = spawnSync(host, [chainPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(chainRun.status, 0, `${chainRun.stdout}\n${chainRun.stderr}`);
    const chainPayload = parsePayload(chainRun);
    const q = quantity('Temperature', 25);
    const uncertainty = quantity('Temperature', 0.5);
    const measured = measurement('Temperature', q, {
      uncertainty,
      confidence: 0.9,
      scale: 'ratio',
      evidence: ['sensor:e1', 'sensor:e1', 'sensor:e2'],
      calibratedBy: 'sensor-A',
    });
    const known = knowledgeClaim('Temperature', q, {
      confidence: 0.8,
      evidence: ['e1', 'e1', 'e2'],
      source: 'lab',
      scope: 'local',
      status: 'provisional',
      dependencies: ['dep:a', 'dep:a', 'dep:b'],
      revision: 1,
      formedAtRoot: 'root-1',
    });
    const expectedState = {
      'q.value': q,
      'q.uncertainty': uncertainty,
      'measure.temp': measured,
      'knowledge.temp': known,
    };
    assert.equal(chainPayload.state['measure.temp'].kind, 'Measurement');
    assert.deepEqual(chainPayload.state['measure.temp'].evidence, ['sensor:e1', 'sensor:e1', 'sensor:e2']);
    assert.equal(chainPayload.state['knowledge.temp'].kind, 'Knowledge');
    assert.deepEqual(chainPayload.state['knowledge.temp'].evidence, ['e1', 'e2']);
    assert.deepEqual(chainPayload.state['knowledge.temp'].dependencies, ['dep:a', 'dep:b']);
    assert.equal(semanticStateRoot(chainPayload.state), semanticStateRoot(expectedState));
    assert.equal(chainPayload.stateRoot, semanticStateRoot(expectedState));

    const invalidQuantityPath = path.join(temp, 'invalid-quantity.rbc');
    writeFileSync(invalidQuantityPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'quantity', operation: 'make', args: ['Warp', 25, ''], target: 'result.quantity' }],
    }));
    assertNativeMatchesOracleError(
      spawnSync(host, [invalidQuantityPath, '--candidate-minimum'], { encoding: 'utf8' }),
      oracleError(() => quantity('Warp', 25)),
    );

    const invalidMeasureConfidencePath = path.join(temp, 'invalid-measure-confidence.rbc');
    writeFileSync(invalidMeasureConfidencePath, assembleRbc13DomainCallProgram({
      calls: [{
        domain: 'quantitative', operation: 'measure', target: 'result.measure',
        args: ['Number', 42, 0.25, 2, '', 'ratio', [], ''],
      }],
    }));
    assertNativeMatchesOracleError(
      spawnSync(host, [invalidMeasureConfidencePath, '--candidate-minimum'], { encoding: 'utf8' }),
      oracleError(() => measurement('Number', 42, { uncertainty: 0.25, confidence: 2, scale: 'ratio', evidence: [], calibratedBy: null })),
    );

    const invalidMeasureTypePath = path.join(temp, 'invalid-measure-type.rbc');
    writeFileSync(invalidMeasureTypePath, assembleRbc13DomainCallProgram({
      calls: [{
        domain: 'quantitative', operation: 'measure', target: 'result.measure',
        args: ['Number', 'forty-two', 0.25, 0.9, '', 'ratio', [], ''],
      }],
    }));
    assertNativeMatchesOracleError(
      spawnSync(host, [invalidMeasureTypePath, '--candidate-minimum'], { encoding: 'utf8' }),
      oracleError(() => measurement('Number', 'forty-two', { uncertainty: 0.25, confidence: 0.9, scale: 'ratio', evidence: [], calibratedBy: null })),
    );

    const invalidKnowledgeConfidencePath = path.join(temp, 'invalid-knowledge-confidence.rbc');
    writeFileSync(invalidKnowledgeConfidencePath, assembleRbc13DomainCallProgram({
      calls: [{
        domain: 'knowledge', operation: 'claim', target: 'result.knowledge',
        args: ['Number', 42, 2, [], '', 'local', 'provisional', [], 1, ''],
      }],
    }));
    assertNativeMatchesOracleError(
      spawnSync(host, [invalidKnowledgeConfidencePath, '--candidate-minimum'], { encoding: 'utf8' }),
      oracleError(() => knowledgeClaim('Number', 42, { confidence: 2, evidence: [], source: null, scope: 'local', status: 'provisional', dependencies: [], revision: 1, formedAtRoot: null })),
    );

    const invalidKnowledgeTypePath = path.join(temp, 'invalid-knowledge-type.rbc');
    writeFileSync(invalidKnowledgeTypePath, assembleRbc13DomainCallProgram({
      calls: [{
        domain: 'knowledge', operation: 'claim', target: 'result.knowledge',
        args: ['Text', 42, 0.8, [], '', 'local', 'provisional', [], 1, ''],
      }],
    }));
    assertNativeMatchesOracleError(
      spawnSync(host, [invalidKnowledgeTypePath, '--candidate-minimum'], { encoding: 'utf8' }),
      oracleError(() => knowledgeClaim('Text', 42, { confidence: 0.8, evidence: [], source: null, scope: 'local', status: 'provisional', dependencies: [], revision: 1, formedAtRoot: null })),
    );

    const missingPath = path.join(temp, 'missing.rbc');
    writeFileSync(missingPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'core', operation: 'missing', args: ['x'], target: 'result.missing' }],
    }));
    const missing = spawnSync(host, [missingPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(missing.status, 2, `${missing.stdout}\n${missing.stderr}`);
    const missingPayload = parsePayload(missing);
    assert.equal(missingPayload.code, 'RCL_DOMAIN_OPERATION_MISSING');
    assert.equal(missingPayload.message, "RCL_DOMAIN_OPERATION_MISSING: Domain operation 'core.missing' is not present in the RBC 1.3 salvage inventory");

    const legacyPath = path.join(temp, 'legacy.rbc');
    writeFileSync(legacyPath, compileRealityToBytecode('reality Legacy { facet world.ready : Truth = true }'));
    const legacy = spawnSync(host, [legacyPath], { encoding: 'utf8' });
    assert.equal(legacy.status, 0, `${legacy.stdout}\n${legacy.stderr}`);
    assert.equal(parsePayload(legacy).state['world.ready'], true);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
