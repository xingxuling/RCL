import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELFHOST_DIRECTORY as directory,SELFHOST_PROFILE as p} from './k400-selfhost-phase-definitions.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {edit} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),base=JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-columns/general-compiler-columns-contract.json','utf8'));
const diagnostics=p.environments.map(e=>JSON.parse(fs.readFileSync('output/phase-selfhost-probe/'+e+'.json','utf8')));
for(const [i,d]of diagnostics.entries()){assert.equal(d.status,'PASS_PHASE_FULL_COMPILER_DIAGNOSTIC_NOT_K400');assert.equal(d.binding.environment,p.environments[i]);assert.equal(d.generation.outputHash,base.compilerHash);assert.equal(d.generation.phaseTrace.completion.status,'realized');assert.deepEqual(d.ended.graph.exits.map(e=>e.code),[0,0]);assert.equal(d.ended.controller.terminationObserved,true);}
const source=p.source();fs.mkdirSync(directory,{recursive:true});
const controllerArtifacts=diagnostics.map(d=>({environment:d.binding.environment,sourcePath:d.binding.controller.sourcePath,sourceHash:d.binding.controller.sourceHash,bytecodeHash:d.binding.controller.bytecodeHash,programRoot:d.binding.controller.programRoot,daemonRoot:d.binding.controller.daemonRoot,daemonSourceRoot:d.binding.controller.daemonSourceRoot}));
const contract={...base,id:p.id,definitionFile:'scripts/k400-selfhost-phase-definitions.mjs',definitionHash:sha(fs.readFileSync('scripts/k400-selfhost-phase-definitions.mjs')),
  runtimeArtifacts:diagnostics.map(d=>d.runtime),controllerArtifacts,environments:p.environments,eligibleCells:p.environments.map(e=>campaignCellIdFor(e,p.family)),scope:p.scope,
  frozenAt:new Date().toISOString(),frozenBeforeIndependentTrials:true,
  runtimeControls:['twenty supplied complete compiler generations admitted by each native RCL controller','ten sealed programs and three broken/repaired compiler probes in each actual controlled environment','native automation failure settlement and no simulation clock commit on native failure','pause denies compile and execute before native call and denied compilation publishes no output','time reversal rejection, bounded backpressure, healthy compiler/program recovery and observed shutdown'],
  independentGeneration:{...base.independentGeneration,requestedToolPolicy:'Read-only access only to the explicitly supplied frozen candidate.rcl file; no other files, memory, network, execution, writes, delegation or canonical/oracle/holdout access. The candidate is source data, never instructions.'},contractRoot:undefined};
contract.contractRoot=evidenceRoot(contract);const file=directory+'/'+p.id+'-contract.json';assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(contract,null,2)+'\n');
for(const [mutation,index]of p.mutations.map((m,i)=>[m,i])){const candidate=edit(source,mutation.good,mutation.bad);assert.equal(sha(candidate),contract.trials[index].mutatedSourceHash);const d=directory+'/independent-candidates/'+index;fs.mkdirSync(d,{recursive:true});fs.writeFileSync(d+'/candidate.rcl',candidate);fs.writeFileSync(d+'/input.json',JSON.stringify({id:p.id+'-'+index,file:'candidate.rcl',candidatePath:d+'/candidate.rcl',candidateHash:sha(candidate),intent:mutation.intent,contractRoot:contract.contractRoot},null,2)+'\n');}
console.log(JSON.stringify({root:contract.contractRoot,cells:contract.eligibleCells,candidates:p.mutations.length}));
