import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditK400Completion, buildUniversalStressMatrix, classifyUniversalMaturity,
  COVERAGE_MODE, evaluateStressCell, evidenceRoot, findUnabsorbedAdvantages,
  STRESS_STATUS, UNIVERSAL_STRESS_GATES, validateUniversalStressEvidence,
} from './universal-program-stress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const K400_EVIDENCE_PATH = 'examples/universal-stress/k400-current-evidence.json';

export function evaluateResearchReadiness(evidence, policy, packageVersion) {
  if (policy?.status !== 'RESEARCH_PREVIEW' || policy?.formalLanguageRelease !== false
      || policy?.versionPromotionFrozen !== true || policy?.frozenPackageVersion !== packageVersion
      || policy?.versionRole !== 'historical-build-identity' || policy?.evidence !== K400_EVIDENCE_PATH
      || policy?.requiredCompletion !== 'K400_COMPLETE') {
    throw new Error('RCL_RESEARCH_VERSION_POLICY_INVALID_OR_PROMOTION_FROZEN');
  }
  const validation = validateUniversalStressEvidence(evidence);
  if (!validation.ok) throw new Error(`RCL_RESEARCH_EVIDENCE_INVALID:${validation.errors.join('|')}`);
  const claims = new Map((evidence.claims ?? []).map(claim => [claim.id, claim]));
  const reports = buildUniversalStressMatrix().map(cell => claims.has(cell.id)
    ? evaluateStressCell({ ...cell, ...claims.get(cell.id), id: cell.id })
    : evaluateStressCell({ ...cell, untested: true, coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
      gates: Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate => [gate, { status: STRESS_STATUS.UNVERIFIED, evidence: [] }])), changes: [] }));
  const completion = auditK400Completion(reports);
  const maturity = classifyUniversalMaturity({
    evaluatedCells: reports.filter(report => claims.has(report.id)), totalMatrixCells: reports.length,
    novelTaskTrials: Number(evidence.novelTaskTrials ?? 0), kernelChangesForNovelTasks: Number(evidence.kernelChangesForNovelTasks ?? 0),
    competitiveComparisons: evidence.competitiveComparisons ?? [],
    unabsorbedAdvantages: findUnabsorbedAdvantages(evidence.donorComparisons ?? []),
  });
  return {
    format: 'rcl.research-readiness.v1', status: 'RESEARCH_PREVIEW', packageVersion,
    versionRole: 'historical-build-identity', versionPromotionFrozen: true, formalLanguageRelease: false,
    releaseReviewRequired: true, maturity, k400: completion,
    passedFraction: completion.passedCells / completion.totalCells,
    evidenceRoot: evidenceRoot(evidence), evidenceScope: 'registered profile evidence; underlying executions not rerun',
    requiredCompletion: 'K400_COMPLETE',
  };
}

export function getResearchReadiness() {
  const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
  const pkg = readJson('package.json'), contract = readJson('VERSION-CONTRACT.json');
  return { ...evaluateResearchReadiness(readJson(K400_EVIDENCE_PATH), contract.researchStatus, pkg.version), evidencePath: K400_EVIDENCE_PATH };
}
