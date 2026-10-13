import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {reconstructGpuResult} from '../src/portable-gpu-target.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const OWNER='RCL_OPENCL_RBC_STACK_VM',ROOT_OWNER='HOST_HASHES_DEVICE_PRODUCED_VALUES';
export function verifyGpuBinding(binding,contract){
  assert.equal(binding.context,'gpu');assert.equal(binding.os,'OpenCL');assert.equal(binding.arch,'gpu-fp64');assert.equal(binding.deviceType,'GPU');
  assert.equal(binding.runtimeOwner,OWNER);assert.equal(binding.cpuExecutionFallback,false);assert.equal(binding.stateRootOwner,ROOT_OWNER);
  for(const field of ['parallelThroughputClaimed','hostedDeploymentClaimed','securitySandboxClaimed'])assert.equal(binding[field],false);
  assert.equal(binding.compilerBinary.path,contract.compilerBinary.path);assert.equal(binding.compilerBinary.sha256,contract.compilerBinary.sha256);
  assert.equal(binding.compilerArtifact.path,contract.compilerPath);assert.equal(binding.compilerArtifact.sha256,contract.compilerHash);
  assert.deepEqual(binding.kernel,contract.kernel);assert.equal(binding.provider.path,'native/gpu-runtime/provider.py');
  assert.equal(binding.transport.path,'native/tensor-engine/amd_opencl_bf16_provider.py');
  assert.deepEqual(binding.sourceBindings,[binding.provider,binding.kernel,binding.transport]);
  for(const item of [binding.compilerBinary,binding.compilerArtifact,...binding.sourceBindings])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  for(const item of [binding.python,binding.openclLoader])assert.equal(sha(fs.readFileSync(item.binaryPath)),item.sha256);
  assert.match(binding.python.version,/^3\./u);assert.match(binding.device.deviceVendor,/AMD|Advanced Micro Devices/iu);
  assert.match(binding.device.deviceVersion,/OpenCL/u);assert.ok(binding.device.extensions.split(' ').includes('cl_khr_fp64'));
  assert.ok(Number.isInteger(binding.initialProcessPid)&&binding.initialProcessPid>0);assert.match(binding.initialContextToken,/^[0-9a-f-]{36}$/u);
}
export function verifyGpuRow(item,binding,value){
  const compile=item.compileTrace,trace=item.runtimeTrace;assert.ok(compile&&trace);
  assert.equal(compile.compilationOwner,'RCL_COMPILER_RBC_WINDOWS_NATIVE');assert.equal(compile.gpuCompilationClaimed,false);
  assert.equal(compile.compilerHash,binding.compilerBinary.sha256);assert.equal(compile.compilerArtifactHash,binding.compilerArtifact.sha256);
  assert.equal(compile.sourceHash,item.sourceHash);assert.equal(compile.artifactHash,item.artifactHash);
  assert.equal(trace.ok,true);assert.equal(trace.executionOwner,OWNER);assert.equal(trace.cpuExecutionFallback,false);assert.equal(trace.stateRootOwner,ROOT_OWNER);
  assert.equal(trace.processPid,binding.initialProcessPid);assert.equal(trace.contextToken,binding.initialContextToken);assert.deepEqual(trace.device,binding.device);
  assert.equal(trace.kernelHash,binding.kernel.sha256);assert.equal(trace.artifactHash,item.artifactHash);assert.equal(trace.sourceRoot,item.sourceRoot);
  assert.equal(trace.stateRoot,item.stateRoot??value.stateRoot);assert.match(trace.nonce,/^[0-9a-f-]{36}$/u);
  assert.ok(Number.isInteger(trace.instance)&&trace.instance>0);assert.ok(Number.isInteger(trace.executedInstructions)&&trace.executedInstructions>0);
  assert.ok(Number.isFinite(trace.kernelMs)&&trace.kernelMs>=0);assert.equal(trace.openclCalls.clEnqueueNDRangeKernel,1);assert.equal(trace.openclCalls.clFinish,1);
  assert.equal(trace.openclCalls.clEnqueueReadBuffer,value.gpuRecords.length?5:4);
  assert.equal(trace.transactionCount,value.gpuRecords.length);assert.equal(trace.warrantCount,value.gpuWarrants.length);
  assert.equal(trace.transactionSnapshotsRoot,sha(JSON.stringify(value.gpuRecords)));
  const reconstructed=reconstructGpuResult({state:value.state,records:value.gpuRecords,warrants:value.gpuWarrants,sourceRoot:item.sourceRoot});
  for(const key of ['stateRoot','history','projections'])assert.deepEqual(reconstructed[key],value[key]);
  for(const record of value.gpuRecords)assert.ok(Number.isInteger(record.instructionAtCommit)&&record.instructionAtCommit>0&&record.instructionAtCommit<=trace.executedInstructions);
}
export function verifyGpuControl(backend){
  const control=backend.runtimeControl,canonical=backend.rounds[0];assert.equal(control.status,'PASS');assert.equal(control.processResetObserved,true);assert.equal(control.stateResetObserved,true);
  assert.equal(control.processExit.code,0);assert.equal(control.processExit.signal,null);assert.equal(control.processExit.pid,control.processPidBefore);
  assert.equal(control.processPidBefore,backend.binding.initialProcessPid);assert.equal(control.contextTokenBefore,backend.binding.initialContextToken);
  assert.ok(Number.isInteger(control.processPidAfter)&&control.processPidAfter>0);assert.match(control.contextTokenAfter,/^[0-9a-f-]{36}$/u);
  assert.notEqual(control.contextTokenBefore,control.contextTokenAfter);assert.equal(control.nextInstance,control.firstInstance+1);assert.equal(control.resetInstance,1);
  for(const field of ['artifactHash','sourceRoot','stateRoot'])assert.equal(control[field],canonical[field]);
  assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.nonce)).size,20);
  for(let index=1;index<backend.rounds.length;index++)assert.equal(backend.rounds[index].runtimeTrace.instance,backend.rounds[index-1].runtimeTrace.instance+1);
}
