import fs from 'node:fs';
import {
  buildNistCeramicDesignGrammar,
  routeFrontierScorer,
} from '../src/frontier-design-grammar-router.mjs';

const dataset = JSON.parse(fs.readFileSync('data/frontier-public-datasets/nist-ceramic-2pow5.json', 'utf8'));
const result = routeFrontierScorer(buildNistCeramicDesignGrammar(), dataset);
console.log(JSON.stringify({
  ok: result.ok,
  status: result.status,
  route: result.route,
  speedRateSumSquares: result.score?.terms?.speed_rate?.sumSquares ?? null,
  fallbackUsed: result.fallbackUsed,
  externalRealityVerified: result.externalRealityVerified,
  root: result.root,
}, null, 2));
