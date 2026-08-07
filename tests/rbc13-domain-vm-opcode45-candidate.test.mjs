import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { assembleRbc13DomainCallProgram } from '../src/rbc13-domain-bytecode-candidate.mjs';
import { materializeRbc13DomainVmCandidate } from '../scripts/materialize-rbc13-domain-vm-candidate.mjs';
import { quantity } from '../src/quantity.mjs';
import { semanticStateRoot } from '../src/semantic-state-root.mjs';

function commandExists(command) {
  const probe = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return probe.status === 0;
}

function parsePayload(run) {
  assert.ok(run.stdout.trim(), `${run.stdout}\n${run.stderr}`);
  return JSON.parse(run.stdout.trim());
}

const compilerAvailable = process.platform !== 'win32' && (commandExists('cc') || commandExists('gcc'));

test('experimental RBC 1.3 opcode45 dispatch is host-gated, fail-closed and authority-rooted', { skip: !compilerAvailable }, () => {
  const compiler = commandExists('cc') ? 'cc' : 'gcc';
  const temp = mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-domain-vm-'));
  const generated = path.join(temp, 'rclvm-rbc13-domain-candidate.c');
  const host = path.join(temp, 'domain-vm-opcode45-candidate');
  try {
    const currentNative = fs.readFileSync('native/rclvm.c', 'utf8');
    writeFileSync(generated, materializeRbc13DomainVmCandidate(currentNative));
    const build = spawnSync(compiler, [
      '-std=c11', '-Wall', '-Wextra', '-pedantic', '-Inative', `-I${temp}`,
      'native/rcl_domain_value.c',
      'native/rcl_domain_organ.c',
      'native/rcl_domain_admitted_organs.c',
      'native/domain_vm_opcode45_candidate_host.c',
      '-lcrypto', '-lm', '-o', host,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

    const literalPath = path.join(temp, 'literal.rbc');
    writeFileSync(literalPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'core', operation: 'echo', args: ['hello'], target: 'result.echo' }],
    }));

    const denied = spawnSync(host, [literalPath], { encoding: 'utf8' });
    assert.equal(denied.status, 2, `${denied.stdout}\n${denied.stderr}`);
    const deniedPayload = parsePayload(denied);
    assert.equal(deniedPayload.code, 'RCL_NATIVE_DOMAIN_ORGAN_FAILURE');
    assert.match(deniedPayload.message, /RCL_DOMAIN_ORGAN_EVIDENCE_TIER/);

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
    assert.equal(
      quantityPayload.stateRoot,
      semanticStateRoot({ 'result.quantity': quantity('Temperature', 25) }),
    );

    const invalidQuantityPath = path.join(temp, 'invalid-quantity.rbc');
    writeFileSync(invalidQuantityPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'quantity', operation: 'make', args: ['Warp', 25, ''], target: 'result.quantity' }],
    }));
    const invalidQuantity = spawnSync(host, [invalidQuantityPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(invalidQuantity.status, 2, `${invalidQuantity.stdout}\n${invalidQuantity.stderr}`);
    assert.match(parsePayload(invalidQuantity).message, /RCL_DOMAIN_QUANTITY_TYPE/);

    const missingPath = path.join(temp, 'missing.rbc');
    writeFileSync(missingPath, assembleRbc13DomainCallProgram({
      calls: [{ domain: 'core', operation: 'missing', args: ['x'], target: 'result.missing' }],
    }));
    const missing = spawnSync(host, [missingPath, '--candidate-minimum'], { encoding: 'utf8' });
    assert.equal(missing.status, 2, `${missing.stdout}\n${missing.stderr}`);
    assert.match(parsePayload(missing).message, /RCL_DOMAIN_ORGAN_MISSING/);

    const legacyPath = path.join(temp, 'legacy.rbc');
    writeFileSync(legacyPath, compileRealityToBytecode('reality Legacy { facet world.ready : Truth = true }'));
    const legacy = spawnSync(host, [legacyPath], { encoding: 'utf8' });
    assert.equal(legacy.status, 0, `${legacy.stdout}\n${legacy.stderr}`);
    assert.equal(parsePayload(legacy).state['world.ready'], true);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
