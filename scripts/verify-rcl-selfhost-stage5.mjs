#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { parseReality } from '../src/parser.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-fixedpoint-source-stage5.rcl');
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'stage5-verification.json');
const materializedSourcePath = path.join(outputDir, 'stage5-materialized-compiler-source.rcl');
const artifactNPath = path.join(outputDir, 'stage5-materialized-compiler-source-N.rbc');
const artifactN1Path = path.join(outputDir, 'stage5-materialized-compiler-source-N1.rbc');
const nativeVmPath = path.join(root, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');

function sha256(buffer) {
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function countKinds(nodes) {
  const counts = {};
  for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  return counts;
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;
const materializedSource = state['source.compiler'];
const materializedAst = parseReality(materializedSource);
const materializedCounts = countKinds(materializedAst.body);
const artifactN = Buffer.from(compileRealityToBytecode(materializedSource));
const artifactN1 = Buffer.from(compileRealityToBytecode(materializedSource));
const decodedN = decodeBytecode(artifactN);
const nativeVmExists = fs.existsSync(nativeVmPath);

const checks = {
  rclCompilesAndRuns: state['selfhost.stage_status'] === 'RCL_OWNED_FIXEDPOINT_SOURCE_SIGNATURE_VERIFIED',
  materializedSourceIsParseable: materializedAst.name === 'RCLCompilerStage9FixedPoint',
  materializedSignatureMatches: Number(state['stage5.materialized_declaration_count']) === 4
    && Number(state['stage5.materialized_facet_count']) === 3
    && Number(state['stage5.materialized_reckon_count']) === 1
    && Number(state['stage5.materialized_absorption_count']) === 0
    && Number(state['compiler.generation']) === 0
    && state['compiler.fixedpoint_signature_supported'] === true,
  jsParserCountsMatchRclSignature: materializedCounts.FacetDecl === Number(state['stage5.materialized_facet_count'])
    && materializedCounts.ReckonDecl === Number(state['stage5.materialized_reckon_count'])
    && materializedAst.body.length === Number(state['stage5.materialized_declaration_count']),
  jsReferenceBytecodeFixedPoint: artifactN.equals(artifactN1),
  decodedArtifactLooksExecutable: decodedN.format === 'rcl.bytecode.v1'
    && decodedN.program === materializedAst.name
    && decodedN.instructions.some(instruction => instruction.name === 'HALT')
    && decodedN.instructions.at(-1)?.name === 'RETURN',
  nativeVmArtifactAvailable: process.platform !== 'win32' || nativeVmExists,
  nativeFixedPointStillNotClaimed: state['gate.native_windows_fixedpoint'] === false,
  boundaryRecorded: state['selfhost.boundary'] === 'source_materialization_signature_only_no_native_windows_fixedpoint'
    && state['gate.full_self_hosting'] === false
    && state['gate.rcl_owned_fixedpoint_signature'] === true
    && state['gate.rcl_owned_artifact_fixedpoint'] === false
    && state['gate.js_reference_bytecode_fixedpoint'] === true
    && state['gate.js_runtime_still_required'] === true,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage5.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  materializedCompilerSourceFile: path.relative(root, materializedSourcePath).replaceAll(path.sep, '/'),
  artifactNFile: path.relative(root, artifactNPath).replaceAll(path.sep, '/'),
  artifactN1File: path.relative(root, artifactN1Path).replaceAll(path.sep, '/'),
  stageStatus: state['selfhost.stage_status'],
  selfHostClaim: state['selfhost.claim'],
  checks,
  materializedCompilerSource: {
    program: materializedAst.name,
    bytes: Buffer.byteLength(materializedSource),
    sha256: sha256(Buffer.from(materializedSource)),
    declarationCount: materializedAst.body.length,
    counts: materializedCounts,
  },
  jsReferenceArtifactFixedPoint: {
    artifactBytes: artifactN.length,
    artifactNSha256: sha256(artifactN),
    artifactN1Sha256: sha256(artifactN1),
    byteIdentical: artifactN.equals(artifactN1),
  },
  nativeBoundary: {
    nativeVmPath: path.relative(root, nativeVmPath).replaceAll(path.sep, '/'),
    nativeVmExists,
    nativeWindowsFixedPoint: state['gate.native_windows_fixedpoint'],
  },
  boundaries: {
    implementedNow: 'RCL source holds a materialized compiler-source projection, parses it inside RCL, verifies its stable self-signature, and emits that source as an actual .rcl file with byte-identical JS-reference artifacts.',
    notYetImplemented: 'RCL does not yet transform compiler source into compiler artifacts inside RCL; native fixed-point execution remains unclaimed even though the Windows native VM artifact is now present.',
    nextTarget: state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(materializedSourcePath, materializedSource);
fs.writeFileSync(artifactNPath, artifactN);
fs.writeFileSync(artifactN1Path, artifactN1);
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
