import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as family from './k400-family-targets.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
import {createPortableBrowserTarget} from '../src/portable-browser-target.mjs';
import {createPortableGpuTarget} from '../src/portable-gpu-target.mjs';
import {createPortableRncsTarget} from '../src/portable-rncs-target.mjs';
import {verifyBrowserBinding,verifyBrowserRow,verifyBrowserControl} from './k400-browser-traces.mjs';
import {verifyGpuBinding,verifyGpuRow,verifyGpuControl} from './k400-gpu-traces.mjs';
import {verifyRncsBinding,verifyRncsRow,verifyRncsControl} from './k400-rncs-traces.mjs';
import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {verifyCounterNetwork} from './k400-crdt-network-verifier.mjs';
export const PHASE_ENVIRONMENTS=family.PHASE_ENVIRONMENTS;
export const SPECIAL_ENVIRONMENTS=['browser','gpu','rncs-runtime'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function createCrdtTarget(environment){
  if(environment==='browser')return createPortableBrowserTarget();
  if(environment==='gpu')return createPortableGpuTarget();
  if(environment==='rncs-runtime')return createPortableRncsTarget();
  return family.createFamilyTarget(environment);
}
export function compilationTrace(environment,compilation){
  return environment==='browser'?compilation.browserCompileTrace:environment==='gpu'?compilation.gpuCompileTrace:
    environment==='rncs-runtime'?compilation.rncsCompileTrace:family.compilationTrace(environment,compilation);
}
export function executionTrace(target,execution){
  return target.environment==='browser'?execution.browserTrace:target.environment==='gpu'?{...execution.gpuTrace,gpuRecords:execution.result.gpuRecords,gpuWarrants:execution.result.gpuWarrants}:
    target.environment==='rncs-runtime'?execution.rncsTrace:family.executionTrace(target,execution);
}
export function verifyCrdtTrace(environment,trace){
  if(!SPECIAL_ENVIRONMENTS.includes(environment))return family.verifyFamilyTrace(environment,trace);
  assert.ok(trace);
}
export function verifyCrdtRowTrace(environment,item,binding,value){
  if(environment==='browser')return verifyBrowserRow(item,binding);
  if(environment==='gpu')return verifyGpuRow(item,binding,{...value,gpuRecords:item.gpuRecords??item.runtimeTrace.gpuRecords,gpuWarrants:item.gpuWarrants??item.runtimeTrace.gpuWarrants});
  if(environment==='rncs-runtime')return verifyRncsRow(item,binding,value);
  return family.verifyFamilyRowTrace(environment,item,binding);
}
export function verifyCrdtBinding(environment,binding,contract){
  if(environment==='browser')return verifyBrowserBinding(binding,{...contract,...contract.environmentContracts.browser});
  if(environment==='gpu')return verifyGpuBinding(binding,{...contract,...contract.environmentContracts.gpu});
  if(environment==='rncs-runtime')return verifyRncsBinding(binding,{...contract,...contract.environmentContracts['rncs-runtime']});
  return family.verifyFamilyBinding(environment,binding,contract.compilerHash);
}
export async function acquireCrdtControl(target,artifact){
  const environment=target.environment;
  if(environment==='rncs-runtime'){
    const guard=await target.verifyContextGuard(artifact.path,artifact.sourceRoot);return{...await target.verifyReset(artifact.path,artifact.sourceRoot),guard};
  }
  if(['browser','gpu'].includes(environment))return target.verifyReset(artifact.path,artifact.sourceRoot);
  return family.acquireFamilyControl(target,artifact);
}
export async function verifyCrdtBackend(environment,backend){
  if(environment==='browser')return verifyBrowserControl(backend);
  if(environment==='gpu')return verifyGpuControl(backend);
  if(environment==='rncs-runtime')return verifyRncsControl(backend);
  return family.verifyFamilyBackendTrace(environment,backend);
}
export async function acquireCrdtNetwork(environment,source){
  return runReplicatedCounterNetwork({source,factory:()=>createCrdtTarget(environment)});
}
export async function verifyCrdtNetwork(environment,network,contract,source,oracle){
  for(const binding of network.nodeBindings)verifyCrdtBinding(environment,binding,contract);
  return verifyCounterNetwork(environment,network,source,oracle,
    (item,binding,value)=>verifyCrdtRowTrace(environment,item,binding,value));
}
