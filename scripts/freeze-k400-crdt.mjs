import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {CRDT_PROFILE as definition,CRDT_DIRECTORY} from './k400-crdt-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),prefix=CRDT_DIRECTORY+'/'+definition.id,
  inputs=path.join(ROOT,'output/k400-crdt-independent'),describe=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))});
if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('CRDT_CONTRACT_ALREADY_FROZEN');
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,CRDT_DIRECTORY),{recursive:true});
const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
const contract={format:'rcl.k400-crdt-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
  sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
  definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),
  compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),
  environmentContracts:{browser:{compilerBinary:describe('native/wasi-compiler/rclc.wasm')},
    gpu:{compilerBinary:describe('native/rclc.exe'),kernel:describe('native/gpu-runtime/rcl-stack-vm.cl')},
    'rncs-runtime':{compilerBinary:describe('native/rclc.exe'),vendorProvenance:describe('src/vendor/rncs-reality-branch/PROVENANCE.json')}},
  environments:definition.environments,families:definition.families,baseline:definition.baseline,rounds:20,
  performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},eligibleCells:definition.environments.map(environment=>campaignCellIdFor(environment,'distributed')),
  independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
    requestedToolPolicy:'read only named frozen candidate; no other filesystem, memory, network, tools or writes'},
  runtimeControls:['on-target native/bytecode execution with context-specific controls','typed roots and source-declared transaction continuity',
    'three real HTTP nodes per target environment; actual RCL packet merge, partition/heal, stale/duplicate delivery, membership/source-authority/transport rejection'],
  networkPlan:{nodes:3,packetStatuses:[200,200,503,200,200,200,200,200,200,400,400,403],partitionWidth:2,
    authority:'RCL source owns packet membership, monotone merge and conditional warrant; HTTP host owns transport and fault injection',
    multiHostClaimed:false,cryptographicMemberIdentityClaimed:false},trials:[],contractRoot:null};
for(const[index,mutation]of definition.mutations.entries()){
  const candidate=edit(source,mutation.good,mutation.bad);fs.writeFileSync(path.join(inputs,'candidate-'+index+'.rcl'),candidate);
  fs.writeFileSync(path.join(inputs,'task-'+index+'.json'),JSON.stringify({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate},null,2)+'\n');
  contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
}
contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
