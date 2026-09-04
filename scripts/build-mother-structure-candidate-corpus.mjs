import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMotherStructureCorpus,
  buildMotherStructureIR,
  runMotherStructureIntegrationCourt,
  verifyMotherStructureIntegrationCourt,
  verifyMotherStructureCorpus,
} from '../src/index.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT_DIR = path.resolve(process.argv[2] ?? 'output/mother-structure-ir-v0.1');
const EXTERNAL_CORPUS = process.env.MOTHER_STRUCTURE_ARCHAEOLOGY_CORPUS
  ? path.resolve(process.env.MOTHER_STRUCTURE_ARCHAEOLOGY_CORPUS)
  : path.resolve(REPO_ROOT, '..', '..', '_inspect', 'rcl-framework-archaeology-v0.1', 'corpus.json');
const K400_EVIDENCE = process.env.MOTHER_STRUCTURE_K400_EVIDENCE
  ? path.resolve(process.env.MOTHER_STRUCTURE_K400_EVIDENCE)
  : path.join(REPO_ROOT, 'examples', 'universal-stress', 'k400-current-evidence.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function relative(file) {
  return path.relative(REPO_ROOT, file).replaceAll(path.sep, '/');
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (['.git', 'node_modules', 'build', 'dist', 'target'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && path.extname(file).toLowerCase() === '.rcl') files.push(file);
    }
  };
  visit(root);
  return files;
}

function scopeFor(file) {
  const normalized = relative(file);
  if (normalized.startsWith('examples/universal-stress/')) return 'K400';
  if (normalized.startsWith('examples/native-ui/') || normalized.startsWith('examples/selfhost-core/')) return 'native-ui';
  if (normalized.startsWith('examples/typed-package/') || normalized.startsWith('examples/package-ecosystem/')) return 'package';
  return 'RCL-source';
}

function lineageFor(file) {
  return relative(file).includes('examples/universal-stress/evidence/')
    ? 'candidate-or-evidence-lineage'
    : 'primary-or-example-source';
}

function readExternalRecords() {
  if (!fs.existsSync(EXTERNAL_CORPUS)) return { records: [], path: null, sourceSha256: null, available: false };
  const raw = fs.readFileSync(EXTERNAL_CORPUS, 'utf8');
  const value = JSON.parse(raw);
  const records = (value.records ?? []).filter(record => record.family !== 'rcl-source');
  return { records, path: EXTERNAL_CORPUS, sourceSha256: sha256(raw), available: true };
}

function readK400Evidence() {
  if (!fs.existsSync(K400_EVIDENCE)) return { value: null, path: null, sourceSha256: null, available: false };
  const raw = fs.readFileSync(K400_EVIDENCE, 'utf8');
  return { value: JSON.parse(raw), path: K400_EVIDENCE, sourceSha256: sha256(raw), available: true };
}

const roots = [
  path.join(REPO_ROOT, 'examples', 'universal-stress'),
  path.join(REPO_ROOT, 'examples', 'native-ui'),
  path.join(REPO_ROOT, 'examples', 'selfhost-core'),
  path.join(REPO_ROOT, 'examples', 'typed-package'),
  path.join(REPO_ROOT, 'examples', 'package-ecosystem'),
];
const files = [...new Set(roots.flatMap(walk))].sort((left, right) => relative(left).localeCompare(relative(right)));
const seenHashes = new Set();
const irs = [];
const parseFailures = [];
const duplicateSources = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceSha256 = sha256(source);
  if (seenHashes.has(sourceSha256)) {
    duplicateSources.push(relative(file));
    continue;
  }
  seenHashes.add(sourceSha256);
  try {
    irs.push(buildMotherStructureIR(source, {
      sourcePath: relative(file),
      sourceSha256,
      scope: scopeFor(file),
      lineage: lineageFor(file),
    }));
  } catch (error) {
    parseFailures.push({ sourcePath: relative(file), error: `${error?.name ?? 'Error'}:${error?.message ?? error}` });
  }
}

const external = readExternalRecords();
const inputs = [...irs];
if (external.records.length) inputs.push({ records: external.records });
const corpus = buildMotherStructureCorpus(inputs);
const verification = verifyMotherStructureCorpus(corpus);
if (!verification.ok) throw new Error(`Mother Structure corpus verification failed: ${verification.errors.join('; ')}`);
const k400Evidence = readK400Evidence();
const integrationCourt = runMotherStructureIntegrationCourt({
  corpus,
  k400Evidence: k400Evidence.value ?? undefined,
});
const integrationCourtVerification = verifyMotherStructureIntegrationCourt(integrationCourt);
if (!integrationCourtVerification.ok) {
  throw new Error(`Mother Structure Integration Court verification failed: ${integrationCourtVerification.errors.join('; ')}`);
}

const summary = {
  format: corpus.format,
  version: corpus.version,
  status: corpus.status,
  root: corpus.root,
  sourceFilesDiscovered: files.length,
  sourceFilesParsed: irs.length,
  duplicateSourcesSkipped: duplicateSources.length,
  parseFailures,
  externalCorpus: {
    available: external.available,
    path: external.path ? path.relative(path.resolve(REPO_ROOT, '..', '..'), external.path).replaceAll(path.sep, '/') : null,
    sourceSha256: external.sourceSha256,
    recordsAdded: external.records.length,
  },
  k400Evidence: {
    available: k400Evidence.available,
    path: k400Evidence.path ? path.relative(REPO_ROOT, k400Evidence.path).replaceAll(path.sep, '/') : null,
    sourceSha256: k400Evidence.sourceSha256,
    status: integrationCourt.k400.status,
    claimedCellCount: integrationCourt.k400.claimedCellCount,
    completionVerdict: integrationCourt.k400.completion?.verdict ?? null,
  },
  observationCount: corpus.summary.observationCount,
  structureCount: corpus.summary.structureCount,
  classificationCounts: corpus.summary.classificationCounts,
  repeatedStructures: corpus.structures.filter(row => row.recurrence.repeated).map(row => ({
    structureId: row.structureId,
    occurrenceCount: row.recurrence.occurrenceCount,
    independentSourceCount: row.recurrence.independentSourceCount,
    scopeCount: row.recurrence.scopeCount,
    classification: row.classification,
  })),
  unmodeledTopLevelKinds: corpus.coverage.unmodeledTopLevelKinds,
  unresolvedDirectiveCount: corpus.coverage.unresolvedDirectiveCount,
  integrationCourt: {
    status: integrationCourt.status,
    verdict: integrationCourt.verdict,
    root: integrationCourt.root,
    localChecksPass: integrationCourt.summary.localChecksPass,
    targetChecksPass: integrationCourt.summary.targetChecksPass,
    targetStructureIds: integrationCourt.targetStructureIds,
    decisionCount: integrationCourt.summary.decisionCount,
    retainedFrameworkCandidates: integrationCourt.summary.retainedFrameworkCandidates,
    retainedStdCandidates: integrationCourt.summary.retainedStdCandidates,
    retainedPacks: integrationCourt.summary.retainedPacks,
    retainedExamples: integrationCourt.summary.retainedExamples,
    retainedAuxiliary: integrationCourt.summary.retainedAuxiliary,
    heldGapCandidates: integrationCourt.summary.heldGapCandidates,
  },
  verification,
  integrationCourtVerification,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'corpus.json'), `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(OUTPUT_DIR, 'integration-court.json'), `${JSON.stringify(integrationCourt, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
