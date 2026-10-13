import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {BROWSER_PROFILES,BROWSER_DIRECTORY} from './k400-browser-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-browser-independent');
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,BROWSER_DIRECTORY),{recursive:true});
for(const definition of BROWSER_PROFILES){
  const prefix=BROWSER_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('BROWSER_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const browserDefinitionFile='scripts/k400-browser-definitions.mjs';
  const contract={format:'rcl.k400-browser-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),browserDefinitionFile,browserDefinitionHash:sha(fs.readFileSync(path.join(ROOT,browserDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),
    compilerBinary:{path:'native/wasi-compiler/rclc.wasm',sha256:sha(fs.readFileSync(path.join(ROOT,'native/wasi-compiler/rclc.wasm')))},
    environments:['browser'],families:definition.families,baseline:definition.baseline,rounds:20,
    performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},eligibleCells:definition.families.map(family=>campaignCellIdFor('browser',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual browser compilation and VM execution','page reload and fresh WASI instances','typed roots and source-declared transaction continuity'],
    authorityProfile:'actual local Chromium WebAssembly compilation/execution; no Node-WASI fallback, hosted deployment or whole-family claim',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);fs.writeFileSync(path.join(inputs,definition.id+'-'+index+'.rcl'),candidate);
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
