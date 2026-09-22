#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFoundationRuntimeTruthContract,
  foundationRuntimeTruthContractRoot,
  verifyFoundationRuntimeTruthContract,
} from '../src/foundation-runtime-truth-contract.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function fail(message, details = {}, exitCode = 82) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_FAILED', message, ...details, diagnosticExitCode: exitCode }, null, 2));
  process.exit(exitCode);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectRejected(label, candidate, exitCode) {
  candidate.contractRoot = foundationRuntimeTruthContractRoot(candidate);
  const result = verifyFoundationRuntimeTruthContract(candidate, { rootDir: root });
  if (result.ok === true) fail(`Negative control did not fail closed: ${label}`, { result }, exitCode);
  return result;
}

try {
  const contract = createFoundationRuntimeTruthContract(root);
  const verification = verifyFoundationRuntimeTruthContract(contract, { rootDir: root });
  if (verification.ok !== true) fail('Canonical runtime truth contract dependency closure did not verify.', { verification }, 82);

  const requiredTransitive = [
    'src/foundation-cross-domain-history-deployment-evidence.mjs',
    'src/foundation-runtime-deployment-evidence-registry.mjs',
    'src/foundation-capability-truth-surface.mjs',
  ];
  const paths = contract.dependencyClosure?.paths ?? [];
  const bindings = new Set((contract.sourceBindings ?? []).map(item => item.path));
  for (const requiredPath of requiredTransitive) {
    if (!paths.includes(requiredPath) || !bindings.has(requiredPath)) {
      fail('A canonical runtime-truth transitive dependency is not dependency-closed/content-bound.', { requiredPath, paths }, 83);
    }
  }
  if (contract.dependencyClosure?.unresolvedRelativeImports?.length !== 0) {
    fail('Canonical runtime-truth dependency closure contains unresolved repository-local imports.', { dependencyClosure: contract.dependencyClosure }, 84);
  }
  if (contract.sourceBindings.length <= 10 || contract.dependencyClosure.sourceCount !== contract.sourceBindings.length) {
    fail('Runtime-truth contract did not expand from the legacy 10-file seed list into an exact dependency closure.', {
      sourceBindingCount: contract.sourceBindings.length,
      dependencyClosureSourceCount: contract.dependencyClosure.sourceCount,
    }, 85);
  }

  const missingDependency = clone(contract);
  missingDependency.sourceBindings = missingDependency.sourceBindings.filter(item => item.path !== requiredTransitive[0]);
  const missingDependencyResult = expectRejected('transitive-dependency-binding-removed', missingDependency, 86);

  const sourceHashDrift = clone(contract);
  const targetBinding = sourceHashDrift.sourceBindings.find(item => item.path === requiredTransitive[1]);
  targetBinding.sha256 = targetBinding.sha256 === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
  const sourceHashDriftResult = expectRejected('transitive-dependency-source-hash-drift', sourceHashDrift, 87);

  const boundaryOverclaim = clone(contract);
  boundaryOverclaim.truthBoundary.dependencyClosureDoesNotClaimDynamicRuntimeResources = false;
  const boundaryResult = expectRejected('dynamic-resource-boundary-removed', boundaryOverclaim, 88);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_VERIFIED',
    contractRoot: contract.contractRoot,
    dependencyClosureRoot: contract.dependencyClosure.closureRoot,
    seedCount: contract.dependencyClosure.seedPaths.length,
    sourceBindingCount: contract.sourceBindings.length,
    dependencyEdgeCount: contract.dependencyClosure.edgeCount,
    requiredTransitiveDependencies: requiredTransitive,
    negativeControls: {
      transitiveDependencyBindingRemovalFailsClosed: missingDependencyResult.ok === false,
      transitiveDependencySourceHashDriftFailsClosed: sourceHashDriftResult.ok === false,
      dynamicRuntimeResourceBoundaryRemovalFailsClosed: boundaryResult.ok === false,
    },
    truthBoundary: contract.truthBoundary,
  }, null, 2));
} catch (error) {
  const unresolved = Array.isArray(error?.details?.unresolvedRelativeImports)
    ? error.details.unresolvedRelativeImports
    : [];
  const exitCode = error?.message === 'RCL_RUNTIME_TRUTH_DEPENDENCY_CLOSURE_UNRESOLVED'
    ? Math.min(119, 90 + unresolved.length)
    : 89;
  fail(error?.message ?? String(error), { code: error?.code ?? null, details: error?.details ?? null, stack: error?.stack ?? null, unresolvedCount: unresolved.length }, exitCode);
}
