import { compileReality } from './compiler.mjs';
import { tryCompileRealityToBytecode } from './bytecode.mjs';
import { lowerDeclaredFoundationToCore } from './foundation-direct-lowering.mjs';
import { lowerDeclaredQuantitativeToCore } from './foundation-quantitative-direct-lowering.mjs';
import { lowerDeclaredEnergyToCore } from './foundation-energy-direct-lowering.mjs';
import {
  FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
  lowerDeclaredKnowledgeToCore,
} from './foundation-knowledge-direct-lowering.mjs';
import { lowerFoundationQuantitiesForNativeBytecode } from './foundation-quantity-native-lowering.mjs';
import {
  FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from './foundation-direct-capability-registry.mjs';

export const FOUNDATION_DIRECT_BYTECODE_FORMAT = 'taowind.rcl-foundation-direct-bytecode.v0.9';

function expectedTargetsForLowering(item) {
  return Array.isArray(item?.stateTargets)
    ? [...item.stateTargets]
    : (Array.isArray(item?.claimPaths) ? [...item.claimPaths] : [item?.claimPath].filter(Boolean));
}

function prepareKnowledgeFirstWriteNativeProgram(program, knowledgeLowering) {
  const lowered = Array.isArray(knowledgeLowering?.lowered) ? knowledgeLowering.lowered : [];
  if (lowered.length === 0) {
    return {
      program,
      omittedInitialFacetPaths: [],
      firstWriteRules: [],
      truthBoundary: {
        knowledgeInitialStateEncodingChanged: false,
        omissionAllowedOnlyForContiguousLeadingBoundedLearns: true,
      },
    };
  }

  if (lowered.length > FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS) {
    throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_LEARN_BOUND_EXCEEDED');
  }

  const facets = Array.isArray(program?.facets) ? program.facets : [];
  const allTargets = [];
  const firstWriteRules = [];

  for (let index = 0; index < lowered.length; index += 1) {
    const item = lowered[index];
    const expectedTargets = expectedTargetsForLowering(item);
    const uniqueTargets = [...new Set(expectedTargets)];
    if (
      item?.domain !== 'knowledge'
      || item?.directive !== 'Learn'
      || Number(item?.directiveIndex) !== index
      || typeof item?.syntheticRule !== 'string'
      || expectedTargets.length < 1
      || expectedTargets.length !== Number(item?.claimCount ?? expectedTargets.length)
      || uniqueTargets.length !== expectedTargets.length
      || expectedTargets.some(target => typeof target !== 'string' || target.length === 0)
    ) {
      throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_METADATA_INVALID');
    }

    const directive = program?.directives?.[index];
    const rule = (program?.rules ?? []).find(candidate => candidate?.name === item.syntheticRule);
    const actualTargets = (rule?.alters ?? []).map(alter => alter?.target);
    const sameTargets = actualTargets.length === expectedTargets.length
      && [...actualTargets].sort().every((target, targetIndex) => target === [...expectedTargets].sort()[targetIndex]);
    const exactFirstWriteRule = directive?.kind === 'Realize'
      && directive?.rule === item.syntheticRule
      && rule?.when?.kind === 'LiteralExpr'
      && rule?.when?.valueType === 'Truth'
      && rule?.when?.value === true
      && (rule?.needs?.length ?? 0) === 0
      && (rule?.calls?.length ?? 0) === 0
      && (rule?.preserves?.length ?? 0) === 0
      && sameTargets;
    if (!exactFirstWriteRule) {
      throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_ORDER_UNPROVEN');
    }

    for (const target of expectedTargets) {
      if (allTargets.includes(target)) {
        throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_TARGET_COLLISION');
      }
      const matchingFacets = facets.filter(facet => facet?.path === target);
      if (matchingFacets.length !== 1) {
        throw new Error('RCL_KNOWLEDGE_NATIVE_FIRST_WRITE_FACET_IDENTITY_DRIFT');
      }
      allTargets.push(target);
    }
    firstWriteRules.push(item.syntheticRule);
  }

  const targetSet = new Set(allTargets);
  return {
    program: {
      ...program,
      facets: facets.filter(facet => !targetSet.has(facet?.path)),
    },
    omittedInitialFacetPaths: allTargets,
    firstWriteRules,
    truthBoundary: {
      knowledgeInitialStateEncodingChanged: true,
      omissionAllowedOnlyForContiguousLeadingBoundedLearns: true,
      maxBoundedLearnDirectiveCount: FOUNDATION_KNOWLEDGE_MAX_BOUNDED_LEARNS,
      leadingDirectivesMustBeUnconditionalAtomicMultiTargetRealizes: true,
      omissionPreservesReferencePreLearnRealityBoundary: true,
      omittedFacetsAreCreatedByOrderedLeadingNativeTransactions: true,
      omittedFacetCount: allTargets.length,
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
