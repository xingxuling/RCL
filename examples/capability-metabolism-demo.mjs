import fs from 'node:fs';
import {
  metabolizeExternalCapability,
  synthesizeAbsorbedCapabilities,
} from '../src/capability-metabolism.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const transaction = metabolizeExternalCapability(read('./capability-metabolism-sql-transaction.json'));
const ownership = metabolizeExternalCapability(read('./capability-metabolism-ownership.json'));
const compound = synthesizeAbsorbedCapabilities([transaction, ownership], {
  id: 'transactional_owned_reality',
});

console.log(JSON.stringify({
  transaction: {
    stage: transaction.assessment.stage,
    score: transaction.assessment.compositeScore,
    root: transaction.root,
  },
  ownership: {
    stage: ownership.assessment.stage,
    score: ownership.assessment.compositeScore,
    root: ownership.root,
  },
  compound,
}, null, 2));
