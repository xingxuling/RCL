import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicGenomeStudyBootstrap,
  publicGenomeStudySummary,
} from '../src/genome-study-bootstrap.mjs';


test('Public Genome Study Bootstrap is deterministic and manifest-first', () => {
  const left = buildPublicGenomeStudyBootstrap();
  const right = buildPublicGenomeStudyBootstrap();
  assert.equal(left.studyRoot, right.studyRoot);
  assert.equal(left.sample.sampleRef, 'HG005');
  assert.equal(left.sample.accessTier, 'public');
  assert.equal(left.budgets.manifestFirst, true);
  assert.equal(left.budgets.wholeGenomeDownloadAllowed, false);
  assert.equal(left.stages[1].id, 'manifest-discovery');
  assert.ok(left.globalInvariants.includes('association-not-causality'));
});


test('Bootstrap wires the whole federation from public source to DWAC artifact', () => {
  const study = buildPublicGenomeStudyBootstrap();
  const owners = study.stages.map(stage => stage.owner);
  assert.ok(owners.includes('provider'));
  assert.ok(owners.includes('rcl'));
  assert.ok(owners.includes('rncs'));
  assert.ok(owners.includes('ugis'));
  assert.ok(owners.includes('dwac'));
  assert.equal(study.stages.at(-1).outputs[0], 'artifact.genomics.research.report');
  assert.equal(study.completionGate.automaticCanonicalPromotion, false);
});


test('Bootstrap reuses mature variant and annotation tools', () => {
  const study = buildPublicGenomeStudyBootstrap();
  assert.deepEqual(study.toolchain.steps.map(step => step.toolId), ['htslib', 'bcftools', 'ensembl-vep']);
  assert.equal(study.toolchain.outputContract, 'rcl.genome-observation.v0.1');
});


test('Bootstrap rejects non-public samples and implicit whole-genome downloads', () => {
  assert.throws(() => buildPublicGenomeStudyBootstrap({
    sample: { accessTier: 'private' },
  }), /only public sample sources/);

  assert.throws(() => buildPublicGenomeStudyBootstrap({
    budgets: { wholeGenomeDownloadAllowed: true },
  }), /explicitWholeGenomeDownloadAuthorization/);

  const explicitlyAllowed = buildPublicGenomeStudyBootstrap({
    budgets: { wholeGenomeDownloadAllowed: true },
    explicitWholeGenomeDownloadAuthorization: true,
  });
  assert.equal(explicitlyAllowed.budgets.wholeGenomeDownloadAllowed, true);
});


test('Study summary exposes bounded execution shape without claiming execution', () => {
  const summary = publicGenomeStudySummary();
  assert.equal(summary.sampleRef, 'HG005');
  assert.equal(summary.referenceAssembly, 'GRCh38');
  assert.equal(summary.firstStage, 'source-authority');
  assert.equal(summary.lastStage, 'research-artifact');
  assert.equal(summary.automaticCanonicalPromotion, false);
  assert.equal(summary.stageCount, 13);
});
