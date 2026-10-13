import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createPortableCompilerTarget} from '../src/portable-compiler-target.mjs';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {COMPILER_PROFILES,COMPILER_DIRECTORY} from '../scripts/k400-compiler-definitions.mjs';
import {verifyFamilyProfile} from '../scripts/k400-compiler-engine.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
const read=id=>JSON.parse(fs.readFileSync(COMPILER_DIRECTORY+'/'+id+'-runtime.json','utf8'));
test('callable compiler pipeline observes separate native compilation and execution, roots and terminal state',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-pipeline-test-')),target=createPortableCompilerTarget(),source='reality PipelineExample { facet result : Number = 3 * 7 }\n',file=path.join(dir,'source.rcl'),out=file+'.rbc';
  try{fs.writeFileSync(file,source);const c=target.compile(file,out);assert.ok(c.bytecode.equals(compileRealityToBytecode(source)));assert.ok(c.compilerCompileTrace.metrics.executedInstructions>0);assert.equal(c.compilerCompileTrace.process.exitObserved,true);
    const e=target.execute(out,compileReality(source).programRoot);assert.equal(e.result.state.result,21);assert.notEqual(c.compilerCompileTrace.process.pid,e.compilerTrace.process.pid);assert.equal(target.binding.referenceCompilationUsed,false);assert.equal(target.binding.referenceExecutionUsed,false);
    assert.throws(()=>target.execute(out,'0'.repeat(64)),/SOURCE_ROOT_MISMATCH/u);target.dispose();assert.throws(()=>target.compile(file,out),/PIPELINE_CLOSED/u);
  }finally{target.dispose();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rcl-pipeline-test-'));fs.rmSync(dir,{recursive:true,force:true});}
});
for(const p of COMPILER_PROFILES)test('native compiler workflow independently admits '+p.id,async()=>{const a=await verifyFamilyProfile(p);assert.equal(a.admitted,true);assert.equal(a.claims.length,1);});
const edits=[
  ['compiler instruction proof',(r,b)=>{b.rounds[0].compileTrace.metrics.executedInstructions=0;}],
  ['process exit',(r,b)=>{b.rounds[0].runtimeTrace.process.exitObserved=false;}],
  ['source parity',(r,b)=>{b.rounds[0].compileTrace.sourceHash='0'.repeat(64);} ],
  ['ledger binding',(r,b)=>{b.compilerLedger=[];}],
  ['wrong-root rejection',(r,b)=>{b.runtimeControl.wrongRootRejected=false;}],
  ['missing gate',(r,b)=>{b.gates.AI_GENERATE='UNTESTED';}],
];
for(const[name,edit]of edits)test('forged '+name+' is rejected even after report rehash',async()=>{const p=COMPILER_PROFILES.find(p=>p.id==='media'),r=read(p.id);edit(r,r.backends['compiler-runtime']);r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyFamilyProfile(p,r));});
test('noncanonical member repair needs every sealed case',async()=>{const p=COMPILER_PROFILES.find(p=>p.id==='replicated-counter'),r=read(p.id);assert.equal(r.backends['compiler-runtime'].trials[1].exactCanonicalRestoration,false);assert.equal(r.backends['compiler-runtime'].trials[1].semanticRepairCases.length,10);r.backends['compiler-runtime'].trials[1].semanticRepairCases.pop();r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyFamilyProfile(p,r));});
test('three-node HTTP evidence cannot be replaced with a successful label',async()=>{const p=COMPILER_PROFILES.find(p=>p.id==='replicated-counter'),r=read(p.id);r.backends['compiler-runtime'].networkControl.pipelineLedgers[0]=[];r.reportRoot=evidenceRoot({...r,generatedAt:undefined,reportRoot:undefined});await assert.rejects(()=>verifyFamilyProfile(p,r));});
