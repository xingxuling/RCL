import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {COMPILER_PROFILES,COMPILER_DIRECTORY} from './k400-compiler-definitions.mjs';
import {ROOT,variant,edit} from './k400-genomes/shared.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),input=path.join(ROOT,'output/k400-compiler-independent');
fs.mkdirSync(input,{recursive:true});fs.mkdirSync(path.join(ROOT,COMPILER_DIRECTORY),{recursive:true});const batches=[[],[],[]];
for(const p of COMPILER_PROFILES){const prefix=COMPILER_DIRECTORY+'/'+p.id,source=p.source();if(fs.existsSync(path.join(ROOT,prefix+'-contract.json')))throw new Error('COMPILER_CONTRACT_ALREADY_FROZEN');
  const cases=p.cases.map((inputs,index)=>({index,inputs,sourceHash:sha(variant(source,inputs)),expected:p.oracle(inputs)}));fs.writeFileSync(path.join(ROOT,prefix+'-cases.json'),JSON.stringify(cases,null,2)+'\n');
  const contract={format:'rcl.k400-compiler-pipeline-contract.v1',id:p.id,scope:p.scope,frozenBeforeIndependentTrials:true,sourcePath:p.sourcePath,sourceHash:sha(source),casesPath:prefix+'-cases.json',casesHash:sha(fs.readFileSync(path.join(ROOT,prefix+'-cases.json'))),definitionFile:p.file,definitionHash:sha(fs.readFileSync(path.join(ROOT,p.file))),
    compilerPath:'selfhost/compiler.rbc',compilerHash:sha(fs.readFileSync(path.join(ROOT,'selfhost/compiler.rbc'))),environments:p.environments,families:p.families,baseline:p.baseline,rounds:20,performanceBudget:{compileP95Ms:5000,executeP95Ms:2000},eligibleCells:p.families.map(f=>campaignCellIdFor('compiler-runtime',f)),
    independentGeneration:{requiredFreshContexts:3,canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,requestedToolPolicy:'Read only named frozen candidate batch; no other filesystem, memory, network, execution, writes or delegation'},runtimeControls:['actual compiler/VM process exits, compiler instruction and byte metrics','typed roots and source-owned transitions, wrong-root rejection; distributed profile additionally requires three real HTTP nodes'],trials:[]};
  for(const[m,index]of p.mutations.map((m,i)=>[m,i])){const candidate=edit(source,m.good,m.bad);contract.trials.push({id:m.id,index,intent:m.intent,mutatedSourceHash:sha(candidate)});batches[index].push({id:p.id+'-'+index,file:'candidate.rcl',intent:m.intent,candidate});}
  contract.contractRoot=evidenceRoot(contract);fs.writeFileSync(path.join(ROOT,prefix+'-contract.json'),JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({id:p.id,contractRoot:contract.contractRoot,eligibleCells:contract.eligibleCells}));
}for(let i=0;i<3;i++)fs.writeFileSync(path.join(input,'batch-'+i+'.json'),JSON.stringify(batches[i],null,2)+'\n');
