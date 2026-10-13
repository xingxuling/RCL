import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyBrowserBinding(binding,contract){
  assert.equal(binding.context,'browser');assert.equal(binding.os,'Browser');assert.equal(binding.arch,'wasm32');assert.equal(binding.executionRealm,'browser-window');
  assert.equal(binding.runtimeOwner,'RCL_C_VM_BROWSER_WEBASSEMBLY');assert.equal(binding.nodeWasiExecutionUsed,false);assert.equal(binding.hostedDeploymentClaimed,false);assert.equal(binding.securitySandboxClaimed,false);
  assert.equal(binding.binary.path,'native/wasi/rclvm.wasm');assert.equal(binding.compilerBinary.path,contract.compilerBinary.path);assert.equal(binding.compilerBinary.sha256,contract.compilerBinary.sha256);
  assert.equal(binding.compilerArtifact.path,contract.compilerPath);assert.equal(binding.compilerArtifact.sha256,contract.compilerHash);
  for(const item of [binding.binary,binding.compilerBinary,binding.compilerArtifact,binding.shim])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  for(const item of [binding.browser,binding.driver])assert.equal(sha(fs.readFileSync(item.binaryPath)),item.sha256);
  assert.ok(Number.isInteger(binding.browser.pid)&&binding.browser.pid>0);assert.match(binding.browser.version,/^[0-9]+\./u);assert.match(binding.browser.userAgent,/HeadlessChrome\//u);
  assert.equal(binding.shim.path,'src/vendor/browser-wasi-shim/PROVENANCE.json');
  const provenance=JSON.parse(fs.readFileSync(path.join(ROOT,binding.shim.path),'utf8'));assert.equal(provenance.upstreamSourceUnmodified,true);
  for(const file of provenance.files)assert.equal(sha(fs.readFileSync(path.join(ROOT,'src/vendor/browser-wasi-shim',file.path))),file.sha256);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/wasi-compiler/build-manifest.json'),'utf8'));
  assert.equal(manifest.binary.sha256,binding.compilerBinary.sha256);for(const file of manifest.sources)assert.equal(sha(fs.readFileSync(path.join(ROOT,file.path))),file.sha256);
}
function common(trace,binding){
  assert.equal(trace.exitCode,0);assert.equal(trace.browserPid,binding.browser.pid);assert.equal(trace.userAgent,binding.browser.userAgent);
  assert.match(trace.nonce,/^[0-9a-f-]{36}$/u);assert.match(trace.pageToken,/^[0-9a-f-]{36}$/u);assert.ok(Number.isInteger(trace.instance)&&trace.instance>0);
  assert.ok(Number.isFinite(trace.executionMs)&&trace.executionMs>=0);
  for(const name of ['args_get','fd_read','fd_write','path_open'])assert.ok(Number.isInteger(trace.wasiCalls[name])&&trace.wasiCalls[name]>0);
}
export function verifyBrowserRow(item,binding){
  const compile=item.compileTrace,execute=item.runtimeTrace;assert.ok(compile&&execute);common(compile,binding);common(execute,binding);
  assert.equal(compile.executionOwner,'RCL_COMPILER_RBC_BROWSER_WEBASSEMBLY');assert.equal(compile.compilerHash,binding.compilerBinary.sha256);
  assert.equal(compile.compilerArtifactHash,binding.compilerArtifact.sha256);assert.equal(compile.sourceHash,item.sourceHash);assert.equal(compile.artifactHash,item.artifactHash);
  assert.equal(compile.compilerMetrics.status,'ok');assert.ok(compile.compilerMetrics.executedInstructions>0);assert.ok(compile.compilerMetrics.bytes>0);
  assert.equal(compile.wasiCalls.path_rename,1);assert.equal(compile.pageToken,execute.pageToken);assert.equal(execute.instance,compile.instance+1);
  assert.notEqual(compile.nonce,execute.nonce);assert.equal(execute.executionOwner,'RCL_C_VM_BROWSER_WEBASSEMBLY');assert.equal(execute.wasmHash,binding.binary.sha256);
  assert.equal(execute.artifactHash,item.artifactHash);assert.equal(execute.sourceRoot,item.sourceRoot);
}
export function verifyBrowserControl(backend){
  const control=backend.runtimeControl,canonical=backend.rounds[0];assert.equal(control.status,'PASS');assert.equal(control.pageResetObserved,true);
  assert.equal(control.browserPid,backend.binding.browser.pid);assert.match(control.pageTokenBefore,/^[0-9a-f-]{36}$/u);assert.match(control.pageTokenAfter,/^[0-9a-f-]{36}$/u);
  assert.notEqual(control.pageTokenBefore,control.pageTokenAfter);assert.equal(control.nextInstance,control.firstInstance+1);assert.equal(control.resetInstance,1);
  for(const field of ['artifactHash','sourceRoot','stateRoot'])assert.equal(control[field],canonical[field]);
  assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.pageToken)).size,1);
  for(let index=1;index<backend.rounds.length;index++)assert.equal(backend.rounds[index].compileTrace.instance,backend.rounds[index-1].runtimeTrace.instance+1);
}
