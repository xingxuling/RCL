import {
  runKnownExternalHostControlSuite,
  writeKnownExternalHostControlReports,
} from '../src/frontier-known-external-host-control.mjs';

const outDir = process.argv[2] || 'output/frontier-known-external-host-control-v0.1';
const options = { samplesPerCell: 12, interactionDelayMs: 8, symbolDelayMs: 4, geometryDelayMs: 6 };
const report = writeKnownExternalHostControlReports(outDir, options);
const suite = runKnownExternalHostControlSuite(options);
console.log(JSON.stringify({
  ok: suite.ok,
  verdict: suite.verdict,
  positiveDetected: suite.positiveDetected,
  additiveRejected: suite.additiveRejected,
  positiveModelWinner: suite.positiveModelWinner,
  additiveModelWinner: suite.additiveModelWinner,
  hostFingerprint: suite.hostFingerprint,
  externalRealityVerified: suite.externalRealityVerified,
  root: suite.root,
  report,
}, null, 2));
