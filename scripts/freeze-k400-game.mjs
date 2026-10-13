import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {GAME_PROFILES,GAME_DIRECTORY,GAME_CONTROL_SOURCE,FROZEN_GAME_INPUTS} from './k400-game-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-game-independent'),batches=[[],[],[]];
const describe=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))});
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,GAME_DIRECTORY),{recursive:true});
for(const definition of GAME_PROFILES){
  const prefix=GAME_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('GAME_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const gameDefinitionFile='scripts/k400-game-definitions.mjs',contract={format:'rcl.k400-game-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),gameDefinitionFile,gameDefinitionHash:sha(fs.readFileSync(path.join(ROOT,gameDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),compilerBinary:describe('native/rclc.exe'),controllerSource:describe(GAME_CONTROL_SOURCE),
    environments:['game-runtime'],families:definition.families,baseline:definition.baseline,rounds:20,
    performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},frameInputs:FROZEN_GAME_INPUTS,controlOptions:{landingFrames:12},
    eligibleCells:definition.families.map(family=>campaignCellIdFor('game-runtime',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual native program on every fixed game step','RCL-owned scene input/physics/collision and independent whole-controller replay','source authority, paused/foreign/duplicate/invalid-frame rollback, ground landing and actual process reset'],
    authorityProfile:'Native RCL owns program semantics and scene commits; Node transports verified output through an explicit bounded procedural metric and reuses the old scene renderer; no browser or physical timing claim',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);batches[index].push({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate});
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
for(let index=0;index<3;index++)fs.writeFileSync(path.join(inputs,'batch-'+index+'.json'),JSON.stringify(batches[index],null,2)+'\n');
