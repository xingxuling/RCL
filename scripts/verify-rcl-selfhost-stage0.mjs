#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'selfhost', 'rcl-source-selfhost-stage0.rcl');
const outputPath = path.join(root, 'output', 'selfhost', 'stage0-verification.json');

const coreModules = [
  ['lexer', 'src/lexer.mjs', 'source.lexer_sha'],
  ['parser', 'src/parser.mjs', 'source.parser_sha'],
  ['compiler', 'src/compiler.mjs', 'source.compiler_sha'],
  ['runtime', 'src/runtime.mjs', 'source.runtime_sha'],
  ['bytecode', 'src/bytecode.mjs', 'source.bytecode_sha'],
  ['bootstrap', 'src/bootstrap.mjs', 'source.bootstrap_sha'],
  ['native_vm', 'src/native-vm.mjs', 'source.native_vm_sha'],
  ['v094_file_emission', 'src/autonomous-sandbox-file-emission-protocol.mjs', 'source.v094_file_emission_sha'],
];

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exportNames(text) {
  return [...text.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)].map(match => match[1]);
}

const rclSource = fs.readFileSync(rclPath, 'utf8');
const compiled = compileReality(rclSource);
const run = await runReality(compiled);
const state = run.state;

const modules = coreModules.map(([id, relativePath, stateKey]) => {
  const text = readText(relativePath);
  const actualSha = sha256(text);
  return {
    id,
    path: relativePath,
    bytes: Buffer.byteLength(text),
    sha256: actualSha,
    rclSha256: state[stateKey],
    hashMatchesRcl: actualSha === state[stateKey],
    exports: exportNames(text),
  };
});

const nativeExe = path.join(root, 'native', 'rclvm.exe');
const nativePosix = path.join(root, 'native', 'rclvm');
const nativePosixPresent = fs.existsSync(nativePosix);
const bootstrapStages = Array.from({ length: 9 }, (_, index) => path.join(root, 'bootstrap', index === 0 ? 'compiler-seed.rcl' : `compiler-stage${index + 1}.rcl`));
const v094Source = readText('src/autonomous-sandbox-file-emission-protocol.mjs');

const checks = {
  rclCompilesAndRuns: run.state['selfhost.stage_status'] === 'PROXY_VERIFIED',
  coreHashesMatch: modules.every(item => item.hashMatchesRcl),
  coreModuleCountMatches: Number(state['source.core_module_count']) === modules.length,
  bootstrapStagesPresent: bootstrapStages.every(file => fs.existsSync(file)),
  windowsNativeBoundaryRecorded: state['platform.windows_native_status'] === 'NATIVE_WINDOWS_VERIFIED',
  windowsNativeExePresent: fs.existsSync(nativeExe),
  posixNativeArtifactOptional: process.platform === 'win32' || nativePosixPresent,
  v094FinalGateStillHardcodedFiveDecoded: v094Source.includes('result.decoded.length >= 5'),
  fullSelfHostingClaimBlocked: state['gate.full_self_hosting'] === false,
};

const payload = {
  ok: Object.values(checks).every(Boolean),
  format: 'rcl.selfhost.stage0.verification.v1',
  rclFile: path.relative(root, rclPath).replaceAll(path.sep, '/'),
  stageStatus: run.state['selfhost.stage_status'],
  selfHostClaim: run.state['selfhost.claim'],
  checks,
  modules,
  boundaries: {
    actualRuntime: 'JS reference runtime executes this Stage 0 RCL model.',
    rewriteStatus: 'Core implementation is not rewritten into RCL yet.',
    nativeWindows: fs.existsSync(nativeExe) ? 'NATIVE_WINDOWS_VERIFIED' : 'BLOCKED_MISSING_RCLVM_EXE',
    nativePosixArtifact: nativePosixPresent ? 'PRESENT' : (process.platform === 'win32' ? 'OPTIONAL_MISSING_ON_WINDOWS' : 'MISSING'),
    nextTarget: run.state['selfhost.next_rewrite_target'],
  },
  stateRoot: run.stateRoot,
  programRoot: run.programRoot,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
