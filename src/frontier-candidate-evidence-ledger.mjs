import { sha256 } from './reality-compiler-kernel.mjs';
import { runUnknownKnowledgeCompiler } from './unknown-knowledge-compiler.mjs';
import { buildDefaultUnknownLawExperimentPortfolio } from './frontier-unknown-law-experiment-spec.mjs';
import { runFrontierEvidenceCourt } from './frontier-evidence-court-candidate-tournament.mjs';

export const RCL_FRONTIER_CANDIDATE_LEDGER_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_CANDIDATE_LEDGER_FORMAT = 'rcl.frontier-candidate-evidence-ledger.v0.1';
export const RCL_FRONTIER_CANDIDATE_ENTRY_FORMAT = 'rcl.frontier-candidate-evidence-entry.v0.1';
export const RCL_FRONTIER_CANDIDATE_EVENT_FORMAT = 'rcl.frontier-candidate-evidence-event.v0.1';

const PRIMARY_LANES = new Set([
  'spell_symbolic_control_protocol',
  'formation_spatial_constraint_array',
  'aether_substrate_information_medium',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(xs = []) {
  return [...new Set((Array.isArray(xs) ? xs : []).map(String).filter(Boolean))].sort();
}

function normalizedCompilerBundle(input = {}) {
  if (input?.result?.candidates && Array.isArray(input?.candidates)) return input;
  return runUnknownKnowledgeCompiler(input);
}

function buildCompilerEvent(candidate, compilerResultRoot) {
  const event = {
    format: RCL_FRONTIER_CANDIDATE_EVENT_FORMAT,
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    type: 'unknown_knowledge_compiler_assessment',
    source: 'RCL Unknown Knowledge Compiler',
    candidateId: candidate.id,
    promoted: candidate.promoted === true,
    candidateKnowledgeScore: Number(candidate.scores?.candidateKnowledgeScore ?? 0),
    lockScore: Number(candidate.lockEvaluation?.score ?? 0),
    compilerCandidateRoot: candidate.root ?? null,
    compilerResultRoot,
    evidenceMeaning: candidate.promoted === true
      ? 'candidate_is_researchable_not_empirically_verified'
      : 'candidate_failed_current_compiler_promotion_gate_not_external_falsification',
    root: null,
  };
  event.root = sha256({ ...event, root: undefined });
  return event;
}

function buildCourtEvent(judgment, courtRoot) {
  const event = {
    format: RCL_FRONTIER_CANDIDATE_EVENT_FORMAT,
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    type: 'frontier_evidence_court_judgment',
    source: 'Frontier Evidence Court',
    candidateId: judgment.laneId,
    evidenceRung: judgment.evidenceRung,
    status: judgment.status,
    researchDisposition: judgment.researchDisposition,
    decisiveReason: judgment.decisiveReason ?? null,
    judgmentRoot: judgment.root,
    courtRoot,
    root: null,
  };
  event.root = sha256({ ...event, root: undefined });
  return event;
}

function buildCandidateEntry(candidate, compilerResultRoot, laneBinding, courtJudgment = null, courtRoot = null) {
  const compilerEvent = buildCompilerEvent(candidate, compilerResultRoot);
  const promoted = candidate.promoted === true;
  const courtManaged = Boolean(promoted && laneBinding && courtJudgment);
  const status = !promoted
    ? 'REJECTED_BY_UNKNOWN_KNOWLEDGE_COMPILER_GATE'
    : courtManaged
      ? courtJudgment.status
      : 'PROMOTED_AWAITING_EXPERIMENT_SPEC_AND_SANDBOX_ROUTE';
  const researchDisposition = !promoted
    ? 'REVISE_OR_ARCHIVE'
    : courtManaged
      ? courtJudgment.researchDisposition
      : 'COMPILE_EXPERIMENT_SPEC';
  const events = [compilerEvent];
  if (courtManaged) events.push(buildCourtEvent(courtJudgment, courtRoot));
  const entry = {
    format: RCL_FRONTIER_CANDIDATE_ENTRY_FORMAT,
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    candidateId: candidate.id,
    title: candidate.title ?? candidate.structure?.title ?? candidate.id,
    sourceClass: candidate.structure?.sourceClass ?? candidate.sourceClass ?? 'unknown',
    promotedByUnknownKnowledgeCompiler: promoted,
    compilerCandidateRoot: candidate.root ?? null,
    compilerScore: Number(candidate.scores?.candidateKnowledgeScore ?? 0),
    compilerLockScore: Number(candidate.lockEvaluation?.score ?? 0),
    predictionRoots: uniqueStrings((candidate.predictions ?? []).map((row) => row.root ?? sha256(row))),
    explicitFalsifiers: [...(candidate.structure?.explicitFalsifiers ?? [])],
    laneBinding: laneBinding ?? null,
    courtManaged,
    evidenceRung: courtManaged ? courtJudgment.evidenceRung : 0,
    status,
    researchDisposition,
    nextGate: !promoted
      ? 'revise_candidate_structure_falsifiers_or_empirical_anchors_before_recompile'
      : courtManaged
        ? courtJudgment.researchDisposition === 'REJECT'
          ? 'archived_by_decisive_external_falsifier'
          : 'follow_frontier_evidence_court_next_evidence_obligation'
        : 'compile_machine_readable_experiment_spec_then_assign_design_grammar_and_sandbox_suite',
    events,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  entry.root = sha256({ ...entry, root: undefined });
  return entry;
}

export function validateCandidateEvidenceLedger(ledger = {}) {
  const failures = [];
  if (ledger.format !== RCL_FRONTIER_CANDIDATE_LEDGER_FORMAT) failures.push('unsupported_candidate_ledger_format');
  if (!Array.isArray(ledger.entries)) failures.push('missing_entries');
  const ids = new Set();
  for (const entry of ledger.entries ?? []) {
    if (!entry.candidateId || ids.has(entry.candidateId)) failures.push('duplicate_or_missing_candidate_id');
    ids.add(entry.candidateId);
    const entryRoot = sha256({ ...entry, root: undefined });
    if (entry.root !== entryRoot) failures.push(`entry_root_mismatch:${entry.candidateId}`);
    for (const event of entry.events ?? []) {
      const eventRoot = sha256({ ...event, root: undefined });
      if (event.root !== eventRoot) failures.push(`event_root_mismatch:${entry.candidateId}:${event.type ?? 'unknown'}`);
    }
    if (entry.externalRealityVerified !== false || entry.newNaturalLawVerified !== false || entry.magicVerified !== false) {
      failures.push(`evidence_boundary_violation:${entry.candidateId}`);
    }
    if (!entry.promotedByUnknownKnowledgeCompiler && entry.evidenceRung > 0) failures.push(`compiler_rejected_candidate_cannot_have_positive_rung:${entry.candidateId}`);
    if (!entry.promotedByUnknownKnowledgeCompiler && entry.courtManaged) failures.push(`compiler_rejected_candidate_cannot_enter_court:${entry.candidateId}`);
  }
  const recomputedRoot = ledger.format === RCL_FRONTIER_CANDIDATE_LEDGER_FORMAT
    ? sha256({ ...ledger, root: undefined })
    : null;
  if (ledger.root && ledger.root !== recomputedRoot) failures.push('ledger_root_mismatch');
  return {
    ok: failures.length === 0,
    failures: uniqueStrings(failures),
    entryCount: ledger.entries?.length ?? 0,
    recomputedRoot,
    externalRealityVerified: false,
    root: sha256({ failures: uniqueStrings(failures), recomputedRoot }),
  };
}

export function appendCandidateEvidenceEvent(ledgerInput, candidateId, eventInput = {}) {
  const ledger = clone(ledgerInput);
  const beforeValidation = validateCandidateEvidenceLedger(ledger);
  if (!beforeValidation.ok) throw new Error(`candidate_ledger_invalid_before_append:${beforeValidation.failures.join(',')}`);
  const entry = ledger.entries.find((row) => row.candidateId === candidateId);
  if (!entry) throw new Error(`candidate_not_found:${candidateId}`);
  const event = {
    format: RCL_FRONTIER_CANDIDATE_EVENT_FORMAT,
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    type: String(eventInput.type ?? 'research_note'),
    source: String(eventInput.source ?? 'manual_or_external_research_input'),
    candidateId,
    evidenceClass: String(eventInput.evidenceClass ?? 'unclassified_evidence_event'),
    payloadRoot: eventInput.payloadRoot ? String(eventInput.payloadRoot) : null,
    note: eventInput.note ? String(eventInput.note) : null,
    createdAt: eventInput.createdAt ? String(eventInput.createdAt) : null,
    externalEvidenceMayRequireCourtRerun: eventInput.externalEvidenceMayRequireCourtRerun === true,
    root: null,
  };
  event.root = sha256({ ...event, root: undefined });
  entry.events.push(event);
  entry.root = sha256({ ...entry, root: undefined });
  ledger.revision = Number(ledger.revision ?? 0) + 1;
  ledger.root = sha256({ ...ledger, root: undefined });
  return ledger;
}

export function runUnknownKnowledgeEvidenceLoop(options = {}) {
  const compiler = normalizedCompilerBundle(options.compilerBundle ?? options.unknownKnowledge ?? {});
  const portfolio = options.portfolio ?? buildDefaultUnknownLawExperimentPortfolio();
  const court = options.court ?? runFrontierEvidenceCourt({
    portfolio,
    suites: options.suites,
    externalEvidence: options.externalEvidence ?? {},
    spellSandbox: options.spellSandbox,
    formationSandbox: options.formationSandbox,
    aetherSandbox: options.aetherSandbox,
  });
  const courtByLane = new Map(court.judgments.map((row) => [row.laneId, row]));
  const bindings = { ...(options.candidateLaneBindings ?? {}) };

  // Canonical frontier lane ids bind automatically only after the compiler promotes them.
  for (const candidate of compiler.candidates ?? []) {
    if (candidate.promoted === true && PRIMARY_LANES.has(candidate.id) && !bindings[candidate.id]) bindings[candidate.id] = candidate.id;
  }

  const entries = (compiler.candidates ?? []).map((candidate) => {
    const lane = candidate.promoted === true ? bindings[candidate.id] ?? null : null;
    return buildCandidateEntry(candidate, compiler.result?.root ?? null, lane, lane ? courtByLane.get(lane) ?? null : null, court.root);
  });

  const promotedAwaitingSpec = entries
    .filter((row) => row.promotedByUnknownKnowledgeCompiler && !row.courtManaged)
    .map((row) => row.candidateId)
    .sort();
  const compilerRejected = entries
    .filter((row) => !row.promotedByUnknownKnowledgeCompiler)
    .map((row) => row.candidateId)
    .sort();
  const courtManaged = entries.filter((row) => row.courtManaged).map((row) => row.candidateId).sort();

  const ledger = {
    format: RCL_FRONTIER_CANDIDATE_LEDGER_FORMAT,
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    id: String(options.id ?? 'rcl_frontier_candidate_evidence_ledger_v0_1'),
    revision: 0,
    compilerResultRoot: compiler.result?.root ?? null,
    courtRoot: court.root,
    entries,
    queues: {
      promotedAwaitingExperimentSpec: promotedAwaitingSpec,
      courtManaged,
      compilerRejected,
    },
    rules: {
      compilerPromotionDoesNotEqualSandboxSurvival: true,
      compilerScoreDoesNotEqualEvidenceRung: true,
      sandboxCannotReplaceExternalEvidence: true,
      decisiveExternalFalsifierOverridesLowerEvidence: true,
      evidenceEventsAreAppendOnlyAndRootBound: true,
      storyBasedRescueForbidden: true,
    },
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  ledger.root = sha256({ ...ledger, root: undefined });
  const validation = validateCandidateEvidenceLedger(ledger);

  const result = {
    format: 'rcl.frontier-unknown-knowledge-evidence-loop-result.v0.1',
    version: RCL_FRONTIER_CANDIDATE_LEDGER_VERSION,
    ok: validation.ok,
    compilerPromotedCount: Number(compiler.result?.promotedCount ?? 0),
    compilerRejectedCount: Number(compiler.result?.rejectedCount ?? 0),
    promotedAwaitingExperimentSpec,
    courtManaged,
    compilerRejected,
    courtEvidenceLeaders: [...(court.evidenceLeaders ?? [])],
    courtEngineeringLeaders: [...(court.engineeringLeaders ?? [])],
    truthWinner: court.truthWinner ?? null,
    ledgerRoot: ledger.root,
    courtRoot: court.root,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return { compiler, portfolio, court, ledger, validation, result };
}
