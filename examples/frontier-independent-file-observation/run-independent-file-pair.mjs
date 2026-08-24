import { runIndependentFileControlPair } from '../../src/frontier-independent-file-observation.mjs';

const interactionFile = process.argv[2];
const additiveFile = process.argv[3];
if (!interactionFile || !additiveFile) {
  console.error('Usage: node run-independent-file-pair.mjs <interaction.json> <additive.json>');
  process.exit(2);
}
const result = runIndependentFileControlPair(interactionFile, additiveFile);
console.log(JSON.stringify({
  ok: result.ok,
  verdict: result.verdict,
  interactionDetected: result.interactionDetected,
  interactionWinner: result.interactionWinner,
  additiveRejectedAsInteraction: result.additiveRejectedAsInteraction,
  additiveWinner: result.additiveWinner,
  producerProcessesDifferFromIntake: result.producerProcessesDifferFromIntake,
  externalRealityVerified: result.externalRealityVerified,
  root: result.root,
}, null, 2));
