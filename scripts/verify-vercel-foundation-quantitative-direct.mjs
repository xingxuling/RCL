#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const proofPath = path.join(publicDir, 'rcl-foundation-quantitative-direct-native-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const source = [
  'reality VercelQuantitativeDeclaredDirectProof {',
  '  facet ambient.raw : Temperature = celsius(8)',
  '  quantitative sensor {',
  '    measure temperature : Temperature = ambient.raw uncertainty celsius(0.2) confidence 0.98 unit "°C" scale interval evidence "sensor:ambient-v1" calibrated by "calibration:ambient-v1"',
  '    derive healthy : Truth = confidence(sensor.temperature) >= 0.95',
  '    preserve confidence(sensor.temperature) >= 0.90',
  '  }',
  '  quantify sensor',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before declared Quantitative proof', { target });
  const binarySha256 = sha256(fs.readFileSync(target));
  const compiled = tryCompileFoundationRealityToBytecode(source);
  if (!compiled?.ok || !compiled?.bytecode) {
    fail('Declared Quantitative source did not compile to generic canonical bytecode', {
      diagnostics: compiled?.diagnostics ?? null,
      directLowering: compiled?.foundationQuantitativeDirectLowering ?? null,
    });
  }

  const direct = compiled.foundationQuantitativeDirectLowering;
  if (direct?.summary?.quantitativeLoweredDeclarationCount !== 1
    || direct?.summary?.remainingQuantitativeCount !== 0
    || direct?.summary?.measurementRecordCount !== 1) {
    fail('Declared Quantitative lowering did not close exactly one measurement domain slice', {
      summary: direct?.summary ?? null,
    });
  }
  if (direct?.truthBoundary?.declaredQuantitativeDirectLoweringImplemented !== true
    || direct?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || direct?.truthBoundary?.referenceRuntimeParityClaimed !== false) {
    fail('Declared Quantitative lowering truth boundary is not fail-closed', {
      truthBoundary: direct?.truthBoundary ?? null,
    });
  }

  const native = runNativeBytecode(compiled.bytecode, {
    vmPath: target,
    buildIfMissing: false,
    timeout: 30_000,
    requireNativeStateRoot: true,
  });
  if (native?.status !== 'ok' || native?.stateRootVerified !== true || native?.stateRootParity !== true) {
    fail('Declared Quantitative bytecode did not close canonical native state-root verification', {
      status: native?.status ?? null,
      stateRootVerified: native?.stateRootVerified ?? false,
      stateRootParity: native?.stateRootParity ?? false,
      stderr: native?.stderr ?? null,
    });
  }

  const measurement = native?.state?.['sensor.temperature'];
  const healthy = native?.state?.['sensor.healthy'];
  if (measurement?.kind !== 'Measurement'
    || measurement?.baseType !== 'Temperature'
    || measurement?.value?.kind !== 'Quantity'
    || measurement?.value?.type !== 'Temperature'
    || measurement?.value?.value !== 8
    || measurement?.value?.unit !== '°C'
    || measurement?.uncertainty?.kind !== 'Quantity'
    || measurement?.uncertainty?.type !== 'Temperature'
    || measurement?.uncertainty?.value !== 0.2
    || measurement?.confidence !== 0.98
    || measurement?.unit !== '°C'
    || measurement?.scale !== 'interval'
    || measurement?.evidence !== '["sensor:ambient-v1"]'
    || measurement?.calibratedBy !== 'calibration:ambient-v1') {
    fail('Canonical native state did not retain the declared measurement semantics', { measurement });
  }
  if (healthy !== true) fail('Declared quantitative derived facet did not evaluate through the lowered measurement accessor', { healthy });

  const history = Array.isArray(native?.history) ? native.history : [];
  const quantitativeTransaction = history.find(item =>
    item?.rule === '__rcl_foundation_quantitative_sensor_0'
    || item?.witnesses?.includes?.('rcl:foundation:quantitative:sensor')
  ) ?? null;

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-quantitative-direct-native-proof.v0.1',
    domain: 'quantitative',
    status: 'native-direct-verified',
    verified: true,
    executionMode: 'declared-domain-direct-lowering',
    binarySha256,
    lowering: direct,
    nativeStateRoot: native?.stateRoot ?? null,
    stateRootVerified: true,
    stateRootParity: true,
    transactionWitnessObserved: Boolean(quantitativeTransaction),
    finalState: {
      'sensor.temperature': measurement,
      'sensor.healthy': healthy,
    },
    truthBoundary: {
      declaredDomainDirectLoweringVerified: true,
      domain: 'quantitative',
      providerBridgeUsedForThisProof: false,
      referenceRuntimeParityClaimed: false,
      domainReceiptParityClaimed: false,
      deploymentHealthBound: false,
      providerBridgeRemovedGlobally: false,
      allFoundationDomainsNativeClaimed: false,
    },
  };

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_DIRECT_NATIVE_VERIFIED',
    binarySha256,
    nativeStateRoot: artifact.nativeStateRoot,
    transactionWitnessObserved: artifact.transactionWitnessObserved,
    measurement: {
      baseType: measurement.baseType,
      confidence: measurement.confidence,
      unit: measurement.unit,
      scale: measurement.scale,
    },
    healthy,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
