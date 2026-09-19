#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  reconcileFoundationConformanceTruth,
  renderFoundationConformanceCsv,
  renderFoundationConformanceMarkdown,
} from '../src/foundation-conformance-truth.mjs';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

// Execute the original conformance harness first. It remains the bridge/reference
// evidence producer; this wrapper reconciles its execution-truth vocabulary with
// the direct-lowering implementation that now exists beside the bridge path.
await import('./foundation-conformance-base.mjs');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_OUT = path.join(ROOT, 'output', 'foundation-conformance');

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

const directProbe = lowerDeclaredFoundationToCore(emptyFoundationProgram());
const executableDefaultDomains = [
  ...(directProbe?.summary?.enabledDomains ?? []),
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
const rootJsonPath = path.join(ROOT, 'foundation-conformance.json');
const outJsonPath = path.join(out, 'foundation-conformance.json');
const outCsvPath = path.join(out, 'foundation-conformance.csv');
const outMarkdownPath = path.join(out, 'foundation-conformance.md');

const baseReport = JSON.parse(await fs.readFile(rootJsonPath, 'utf8'));
const reconciled = reconcileFoundationConformanceTruth(baseReport, {}, {
  implementationDomains: executableDefaultDomains,
  requireDeploymentEvidence: false,
});

const json = `${JSON.stringify(reconciled, null, 2)}\n`;
await fs.writeFile(rootJsonPath, json);
await fs.writeFile(outJsonPath, json);
await fs.writeFile(outCsvPath, renderFoundationConformanceCsv(reconciled));
await fs.writeFile(outMarkdownPath, renderFoundationConformanceMarkdown(reconciled));

console.log(JSON.stringify({
  status: reconciled.status,
  truthStatus: reconciled.canonicalExecutionTruth.status,
  nativeVm: reconciled.executionLayers.nativeVm,
  directImplementationDomains: reconciled.canonicalExecutionTruth.implementationDomains,
  providerBridgeDomains: reconciled.canonicalExecutionTruth.verifiedBridgeDomains,
  truthRoot: reconciled.canonicalExecutionTruth.truthRoot,
  out,
}, null, 2));
