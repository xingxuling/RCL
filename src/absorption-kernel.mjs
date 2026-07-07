import { compileReality } from './compiler.mjs';
import { realityRoot } from './canonical.mjs';
import { createRealityDialectRegistry, DEFAULT_REALITY_DIALECTS } from './reality-dialect.mjs';
import { analyzeProgramEffects, createEffectSignature } from './effects.mjs';
import { verifyProgramCapabilities, assertProgramCapabilities } from './capability-verifier.mjs';
import { createContentAddressedRealityStore } from './reality-store.mjs';
import { RCLCompileError } from './errors.mjs';

export const RCL_NATIVE_ABSORPTION_VERSION = '0.14.0-alpha.1';

const BUDGET_KEY_MAP = Object.freeze({
  max_effects: 'maxEffects',
  max_alterations: 'maxAlterations',
  max_host_calls: 'maxHostCalls',
  max_rules: 'maxRules',
});

function programFrom(sourceOrProgram) {
  return typeof sourceOrProgram === 'string' ? compileReality(sourceOrProgram) : sourceOrProgram;
}

function normalizeCapabilityPolicy(policyDecl) {
  if (!policyDecl) return null;
  const budget = {};
  for (const [key, value] of Object.entries(policyDecl.budget ?? {})) budget[BUDGET_KEY_MAP[key] ?? key] = value;
  return {
    allowedEffects: policyDecl.allowedEffects.length ? [...policyDecl.allowedEffects] : null,
    deniedEffects: [...policyDecl.deniedEffects],
    capabilities: policyDecl.capabilities.map(item => ({ capability: item.capability, target: item.target })),
    hostCapabilities: policyDecl.hostCapabilities.length ? [...policyDecl.hostCapabilities] : null,
    budget,
    requireDeterministicReplay: Boolean(policyDecl.requireDeterministicReplay),
  };
}

function selectedPolicyName(program, explicitName = null) {
  if (explicitName) return explicitName;
  const directive = (program.absorptionDirectives ?? []).find(item => item.kind === 'VerifyCapabilities');
  return directive?.policy ?? program.capabilityPolicies?.[0]?.name ?? null;
}

function selectedStoreName(program, explicitName = null) {
  if (explicitName) return explicitName;
  const directive = (program.absorptionDirectives ?? []).find(item => item.kind === 'SnapshotStore');
  return directive?.store ?? program.stores?.[0]?.name ?? null;
}

export function resolveRclCapabilityPolicy(sourceOrProgram, name = null) {
  const program = programFrom(sourceOrProgram);
  const policyName = selectedPolicyName(program, name);
  if (!policyName) return null;
  const declaration = (program.capabilityPolicies ?? []).find(item => item.name === policyName);
  if (!declaration) throw new RCLCompileError([{ code: 'RCL_POLICY_UNKNOWN', message: `Capability policy '${policyName}' is not declared`, nodeKind: 'CapabilityPolicyRef' }]);
  return Object.freeze({ name: policyName, declaration, policy: normalizeCapabilityPolicy(declaration) });
}

export function createRclDeclaredDialectRegistry(sourceOrProgram) {
  const program = programFrom(sourceOrProgram);
  const registry = createRealityDialectRegistry(DEFAULT_REALITY_DIALECTS);
  for (const dialect of program.dialects ?? []) registry.register(dialect);
  return registry;
}

export function materializeRclAbsorptionKernel(sourceOrProgram, options = {}) {
  const program = programFrom(sourceOrProgram);
  const registry = createRclDeclaredDialectRegistry(program);
  const effectProfile = analyzeProgramEffects(program);
  const effectSignature = createEffectSignature(program);
  const resolved = resolveRclCapabilityPolicy(program, options.policyName ?? null);
  const verification = resolved ? verifyProgramCapabilities(program, resolved.policy) : null;

  const store = createContentAddressedRealityStore();
  const programObject = store.putObject({ program: program.name, programRoot: program.programRoot }, { type: 'program' });
  const dialectSummary = registry.summary();
  const dialectObject = store.putObject(dialectSummary, { type: 'dialect-summary' });
  const effectObject = store.putObject(effectSignature, { type: 'effect-signature' });
  const evidence = [];
  if (verification) evidence.push(store.putEvidence(verification, { policy: resolved.name }));
  const eventRoot = store.putEvent({
    type: verification?.status === 'rejected' ? 'absorption.rejected' : 'absorption.verified',
    subject: program.subjects?.[0] ?? 'rcl',
    payload: {
      program: program.name,
      policy: resolved?.name ?? null,
      verificationStatus: verification?.status ?? 'not-requested',
      dialects: registry.list().map(item => item.id),
      effectCount: effectProfile.effects.length,
    },
    evidence,
  });
  const tree = store.putTree([
    { path: 'program.json', root: programObject, type: 'program' },
    { path: 'dialects.json', root: dialectObject, type: 'dialect-summary' },
    { path: 'effects.json', root: effectObject, type: 'effect-signature' },
  ]);
  const storeName = selectedStoreName(program, options.storeName ?? null);
  const storeDecl = (program.stores ?? []).find(item => item.name === storeName) ?? null;
  const commit = store.putCommit({
    tree,
    events: [eventRoot],
    evidence,
    message: storeDecl?.commits?.[0] ?? `materialize ${program.name} absorption kernel`,
    author: 'rcl',
    metadata: { store: storeDecl?.name ?? null, policy: resolved?.name ?? null },
  });
  const branch = storeDecl?.branches?.[0] ?? 'main';
  store.createBranch(branch, commit);

  const report = {
    format: 'rcl.native-absorption-kernel-report.v0.14',
    version: RCL_NATIVE_ABSORPTION_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    registryRoot: dialectSummary.root,
    effectProfileRoot: effectProfile.root,
    effectSignatureRoot: effectSignature.root,
    policy: resolved?.name ?? null,
    verification,
    store: store.summary(),
    commit,
    branch,
    userSurface: {
      dialectDeclarations: program.dialects?.length ?? 0,
      effectDeclarations: program.effectDeclarations?.length ?? 0,
      capabilityPolicies: program.capabilityPolicies?.length ?? 0,
      stores: program.stores?.length ?? 0,
      directives: program.absorptionDirectives?.length ?? 0,
    },
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function assertRclAbsorptionKernel(sourceOrProgram, options = {}) {
  const program = programFrom(sourceOrProgram);
  const resolved = resolveRclCapabilityPolicy(program, options.policyName ?? null);
  if (resolved) assertProgramCapabilities(program, resolved.policy);
  return materializeRclAbsorptionKernel(program, options);
}
