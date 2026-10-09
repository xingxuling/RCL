#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveNpmCli } from './npm-cli-path.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.resolve(process.argv[2]);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v2-install-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (args, cwd = directory) => {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('RCL_V2_INSTALL_PROCESS_FAILED:' + result.stderr + result.stdout);
  return result.stdout;
};
try {
  fs.writeFileSync(path.join(directory, 'package.json'), '{"private":true,"type":"module"}\n');
  run([resolveNpmCli(), 'install', '--ignore-scripts', '--no-audit', '--no-fund', archive]);
  const packageRoot = path.join(directory, 'node_modules/@taowind/rcl-reality-forge');
  const cli = path.join(packageRoot, 'src/reality-hub-cli.mjs');
  const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.version !== '2.0.0') throw new Error('RCL_V2_INSTALLED_VERSION_MISMATCH');
  const version = JSON.parse(run([cli, 'version', '--json']));
  const doctor = JSON.parse(run([cli, 'doctor']));
  if (version.version !== '2.0.0' || doctor.ok !== true) throw new Error('RCL_V2_INSTALLED_PUBLIC_CONTRACT_FAILED');
  const example = path.join(packageRoot, 'examples/sessions/governed-counter.rcl');
  const storage = path.join(directory, 'state');
  const command = path.join(directory, 'command.json');
  fs.writeFileSync(command, JSON.stringify({ requestId: 'installed', expectedRevision: 0, rule: 'increment', inputs: { 'event.delta': 4, 'event.label': '独立安装' } }));
  run([cli, 'session', 'init', example, storage]);
  const first = JSON.parse(run([cli, 'session', 'invoke', storage, command]));
  const retry = JSON.parse(run([cli, 'session', 'invoke', storage, command]));
  const verified = JSON.parse(run([cli, 'session', 'verify', storage, '--reference']));
  if (first.result.state['counter.value'] !== 4 || !retry.replayed || verified.status !== 'PASS' || !verified.referenceReplayVerified) throw new Error('RCL_V2_INSTALLED_SESSION_FLOW_FAILED');
  const compiled = JSON.parse(run([cli, 'session', 'compile', example, path.join(directory, 'session.rbc')]));
  if (compiled.compilerOwner !== 'RCL' || !compiled.targetByteParity) throw new Error('RCL_V2_INSTALLED_RCL_COMPILATION_FAILED');
  const apiSource = `import fs from 'node:fs'; import {createNativeRealitySession,createRealitySession,compileRealitySessionNative} from '@taowind/rcl-reality-forge';
    const source=fs.readFileSync(process.argv[2],'utf8'); const compiled=compileRealitySessionNative(source);
    const native=await createNativeRealitySession(source,{bytecode:compiled.bytecode}), reference=createRealitySession(source);
    try { const command={rule:'increment',inputs:{'event.delta':2}}; const n=await native.invoke(command),r=await reference.invoke(command);
      if(n.afterRoot!==r.afterRoot||n.state['counter.value']!==2)throw Error('API parity failed'); console.log(JSON.stringify({ok:true,native:native.snapshot().native}));
    } finally {await native.close();}`;
  const api = path.join(directory, 'api-smoke.mjs'); fs.writeFileSync(api, apiSource);
  const apiResult = JSON.parse(run([api, example]));
  const releaseVerifier = JSON.parse(run([path.join(packageRoot, 'scripts/verify-v2-release.mjs')]));
  if (releaseVerifier.status !== 'PASS' || !apiResult.ok) throw new Error('RCL_V2_INSTALLED_RELEASE_VERIFIER_FAILED');
  const report = {
    format: 'rcl.v2-independent-installation.v1', status: 'PASS', version: metadata.version, platform: process.platform,
    archiveSha256: hash(fs.readFileSync(archive)), installedOutsideSourceCheckout: true,
    publicVersion: true, doctor: true, distinctCliProcesses: true, nativeReferenceApiParity: true,
    durableRestartRetry: true, nativeRclCompilation: true, sourceBound: apiResult.native.sourceBound,
    releaseVerifier: releaseVerifier.status, nativeDaemonRoot: apiResult.native.daemonRoot,
    installedSessionRoot: verified.stateRoot,
  };
  fs.mkdirSync(path.join(ROOT, 'output/v2.0'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'output/v2.0/independent-installation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('rcl-v2-install-')) throw new Error('RCL_V2_INSTALL_CLEANUP_SCOPE_INVALID');
  fs.rmSync(resolved, { recursive: true, force: true });
}
