import { verifyFoundationDirectNativeParityComposite } from './foundation-direct-native-parity-composite.mjs';
import { verifyNativeVmExecutionAttestation } from './native-vm-execution-attestation.mjs';

export const FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_FORMAT = 'taowind.rcl-foundation-direct-native-parity-attested.v0.1';
export const FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_VERSION = '0.1.0';

function unique(values) { return [...new Set(values)]; }

export async function verifyFoundationDirectNativeParityAttested(sourceOrProgram, options = {}) {
  const verifyComposite = options.verifyComposite ?? verifyFoundationDirectNativeParityComposite;
  const verifyExecutionAttestation = options.verifyExecutionAttestation ?? verifyNativeVmExecutionAttestation;
  const delegateOptions = { ...options };
  delete delegateOptions.verifyComposite;
  delete delegateOptions.verifyExecutionAttestation;

  const base = await verifyComposite(sourceOrProgram, delegateOptions);
  const attestation = base?.nativeExecutionAttestation ?? null;
  const attestationVerification = verifyExecutionAttestation(attestation);
  const baseParity = base?.parity && typeof base.parity === 'object' ? base.parity : null;
  const parity = baseParity ? { ...baseParity, nativeExecutionAttestation: attestationVerification?.ok === true } : null;
  const baseVerified = base?.verified === true && base?.status === 'native-verified';
  const verified = baseVerified && attestationVerification?.ok === true;
  const gaps = unique([
    ...(Array.isArray(base?.gaps) ? base.gaps : []),
    ...(attestationVerification?.ok === true ? [] : ['nativeExecutionAttestation']),
  ]);

  return {
    ...base,
    format: FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_FORMAT,
    version: FOUNDATION_DIRECT_NATIVE_PARITY_ATTESTED_VERSION,
    status: baseVerified ? (verified ? 'native-verified' : 'parity-failed') : base?.status ?? 'parity-failed',
    verified,
    parity,
    executionAttestationVerification: attestationVerification,
    gaps: verified ? [] : gaps,
    truthBoundary: {
      ...(base?.truthBoundary ?? {}),
      nativeExecutionAttestationRequiredForNativeVerified: true,
      exactExecutableArtifactIdentityIsNonCompensatory: true,
      defaultFoundationParityEntryPointPromotedToAttested: false,
    },
  };
}
