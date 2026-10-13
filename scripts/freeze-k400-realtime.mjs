import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REALTIME_PROFILES,REALTIME_DIRECTORY,REALTIME_CONTROL_SOURCE,REALTIME_SPIN_SOURCE} from './k400-realtime-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-realtime-independent'),batches=[[],[],[]];
const describe=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))});
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,REALTIME_DIRECTORY),{recursive:true});
for(const definition of REALTIME_PROFILES){
  const prefix=REALTIME_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('REALTIME_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const realtimeDefinitionFile='scripts/k400-realtime-definitions.mjs',contract={format:'rcl.k400-realtime-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),realtimeDefinitionFile,realtimeDefinitionHash:sha(fs.readFileSync(path.join(ROOT,realtimeDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),compilerBinary:describe('native/rclc.exe'),
    controllerSource:describe(REALTIME_CONTROL_SOURCE),spinSource:describe(REALTIME_SPIN_SOURCE),
    environments:['realtime-runtime'],families:definition.families,baseline:definition.baseline,rounds:20,
    performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},runtimeOptions:{notBeforeMs:2,deadlineMs:2000},
    controlOptions:{releaseMs:20,expiredDeadlineMs:-1,spinDeadlineMs:150,cancelAfterMs:20,heartbeatIntervalMs:5},
    eligibleCells:definition.families.map(family=>campaignCellIdFor('realtime-runtime',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual monotonic timers and asynchronous native process exit','RCL-owned admission/publication and full independent controller replay',
      'release wait, bounded backpressure, past-deadline/time-reversal/source-authority rejection, native timeout/cancel and healthy recovery'],
    authorityProfile:'RCL conditional warrants own local sampled-deadline publication; Node transports clock observations, stops owned processes and waits for real exit; no hard realtime/OS interruption guarantee',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);batches[index].push({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate});
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
for(let index=0;index<3;index++)fs.writeFileSync(path.join(inputs,'batch-'+index+'.json'),JSON.stringify(batches[index],null,2)+'\n');
