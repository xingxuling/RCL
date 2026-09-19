#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  canonicalFoundationConformanceDomainId,
  reconcileFoundationConformanceTruth,
  renderFoundationConformanceCsv,
  renderFoundationConformanceMarkdown,
} from '../src/foundation-conformance-truth.mjs';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_OUT = path.join(ROOT, 'output', 'foundation-conformance');
const rootJsonPath = path.join(ROOT, 'foundation-conformance.json');
const rootTruthPath = path.join(ROOT, 'foundation-conformance-truth.json');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function emptyFoundationProgram() {
  return {
    rules: [],
    directives: [],
    perceptions: [],
    physicals: [],
    neurals: [],
    genetics: [],
    livings: [],
  };
}

// Capture the versioned canonical truth surface before the base evidence producer
// rewrites foundation-conformance.json. This turns the small truth snapshot into a
// fail-closed drift gate rather than letting generation silently repair repository
// truth after checkout.
const committedTruthSnapshot = JSON.parse(await fs.readFile(rootTruthPath, 'utf8'));

// Execute the original conformance harness. It remains the bridge/reference
// evidence producer; this wrapper reconciles its execution-truth vocabulary with
// the direct-lowering implementation that exists beside the bridge path.
await import('./foundation-conformance-base.mjs');

const directProbe = lowerDeclaredFoundationToCore(emptyFoundationProgram());
const executableDefaultDomains = [
  ...(directProbe?.summary?.enabledDomains ?? []).map(canonicalFoundationConformanceDomainId),
  'quantitative',
].sort();
const expectedDirectDomains = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort();
if (JSON.stringify(executableDefaultDomains) !== JSON.stringify(expectedDirectDomains)) {
  const error = new Error('Canonical conformance direct-domain registry drifted from the executable lowerer defaults.');
  error.code = 'RCL_FOUNDATION_CONFORMANCE_DIRECT_REGISTRY_DRIFT';
  error.details = { executableDefaultDomains, expectedDirectDomains };
  throw error;
}

const out = path.resolve(option('out', DEFAULT_OUT));
const outJsonPath = path.join(out, 'foundation-conformance.json');
const outTruthPath = path.join(out, 'foundation-conformance-truth.json');
const outCsvPath = path.join(out, 'foundation-conformance.csv');
const outMarkdownPath = path.join(out, 'foundation-conformance.md');

const baseReport = JSON.parse(await fs.readFile(rootJsonPath, 'utf8'));
const reconciled = reconcileFoundationConformanceTruth(baseReport, {}, {
  implementationDomains: executableDefaultDomains,
  requireDeploymentEvidence: false,
});
const canonicalTruth = reconciled.canonicalExecutionTruth;

if (JSON.stringify(committedTruthSnapshot) !== JSON.stringify(canonicalTruth)) {
  const error = new Error('Versioned canonical conformance truth snapshot drifted from executable reconciliation.');
  error.code = 'RCL_FOUNDATION_CONFORMANCE_TRUTH_SNAPSHOT_DRIFT';
  error.details = {
    committedTruthRoot: committedTruthSnapshot?.truthRoot ?? null,
    generatedTruthRoot: canonicalTruth?.truthRoot ?? null,
    committedStatus: committedTruthSnapshot?.status ?? null,
    generatedStatus: canonicalTruth?.status ?? null,
  };
  throw error;
}

const json = `${JSON.stringify(reconciled, null, 2)}\n`;
const truthJson = `${JSON.stringify(canonicalTruth, null, 2)}\n`;
await fs.writeFile(rootJsonPath, json);
await fs.writeFile(rootTruthPath, truthJson);
await fs.writeFile(outJsonPath, json);
await fs.writeFile(outTruthPath, truthJson);
await fs.writeFile(outCsvPath, renderFoundationConformanceCsv(reconciled));
await fs.writeFile(outMarkdownPath, renderFoundationConformanceMarkdown(reconciled));

console.log(JSON.stringify({
  status: reconciled.status,
  truthStatus: canonicalTruth.status,
  nativeVm: reconciled.executionLayers.nativeVm,
  directImplementationDomains: canonicalTruth.implementationDomains,
  providerBridgeDomains: canonicalTruth.verifiedBridgeDomains,
  truthRoot: canonicalTruth.truthRoot,
  canonicalTruthSnapshot: rootTruthPath,
  snapshotFresh: true,
  out,
}, null, 2));
