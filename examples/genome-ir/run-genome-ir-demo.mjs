import { genomeFoundationProjection, parseVcfVariantLine } from '../../src/genome-ir.mjs';

const observation = parseVcfVariantLine(
  'chr20\t14370\tvariant:synthetic-demo\tG\tA\t29\tPASS\tNS=3;DP=14\tGT:GQ\t0|1:48',
  {
    assembly: 'GRCh38',
    sampleRef: 'sample:synthetic-demo',
    governance: {
      accessTier: 'synthetic',
      consentBasis: 'not-applicable-demo-fixture',
    },
    evidence: [
      {
        id: 'evidence:demo-fixture',
        source: 'RCL synthetic Genome IR demo',
        sourceType: 'synthetic-fixture',
        provenanceClass: 'repository-demo',
        confidence: 1,
      },
    ],
  },
);

console.log(JSON.stringify({
  observation,
  foundationProjection: genomeFoundationProjection(observation),
}, null, 2));
