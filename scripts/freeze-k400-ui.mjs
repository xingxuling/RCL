import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {UI_PROFILE,UI_DIRECTORY,UI_EVENTS,uiVariant} from './k400-ui-definitions.mjs';
import {ROOT,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {compileNativeUiForExecution as compileNativeUiProgram} from '../src/ui/native-event-lowering.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),p=UI_PROFILE,prefix=UI_DIRECTORY+'/'+p.id,source=p.source(),input=path.join(ROOT,'output/k400-ui-independent');
if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('UI_CONTRACT_ALREADY_FROZEN');fs.mkdirSync(path.join(ROOT,UI_DIRECTORY),{recursive:true});fs.mkdirSync(input,{recursive:true});
const cases=p.cases.map((values,index)=>{const variant=uiVariant(source,values);return{index,inputs:values,sourceHash:sha(variant),uiRoot:compileNativeUiProgram(variant).semanticRoot};});fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
const contract={format:'rcl.k400-ui-contract.v1',id:p.id,frozenBeforeIndependentTrials:true,sourcePath:p.sourcePath,sourceHash:sha(source),definitionFile:p.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,p.file))),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
  compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),uiRoot:compileNativeUiProgram(source).semanticRoot,environments:p.environments,families:p.families,events:UI_EVENTS,baseline:p.baseline,rounds:20,
  performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},measurementUnit:'native event compile/execute p95 across full four-event UI flows; browser/transport overhead retained separately',
  browserPolicy:{realm:'ACTUAL_CHROMIUM_DOM',desktop:{width:1100,height:800},mobileViewport:{width:414,height:896},minimumActionHeight:44,consoleErrorsAllowed:0},
  runtimeControls:['actual browser clicks and target-owned RCL state/render projection','authenticated HTTP, stale-root and unknown-event rejection, native authority rejection','page reload with preserved committed state, mobile viewport layout and screenshot, exact reference/native event history'],
  eligibleCells:p.environments.flatMap(env=>p.families.map(f=>campaignCellIdFor(env,f))),scope:p.scope,independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,requestedToolPolicy:'read only named frozen candidate; no other filesystem, memory, network, execution, writes or delegation'},trials:[],contractRoot:null};
for(const[index,m]of p.mutations.entries()){const candidate=edit(source,m.good,m.bad),id=p.id+'-'+index;contract.trials.push({index,id:m.id,intent:m.intent,mutatedSourceHash:sha(candidate)});fs.writeFileSync(path.join(input,'batch-'+index+'.json'),JSON.stringify([{id,file:'candidate.rcl',intent:m.intent,candidate}],null,2)+'\n');}
contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({contractRoot:contract.contractRoot,environments:p.environments.length,eligibleCells:contract.eligibleCells.length}));
