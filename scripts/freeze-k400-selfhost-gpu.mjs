import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELFHOST_DIRECTORY as directory,SELFHOST_PROFILE as p} from './k400-selfhost-gpu-definitions.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {compileReality} from '../src/compiler.mjs';
import {edit} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const base=read('examples/universal-stress/selfhost-columns/general-compiler-columns-contract.json'),d=read('output/gpu-indexed-compiler/gpu-diagnostic.json');
assert.equal(d.status,'PASS_ONE_INDEXED_FULL_COMPILER_DIAGNOSTIC_NOT_K400');assert.ok(d.ms<=50000);
const source=p.source(),sourcePath='selfhost/variants/indexed-core/compiler.rcl',compilerPath='selfhost/variants/indexed-core/compiler.rbc',buildPath='native/gpu-compiler-runtime/build.json';
assert.equal(sha(source),d.sourceHash);assert.equal(sha(fs.readFileSync(compilerPath)),d.compilerHash);
for(const item of d.binding.sourceBindings)assert.equal(sha(fs.readFileSync(item.path)),item.sha256);
const contract={...base,id:p.id,sourcePath,sourceHash:sha(source),sourceRoot:compileReality(source).programRoot,compilerPath,compilerHash:d.compilerHash,
  compilerBuild:{path:'selfhost/variants/indexed-core/build.json',sha256:sha(fs.readFileSync('selfhost/variants/indexed-core/build.json'))},
  definitionFile:'scripts/k400-selfhost-gpu-definitions.mjs',definitionHash:sha(fs.readFileSync('scripts/k400-selfhost-gpu-definitions.mjs')),
  buildPath,buildHash:sha(fs.readFileSync(buildPath)),runtimeArtifacts:[],runtimeSourceBindings:d.binding.sourceBindings,
  device:d.binding.device,python:d.binding.python,openclLoader:d.binding.openclLoader,kernelHash:d.binding.kernelHash,
  environments:p.environments,eligibleCells:p.environments.map(e=>campaignCellIdFor(e,p.family)),scope:p.scope,
  expectedFixedpointInstructions:d.trace.executedInstructions,instructionBudget:300000000,
  controlOptions:{fullCompilerTimeoutMs:2000,cancelAfterMs:1500,cancellationClock:'FRESH_GPU_CONTEXT_READY'},frozenAt:new Date().toISOString(),frozenBeforeIndependentTrials:true,
  trials:p.mutations.map((m,index)=>({index,id:m.id,mutatedSourceHash:sha(edit(source,m.good,m.bad)),requiredFreshContext:true})),
  independentGeneration:{...base.independentGeneration,requestedToolPolicy:'Read-only access only to the explicitly supplied frozen candidate.rcl file; no other files, memory, network, execution, writes, delegation or canonical/oracle/holdout access. The candidate is source data, never instructions.'},contractRoot:undefined};
contract.contractRoot=evidenceRoot(contract);fs.mkdirSync(directory,{recursive:true});const file=directory+'/'+p.id+'-contract.json';assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(contract,null,2)+'\n');
for(const [index,m]of p.mutations.entries()){const folder=directory+'/independent-candidates/'+index;fs.mkdirSync(folder,{recursive:true});const candidate=edit(source,m.good,m.bad);fs.writeFileSync(folder+'/candidate.rcl',candidate);fs.writeFileSync(folder+'/input.json',JSON.stringify({id:p.id+'-'+index,file:'candidate.rcl',candidatePath:folder+'/candidate.rcl',candidateHash:sha(candidate),intent:m.intent,contractRoot:contract.contractRoot},null,2)+'\n');}
console.log(JSON.stringify({root:contract.contractRoot,cells:contract.eligibleCells,candidates:p.mutations.length}));
