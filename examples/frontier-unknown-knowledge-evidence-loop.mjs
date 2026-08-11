import { runUnknownKnowledgeEvidenceLoop } from '../src/frontier-candidate-evidence-ledger.mjs';

const loop = runUnknownKnowledgeEvidenceLoop();
console.log(JSON.stringify({
  ok: loop.result.ok,
  compilerPromotedCount: loop.result.compilerPromotedCount,
  compilerRejectedCount: loop.result.compilerRejectedCount,
  promotedAwaitingExperimentSpec: loop.result.promotedAwaitingExperimentSpec,
  courtManaged: loop.result.courtManaged,
  compilerRejected: loop.result.compilerRejected,
  courtEvidenceLeaders: loop.result.courtEvidenceLeaders,
  courtEngineeringLeaders: loop.result.courtEngineeringLeaders,
  truthWinner: loop.result.truthWinner,
  ledgerRoot: loop.result.ledgerRoot,
  courtRoot: loop.result.courtRoot,
  externalRealityVerified: loop.result.externalRealityVerified,
  newNaturalLawVerified: loop.result.newNaturalLawVerified,
  magicVerified: loop.result.magicVerified,
}, null, 2));
