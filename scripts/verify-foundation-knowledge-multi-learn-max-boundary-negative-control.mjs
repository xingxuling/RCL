#!/usr/bin/env node
import { compileReality } from '../src/compiler.mjs';
import { lowerDeclaredKnowledgeToCore } from '../src/foundation-knowledge-direct-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_NEGATIVE_CONTROL_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

const fiveClaimFirstLearn = [
  'reality KnowledgeMultiLearnOverClaimBoundary {',
  '  facet world.a : Number = 1',
  '  facet world.b : Number = 2',
  '  facet world.c : Number = 3',
  '  facet world.d : Number = 4',
  '  facet world.e : Number = 5',
  '  facet world.f : Number = 6',
  '  knowledge mind {',
  '    claim a : Number = world.a source "sensor:a"',
  '    claim b : Number = world.b source "sensor:b"',
  '    claim c : Number = world.c source "sensor:c"',
  '    claim d : Number = world.d source "sensor:d"',
  '    claim e : Number = world.e source "sensor:e"',
  '  }',
  '  knowledge context {',
  '    claim f : Number = world.f source "sensor:f"',
  '  }',
  '  learn mind',
  '  learn context',
  '}',
  '',
].join('\n');

const threeLearnSource = [
  'reality KnowledgeMultiLearnOverLearnBoundary {',
  '  facet world.a : Number = 1',
  '  facet world.b : Number = 2',
  '  facet world.c : Number = 3',
  '  knowledge first {',
  '    claim a : Number = world.a source "sensor:a"',
  '  }',
  '  knowledge second {',
  '    claim b : Number = world.b source "sensor:b"',
  '  }',
  '  knowledge third {',
  '    claim c : Number = world.c source "sensor:c"',
  '  }',
  '  learn first',
  '  learn second',
  '  learn third',
  '}',
  '',
].join('\n');

function compileCase(source, label) {
  let program;
  try { program = compileReality(source); }
  catch (error) {
    fail(`${label} did not parse; negative control must exercise lowering rather than syntax failure.`, {
      code: error?.code ?? null,
      error: error?.message ?? String(error),
    }, 233);
  }

  let lowering;
  try { lowering = lowerDeclaredKnowledgeToCore(program); }
  catch (error) {
    fail(`${label} threw during Knowledge lowering instead of failing closed through diagnostics.`, {
      code: error?.code ?? null,
      error: error?.message ?? String(error),
    }, 234);
  }

  let compiled;
  try { compiled = tryCompileFoundationRealityToBytecode(program); }
  catch (error) {
    fail(`${label} threw during bytecode compilation instead of failing closed through diagnostics.`, {
      code: error?.code ?? null,
      error: error?.message ?? String(error),
    }, 235);
  }
  return { lowering, compiled };
}

function assertProviderBound(result, label, exitCode) {
  const loweringDiagnostics = result?.lowering?.diagnostics ?? [];
  const compiledDiagnostics = result?.compiled?.diagnostics ?? [];
  const loweringRejected = result?.lowering?.summary?.knowledgeLoweredDeclarationCount === 0
    && result?.lowering?.summary?.nativeKnowledgeRecordCount === 0
    && result?.lowering?.summary?.remainingKnowledgeCount >= 1
    && loweringDiagnostics.some(item => item?.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED');
  const bytecodeRejected = result?.compiled?.ok === false && !result?.compiled?.bytecode;

  if (!loweringRejected || !bytecodeRejected) {
    fail(`${label} crossed the bounded Knowledge autonomy surface instead of failing closed to Provider-required.`, {
      loweringSummary: result?.lowering?.summary ?? null,
      loweringDiagnostics,
      compiledOk: result?.compiled?.ok ?? null,
      compiledDiagnostics,
      bytecodePresent: Boolean(result?.compiled?.bytecode),
    }, exitCode);
  }

  return {
    loweringDiagnosticCodes: loweringDiagnostics.map(item => item?.code).filter(Boolean),
    compiledDiagnosticCodes: compiledDiagnostics.map(item => item?.code).filter(Boolean),
  };
}

const overClaim = assertProviderBound(
  compileCase(fiveClaimFirstLearn, 'five-claim first Learn'),
  'Five claims in one Learn',
  236,
);
const overLearn = assertProviderBound(
  compileCase(threeLearnSource, 'three-Learn program'),
  'Three Learn directives',
  237,
);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_NEGATIVE_CONTROL_PASS',
  overClaim,
  overLearn,
  truthBoundary: {
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    fiveOrMoreClaimsPerLearnRemainProviderBound: true,
    threeOrMoreLearnDirectivesRemainProviderBound: true,
    overBoundaryBytecodeEmissionRejected: true,
    lowererProviderRequiredDiagnosticRequired: true,
  },
}, null, 2));
