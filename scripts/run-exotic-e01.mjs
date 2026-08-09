#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMinimalLivingIntelligence } from '../experiments/exotic-programs/E01/src/minimal-living-intelligence.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const E01_ROOT = path.join(ROOT, 'experiments', 'exotic-programs', 'E01');
const programSource = fs.readFileSync(path.join(E01_ROOT, 'program.rcl'), 'utf8');
const result = await runMinimalLivingIntelligence({ programSource });
const { report, growthHistory, donorEvidence } = result;

const evidenceDir = path.join(E01_ROOT, 'evidence');
const resultsDir = path.join(E01_ROOT, 'results');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'e01-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceDir, 'donor-trials.json'), `${JSON.stringify(donorEvidence, null, 2)}\n`);
fs.writeFileSync(path.join(resultsDir, 'living_intelligence_growth_history.json'), `${JSON.stringify({
  format: 'rcl.e01-living-intelligence-growth-history.v0.1',
  experimentId: 'E01',
  subjectId: report.subjectId,
  status: report.status,
  root: report.growthHistoryRoot,
  entries: growthHistory,
}, null, 2)}\n`);
fs.writeFileSync(path.join(E01_ROOT, 'experiment.json'), `${JSON.stringify({
  id: 'E01',
  name: 'RCL Minimal Living Intelligence',
  question: 'Can a deliberately incomplete RCL subject distinguish a capability failure, absorb a verified candidate organ, retry successfully, and close an invalid donor honestly?',
  hypothesis: 'A bounded persistent subject can complete an existing task, detect a missing weighted_sum capability, assimilate a human-selected donor only after metabolism and independent differential evidence, retry with the new candidate organ, and leave a failed donor out of its body.',
  baseline: 'Initial fixed-language capability body with no weighted_sum capability installed.',
  rcl_features_used: [
    'canonical RCL compilation',
    'subject/facet/emergence/needs/warrant',
    'Capability Metabolism',
    'independent Differential Absorption',
    'Content-Addressed Reality Store',
    'Semantic State Root',
    'bounded replay',
    'candidate organ tier',
  ],
  environment: {
    runtime: 'Node.js',
    external_network: false,
    llm: false,
    donor_selection: 'human-in-the-loop fixture selection',
    max_attempts: report.maxAttempts,
    branch_boundary: 'experimental E01 only',
  },
  result: report.status,
  failure_class: report.failureClasses.taskCDonor,
  new_semantics_required: [],
  artifact_roots: {
    rcl_program: report.program.programRoot,
    source: report.program.sourceRoot,
    initial_body: report.initialBodyRoot,
    final_body: report.finalBodyRoot,
    final_state: report.finalStateRoot,
    evidence: report.root,
    growth_history: report.growthHistoryRoot,
    final_commit: report.finalCommitRoot,
    donor_b_metabolism: report.donorTrials[0].metabolismRoot,
    donor_b_differential: report.donorTrials[0].differentialRoot,
    donor_c_metabolism: report.donorTrials[1].metabolismRoot,
    donor_c_differential: report.donorTrials[1].differentialRoot,
  },
  next_experiment: 'Run E05 only after recording E01 capability-growth boundaries; do not extract a shared framework yet.',
}, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  experiment: 'E01',
  status: report.status,
  root: report.root,
  growthHistoryRoot: report.growthHistoryRoot,
  finalCommitRoot: report.finalCommitRoot,
  taskA: report.taskResults.taskA.status,
  taskB: report.taskResults.taskBRetry.status,
  taskC: report.taskResults.taskCInitial.status,
  checksPassed: Object.values(report.checks).filter(Boolean).length,
  checksTotal: Object.keys(report.checks).length,
  evidenceDir,
  resultsDir,
}, null, 2)}\n`);

if (report.status !== 'VERIFIED') process.exitCode = 2;
