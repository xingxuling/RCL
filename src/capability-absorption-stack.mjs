export {
  RCL_CAPABILITY_METABOLISM_VERSION,
  RCL_CAPABILITY_SPEC_FORMAT,
  CAPABILITY_METABOLISM_STAGES,
  RCLCapabilityMetabolismError,
  normalizeExternalCapabilitySpec,
  extractCapabilitySemanticKernel,
  evaluateDeclaredEquivalence,
  renderCapabilityAsRcl,
  metabolizeExternalCapability,
  synthesizeAbsorbedCapabilities,
} from './capability-metabolism.mjs';

export {
  RCL_DIFFERENTIAL_ABSORPTION_VERSION,
  RCL_EXECUTION_OBSERVATION_FORMAT,
  RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT,
  RCLDifferentialAbsorptionError,
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
  attachIndependentDifferentialEvidence,
} from './differential-absorption-runner.mjs';

export {
  RCL_NATIVE_CAPABILITY_PROMOTION_VERSION,
  RCL_NATIVE_IMPLEMENTATION_MANIFEST_FORMAT,
  RCL_NATIVE_PROMOTION_REPORT_FORMAT,
  RCL_NATIVE_PROMOTION_STATUSES,
  RCLNativeCapabilityPromotionError,
  createNativeCapabilityImplementationManifest,
  createNativeRuntimeObservation,
  promoteCapabilityToNative,
} from './native-capability-promotion.mjs';
