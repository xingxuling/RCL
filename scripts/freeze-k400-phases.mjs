import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PHASE_PROFILES,PHASE_DIRECTORY,CONTROL_SOURCES} from './k400-phase-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory=path.join(ROOT,PHASE_DIRECTORY),inputs=path.join(ROOT,'output/k400-phase-independent');fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(inputs,{recursive:true});
const controllerSources=Object.entries(CONTROL_SOURCES).map(([environment,file])=>({environment,path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}));
const controllerCompilerSources=['selfhost/compiler-core.rcl','selfhost/session-compiler-core.rcl','selfhost/session-compiler-main.rcl']
  .map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}));
for(const definition of PHASE_PROFILES){
  const prefix=PHASE_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('PHASE_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const contract={format:'rcl.k400-phase-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),
    phaseDefinitionFile:'scripts/k400-phase-definitions.mjs',phaseDefinitionHash:sha(fs.readFileSync(path.join(ROOT,'scripts/k400-phase-definitions.mjs'))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),controllerSources,controllerCompilerSources,
    environments:definition.environments,families:definition.families,baseline:definition.baseline,rounds:20,
    performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},eligibleCells:definition.environments.flatMap(environment=>definition.families.map(family=>campaignCellIdFor(environment,family))),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['native RCL clock forecast/commit and backward-time rejection','native RCL disabled-dispatch rejection and resume'],
    authorityProfile:'local source/binary-bound native RCL controllers and kernels, frozen cases and unchanged independent proposals; no new hosted CI',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);fs.writeFileSync(path.join(inputs,definition.id+'-'+index+'.rcl'),candidate);
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
