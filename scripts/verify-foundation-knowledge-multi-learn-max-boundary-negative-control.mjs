#!/usr/bin/env node
import { compileReality } from '../src/compiler.mjs';
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

function compile(source, label) {
  let program;
  try { program = compileReality(source); }
  catch (error) {
    fail(`${label} did not parse; negative control must exercise lowering rather than syntax failure.`, {
      code: error?.code ?? null,
      error: error?.message ?? String(error),
    }, 294);
  }
  try { return tryCompileFoundationRealityToBytecode(program); }
  catch (error) {
    fail(`${label} threw instead of failing closed through diagnostics.`, {
      code: error?.code ?? null,
      error: error?.message ?? String(error),
    }, 295);
  }
}

const overClaim = compile(fiveClaimFirstLearn, 'five-claim first Learn');
const overLearn = compile(threeLearnSource, 'three-Learn program');
const overClaimDiagnostics = overClaim?.diagnostics ?? [];
const overLearnDiagnostics = overLearn?.diagnostics ?? [];

if (
  overClaim?.ok !== false
  || overClaim?.bytecode
  || !overClaimDiagnostics.some(item => item?.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED')
) {
  fail('Five claims in one Learn crossed the declared four-claim boundary without failing closed to Provider-required.', {
    ok: overClaim?.ok ?? null,
    diagnostics: overClaimDiagnostics,
    bytecodePresent: Boolean(overClaim?.bytecode),
  }, 296);
}

if (
  overLearn?.ok !== false
  || overLearn?.bytecode
  || !overLearnDiagnostics.some(item => item?.code === 'RCL_FOUNDATION_KNOWLEDGE_DIRECT_LOWERING_PROVIDER_REQUIRED')
) {
  fail('Three Learn directives crossed the declared two-Learn boundary without failing closed to Provider-required.', {
    ok: overLearn?.ok ?? null,
    diagnostics: overLearnDiagnostics,
    bytecodePresent: Boolean(overLearn?.bytecode),
  }, 297);
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_NEGATIVE_CONTROL_PASS',
  truthBoundary: {
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    fiveOrMoreClaimsPerLearnRemainProviderBound: true,
    threeOrMoreLearnDirectivesRemainProviderBound: true,
    overBoundaryBytecodeEmissionRejected: true,
  },
}, null, 2));
