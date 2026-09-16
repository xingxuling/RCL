#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicDir = path.join(root, 'public');
const geneticProofPath = path.join(publicDir, 'rcl-foundation-genetic-native-proof.json');
const livingProofPath = path.join(publicDir, 'rcl-foundation-living-native-proof.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}
function fail(message, details = {}) {
  console.error(JSON.stringify({ ok:false, status:'RCL_VERCEL_FOUNDATION_BIOLOGICAL_BINDING_FAILED', message, ...details }, null, 2));
  process.exit(1);
}
function coreParityValid(proof) {
  return Boolean(
    proof?.parity?.state === true
    && proof?.parity?.semanticStateRoot === true
    && proof?.parity?.nativeStateRootVerified === true
    && proof?.parity?.nativeStateRootParity === true
    && proof?.parity?.loweringLineage === true
    && proof?.parity?.domainReceipt === true
    && proof?.parity?.nativeExecutionAttestation === true
  );
}
function existingBoundProofValid(proof, domain, binarySha256) {
  return Boolean(
    proof?.domain === domain
    && proof?.status === 'native-verified'
    && proof?.verified === true
    && Number(proof?.loweredCount ?? 0) >= 1
    && proof?.executionBinarySha256 === binarySha256
    && coreParityValid(proof)
    && isSha256(proof?.foundationDomainReceiptRoot)
    && isSha256(proof?.nativeVmExecutionAttestationRoot)
  );
}

try {
  for (const requiredPath of [target, manifestPath, geneticProofPath, livingProofPath]) {
    if (!fs.existsSync(requiredPath)) fail('Required biological deployment evidence input is missing', { requiredPath });
  }

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const genetic = JSON.parse(fs.readFileSync(geneticProofPath, 'utf8'));
  const living = JSON.parse(fs.readFileSync(livingProofPath, 'utf8'));

  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Deployment attestation format is not the expected multi-domain format', { format:manifest?.format ?? null });
  }
  if (
    manifest?.binarySha256 !== binarySha256
    || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
    || manifest?.replayProof?.stateRootVerified !== true
    || manifest?.replayProof?.stateRootParity !== true
    || !isSha256(manifest?.replayProof?.attestationRoot)
  ) {
    fail('Deployment replay evidence is not bound to the exact current canonical binary', { binarySha256, replayProof:manifest?.replayProof ?? null });
  }

  const existingProofs = manifest?.foundationParityProofs ?? {};
  for (const domain of ['perception','physical','neural']) {
    if (!existingBoundProofValid(existingProofs[domain], domain, binarySha256)) {
      fail(`Existing ${domain} deployment proof is not valid enough to extend the manifest`, { domain, proof:existingProofs[domain] ?? null });
    }
  }

  if (
    genetic?.format !== 'taowind.rcl-vercel-foundation-genetic-native-proof.v0.1'
    || genetic?.domain !== 'genetic'
    || genetic?.status !== 'native-verified'
    || genetic?.verified !== true
    || genetic?.binarySha256 !== binarySha256
    || genetic?.executionBinarySha256 !== binarySha256
    || genetic?.geneticLoweredGenerationCount !== 2
    || genetic?.geneticLoweredStageCount !== 4
    || !coreParityValid(genetic)
    || !isSha256(genetic?.foundationDomainReceiptRoot)
    || !isSha256(genetic?.foundationCompositeReceiptRoot)
    || !isSha256(genetic?.nativeVmExecutionAttestationRoot)
    || genetic?.finalState?.['lineage.seed'] !== 5
    || genetic?.finalState?.['lineage.trait'] !== 15
  ) {
    fail('Standalone Genetic proof does not satisfy the deployment evidence contract', { genetic });
  }

  if (
    living?.format !== 'taowind.rcl-vercel-foundation-living-native-proof.v0.1'
    || living?.domain !== 'living'
    || living?.status !== 'native-verified'
    || living?.verified !== true
    || living?.binarySha256 !== binarySha256
    || living?.executionBinarySha256 !== binarySha256
    || living?.livingLoweredStepCount !== 2
    || living?.livingLoweredStageCount !== 6
    || !coreParityValid(living)
    || !isSha256(living?.foundationDomainReceiptRoot)
    || !isSha256(living?.foundationCompositeReceiptRoot)
    || !isSha256(living?.nativeVmExecutionAttestationRoot)
    || living?.truthBoundary?.unchangedSenseNegativeEvidenceBound !== true
    || living?.finalState?.['organism.foodSense'] !== 4
    || living?.finalState?.['organism.energy'] !== 9
    || living?.finalState?.['organism.health'] !== 3
  ) {
    fail('Standalone Living proof does not satisfy the deployment evidence contract', { living });
  }

  const geneticParityProof = {
    format:genetic.format, version:'0.1.0', domain:'genetic', status:genetic.status, verified:true,
    loweredCount:genetic.geneticLoweredStageCount,
    generationCount:genetic.geneticLoweredGenerationCount,
    stageCount:genetic.geneticLoweredStageCount,
    parity:genetic.parity,
    foundationDomainReceiptRoot:genetic.foundationDomainReceiptRoot,
    foundationCompositeReceiptRoot:genetic.foundationCompositeReceiptRoot,
    nativeVmExecutionAttestationRoot:genetic.nativeVmExecutionAttestationRoot,
    executionBinarySha256:genetic.executionBinarySha256,
    finalState:genetic.finalState,
  };
  const livingParityProof = {
    format:living.format, version:'0.1.0', domain:'living', status:living.status, verified:true,
    loweredCount:living.livingLoweredStageCount,
    boundedSteps:living.livingLoweredStepCount,
    stageCount:living.livingLoweredStageCount,
    parity:living.parity,
    foundationDomainReceiptRoot:living.foundationDomainReceiptRoot,
    foundationCompositeReceiptRoot:living.foundationCompositeReceiptRoot,
    nativeVmExecutionAttestationRoot:living.nativeVmExecutionAttestationRoot,
    executionBinarySha256:living.executionBinarySha256,
    unchangedSenseNegativeEvidenceBound:true,
    finalState:living.finalState,
  };

  manifest.foundationParityProofs = {
    perception:existingProofs.perception,
    physical:existingProofs.physical,
    neural:existingProofs.neural,
    genetic:geneticParityProof,
    living:livingParityProof,
  };
  manifest.foundationGeneticParityProof = geneticParityProof;
  manifest.foundationLivingParityProof = livingParityProof;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath) ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8')) : {};
  publicBuildProof.format = manifest.format;
  publicBuildProof.binarySha256 = binarySha256;
  publicBuildProof.foundationParityDomains = ['perception','physical','neural','genetic','living'];
  publicBuildProof.foundationParityProofs = manifest.foundationParityProofs;
  publicBuildProof.foundationGeneticParity = {
    domain:'genetic', status:geneticParityProof.status, verified:true,
    generationCount:geneticParityProof.generationCount, stageCount:geneticParityProof.stageCount,
    foundationDomainReceiptRoot:geneticParityProof.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot:geneticParityProof.nativeVmExecutionAttestationRoot,
    executionBinarySha256:geneticParityProof.executionBinarySha256,
    finalState:geneticParityProof.finalState,
  };
  publicBuildProof.foundationLivingParity = {
    domain:'living', status:livingParityProof.status, verified:true,
    boundedSteps:livingParityProof.boundedSteps, stageCount:livingParityProof.stageCount,
    foundationDomainReceiptRoot:livingParityProof.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot:livingParityProof.nativeVmExecutionAttestationRoot,
    executionBinarySha256:livingParityProof.executionBinarySha256,
    unchangedSenseNegativeEvidenceBound:true,
    finalState:livingParityProof.finalState,
  };
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok:true,
    status:'RCL_VERCEL_FOUNDATION_BIOLOGICAL_DEPLOYMENT_BOUND',
    binarySha256,
    foundationParityDomains:Object.keys(manifest.foundationParityProofs),
    geneticDomainReceiptRoot:geneticParityProof.foundationDomainReceiptRoot,
    livingDomainReceiptRoot:livingParityProof.foundationDomainReceiptRoot,
    geneticFinalState:geneticParityProof.finalState,
    livingFinalState:livingParityProof.finalState,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code:error?.code ?? null, stack:error?.stack ?? null });
}
