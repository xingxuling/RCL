import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {GENOMES} from './k400-genomes/index.mjs';
import {ROOT,DIRECTORY,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const frozenDirectory=path.join(ROOT,DIRECTORY),candidates=path.join(ROOT,'output/k400-genome-independent');
fs.mkdirSync(frozenDirectory,{recursive:true});fs.mkdirSync(candidates,{recursive:true});
for(const definition of GENOMES){
  const prefix=DIRECTORY+'/'+definition.id;
  if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('FROZEN_GENOME_ALREADY_EXISTS:'+definition.id);
  const source=definition.source(),sourcePath=prefix+'.rcl';fs.writeFileSync(path.join(ROOT,sourcePath),source);
  const cases=definition.cases.map((inputs,index)=>({index,inputs,sourceHash:sha(variant(source,inputs)),expected:definition.oracle(inputs)}));
  fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const contract={format:'rcl.k400-genome-contract.v1',id:definition.id,scope:definition.scope,frozenBeforeIndependentTrials:true,
    sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),
    definitionFile:definition.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,definition.file))),
    donor:{path:definition.donor,sha256:sha(fs.readFileSync(path.join(ROOT,definition.donor))),decision:'ADAPT'},
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),
    environments:definition.environments,families:definition.families,
    eligibleCells:definition.environments.flatMap(environment=>definition.families.map(family=>campaignCellIdFor(environment,family))),
    baseline:definition.baseline,rounds:20,performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
      requestedToolPolicy:'read only named frozen candidates; no other filesystem, memory, network, tools or writes'},
    authorityProfile:'local source/binary-bound actual execution and exact independent proposals; no new hosted CI',trials:[],contractRoot:null};
  for(const[index,mutation]of definition.mutations.entries()){
    const candidate=edit(source,mutation.good,mutation.bad);fs.writeFileSync(path.join(candidates,definition.id+'-'+index+'.rcl'),candidate);
    contract.trials.push({id:mutation.id,index,intent:mutation.intent,mutatedSourceHash:sha(candidate)});
  }
  contract.contractRoot=evidenceRoot({...contract,contractRoot:undefined});
  fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');
  console.log(JSON.stringify({id:definition.id,eligibleCells:contract.eligibleCells,contractRoot:contract.contractRoot}));
}
