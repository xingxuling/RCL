import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELFHOST_PROFILE,SELFHOST_DIRECTORY,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
import {ROOT,edit} from './k400-genomes/shared.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {compileReality} from '../src/compiler.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),directory=path.join(ROOT,SELFHOST_DIRECTORY);
const contractPath=path.join(directory,'general-compiler-contract.json');assert.equal(fs.existsSync(contractPath),false,'Never replace a frozen self-host contract');fs.mkdirSync(directory,{recursive:true});
const source=SELFHOST_PROFILE.source(),sourceFile=SELFHOST_DIRECTORY+'/general-compiler.rcl';fs.writeFileSync(path.join(ROOT,sourceFile),source);
const cases=SELFHOST_CASES.map(c=>{const result=compileReality(c.source);return{...c,sourceHash:sha(c.source),sourceRoot:result.programRoot,artifactHash:sha(compileRealityToBytecode(c.source))};});
const casesPath=SELFHOST_DIRECTORY+'/general-compiler-cases.json';fs.writeFileSync(path.join(ROOT,casesPath),JSON.stringify(cases,null,2)+'\n');
const runtimeDirectory='native/sequence-runtime/portable';fs.mkdirSync(path.join(ROOT,runtimeDirectory),{recursive:true});
const win=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/native-sequence-runtime/fresh-build.json'),'utf8'));
const portable=JSON.parse(fs.readFileSync(path.join(ROOT,'output/sequence-portable/build.json'),'utf8'));
const artifacts=[];
for(const[environment,vmInput,compilerInput]of [
  ['windows','output/k4-mc-ad18385d/output/native-sequence-runtime/rclvm.exe','output/k4-mc-ad18385d/output/native-sequence-runtime/rclc.exe'],
  ['linux','output/sequence-portable/linux/rclvm','output/sequence-portable/linux/rclc'],
  ['wasm-vm','output/sequence-portable/wasi/rclvm.wasm','output/sequence-portable/wasi/rclc.wasm'],
]){const folder=runtimeDirectory+'/'+environment;fs.mkdirSync(path.join(ROOT,folder),{recursive:true});const mapped=[];for(const file of [vmInput,compilerInput]){const dest=folder+'/'+path.basename(file),bytes=fs.readFileSync(path.join(ROOT,file));fs.writeFileSync(path.join(ROOT,dest),bytes);mapped.push({path:dest,sha256:sha(bytes),bytes:bytes.length});}artifacts.push({environment,vm:mapped[0],compiler:mapped[1]});}
for(const r of artifacts){const inputs=r.environment==='windows'?win.artifacts:portable.artifacts.find(a=>a.environment===(r.environment==='linux'?'linux':'wasi'));const list=Array.isArray(inputs)?inputs:[inputs.vm,inputs.compiler];assert.equal(r.vm.sha256,list[0].sha256);assert.equal(r.compiler.sha256,list[1].sha256);}
const buildPath=SELFHOST_DIRECTORY+'/runtime-builds.json';fs.writeFileSync(path.join(ROOT,buildPath),JSON.stringify({format:'rcl.selfhost-runtime-builds.v1',windows:win,portable,artifacts},null,2)+'\n');
const instructions='Public RBC binary instruction interface: ADD=6, SUB=7, MUL=8, DIV=9, EQ=10, NE=11, LT=12, LE=13, GT=14, GE=15, MOD=44. These are task requirements; canonical edits and sealed evaluator inputs are withheld.';
const candidateDirectory=path.join(ROOT,'output/k400-selfhost-independent');fs.mkdirSync(candidateDirectory,{recursive:true});
const trials=SELFHOST_PROFILE.mutations.map((m,index)=>{const candidate=edit(source,m.good,m.bad);fs.writeFileSync(path.join(candidateDirectory,'batch-'+index+'.json'),JSON.stringify({id:'general-compiler-'+index,file:'candidate.rcl',intent:m.intent,interface:instructions,candidateSource:candidate},null,2)+'\n');return{index,id:m.id,mutatedSourceHash:sha(candidate),requiredFreshContext:true};});
const contract={format:'rcl.k400-selfhost-contract.v1',id:SELFHOST_PROFILE.id,frozenBeforeIndependentTrials:true,sourcePath:sourceFile,sourceHash:sha(source),sourceRoot:compileReality(source).programRoot,compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),definitionFile:'scripts/k400-selfhost-definitions.mjs',definitionHash:sha(fs.readFileSync(path.join(ROOT,'scripts/k400-selfhost-definitions.mjs'))),casesPath,casesHash:sha(fs.readFileSync(path.join(ROOT,casesPath))),buildPath,buildHash:sha(fs.readFileSync(path.join(ROOT,buildPath))),runtimeArtifacts:artifacts,environments:SELFHOST_PROFILE.environments,family:SELFHOST_PROFILE.family,eligibleCells:SELFHOST_PROFILE.environments.map(e=>campaignCellIdFor(e,'self-hosting')),rounds:20,performanceBudget:{compileP95Ms:50000,executeP95Ms:5000},independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false},trials,scope:SELFHOST_PROFILE.scope};
assert.equal(contract.compilerHash,sha(compileRealityToBytecode(source)));contract.contractRoot=evidenceRoot(contract);fs.writeFileSync(contractPath,JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({status:'FROZEN',contractRoot:contract.contractRoot,eligibleCells:contract.eligibleCells,trials:trials.length}));
