import { runFrontierEvidenceCourt } from '../src/frontier-evidence-court-candidate-tournament.mjs';

const court = runFrontierEvidenceCourt();
console.log(JSON.stringify({
  candidateCount: court.candidateCount,
  survivors: court.survivors,
  rejected: court.rejected,
  protocolBlocked: court.protocolBlocked,
  evidenceLeaders: court.evidenceLeaders,
  engineeringLeaders: court.engineeringLeaders,
  truthWinner: court.truthWinner,
  judgments: court.judgments.map((row) => ({
    laneId: row.laneId,
    designFamily: row.designFamily,
    evidenceRung: row.evidenceRung,
    status: row.status,
    researchDisposition: row.researchDisposition,
    sandboxPass: row.sandbox.pass,
    engineeringStatus: row.engineeringStatus,
    externalRealityVerified: row.externalRealityVerified,
    root: row.root,
  })),
  externalRealityVerified: court.externalRealityVerified,
  newNaturalLawVerified: court.newNaturalLawVerified,
  magicVerified: court.magicVerified,
  root: court.root,
}, null, 2));
