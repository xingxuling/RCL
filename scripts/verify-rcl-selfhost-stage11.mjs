#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootstrapCompilerStage11 } from '../src/bootstrap.mjs';
import { decodeBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage11-verification.json');
const emitterSourcePath = path.join(outputDir, 'stage11-structured-artifact-emitter.rcl');
const emitterArtifactPath = path.join(outputDir, 'stage11-structured-artifact-emitter.rbc');
const emittedCompilerArtifactPath = path.join(outputDir, 'stage11-structured-emitted-compiler.rbc');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

const result = bootstrapCompilerStage11({
  emitterSourcePath,
  emitterArtifactPath,
  emittedCompilerArtifactPath,
});

fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(emitterSourcePath)) fs.writeFileSync(emitterSourcePath, result.emitterSource);

const emitterArtifact = fs.readFileSync(emitterArtifactPath);
const emittedCompilerArtifact = fs.readFileSync(emittedCompilerArtifactPath);
const decodedEmitter = decodeBytecode(emitterArtifact);
const decodedEmittedCompiler = decodeBytecode(emittedCompilerArtifact);
const emittedCompilerRun = runNativeBytecode(emittedCompilerArtifactPath);
const emitterBuiltins = new Set(decodedEmitter.instructions.map(instruction => instruction.builtin).filter(Boolean));

const checks = {
  stage11Completes: result.stage === 'structured-compiler-artifact-emitter-v0.21',
  emitterSourceWritten: fs.existsSync(emitterSourcePath),
  emitterArtifactWritten: fs.existsSync(emitterArtifactPath),
  emittedCompilerArtifactWritten: fs.existsSync(emittedCompilerArtifactPath),
  structuredRclArtifactEmitsCompilerRbc: result.emittedCompilerMatchesExpected === true
    && result.emittedCompilerArtifactSha256 === result.expectedCompilerArtifactSha256
    && sha256(emittedCompilerArtifact) === result.expectedCompilerArtifactSha256,
  emittedCompilerRunsInNativeVm: result.emittedCompilerExecutes === true
    && emittedCompilerRun.status === 'ok'
    && emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] === true,
  decodedEmitterUsesStructuredByteEncoders: emitterBuiltins.has('BYTES_U8')
    && emitterBuiltins.has('BYTES_U16LE')
    && emitterBuiltins.has('BYTES_U32LE')
    && emitterBuiltins.has('BYTES_I32LE')
    && emitterBuiltins.has('BYTES_F64LE')
    && emitterBuiltins.has('UTF8_BYTES')
    && !emitterBuiltins.has('HEX_BYTES'),
  decodedEmittedCompilerIsStage9: decodedEmittedCompiler.program === 'RCLCompilerStage9FixedPoint'
    && decodedEmittedCompiler.strings.length === result.decodedCompilerShape.strings
    && decodedEmittedCompiler.numbers.length === result.decodedCompilerShape.numbers
    && decodedEmittedCompiler.instructions.length === result.decodedCompilerShape.instructions
    && decodedEmittedCompiler.instructions.at(-1)?.name === 'RETURN',
  boundaryHonest: result.boundary.includes('JS-decoded prior bytecode sections')
    && result.trustedBase.some(item => item.includes('Stage-0 JS still decodes')),
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage11.verification.v1',
  emitterSourceFile: path.relative(root, emitterSourcePath).replaceAll(path.sep, '/'),
  emitterArtifactFile: path.relative(root, emitterArtifactPath).replaceAll(path.sep, '/'),
  emittedCompilerArtifactFile: path.relative(root, emittedCompilerArtifactPath).replaceAll(path.sep, '/'),
  stageStatus: 'RCL_STRUCTURED_ARTIFACT_REENCODES_COMPILER_RBC_VERIFIED',
  selfHostClaim: 'structured_artifact_reencodes_next_compiler_rbc_not_full_source_self_emission',
  checks,
  emitterArtifact: {
    program: decodedEmitter.program,
    bytes: emitterArtifact.length,
    sha256: sha256(emitterArtifact),
    instructionCount: decodedEmitter.instructions.length,
    builtins: [...emitterBuiltins].sort(),
  },
  emittedCompilerArtifact: {
    program: decodedEmittedCompiler.program,
    bytes: emittedCompilerArtifact.length,
    sha256: sha256(emittedCompilerArtifact),
    expectedSha256: result.expectedCompilerArtifactSha256,
    exactExpectedMatch: sha256(emittedCompilerArtifact) === result.expectedCompilerArtifactSha256,
    strings: decodedEmittedCompiler.strings.length,
    numbers: decodedEmittedCompiler.numbers.length,
    instructionCount: decodedEmittedCompiler.instructions.length,
  },
  nativeRun: {
    status: emittedCompilerRun.status,
    program: emittedCompilerRun.program,
    instructions: emittedCompilerRun.metrics.instructions,
    signature: result.emittedCompilerSignature,
  },
  boundaries: {
    implementedNow: 'A native-running RCL artifact structurally re-encodes the next compiler RBC header, string pool, number pool, and instruction table; the emitted compiler artifact then executes in the native VM and verifies the Stage-9 self-signature.',
    notYetImplemented: 'The structure still comes from JS-decoded prior bytecode sections, not from full compiler source parsing, semantics, and lowering inside RCL.',
    nextTarget: 'replace_stage11_decoded_bytecode_sections_with_rcl_source_to_instruction_plan_lowering',
  },
  root: result.root,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
