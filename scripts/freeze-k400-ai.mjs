import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AI_PROFILES,AI_DIRECTORY,AI_CONTROL_SOURCE,AI_DONOR_SOURCE} from './k400-ai-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {createPortableAiTarget} from '../src/portable-ai-target.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-ai-independent'),batches=[[],[],[]];
const describe=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}),target=await createPortableAiTarget();const modelRoot=target.binding.modelRoot;await target.dispose();
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,AI_DIRECTORY),{recursive:true});
for(const definition of AI_PROFILES){
  const prefix=AI_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('AI_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const aiDefinitionFile='scripts/k400-ai-definitions.mjs',contract={format:'rcl.k400-ai-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),aiDefinitionFile,aiDefinitionHash:sha(fs.readFileSync(path.join(ROOT,aiDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),compilerBinary:describe('native/rclc.exe'),controllerSource:describe(AI_CONTROL_SOURCE),donorSource:describe(AI_DONOR_SOURCE),modelRoot,
    environments:['ai-runtime'],families:definition.families,baseline:definition.baseline,rounds:20,performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},
    featurePolicy:{maximumScalars:256,minimumNonzeroMagnitude:1e-12,maximumMagnitude:1e24,channels:2,normalization:'clamp [0,1], alternating channel mean'},controlOptions:{positive:[0,1],negative:[0,0],oversizedCount:257},
    eligibleCells:definition.families.map(family=>campaignCellIdFor('ai-runtime',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual RCL-owned training and native program/model forward execution','pinned model and input roots, source-owned advisory-only publication, complete independent controller replay','pause/source/model-replacement/authority-escalation/oversized/nonfinite rejection, failure settlement and real controller reset'],
    authorityProfile:'RCL owns semantics and result publication; native MLP predictions remain advisory, never action authorization; two bounded toy training tasks prove no general AI competence',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){const candidate=edit(source,mutation.good,mutation.bad);batches[index].push({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate});contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});}
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
for(let index=0;index<3;index++)fs.writeFileSync(path.join(inputs,'batch-'+index+'.json'),JSON.stringify(batches[index],null,2)+'\n');
