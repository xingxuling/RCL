import { createHash } from 'node:crypto';

export const RCL_NATIVE_VM_EXECUTION_ATTESTATION_FORMAT = 'taowind.rcl-native-vm-execution-attestation.v0.1';
export const RCL_NATIVE_VM_EXECUTION_ATTESTATION_VERSION = '0.1.0';
export const RCL_NATIVE_VM_EXECUTION_ATTESTATION_ROOT_ALGORITHM = 'rcl.native-vm-execution-attestation.sha256.v0.1';

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function rootFor(binding) {
  return createHash('sha256').update(JSON.stringify(canonicalJson(binding))).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

export function createNativeVmExecutionAttestation(materialization, payload) {
  const binarySha256 = materialization?.binarySha256 ?? materialization?.build?.binarySha256 ?? null;
  const binding = {
    algorithm: RCL_NATIVE_VM_EXECUTION_ATTESTATION_ROOT_ALGORITHM,
    vmIdentity: typeof payload?.vm === 'string' ? payload.vm : null,
    bytecodeVersion: typeof payload?.bytecodeVersion === 'string' ? payload.bytecodeVersion : null,
    program: typeof payload?.program === 'string' ? payload.program : null,
    programSourceRoot: typeof payload?.sourceRoot === 'string' ? payload.sourceRoot : null,
    materialization: {
      format: materialization?.format ?? null,
      version: materialization?.version ?? null,
      provenance: materialization?.provenance ?? null,
      sourceRoot: materialization?.sourceRoot ?? null,
      binarySha256,
    },
  };
  return {
    format: RCL_NATIVE_VM_EXECUTION_ATTESTATION_FORMAT,
    version: RCL_NATIVE_VM_EXECUTION_ATTESTATION_VERSION,
    ...binding,
    attestationRoot: rootFor(binding),
  };
}

export function verifyNativeVmExecutionAttestation(attestation) {
  const checks = {
    format: attestation?.format === RCL_NATIVE_VM_EXECUTION_ATTESTATION_FORMAT,
    version: attestation?.version === RCL_NATIVE_VM_EXECUTION_ATTESTATION_VERSION,
    vmIdentity: typeof attestation?.vmIdentity === 'string' && attestation.vmIdentity.startsWith('rcl-native-vm/'),
    bytecodeVersion: typeof attestation?.bytecodeVersion === 'string' && attestation.bytecodeVersion.length > 0,
    programSourceRoot: typeof attestation?.programSourceRoot === 'string' && attestation.programSourceRoot.length > 0,
    materializationFormat: typeof attestation?.materialization?.format === 'string' && attestation.materialization.format.length > 0,
    materializationVersion: typeof attestation?.materialization?.version === 'string' && attestation.materialization.version.length > 0,
    materializationProvenance: typeof attestation?.materialization?.provenance === 'string' && attestation.materialization.provenance.length > 0,
    binarySha256: isSha256(attestation?.materialization?.binarySha256),
  };
  const binding = {
    algorithm: attestation?.algorithm ?? null,
    vmIdentity: attestation?.vmIdentity ?? null,
    bytecodeVersion: attestation?.bytecodeVersion ?? null,
    program: attestation?.program ?? null,
    programSourceRoot: attestation?.programSourceRoot ?? null,
    materialization: canonicalJson(attestation?.materialization ?? {}),
  };
  checks.algorithm = binding.algorithm === RCL_NATIVE_VM_EXECUTION_ATTESTATION_ROOT_ALGORITHM;
  const expectedRoot = rootFor(binding);
  checks.attestationRoot = isSha256(attestation?.attestationRoot) && attestation.attestationRoot === expectedRoot;
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    expectedRoot,
    attestationRoot: attestation?.attestationRoot ?? null,
  };
}
