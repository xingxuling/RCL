import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SCIENTIFIC_PROFILES,SCIENTIFIC_DIRECTORY,SCIENTIFIC_CONTROL_SOURCE,SCIENTIFIC_KERNEL_SOURCE,SCIENTIFIC_ORACLE_SOURCE} from './k400-scientific-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),inputs=path.join(ROOT,'output/k400-scientific-independent'),batches=[[],[],[]];
const describe=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))});
const python=process.env.RCL_SCIENTIFIC_PYTHON??'C:/Users/User/AppData/Local/Programs/Python/Python311/python.exe';
const queried=spawnSync(python,['-u',path.join(ROOT,SCIENTIFIC_ORACLE_SOURCE),'--binding'],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
if(queried.status!==0)throw new Error('SCIENTIFIC_OBSERVER_BINDING:'+queried.stderr);const observerBinding=JSON.parse(queried.stdout);observerBinding.worker=describe(SCIENTIFIC_ORACLE_SOURCE);
fs.mkdirSync(inputs,{recursive:true});fs.mkdirSync(path.join(ROOT,SCIENTIFIC_DIRECTORY),{recursive:true});
for(const definition of SCIENTIFIC_PROFILES){
  const prefix=SCIENTIFIC_DIRECTORY+'/'+definition.id;if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('SCIENTIFIC_CONTRACT_ALREADY_FROZEN:'+definition.id);
  const source=definition.source(),cases=definition.cases.map((input,index)=>({index,inputs:input,sourceHash:sha(variant(source,input)),expected:definition.oracle(input)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const scientificDefinitionFile='scripts/k400-scientific-definitions.mjs',contract={format:'rcl.k400-scientific-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath:definition.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),scientificDefinitionFile,scientificDefinitionHash:sha(fs.readFileSync(path.join(ROOT,scientificDefinitionFile))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),compilerBinary:describe('native/rclc.exe'),controllerSource:describe(SCIENTIFIC_CONTROL_SOURCE),
    kernelSource:describe(SCIENTIFIC_KERNEL_SOURCE),oracleSource:describe(SCIENTIFIC_ORACLE_SOURCE),observerBinding,
    environments:['scientific-runtime'],families:definition.families,baseline:definition.baseline,rounds:20,performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},
    numericalPolicy:{tolerance:1e-9,maximumMeasuredScalars:256,minimumNonzeroMagnitude:1e-12,maximumMagnitude:1e24},controlOptions:{sampleVector:[1,2,4,8],oversizedCount:257},
    eligibleCells:definition.families.map(family=>campaignCellIdFor('scientific-runtime',family)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    runtimeControls:['actual native program and native numerical kernel with independent NumPy/SciPy observation','source-owned numeric-error publication and entire independent controller replay','pause/source/empty/oversized/nonfinite rejection, actual numeric mutant failure settlement, real controller reset and observer exit'],
    authorityProfile:'RCL owns numeric kernels and publication; NumPy/SciPy only supplies independent observations; Node binds exact binary64 measurements and transports evidence',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);batches[index].push({id:definition.id,file:'candidate.rcl',intent:mutation.intent,candidate});contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
for(let index=0;index<3;index++)fs.writeFileSync(path.join(inputs,'batch-'+index+'.json'),JSON.stringify(batches[index],null,2)+'\n');
