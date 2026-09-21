import { compileReality } from './compiler.mjs';
import { tryCompileRealityToBytecode } from './bytecode.mjs';
import { lowerDeclaredFoundationToCore } from './foundation-direct-lowering.mjs';
import { lowerDeclaredQuantitativeToCore } from './foundation-quantitative-direct-lowering.mjs';
import { lowerDeclaredEnergyToCore } from './foundation-energy-direct-lowering.mjs';
import { lowerDeclaredKnowledgeToCore } from './foundation-knowledge-direct-lowering.mjs';
import { lowerFoundationQuantitiesForNativeBytecode } from './foundation-quantity-native-lowering.mjs';
import {
  FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from './foundation-direct-capability-registry.mjs';

export const FOUNDATION_DIRECT_BYTECODE_FORMAT = 'taowind.rcl-foundation-direct-bytecode.v0.7';

function prepareKnowledgeFirstWriteNativeProgram(program, knowledgeLowering) {
  const lowered = Array.isArray(knowledgeLowering?.lowered) ? knowledgeLowering.lowered : [];
  if (lowered.length === 0) {
    return {
      program,
      omittedInitialFacetPaths: [],
      firstWriteRules: [],
      truthBoundary: {
        knowledgeInitialStateEncodingChanged: false,
        omissionAllowedOnlyForFirstDirectiveBoundedLearn: true,
      },
    };
  }

  if (lowered.length !== 1) {
    throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_REQUIRES_SINGLE_LOWERING');
  }
  const item = lowered[0];
  if (
    item?.domain !== 'knowledge'
    || item?.directive !== 'Learn'
    || Number(item?.directiveIndex) !== 0
    || typeof item?.claimPath !== 'string'
    || typeof item?.syntheticRule !== 'string'
  ) {
    throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_METADATA_INVALID');
  }

  const firstDirective = program?.directives?.[0];
  const firstRule = (program?.rules ?? []).find(rule => rule?.name === item.syntheticRule);
  const exactFirstWriteRule = firstDirective?.kind === 'Realize'
    && firstDirective?.rule === item.syntheticRule
    && firstRule?.when?.kind === 'LiteralExpr'
    && firstRule?.when?.valueType === 'Truth'
    && firstRule?.when?.value === true
    && (firstRule?.needs?.length ?? 0) === 0
    && (firstRule?.calls?.length ?? 0) === 0
    && (firstRule?.preserves?.length ?? 0) === 0
    && (firstRule?.alters?.length ?? 0) === 1
    && firstRule.alters[0]?.target === item.claimPath;
  if (!exactFirstWriteRule) {
    throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_ORDER_UNPROVEN');
  }

  const facets = Array.isArray(program?.facets) ? program.facets : [];
  const matchingFacets = facets.filter(facet => facet?.path === item.claimPath);
  if (matchingFacets.length !== 1) {
    throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_FACET_IDENTITY_DRIFT');
  }

  return {
    program: {
      ...program,
      facets: facets.filter(facet => facet?.path !== item.claimPath),
    },
    omittedInitialFacetPaths: [item.claimPath],
    firstWriteRules: [item.syntheticRule],
    truthBoundary: {
      knowledgeInitialStateEncodingChanged: true,
      omissionAllowedOnlyForFirstDirectiveBoundedLearn: true,
      firstDirectiveMustBeUnconditionalSingleTargetRealize: true,
      omissionPreservesReferencePreLearnRealityBoundary: true,
      omittedFacetIsCreatedByTheFirstNativeTransaction: true,
      genericDeferredFacetSupportClaimed: false,
    },
  };
}

export function tryCompileFoundationRealityToBytecode(sourceOrProgram, options = {}) {
  try {
    const compileSource = options.compileSource ?? compileReality;
    const compileBytecode = options.compileBytecode ?? tryCompileRealityToBytecode;
    const program = typeof sourceOrProgram === 'string' ? compileSource(sourceOrProgram) : sourceOrProgram;
    const capabilityRegistry = foundationDirectCapabilityRegistrySnapshot();
    const quantitativeLowering = lowerDeclaredQuantitativeToCore(program);
    const energyLowering = lowerDeclaredEnergyToCore(quantitativeLowering.program);
    const knowledgeLowering = lowerDeclaredKnowledgeToCore(energyLowering.program);
    const lowering = lowerDeclaredFoundationToCore(knowledgeLowering.program, {
      ...options,
      domains: options.domains ?? FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS,
    });
    const quantityLowering = lowerFoundationQuantitiesForNativeBytecode(lowering.program);
    const knowledgeNativeInitialization = prepareKnowledgeFirstWriteNativeProgram(
      quantityLowering.program,
      knowledgeLowering,
    );
    const { program: nativeProgram, ...knowledgeNativeInitializationEvidence } = knowledgeNativeInitialization;
    const result = compileBytecode(nativeProgram);
    return {
      ...result,
      program: result?.ok ? lowering.program : result?.program ?? null,
      foundationDirectCapabilityRegistry: capabilityRegistry,
      foundationQuantitativeDirectLowering: {
        format: quantitativeLowering.format,
        version: quantitativeLowering.version,
        lowered: quantitativeLowering.lowered,
        diagnostics: quantitativeLowering.diagnostics,
        summary: quantitativeLowering.summary,
        truthBoundary: quantitativeLowering.truthBoundary,
      },
      foundationEnergyDirectLowering: {
        format: energyLowering.format,
        version: energyLowering.version,
        lowered: energyLowering.lowered,
        diagnostics: energyLowering.diagnostics,
        summary: energyLowering.summary,
        truthBoundary: energyLowering.truthBoundary,
      },
      foundationKnowledgeDirectLowering: {
        format: knowledgeLowering.format,
        version: knowledgeLowering.version,
        lowered: knowledgeLowering.lowered,
        diagnostics: knowledgeLowering.diagnostics,
        summary: knowledgeLowering.summary,
        truthBoundary: knowledgeLowering.truthBoundary,
      },
      foundationKnowledgeNativeInitialization: knowledgeNativeInitializationEvidence,
      foundationDirectLowering: {
        format: FOUNDATION_DIRECT_BYTECODE_FORMAT,
        lowered: lowering.lowered,
        diagnostics: lowering.diagnostics,
        summary: lowering.summary,
        truthBoundary: lowering.truthBoundary,
      },
      foundationQuantityNativeLowering: {
        format: quantityLowering.format,
        version: quantityLowering.version,
        summary: quantityLowering.summary,
        truthBoundary: quantityLowering.truthBoundary,
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [{
        code: error?.code ?? 'RCL_FOUNDATION_DIRECT_LOWERING_FAILURE',
        message: error?.message ?? String(error),
        details: error?.details ?? {},
      }],
      program: null,
      bytecode: null,
      foundationDirectCapabilityRegistry: null,
      foundationQuantitativeDirectLowering: null,
      foundationEnergyDirectLowering: null,
      foundationKnowledgeDirectLowering: null,
      foundationKnowledgeNativeInitialization: null,
      foundationDirectLowering: null,
      foundationQuantityNativeLowering: null,
    };
  }
}
