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

export {
  RCL_SOURCE_CAPABILITY_FRONTENDS_VERSION,
  RCL_SOURCE_CAPABILITY_BUNDLE_FORMAT,
  RCL_SOURCE_CAPABILITY_FRONTEND_KINDS,
  RCLSourceCapabilityFrontendError,
  detectSourceCapabilityKind,
  extractCapabilitiesFromJsonSchema,
  extractCapabilitiesFromOpenApi,
  extractCapabilitiesFromSqlDdl,
  extractSourceCapabilities,
  metabolizeSourceCapabilityBundle,
} from './source-capability-frontends.mjs';

export {
  RCL_EQUIVALENCE_CORPUS_VERSION,
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCL_CAPABILITY_CORPUS_FORMAT,
  RCL_EQUIVALENCE_CASE_FORMAT,
  RCL_MUTATION_PLAN_FORMAT,
  RCLEquivalenceCorpusError,
  forgeJsonSchemaCapabilityCorpus,
  forgeOpenApiCapabilityCorpus,
  forgeSqlCapabilityCorpus,
  forgeEquivalenceCorpus,
  differentialCasesFromCorpus,
  createDifferentialExperimentPlan,
} from './equivalence-corpus-forge.mjs';

export {
  RCL_EXECUTABLE_NEGATIVE_CONTROLS_VERSION,
  RCL_EXECUTABLE_NEGATIVE_CONTROL_SET_FORMAT,
  RCL_CORPUS_DIFFERENTIAL_EXPERIMENT_FORMAT,
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  RCLExecutableNegativeControlError,
  verifyExecutableCorpusIntegrity,
  synthesizeExecutableNegativeControls,
  runCorpusDifferentialExperiment,
} from './executable-negative-controls.mjs';

export {
  RCL_ADAPTIVE_CORPUS_VERSION,
  RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT,
  RCL_ADAPTIVE_CORPUS_LOOP_FORMAT,
  RCLAdaptiveCorpusError,
  analyzeCorpusFeedback,
  materializeAdaptiveCorpusRevision,
  runAdaptiveCorpusLoop,
} from './adaptive-corpus-loop.mjs';
