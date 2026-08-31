import { realityRoot } from './canonical.mjs';

export const RCL_ASIL_GOVERNED_ENVELOPE_VERSION = '0.1.0-candidate.1';
export const RCL_ASIL_GOVERNED_ENVELOPE_FORMAT = 'rcl.asil-governed-envelope.v0.1';

const SHA256_RE = /^[0-9a-f]{64}$/u;

function requiredText(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(code);
  return value.trim();
}
function requiredRoot(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new TypeError(code);
  return value;
}
function roots(values, code) {
  if (!Array.isArray(values)) throw new TypeError(code);
  const out = values.map((value) => requiredRoot(value, code));
  if (new Set(out).size !== out.length) throw new TypeError(`${code}_DUPLICATE`);
  return out.sort();
}
function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
}

export function createAsilGovernedEnvelope(input = {}) {
  const meaningOwner = requiredText(input.meaningOwner, 'RCL_ASIL_MEANING_OWNER_REQUIRED');
  if (meaningOwner !== 'asil') throw new Error('RCL_ASIL_MEANING_OWNER_MISMATCH');
  const meaningRoot = requiredRoot(input.meaningRoot, 'RCL_ASIL_MEANING_ROOT_INVALID');
  const meaningFormat = requiredText(input.meaningFormat, 'RCL_ASIL_MEANING_FORMAT_REQUIRED');
  const meaningVersion = requiredText(input.meaningVersion, 'RCL_ASIL_MEANING_VERSION_REQUIRED');
  const evidenceRoots = roots(input.evidenceRoots ?? [], 'RCL_ASIL_EVIDENCE_ROOT_INVALID');
  const unknownRefs = [...new Set((input.unknownRefs ?? []).map((value) => requiredText(value, 'RCL_ASIL_UNKNOWN_REF_INVALID')))].sort();
  const authority = objectOrEmpty(input.authority);
  const transition = objectOrEmpty(input.transition);
  const rollback = objectOrEmpty(input.rollback);

  if (authority.authorityGranted === true || authority.authorityEscalationPerformed === true) {
    throw new Error('RCL_ASIL_MEANING_CANNOT_GRANT_AUTHORITY');
  }
  if (authority.rclEvidenceCommitPerformed === true || authority.worldFactPromoted === true || authority.rncsRealityCommitPerformed === true) {
    throw new Error('RCL_ASIL_ENVELOPE_CANNOT_CLAIM_COMMIT');
  }
  if ((authority.mode ?? 'candidate-only') !== 'candidate-only') {
    throw new Error('RCL_ASIL_AUTHORITY_MODE_UNSUPPORTED');
  }
  if ((transition.mode ?? 'proposal-only') !== 'proposal-only') {
    throw new Error('RCL_ASIL_TRANSITION_MODE_UNSUPPORTED');
  }
  if ((rollback.required ?? true) !== true) {
    throw new Error('RCL_ASIL_ROLLBACK_REQUIRED');
  }

  const core = {
    format: RCL_ASIL_GOVERNED_ENVELOPE_FORMAT,
    version: RCL_ASIL_GOVERNED_ENVELOPE_VERSION,
    meaning: {
      owner: 'asil',
      root: meaningRoot,
      format: meaningFormat,
      version: meaningVersion,
      immutableInput: true,
    },
    evidenceRoots,
    unknownRefs,
    condition: objectOrEmpty(input.condition),
    effectScope: objectOrEmpty(input.effectScope),
    authority: {
      ...authority,
      mode: 'candidate-only',
      authorityGranted: false,
      authorityEscalationPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
      rncsRealityCommitPerformed: false,
    },
    transition: {
      ...transition,
      mode: 'proposal-only',
      committed: false,
    },
    rollback: {
      ...rollback,
      required: true,
      performed: false,
    },
    ownership: {
      meaning: 'asil',
      governedEnvelope: 'rcl',
      worldState: 'rncs',
    },
  };
  return Object.freeze({ ...core, envelopeRoot: realityRoot(core) });
}
