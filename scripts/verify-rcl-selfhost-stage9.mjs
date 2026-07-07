#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootstrapCompilerStage9 } from '../src/bootstrap.mjs';
import { decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'bootstrap', 'compiler-stage9.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage9-verification.json');
const artifactNPath = path.join(outputDir, 'stage9-fixedpoint-compiler-N.rbc');
const artifactN1Path = path.join(outputDir, 'stage9-fixedpoint-compiler-N1.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

const result = bootstrapCompilerStage9({
  stage9Path: rclPath,
  outputNPath: artifactNPath,
  outputN1Path: artifactN1Path,
});

const artifactN = fs.readFileSync(artifactNPath);
const artifactN1 = fs.readFileSync(artifactN1Path);
const decodedN = decodeBytecode(artifactN);
const decodedN1 = decodeBytecode(artifactN1);
const rerunN = runNativeBytecode(artifactNPath);
const rerunN1 = runNativeBytecode(artifactN1Path);

const checks = {
  stage9Completes: result.stage === 'fixed-point-self-compilation-v0.19',
  artifactsWritten: fs.existsSync(artifactNPath) && fs.existsSync(artifactN1Path),
  byteIdenticalArtifactFixedPoint: result.byteIdenticalArtifactFixedPoint === true
    && artifactN.equals(artifactN1)
    && result.artifactNSha256 === result.artifactN1Sha256
    && result.artifactNSha256 === sha256(artifactN),
  semanticFixedPoint: result.semanticFixedPoint === true
    && JSON.stringify(result.signatureN) === JSON.stringify(result.signatureN1)
    && result.signatureN.program === 'RCLCompilerStage9FixedPoint'
    && result.signatureN.supported === true,
  decodedArtifactsMatch: decodedN.format === 'rcl.bytecode.v1'
    && decodedN1.format === 'rcl.bytecode.v1'
    && decodedN.program === 'RCLCompilerStage9FixedPoint'
    && decodedN.program === decodedN1.program
    && decodedN.instructions.at(-1)?.name === 'RETURN'
    && JSON.stringify(decodedN.instructions) === JSON.stringify(decodedN1.instructions),
  nativeVmRunsArtifactN: rerunN.status === 'ok'
    && rerunN.state['compiler.fixedpoint_signature_supported'] === true
    && rerunN.state['compiler.program'] === 'RCLCompilerStage9FixedPoint',
  nativeVmRunsArtifactN1: rerunN1.status === 'ok'
    && rerunN1.state['compiler.fixedpoint_signature_supported'] === true
    && rerunN1.state['compiler.program'] === 'RCLCompilerStage9FixedPoint',
  boundaryHonest: result.boundary.includes('not yet a whole-language compiler artifact')
    && result.trustedBase.some(item => item.includes('Stage-0 JS still materializes')),
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage9.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  artifactNFile: path.relative(root, artifactNPath).replaceAll(path.sep, '/'),
  artifactN1File: path.relative(root, artifactN1Path).replaceAll(path.sep, '/'),
  stageStatus: 'RCL_FIXED_POINT_SELF_COMPILATION_WITNESS_VERIFIED',
  selfHostClaim: 'fixed_point_witness_not_complete_whole_language_self_hosting',
  checks,
  artifact: {
    bytes: artifactN.length,
    artifactNSha256: sha256(artifactN),
    artifactN1Sha256: sha256(artifactN1),
    byteIdentical: artifactN.equals(artifactN1),
    program: decodedN.program,
    instructionCount: decodedN.instructions.length,
  },
  signatures: {
    signatureN: result.signatureN,
    signatureN1: result.signatureN1,
    semanticFixedPoint: result.semanticFixedPoint,
  },
  nativeRuns: {
    n: {
      status: rerunN.status,
      program: rerunN.program,
      stateRoot: rerunN.stateRoot,
      instructions: rerunN.metrics.instructions,
    },
    n1: {
      status: rerunN1.status,
      program: rerunN1.program,
      stateRoot: rerunN1.stateRoot,
      instructions: rerunN1.metrics.instructions,
    },
  },
  boundaries: {
    implementedNow: 'RCL Stage-9 source materializes byte-identical compiler artifacts N and N+1, and both artifacts execute in the native VM to derive the same compiler self-signature.',
    notYetImplemented: 'The compiler artifact still depends on Stage-0 JS materialization for the first artifact and is not yet a whole-language compiler that self-emits all of its own RBC and replaces the JS runtime completely.',
    nextTarget: 'rcl_artifact_self_emits_compiler_rbc_without_stage0_js_materialization',
  },
  root: result.root,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
