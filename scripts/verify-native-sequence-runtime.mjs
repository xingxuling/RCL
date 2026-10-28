import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
const directory=path.join(ROOT,'output/native-sequence-runtime'),sha=b=>createHash('sha256').update(b).digest('hex');
const buildPath=path.join(directory,'build.json'),build=JSON.parse(fs.readFileSync(buildPath,'utf8'));
for(const b of [...build.sourceBindings,...build.artifacts])assert.equal(sha(fs.readFileSync(path.join(ROOT,b.path))),b.sha256);
assert.equal(build.status,'BUILT_CANDIDATE');assert.equal(sha(fs.readFileSync(path.join(directory,'rclvm.c'))),build.generatedSourceHash);
const binding=file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});
const frozenVm=path.join(directory,'rclvm-frozen.exe'),candidateVm=path.join(directory,'rclvm.exe'),candidateCompiler=path.join(directory,'rclc.exe');
const ledger=[];
function invoke(binary,args,{timeout=300000}={}){
  const started=performance.now(),r=spawnSync(binary,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:64*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2',RCLC_OUTPUT_STATE:'compiler.output'}}),ended=performance.now();
  if(r.error)throw r.error;
  const trace={index:ledger.length,binary:binding(binary),args,pid:r.pid,status:r.status,signal:r.signal,exitObserved:true,started,ended,ms:ended-started,stdout:r.stdout,stderr:r.stderr};
  trace.stdoutHash=sha(trace.stdout);trace.stderrHash=sha(trace.stderr);ledger.push(trace);return trace;
}
const parity=[];
for(const name of ['aliases','accumulation','transactions']){
  const source=fs.readFileSync(path.join(ROOT,'examples/sequence-runtime/'+name+'.rcl'),'utf8'),artifact=path.join(directory,name+'.rbc');fs.writeFileSync(artifact,compileRealityToBytecode(source));
  const traces=[invoke(frozenVm,[artifact]),invoke(candidateVm,[artifact])];for(const t of traces)assert.equal(t.status,0,t.stderr);
  const result=JSON.parse(traces[0].stdout);assert.deepEqual(JSON.parse(traces[1].stdout),result);
  parity.push({name,sourceHash:sha(source),artifactHash:sha(fs.readFileSync(artifact)),stateRoot:result.stateRoot,traces:traces.map(t=>t.index)});
}
// Keep the source rooted; alter only a zero-argument empty_sequence instruction
// into a valid Number push to exercise the runtime builtin type guard.
const valid=Buffer.from(compileRealityToBytecode('reality BadConcat { facet zero : Number = 0 facet values : Sequence = sequence_concat(empty_sequence(), empty_sequence()) }'));
let offset=36;for(let i=0;i<valid.readUInt32LE(20);i++){const size=valid.readUInt32LE(offset);offset+=4+size;}offset+=valid.readUInt32LE(24)*8;
let emptyCalls=0,changed=false;for(let i=0;i<valid.readUInt32LE(28);i++){const at=offset+i*16;if(valid[at]===30&&valid.readInt32LE(at+4)===12&&++emptyCalls===2){valid[at]=1;valid.writeInt32LE(0,at+4);changed=true;break;}}
assert.ok(changed);const malformed=path.join(directory,'bad-concat.rbc');fs.writeFileSync(malformed,valid);
const negatives=[invoke(frozenVm,[malformed]),invoke(candidateVm,[malformed])];for(const t of negatives){assert.notEqual(t.status,0);assert.match(t.stdout+t.stderr,/RCL_NATIVE_BUILTIN_TYPE/u);}
console.log(JSON.stringify({phase:'semantic-parity',profiles:parity.length,negativeControls:negatives.length}));
// This reproduces the October 14 overlay. Keep its donor and compiler fixed
// while the default runtime and general compiler continue to evolve.
const compilerSource='examples/universal-stress/selfhost-native/general-compiler.rcl';
const source=fs.readFileSync(path.join(ROOT,compilerSource),'utf8'),sourcePath=path.join(directory,'full-compiler.rcl'),c0=compileRealityToBytecode(source);
assert.equal(sha(source),'07d7f219025ccaa848081b21e4c2d02125b64db64c35b4a58d3850a55f58e452');
assert.equal(sha(c0),'b8474f5e2e831d39fdef0cca59c6db95aefef7e3f6b2c6e129895501e9e054ce');
fs.writeFileSync(sourcePath,source);let input=path.join(directory,'generation-0.rbc');fs.writeFileSync(input,c0);
const generations=[];
for(let generation=1;generation<=20;generation++){
  const output=path.join(directory,'generation-'+generation+'.rbc'),t=invoke(candidateCompiler,[input,sourcePath,output]);assert.equal(t.status,0,t.stderr);
  const bytes=fs.readFileSync(output),metrics=JSON.parse(t.stdout);assert.deepEqual(bytes,c0);assert.equal(metrics.executedInstructions,101552310);assert.equal(metrics.instructionBudget,300000000);
  generations.push({generation,artifactHash:sha(bytes),bytes:bytes.length,trace:t.index,ms:t.ms,metrics});input=output;
  if(generation%5===0)console.log(JSON.stringify({phase:'full-compiler-fixed-point',completed:generation,total:20}));
}
const times=generations.map(g=>g.ms).sort((a,b)=>a-b),report={format:'rcl.native-sequence-runtime-evidence.v1',status:'PASS_WINDOWS_CANDIDATE',buildHash:sha(fs.readFileSync(buildPath)),sourceHash:sha(source),compilerArtifactHash:sha(c0),parity,negativeControls:negatives.map(t=>t.index),generations,ledger,performance:{compileP95Ms:times[18],compileMedianMs:(times[9]+times[10])/2},scope:'Generic persistent Sequence concatenation overlay on actual Windows native runtime; three snapshot/transaction parity profiles, type rejection and twenty byte-identical full compiler self-compilation generations. No K400 cell or cross-platform admission.'};
report.reportRoot=sha(JSON.stringify(report));fs.writeFileSync(path.join(directory,'evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,generations:generations.length,performance:report.performance,reportRoot:report.reportRoot}));
