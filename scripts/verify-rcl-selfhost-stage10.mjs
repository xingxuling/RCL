#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootstrapCompilerStage10 } from '../src/bootstrap.mjs';
import { decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage10-verification.json');
const emitterSourcePath = path.join(outputDir, 'stage10-artifact-emitter.rcl');
const emitterArtifactPath = path.join(outputDir, 'stage10-artifact-emitter.rbc');
const emittedCompilerArtifactPath = path.join(outputDir, 'stage10-emitted-compiler.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

const result = bootstrapCompilerStage10({
  emitterArtifactPath,
  emittedCompilerArtifactPath,
});

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(emitterSourcePath, result.emitterSource);

const emitterArtifact = fs.readFileSync(emitterArtifactPath);
const emittedCompilerArtifact = fs.readFileSync(emittedCompilerArtifactPath);
const decodedEmitter = decodeBytecode(emitterArtifact);
const decodedEmittedCompiler = decodeBytecode(emittedCompilerArtifact);
const emittedCompilerRun = runNativeBytecode(emittedCompilerArtifactPath);

const checks = {
  stage10Completes: result.stage === 'compiler-artifact-emitter-v0.20',
  emitterSourceWritten: fs.existsSync(emitterSourcePath),
  emitterArtifactWritten: fs.existsSync(emitterArtifactPath),
  emittedCompilerArtifactWritten: fs.existsSync(emittedCompilerArtifactPath),
  rclArtifactEmitsCompilerRbc: result.emittedCompilerMatchesExpected === true
    && result.emittedCompilerArtifactSha256 === result.expectedCompilerArtifactSha256
    && sha256(emittedCompilerArtifact) === result.expectedCompilerArtifactSha256,
  emittedCompilerRunsInNativeVm: result.emittedCompilerExecutes === true
    && emittedCompilerRun.status === 'ok'
    && emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] === true,
  decodedEmitterUsesHexBytes: decodedEmitter.instructions.some(instruction => instruction.builtin === 'HEX_BYTES'),
  decodedEmittedCompilerIsStage9: decodedEmittedCompiler.program === 'RCLCompilerStage9FixedPoint'
    && decodedEmittedCompiler.instructions.at(-1)?.name === 'RETURN',
  boundaryHonest: result.boundary.includes('payload-emission bridge')
    && result.trustedBase.some(item => item.includes('Stage-0 JS still bootstraps')),
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage10.verification.v1',
  emitterSourceFile: path.relative(root, emitterSourcePath).replaceAll(path.sep, '/'),
  emitterArtifactFile: path.relative(root, emitterArtifactPath).replaceAll(path.sep, '/'),
  emittedCompilerArtifactFile: path.relative(root, emittedCompilerArtifactPath).replaceAll(path.sep, '/'),
  stageStatus: 'RCL_ARTIFACT_EMITS_COMPILER_RBC_VERIFIED',
  selfHostClaim: 'artifact_emits_next_compiler_rbc_not_full_source_self_emission',
  checks,
  emitterArtifact: {
    program: decodedEmitter.program,
    bytes: emitterArtifact.length,
    sha256: sha256(emitterArtifact),
    instructionCount: decodedEmitter.instructions.length,
  },
  emittedCompilerArtifact: {
    program: decodedEmittedCompiler.program,
    bytes: emittedCompilerArtifact.length,
    sha256: sha256(emittedCompilerArtifact),
    expectedSha256: result.expectedCompilerArtifactSha256,
    exactExpectedMatch: sha256(emittedCompilerArtifact) === result.expectedCompilerArtifactSha256,
    instructionCount: decodedEmittedCompiler.instructions.length,
  },
  nativeRun: {
    status: emittedCompilerRun.status,
    program: emittedCompilerRun.program,
    instructions: emittedCompilerRun.metrics.instructions,
    signature: result.emittedCompilerSignature,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact emits the next compiler RBC bytes through runtime state; that emitted compiler artifact then executes in the native VM and verifies the Stage-9 self-signature.',
    notYetImplemented: 'The emitted bytes are still carried as an artifact payload, not derived from full compiler source semantics; Stage-0 JS still bootstraps the emitter artifact itself.',
    nextTarget: 'replace_stage10_payload_with_rcl_source_to_compiler_rbc_lowering',
  },
  root: result.root,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
