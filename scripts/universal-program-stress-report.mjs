#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  COVERAGE_MODE,
  KILLER_TASKS_V01,
  STRESS_STATUS,
  UNIVERSAL_ENVIRONMENTS,
  UNIVERSAL_PROGRAM_FAMILIES,
  UNIVERSAL_STRESS_GATES,
  buildUniversalStressMatrix,
  classifyUniversalMaturity,
  evaluateStressCell,
  evidenceRoot,
  findUnabsorbedAdvantages,
} from '../src/universal-program-stress.mjs';

const inputPath = process.argv[2] ?? 'examples/universal-stress/v0.1-baseline-evidence.json';
const outputDir = process.argv[3] ?? 'output/universal-stress-v0.1';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function untestedReportFor(cell) {
  return evaluateStressCell({
    ...cell,
    untested: true,
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    gates: Object.fromEntries(
      UNIVERSAL_STRESS_GATES.map((gate) => [gate, { status: STRESS_STATUS.UNVERIFIED, evidence: [] }]),
    ),
    changes: [],
  });
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

const evidence = readJson(inputPath);
if (evidence.schema !== 'rcl.universal-stress.evidence.v0.1') {
  throw new Error(`RCL_STRESS_EVIDENCE_SCHEMA:${evidence.schema ?? 'missing'}`);
}

const matrix = buildUniversalStressMatrix();
const byCellId = new Map((evidence.claims ?? []).map((claim) => [claim.id, claim]));
const reports = matrix.map((cell) => {
  const claim = byCellId.get(cell.id);
  if (!claim) return untestedReportFor(cell);
  return evaluateStressCell({ ...cell, ...claim, id: cell.id });
});

const killerReports = KILLER_TASKS_V01.map((task) => {
  const id = `${task.environment}::${task.programFamily}`;
  const report = reports.find((item) => item.id === id);
  return { ...task, report };
});

const unabsorbedAdvantages = findUnabsorbedAdvantages(evidence.donorComparisons ?? []);
const maturity = classifyUniversalMaturity({
  evaluatedCells: reports.filter((report) => byCellId.has(report.id)),
  totalMatrixCells: UNIVERSAL_ENVIRONMENTS.length * UNIVERSAL_PROGRAM_FAMILIES.length,
  novelTaskTrials: Number(evidence.novelTaskTrials ?? 0),
  kernelChangesForNovelTasks: Number(evidence.kernelChangesForNovelTasks ?? 0),
  competitiveComparisons: evidence.competitiveComparisons ?? [],
  unabsorbedAdvantages,
});

const claimedReports = reports.filter((report) => byCellId.has(report.id));
const statusCounts = Object.fromEntries(
  Object.values(STRESS_STATUS).map((status) => [status, reports.filter((report) => report.status === status).length]),
);
const coverageModeCounts = Object.fromEntries(
  Object.values(COVERAGE_MODE).map((mode) => [mode, claimedReports.filter((report) => report.coverageMode === mode).length]),
);
const gateCompletion = Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, {
  pass: claimedReports.filter((report) => report.gates[gate].status === STRESS_STATUS.PASS).length,
  totalClaims: claimedReports.length,
}]));
const fullReportWithoutRoot = {
  schema: 'rcl.universal-stress.report.v0.1',
  generatedAt: new Date().toISOString(),
  sourceEvidence: path.normalize(inputPath),
  generation: evidence.generation ?? 'unknown',
  matrix: {
    environments: UNIVERSAL_ENVIRONMENTS.length,
    programFamilies: UNIVERSAL_PROGRAM_FAMILIES.length,
    totalCells: matrix.length,
    claimedCells: claimedReports.length,
    unverifiedCells: matrix.length - claimedReports.length,
    statusCounts,
    coverageModeCounts,
    gateCompletion,
  },
  killerTasks: killerReports.map(({ report, ...task }) => ({
    ...task,
    cellId: report.id,
    status: byCellId.has(report.id) ? report.status : STRESS_STATUS.UNVERIFIED,
    coverageMode: byCellId.has(report.id) ? report.coverageMode : null,
    evidenceRoot: byCellId.has(report.id) ? report.evidenceRoot : null,
  })),
  maturity,
  unabsorbedAdvantages,
  cells: reports,
  claims: claimedReports,
  antiCheatRules: [
    'No task/environment-specific patch receives universal-growth credit unless it is justified as a reusable general primitive.',
    'A new genome cannot be promoted if it regresses previously verified capabilities beyond the declared tolerance.',
    'Opaque delegation is provider coverage, not native RCL language capability.',
    'A generated artifact is not an execution proof; real environment receipts are required for EXECUTE, CORRECT, ROBUST and PERFORMANCE.',
  ],
  notes: evidence.notes ?? [],
};

const fullReport = {
  ...fullReportWithoutRoot,
  reportRoot: evidenceRoot(fullReportWithoutRoot),
};

ensureDir(outputDir);
const jsonPath = path.join(outputDir, 'universal-stress-report.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(fullReport, null, 2)}\n`, 'utf8');

const markdown = `# RCL Universal Program Stress Test v0.1\n\n` +
  `**Generation:** ${fullReport.generation}\n\n` +
  `**Evidence maturity:** ${maturity.level}\n\n` +
  `**Report root:** \`${fullReport.reportRoot}\`\n\n` +
  `## Matrix\n\n` +
  `- Environments: ${fullReport.matrix.environments}\n` +
  `- Program families: ${fullReport.matrix.programFamilies}\n` +
  `- Permanent cells: ${fullReport.matrix.totalCells}\n` +
  `- Evidence-bearing claims: ${fullReport.matrix.claimedCells}\n` +
  `- Unverified cells: ${fullReport.matrix.unverifiedCells}\n` +
  `- Untested cells: ${fullReport.matrix.statusCounts.UNTESTED}\n` +
  `- Regressed cells: ${fullReport.matrix.statusCounts.REGRESSED}\n\n` +
  `## Maturity metrics\n\n` +
  `- Passed claimed cells: ${maturity.metrics.passedCells}/${maturity.metrics.evaluatedCells}\n` +
  `- Claimed-cell pass ratio: ${percent(maturity.metrics.passRatio)}\n` +
  `- Matrix evidence coverage: ${percent(maturity.metrics.matrixCoverage)}\n` +
  `- Native-semantic passed: ${maturity.metrics.nativePassed}\n` +
  `- Opaque-delegation passed: ${maturity.metrics.opaquePassed}\n` +
  `- Unabsorbed advantages: ${maturity.metrics.unabsorbedAdvantages}\n\n` +
  `## Killer tasks\n\n` +
  killerReports.map(({ report, ...task }) => {
    const claimed = byCellId.has(report.id);
    return `- ${task.id} ${task.name}: **${claimed ? report.status : STRESS_STATUS.UNVERIFIED}** (${report.id})`;
  }).join('\n') +
  `\n\n## Evidence rule\n\n` +
  `No unexecuted claim is upgraded into a PASS. Missing receipts remain UNVERIFIED/BLOCKED. Opaque delegation never counts as native RCL semantics.\n`;

const mdPath = path.join(outputDir, 'universal-stress-report.md');
fs.writeFileSync(mdPath, markdown, 'utf8');

console.log(JSON.stringify({
  status: 'REPORT_WRITTEN',
  jsonPath,
  markdownPath: mdPath,
  reportRoot: fullReport.reportRoot,
  maturity: maturity.level,
  claimedCells: fullReport.matrix.claimedCells,
  unverifiedCells: fullReport.matrix.unverifiedCells,
  statusCounts: fullReport.matrix.statusCounts,
}, null, 2));
