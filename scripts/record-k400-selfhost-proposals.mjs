import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_DIRECTORY} from './k400-selfhost-definitions.mjs';
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,SELFHOST_DIRECTORY,'general-compiler-contract.json'),'utf8'));
const returned=[
  {context:'/root/k400_selfhost_independent_a',rawResponse:'[{"id":"general-compiler-0","file":"candidate.rcl","old":"choose(operator == \\\"+\\\", 7,","new":"choose(operator == \\\"+\\\", 6,"}]'},
  {context:'/root/k400_selfhost_independent_b',rawResponse:'[{"id":"general-compiler-1","file":"candidate.rcl","old":"choose(operator == \\\"<=\\\", 12,","new":"choose(operator == \\\"<=\\\", 13,"}]'},
  {context:'/root/k400_selfhost_independent_c',rawResponse:'[{"id":"general-compiler-2","file":"candidate.rcl","old":"choose(operator == \\\">=\\\", 14, 44)","new":"choose(operator == \\\">=\\\", 15, 44)"}]'},
];
// Normalize only JavaScript string escaping. The returned JSON edits are kept
// unchanged, and the original response bytes remain in the batch.
for(const r of returned)r.rawResponse=r.rawResponse.replaceAll('\\\\\\"','\\"');
const flags={canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false};
const batches=returned.map((r,index)=>({...r,index,returnedProposals:JSON.parse(r.rawResponse)}));
const batch={format:'rcl.k400-independent-selfhost-batch.v1',...flags,batches};
fs.writeFileSync(path.join(ROOT,SELFHOST_DIRECTORY,'independent-batch.json'),JSON.stringify(batch,null,2)+'\n');
const proposals={format:'rcl.k400-independent-selfhost-proposals.v1',contractRoot:contract.contractRoot,acquisitionBatch:SELFHOST_DIRECTORY+'/independent-batch.json',...flags,trials:batches.map((b,index)=>({id:contract.trials[index].id,context:b.context,proposal:b.returnedProposals[0]}))};
fs.writeFileSync(path.join(ROOT,SELFHOST_DIRECTORY,'general-compiler-proposals.json'),JSON.stringify(proposals,null,2)+'\n');console.log(JSON.stringify({status:'RECORDED',contexts:batches.length,contractRoot:contract.contractRoot}));
