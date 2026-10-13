import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealitySessionBytecode,compileRealityToBytecode} from '../src/bytecode.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {bindScientificSamples} from '../src/portable-scientific-target.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=value=>semanticStateRootForAlgorithm(value,'rcl.semantic-state-root.v2');
const close=(a,b)=>{assert.ok(Number.isFinite(a)&&Number.isFinite(b));assert.ok(Math.abs(a-b)/(1+Math.abs(b))<=1e-9,`${a} != ${b}`);};
export function scientificMeasurementsOracle(state){
  const measured=[];function walk(v){if(typeof v==='number')measured.push(v);else if(typeof v==='boolean')measured.push(Number(v));else if(Array.isArray(v))for(const item of v)walk(item);else if(v&&typeof v==='object')for(const key of Object.keys(v).sort())walk(v[key]);else assert.equal(typeof v,'string');}
  walk(state);assert.ok(measured.length>0&&measured.length<=256);for(const v of measured)assert.ok(Number.isFinite(v)&&Math.abs(v)<=1e24&&(v===0||Math.abs(v)>=1e-12));return measured;
}
export function scientificStatisticsOracle(values){
  const n=values.length,base=values[0],shift=values.map(x=>x-base),average=shift.reduce((a,b)=>a+b,0)/n,xcenter=(n-1)/2;
  let variance=0,cross=0,xx=0;for(let i=0;i<n;i++){variance+=(shift[i]-average)**2;cross+=(i-xcenter)*(shift[i]-average);xx+=(i-xcenter)**2;}
  const slope=n>1?cross/xx:0;return{count:n,mean:base+average,variance:variance/n,minimum:Math.min(...values),maximum:Math.max(...values),slope,intercept:base+(average-slope*xcenter)};
}
function vectorHash(values){const buffer=Buffer.alloc(values.length*8);for(let i=0;i<values.length;i++)buffer.writeDoubleBE(values[i],i*8);return sha(buffer);}
export function verifyScientificBinding(b,contract){
  assert.equal(b.context,'scientific-runtime');assert.equal(b.os,'win32');assert.equal(b.numericalOwner,'RCL');assert.equal(b.oracleOwner,'NUMPY_SCIPY_OBSERVER_ONLY');assert.equal(b.tolerance,1e-9);
  for(const field of ['externalEffectsClaimed','arbitraryHpcClaimed'])assert.equal(b[field],false);
  assert.equal(b.binary.path,'native/rclvm.exe');assert.deepEqual(b.compilerBinary,contract.compilerBinary);assert.equal(b.compilerArtifact.path,contract.compilerPath);assert.equal(b.compilerArtifact.sha256,contract.compilerHash);
  for(const item of [b.binary,b.compilerBinary,b.compilerArtifact,b.kernel])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  assert.deepEqual(b.kernel,contract.kernelSource);const c=b.controller,source=fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8');
  assert.equal(c.sourcePath,contract.controllerSource.path);assert.equal(c.sourceHash,contract.controllerSource.sha256);assert.equal(c.sourceHash,sha(source));assert.equal(c.programRoot,compileReality(source).programRoot);
  assert.equal(c.bytecodeHash,sha(compileRealitySessionBytecode(source)));const compilerSource=['compiler-core.rcl','session-compiler-core.rcl','session-compiler-main.rcl'].map(f=>fs.readFileSync(path.join(ROOT,'selfhost',f),'utf8')).join('\n');
  assert.equal(c.compilerEvidence.compilerOwner,'RCL');assert.equal(c.compilerEvidence.compilerSourceHash,sha(compilerSource));assert.equal(c.compilerEvidence.sourceHash,sha(source));assert.equal(c.compilerEvidence.bytecodeRoot,c.bytecodeHash);
  assert.equal(c.compilerEvidence.targetByteParity,true);assert.equal(c.compilerEvidence.referenceExecutionFallback,false);assert.equal(c.daemonRoot,sha(fs.readFileSync(path.join(ROOT,'native/rclvmd.exe'))));
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'native/native-windows-manifest.json'),'utf8')),hash=createHash('sha256');for(const f of manifest.sources){hash.update(f);hash.update('\0');hash.update(fs.readFileSync(path.join(ROOT,f)));hash.update('\0');}assert.equal(hash.digest('hex'),manifest.sourceSha256);assert.equal(c.daemonSourceRoot,manifest.sourceSha256);
  const o=b.observer;assert.equal(o.kind,'ACTUAL_NUMPY_SCIPY_FLOAT64');assert.equal(o.authorityGranted,false);assert.ok(Number.isInteger(o.processPid)&&o.processPid>0);assert.equal(o.numpyVersion,contract.observerBinding.numpyVersion);assert.equal(o.scipyVersion,contract.observerBinding.scipyVersion);assert.equal(o.python,contract.observerBinding.python);
  assert.deepEqual(o.executable,contract.observerBinding.executable);assert.deepEqual(o.modules,contract.observerBinding.modules);for(const item of [o.executable,...o.modules])assert.equal(sha(fs.readFileSync(item.path)),item.sha256);
  assert.deepEqual(o.worker,contract.oracleSource);assert.equal(o.worker.sha256,sha(fs.readFileSync(path.join(ROOT,o.worker.path))));
}
function process(trace){assert.ok(Number.isInteger(trace.processPid)&&trace.processPid>0);assert.equal(trace.status,0);assert.equal(trace.signal,null);assert.ok(Number.isFinite(trace.started)&&Number.isFinite(trace.ended)&&trace.ended>=trace.started);for(const f of ['stdoutHash','stderrHash'])assert.match(trace[f],/^[0-9a-f]{64}$/u);}
export function verifyScientificAnalysis(analysis,binding,template){
  assert.ok(analysis.samples.length>0&&analysis.samples.length<=256);assert.equal(analysis.vectorHash,vectorHash(analysis.samples));assert.equal(analysis.templateHash,sha(template));
  const source=bindScientificSamples(template,analysis.samples);assert.equal(analysis.sourceHash,sha(source));assert.equal(analysis.sourceRoot,compileReality(source).programRoot);assert.equal(analysis.artifactHash,sha(compileRealityToBytecode(source)));assert.ok(analysis.compileMs>=0);process(analysis.processTrace);
  const value=analysis.result;assert.equal(value.sourceRoot,analysis.sourceRoot);assert.equal(value.stateRootAlgorithm,'rcl.semantic-state-root.v2');assert.equal(value.stateRoot,root(value.state));assert.deepEqual(value.state['samples.values'],analysis.samples);assert.deepEqual(value.history,[]);assert.deepEqual(value.projections,[]);
  const observed=analysis.independent,expected=scientificStatisticsOracle(analysis.samples);assert.equal(observed.status,'OK');assert.match(observed.id,/^[0-9a-f-]{36}$/u);assert.equal(observed.processPid,binding.observer.processPid);assert.equal(observed.vectorHash,analysis.vectorHash);assert.ok(Number.isSafeInteger(observed.elapsedNs)&&observed.elapsedNs>=0);assert.ok(observed.ms>=0);
  assert.deepEqual(Object.keys(observed.result).sort(),Object.keys(expected).sort());for(const key of Object.keys(expected))close(observed.result[key],expected[key]);
  const errors={};for(const[key,v]of Object.entries(observed.result)){const actual=value.state['result.'+key];assert.ok(Number.isFinite(actual));errors[key]=Math.abs(actual-v)/(1+Math.abs(v));}assert.deepEqual(analysis.errors,errors);assert.equal(analysis.maxError,Math.max(...Object.values(errors)));
}
export function verifyScientificRow(row,b,value){
  const c=row.compileTrace,t=row.runtimeTrace;assert.ok(c&&t);assert.equal(c.owner,'RCL_COMPILER_RBC_WINDOWS_NATIVE');assert.equal(c.sourceHash,row.sourceHash);assert.equal(c.artifactHash,row.artifactHash);assert.equal(c.compilerHash,b.compilerBinary.sha256);assert.equal(c.compilerArtifactHash,b.compilerArtifact.sha256);
  assert.equal(t.sourceRoot,row.sourceRoot);assert.equal(t.artifactHash,row.artifactHash);verifyScientificTrace(t,b,value);
}
function verifyScientificTrace(t,b,value){
  process(t.programTrace);assert.match(t.nonce,/^[0-9a-f-]{36}$/u);
  assert.deepEqual(t.analysis.samples,scientificMeasurementsOracle(value.state));verifyScientificAnalysis(t.analysis,b,fs.readFileSync(path.join(ROOT,b.kernel.path),'utf8'));assert.ok(t.analysis.maxError<=1e-9);
  assert.equal(t.entry.status,'realized');assert.equal(t.entry.transition.rule,'prepare');assert.equal(t.completion.status,'realized');assert.equal(t.completion.transition.rule,'publish');assert.equal(t.completion.transition.actor,'researcher');assert.deepEqual(t.completion.transition.authority.needs,[{capability:'experiment.publish',target:'experiment'}]);
  assert.equal(t.snapshot.stateRoot,root(t.snapshot.state));assert.equal(t.snapshot.state['experiment.active'],false);assert.equal(t.snapshot.state['experiment.source_root'],t.sourceRoot);assert.equal(t.snapshot.state['experiment.analysis_root'],t.analysis.result.stateRoot);assert.equal(t.snapshot.state['experiment.error'],t.analysis.maxError);assert.equal(t.ledgerRange.end-t.ledgerRange.start,2);
}
export async function replayScientificLedger(binding,ledger,contract){
  let reference=createRealitySession(fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8')),pid=binding.controller.processId;
  function snapshot(s){assert.equal(s.programRoot,binding.controller.programRoot);assert.deepEqual(s.state,reference.snapshot().state);assert.equal(s.stateRoot,reference.snapshot().stateRoot);assert.equal(s.native.processId,pid);assert.equal(s.native.daemonRoot,binding.controller.daemonRoot);assert.equal(s.native.sourceRoot,binding.controller.daemonSourceRoot);assert.equal(s.native.sourceBound,true);assert.equal(s.native.stateRootsIndependentlyVerified,true);}
  for(const[index,item]of ledger.entries()){assert.equal(item.index,index);snapshot(item.before);if(item.reset){assert.notEqual(item.after.native.processId,pid);assert.ok(item.after.native.processId>0);pid=item.after.native.processId;reference=createRealitySession(fs.readFileSync(path.join(ROOT,contract.controllerSource.path),'utf8'));snapshot(item.after);continue;}
    let expected,failure;try{expected=await reference.invoke(item.command);}catch(e){failure=e;}if(failure){assert.equal(item.error?.code,failure.code);assert.equal(item.result,undefined);}else{assert.equal(item.error,undefined);assert.deepEqual(item.result,expected);}snapshot(item.after);}
}
export function bindScientificTrace(t,value,ledger,binding){
  verifyScientificTrace(t,binding,value);
  const first=ledger[t.ledgerRange.start],last=ledger[t.ledgerRange.end-1];assert.ok(first&&last);assert.deepEqual(t.entry,first.result);assert.deepEqual(t.completion,last.result);assert.deepEqual(t.snapshot,last.after);
  assert.deepEqual(first.command,{rule:'prepare',inputs:{'event.source_root':t.sourceRoot,'event.sample_count':t.analysis.samples.length}});
  assert.deepEqual(last.command,{rule:'publish',inputs:{'event.source_root':t.sourceRoot,'event.analysis_root':t.analysis.result.stateRoot,'event.sample_count':t.analysis.samples.length,'event.error':t.analysis.maxError}});
}
export async function verifyScientificControl(backend,contract,values){
  const b=backend.binding,ledger=backend.controllerLedger,kernel=fs.readFileSync(path.join(ROOT,contract.kernelSource.path),'utf8');await replayScientificLedger(b,ledger,contract);
  const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(t=>t.semanticRepairCases),...backend.trials.filter(t=>t.broken.kind==='success').map(t=>t.broken)];for(const row of rows)bindScientificTrace(row.runtimeTrace,values[row.valueRef],ledger,b);
  const control=backend.runtimeControl,value=values[backend.rounds[0].valueRef],segment=ledger.slice(control.ledgerRange.start,control.ledgerRange.end);assert.equal(control.status,'PASS');assert.equal(segment.length,12);
  for(const key of ['sourceRoot','artifactHash','stateRoot'])assert.equal(control[key],backend.rounds[0][key]);for(const t of [control.firstTrace,control.secondTrace]){assert.equal(t.sourceRoot,control.sourceRoot);assert.equal(t.artifactHash,control.artifactHash);}
  for(const key of ['sourceRejected','oversizedRejected','nonfiniteRejected'])assert.equal(control[key],true);for(const t of [control.firstTrace,control.secondTrace])bindScientificTrace(t,value,ledger,b);
  assert.equal(control.firstTrace.ledgerRange.start,control.ledgerRange.start);assert.equal(control.secondTrace.ledgerRange.end,control.ledgerRange.end);
  assert.deepEqual(segment[2].after,control.paused);assert.equal(segment[2].command.rule,'pause');assert.equal(segment[3].error.code,'RCL_AUTHORITY_DENIED');assert.equal(control.pausedDenied.code,'RCL_AUTHORITY_DENIED');assert.equal(control.paused.stateRoot,control.pausedRollback.stateRoot);assert.deepEqual(segment[3].after,control.pausedRollback);
  assert.deepEqual(segment[4].after,control.beforeWrong);assert.equal(control.beforeWrong.stateRoot,control.sourceRollback.stateRoot);assert.equal(control.empty.status,'not-triggered');assert.deepEqual(segment[5].result,control.empty);assert.equal(control.beforeEmpty.stateRoot,control.afterEmpty.stateRoot);
  assert.deepEqual(control.sampleControl.samples,[1,2,4,8]);verifyScientificAnalysis(control.sampleControl,b,kernel);assert.ok(control.sampleControl.maxError<=1e-9);
  const badKernel=kernel.replace('sequence_get(internal.moments, 1) / result.count','sequence_get(internal.moments, 1) / result.count + 1');verifyScientificAnalysis(control.badAnalysis,b,badKernel);assert.ok(control.badAnalysis.maxError>1e-9);
  const mismatch=control.mismatch;assert.equal(mismatch.code,'RCL_AUTHORITY_DENIED');verifyScientificAnalysis(mismatch.analysis,b,badKernel);assert.ok(mismatch.analysis.maxError>1e-9);assert.deepEqual(mismatch.program.state,value.state);assert.equal(mismatch.program.stateRoot,value.stateRoot);process(mismatch.programTrace);
  assert.deepEqual(segment[6].before,control.beforeBad);assert.deepEqual(mismatch.entry,segment[6].result);assert.equal(segment[7].error.code,'RCL_AUTHORITY_DENIED');assert.equal(segment[7].command.inputs['event.error'],mismatch.analysis.maxError);assert.deepEqual(mismatch.settlement,segment[8].result);assert.deepEqual(mismatch.snapshot,segment[8].after);
  assert.equal(mismatch.snapshot.state['experiment.completed'],control.beforeBad.state['experiment.completed']);assert.equal(mismatch.snapshot.state['experiment.failed'],control.beforeBad.state['experiment.failed']+1);assert.equal(mismatch.snapshot.state['experiment.active'],false);
  assert.equal(segment[9].reset,true);assert.deepEqual(control.reset,{before:segment[9].before,after:segment[9].after});
  for(const key of ['experiment.source_root','experiment.analysis_root','experiment.sample_count','experiment.error','experiment.active','lab.enabled'])assert.deepEqual(control.firstTrace.snapshot.state[key],control.secondTrace.snapshot.state[key]);
  assert.equal(control.secondTrace.snapshot.state['experiment.admitted'],1);assert.equal(control.secondTrace.snapshot.state['experiment.completed'],1);assert.equal(control.secondTrace.snapshot.state['experiment.failed'],0);
  const expectedObservations=[...rows.map(row=>row.runtimeTrace.analysis.independent),control.firstTrace.analysis.independent,control.sampleControl.independent,control.badAnalysis.independent,mismatch.analysis.independent,control.secondTrace.analysis.independent];
  const byId=(a,b)=>a.id.localeCompare(b.id);assert.deepEqual([...backend.observerRecords].sort(byId),expectedObservations.sort(byId));assert.equal(new Set(backend.observerRecords.map(r=>r.id)).size,backend.observerRecords.length);
  assert.equal(backend.observerExit.processPid,b.observer.processPid);assert.equal(backend.observerExit.exitObserved,true);assert.equal(backend.observerExit.code,0);assert.equal(backend.observerExit.signal,null);assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.nonce)).size,20);
}
