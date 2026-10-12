#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealitySessionNative } from '../src/session-compiler.mjs';
import { openDurableRealitySession, verifyDurableRealitySession } from '../src/durable-session.mjs';
import { getResearchReadiness } from '../src/research-readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const metadata = readJson('package.json'), components = readJson('COMPONENT-VERSIONS.json'), contract = readJson('VERSION-CONTRACT.json');
const require = (condition, code) => { if (!condition) throw new Error(code); };

require(metadata.version === '2.0.0' && contract.packageVersion === metadata.version && components.package.version === metadata.version, 'RCL_V2_PACKAGE_VERSION_MISMATCH');
require(components.components.nativeVm.version === '2.0.0', 'RCL_V2_NATIVE_VERSION_MISMATCH');
require(components.components.governedSessions.version === '1.0.0' && components.components.durableSessions.version === '1.0.0'
  && components.components.sessionBytecode.version === '1.3', 'RCL_V2_INDEPENDENT_COMPONENT_VERSION_MISMATCH');
require(contract.claims.wholeLanguageRuntimeSelfHosting === false && contract.claims.governedSessions.externalEffectsSupported === false
  && contract.claims.governedSessions.distributedExactlyOnceClaimed === false, 'RCL_V2_SCOPE_OVERCLAIM');
const source = fs.readFileSync(path.join(ROOT, 'examples/sessions/governed-counter.rcl'), 'utf8');
const compiled = compileRealitySessionNative(source);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v2-release-'));
let session;
try {
  session = await openDurableRealitySession(directory, { source, verifyReference: true });
  const request = { requestId: 'release-acceptance', expectedRevision: 0, rule: 'increment', inputs: { 'event.delta': 3, 'event.label': 'release' } };
  const receipt = await session.invoke(request);
  const snapshot = session.snapshot();
  require(snapshot.state['counter.value'] === 3 && snapshot.revision === 1, 'RCL_V2_NATIVE_COMMIT_FAILED');
  require(process.platform !== 'win32' || snapshot.native.sourceBound === true, 'RCL_V2_NATIVE_SOURCE_BINDING_MISSING');
  await session.close();
  session = await openDurableRealitySession(directory, { expectedJournalRoot: snapshot.journalRoot, verifyReference: true });
  const retry = await session.invoke(request);
  require(retry.replayed && retry.receipt.root === receipt.receipt.root && session.snapshot().revision === 1, 'RCL_V2_RESTART_RETRY_FAILED');
  require(session.snapshot().native.processId !== snapshot.native.processId, 'RCL_V2_RESTART_PROCESS_NOT_DISTINCT');
  await session.close(); session = null;
  const verification = await verifyDurableRealitySession(directory, { verifyReference: true });
  const report = {
    format: 'rcl.v2-release-acceptance.v1', status: 'PASS', version: metadata.version, platform: process.platform,
    verificationScope: 'bounded local session implementation; not whole-language release acceptance',
    formalLanguageRelease: false, researchReadiness: getResearchReadiness(),
    nativeSourceBound: snapshot.native.sourceBound, native: snapshot.native, compiler: compiled.evidence, verification,
    sourceHash: hash(Buffer.from(source)), distinctNativeProcesses: true, idempotentRestartRetry: true,
    localFilesystemProfileOnly: true, hostedCi: 'NOT_RUN_USER_INSTRUCTION', publishedRelease: false,
  };
  fs.mkdirSync(path.join(ROOT, 'output/v2.0'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'output/v2.0/release-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await session?.close();
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('rcl-v2-release-')) throw new Error('RCL_V2_TEMP_CLEANUP_SCOPE_INVALID');
  fs.rmSync(resolved, { recursive: true, force: true });
}
