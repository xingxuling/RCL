import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {GPU_PROFILES,GPU_DIRECTORY} from './k400-gpu-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-gpu-independent');
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,GPU_DIRECTORY),{recursive:true});
const batches=[[],[],[]];
for(const definition of GPU_PROFILES){
  const prefix=GPU_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('GPU_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const gpuDefinitionFile='scripts/k400-gpu-definitions.mjs';
  const contract={format:'rcl.k400-gpu-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),gpuDefinitionFile,gpuDefinitionHash:sha(fs.readFileSync(path.join(ROOT,gpuDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),
    compilerBinary:{path:'native/rclc.exe',sha256:sha(fs.readFileSync(path.join(ROOT,'native/rclc.exe')))},
    kernel:{path:'native/gpu-runtime/rcl-stack-vm.cl',sha256:sha(fs.readFileSync(path.join(ROOT,'native/gpu-runtime/rcl-stack-vm.cl')))},
    environments:['gpu'],families:definition.families,baseline:definition.baseline,rounds:20,
    performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},eligibleCells:definition.families.map(family=>campaignCellIdFor('gpu',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual GPU instruction/authority/transaction execution','process restart and fresh device buffers','host hashes typed device-produced snapshots and transaction continuity'],
    authorityProfile:'actual AMD FP64 OpenCL GPU executes generic RBC; host compilation and snapshot hashing explicitly owned by host; no CPU VM fallback or parallel-throughput claim',
    trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);const file=path.join(inputs,definition.id+'-'+index+'.rcl');fs.writeFileSync(file,candidate);
    batches[index].push({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate});
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
for(let index=0;index<3;index++)fs.writeFileSync(path.join(inputs,'batch-'+index+'.json'),JSON.stringify(batches[index],null,2)+'\n');
