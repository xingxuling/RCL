#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS } from '../src/foundation-conformance-truth.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_OUT = path.join(ROOT, 'output', 'foundation-conformance');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_CONFORMANCE_TRUTH_VERIFICATION_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const out = path.resolve(option('out', DEFAULT_OUT));
const rootJsonBytes = await fs.readFile(path.join(ROOT, 'foundation-conformance.json'));
const outJsonBytes = await fs.readFile(path.join(out, 'foundation-conformance.json'));
const csv = await fs.readFile(path.join(out, 'foundation-conformance.csv'), 'utf8');
const markdown = await fs.readFile(path.join(out, 'foundation-conformance.md'), 'utf8');

if (!rootJsonBytes.equals(outJsonBytes)) {
  fail('Root and requested-output canonical conformance JSON diverged.');
}

const report = JSON.parse(rootJsonBytes.toString('utf8'));
const truth = report?.canonicalExecutionTruth;
const direct = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort();
const actualDirect = [...(truth?.implementationDomains ?? [])].sort();
if (report?.executionLayers?.nativeVm !== 'hybrid') {
  fail('Canonical Native VM truth must be hybrid after direct-lowering reconciliation.', {
    nativeVm: report?.executionLayers?.nativeVm ?? null,
  });
}
if (truth?.status !== 'implementation-bound') {
  fail('Repository conformance must remain implementation-bound rather than overclaiming deployment evidence.', {
    truthStatus: truth?.status ?? null,
  });
}
if (JSON.stringify(actualDirect) !== JSON.stringify(direct)) {
  fail('Canonical direct-lowering implementation domains are incomplete or drifted.', {
    expected: direct,
    actual: actualDirect,
  });
}
if (truth?.truthBoundary?.allFoundationDomainsNativeClaimed !== false) {
  fail('Canonical conformance must fail closed on all-Foundation direct-native claims.');
}
if (truth?.truthBoundary?.providerBridgeRemovedGlobally !== false) {
  fail('Canonical conformance must preserve the Provider bridge truth boundary.');
}
if ((truth?.verifiedDirectDomains ?? []).length !== 0) {
  fail('Repository conformance must not fabricate deployment-bound direct-native verification.', {
    verifiedDirectDomains: truth?.verifiedDirectDomains,
  });
}
for (const domain of direct) {
  const entry = report?.domains?.[domain];
  if (!entry || entry.directLoweringImplemented !== true) {
    fail('Direct-lowering implementation flag is missing from a canonical domain entry.', { domain, entry });
  }
  if (entry.directNativeVerified !== false) {
    fail('Repository conformance incorrectly promoted implementation to deployment verification.', { domain, entry });
  }
}
const quantitative = report?.domains?.quantitative;
if (!quantitative?.availableModes?.includes('native-direct') || !quantitative?.availableModes?.includes('bridge')) {
  fail('Quantitative must expose direct-lowering implementation and verified bridge coexistence.', {
    availableModes: quantitative?.availableModes ?? null,
  });
}
const stalePhrases = [
  'Declared Foundation-domain syntax still rejects lowering',
  'declared domain syntax is still not Native VM syntax',
  'Unsupported declared-domain lowering remains explicit and is not counted as native mode',
];
const artifacts = [rootJsonBytes.toString('utf8'), csv, markdown];
for (const phrase of stalePhrases) {
  if (artifacts.some(text => text.includes(phrase))) {
    fail('Stale bridge-only execution truth survived reconciliation.', { phrase });
  }
}
if (!markdown.includes(`truth root: \`${truth?.truthRoot}\``)) {
  fail('Markdown truth surface is not bound to the canonical truth root.', {
    truthRoot: truth?.truthRoot ?? null,
  });
}
if (!csv.includes('directLoweringImplemented,directNativeVerified,providerBridgeVerified')) {
  fail('CSV truth surface is missing separated direct/bridge evidence dimensions.');
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_CONFORMANCE_TRUTH_VERIFIED',
  truthRoot: truth.truthRoot,
  directImplementationDomains: direct,
  providerBridgeDomains: truth.verifiedBridgeDomains,
  nativeVm: report.executionLayers.nativeVm,
  out,
}, null, 2));
