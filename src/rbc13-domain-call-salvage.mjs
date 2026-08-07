import { createHash } from 'node:crypto';
import { RCLRuntimeError } from './errors.mjs';
import { quantity, measurement } from './quantity.mjs';
import { knowledgeClaim } from './knowledge.mjs';

export const RBC13_DOMAIN_CALL_SALVAGE_FORMAT =
  'taowind.rcl-rbc13-domain-call-salvage.v0.1';

export const RBC13_DOMAIN_CALL_ABI_CANDIDATE = Object.freeze({
  bytecodeMajor: 1,
  bytecodeMinor: 3,
  opcode: 45,
  opcodeName: 'DOMAIN_CALL',
  literalDispatchFlag: 0,
  dynamicDispatchFlag: 1,
  canonicalEnabled: false,
  currentCanonicalFeatureVersion: '1.2',
  provenance: Object.freeze({
    branch: 'agent/advanced-runtime-rcl',
    firstCommit: '70326b1c9e754410576975d08ae49df7d7ade21b',
    finalCommit: '4246f11b696d19cef5f92f43f76cfd026fa1f09f',
  }),
});

const LEGACY_REFERENCE_OPERATION_SPECS = Object.freeze([
  Object.freeze({
    key: 'core.echo',
    domain: 'core',
    operation: 'echo',
    evidenceClass: 'legacy-js-reference-and-native-candidate',
    currentOracle: 'identity',
  }),
  Object.freeze({
    key: 'quantity.make',
    domain: 'quantity',
    operation: 'make',
    evidenceClass: 'legacy-js-reference-and-native-candidate',
    currentOracle: 'src/quantity.mjs#quantity',
  }),
  Object.freeze({
    key: 'quantitative.measure',
    domain: 'quantitative',
    operation: 'measure',
    evidenceClass: 'legacy-js-reference-and-native-candidate',
    currentOracle: 'src/quantity.mjs#measurement',
  }),
  Object.freeze({
    key: 'knowledge.claim',
    domain: 'knowledge',
    operation: 'claim',
    evidenceClass: 'legacy-js-reference-and-native-candidate',
    currentOracle: 'src/knowledge.mjs#knowledgeClaim',
  }),
]);

const LEGACY_NATIVE_ONLY_OPERATION_SPECS = Object.freeze([
  ['language.utterance', 'natural-language.interpret'],
  ['language.intent', 'natural-language.interpret'],
  ['understanding.model', 'understanding.model'],
  ['creation.candidate', 'creative.generate'],
  ['creation.select', 'creative.generate'],
  ['energy.scale', 'energy.balance'],
  ['element.species', 'elemental.compose'],
  ['element.compound', 'elemental.compose'],
  ['science.claim', null],
  ['science.experiment', null],
  ['body.state', 'embodiment.integrate'],
  ['spirit.state', null],
  ['spacetime.point', 'meta.spacetime.sequence'],
  ['spacetime.retime', 'meta.spacetime.sequence'],
].map(([key, nearestCurrentBridge]) => Object.freeze({
  key,
  domain: key.slice(0, key.indexOf('.')),
  operation: key.slice(key.indexOf('.') + 1),
  evidenceClass: 'legacy-native-only-no-current-reference-equivalence',
  nearestCurrentBridge,
  promotionAllowed: false,
})));

export const RBC13_DOMAIN_CALL_OPERATION_INVENTORY = Object.freeze([
  ...LEGACY_REFERENCE_OPERATION_SPECS,
  ...LEGACY_NATIVE_ONLY_OPERATION_SPECS,
]);

const REFERENCE_KEYS = new Set(
  LEGACY_REFERENCE_OPERATION_SPECS.map(item => item.key),
);

function normalizeText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function normalizeArgs(args) {
  if (!Array.isArray(args)) throw new TypeError('domain-call args must be an array');
  return args;
}

/**
 * Source-only salvage of the four operations that had an explicit JavaScript
 * reference implementation on the stale advanced-runtime branch.
 *
 * This function is deliberately NOT wired into the parser, canonical RBC 1.2,
 * or the C native VM. It exists as an independent semantic oracle for a future
 * differential/native-promotion experiment.
 */
export function invokeRbc13DomainCallReference(domainInput, operationInput, argsInput = []) {
  const domain = normalizeText(domainInput, 'domain');
  const operation = normalizeText(operationInput, 'operation');
  const args = normalizeArgs(argsInput);
  const key = `${domain}.${operation}`;

  if (!REFERENCE_KEYS.has(key)) {
    const legacyNativeOnly = LEGACY_NATIVE_ONLY_OPERATION_SPECS.find(item => item.key === key);
    if (legacyNativeOnly) {
      throw new RCLRuntimeError(
        'RCL_DOMAIN_CALL_CANDIDATE_UNIMPLEMENTED',
        `Legacy native-only domain operation '${key}' has no admitted current reference-equivalence oracle`,
        { key, nearestCurrentBridge: legacyNativeOnly.nearestCurrentBridge },
      );
    }
    throw new RCLRuntimeError(
      'RCL_DOMAIN_OPERATION_MISSING',
      `Domain operation '${key}' is not present in the RBC 1.3 salvage inventory`,
      { key },
    );
  }

  if (key === 'core.echo') return args[0];
  if (key === 'quantity.make') {
    return quantity(args[0], args[1], args[2] || undefined);
  }
  if (key === 'quantitative.measure') {
    return measurement(args[0], args[1], {
      uncertainty: args[2],
      confidence: args[3],
      unit: args[4] || undefined,
      scale: args[5],
      evidence: args[6],
      calibratedBy: args[7] || null,
    });
  }
  if (key === 'knowledge.claim') {
    return knowledgeClaim(args[0], args[1], {
      confidence: args[2],
      evidence: args[3],
      source: args[4] || null,
      scope: args[5],
      status: args[6],
      dependencies: args[7],
      revision: args[8],
      formedAtRoot: args[9] || null,
    });
  }

  throw new RCLRuntimeError(
    'RCL_DOMAIN_OPERATION_MISSING',
    `Domain operation '${key}' has no salvage implementation`,
    { key },
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
  );
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function buildRbc13DomainCallSalvageReport() {
  const report = {
    format: RBC13_DOMAIN_CALL_SALVAGE_FORMAT,
    status: 'CANDIDATE',
    sourceBranch: RBC13_DOMAIN_CALL_ABI_CANDIDATE.provenance.branch,
    candidateAbi: RBC13_DOMAIN_CALL_ABI_CANDIDATE,
    inventory: RBC13_DOMAIN_CALL_OPERATION_INVENTORY,
    counts: {
      totalLegacyOperations: RBC13_DOMAIN_CALL_OPERATION_INVENTORY.length,
      admittedReferenceOperations: LEGACY_REFERENCE_OPERATION_SPECS.length,
      quarantinedLegacyNativeOnlyOperations: LEGACY_NATIVE_ONLY_OPERATION_SPECS.length,
    },
    authority: {
      canonicalBytecodeMutationAllowed: false,
      nativeFoundationSyntaxClaimAllowed: false,
      oldBinaryReuseAllowed: false,
      nextPromotionGate: 'independent differential execution against current reference/provider oracles',
    },
  };
  return Object.freeze({ ...report, evidenceRoot: sha256(report) });
}
