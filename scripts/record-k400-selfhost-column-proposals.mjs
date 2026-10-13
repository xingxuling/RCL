import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
const directory='examples/universal-stress/selfhost-columns',contract=JSON.parse(fs.readFileSync(path.join(ROOT,directory,'general-compiler-columns-contract.json'),'utf8'));
const returned=[
  {context:'/root/k400_column_selfhost_a',rawResponse:String.raw`[{"id":"general-compiler-columns-0","file":"candidate.rcl","old":"choose(operator == \"+\", 7,","new":"choose(operator == \"+\", 6,"}]`},
  {context:'/root/k400_column_selfhost_b',rawResponse:String.raw`[{"id":"general-compiler-columns-1","file":"candidate.rcl","old":"choose(operator == \"<=\", 12,","new":"choose(operator == \"<=\", 13,"}]`},
  {context:'/root/k400_column_selfhost_c',rawResponse:String.raw`[
  {
    "id": "general-compiler-columns-2",
    "file": "candidate.rcl",
    "old": "choose(operator == \">=\", 14, 44)",
    "new": "choose(operator == \">=\", 15, 44)"
  }
]`},
];
const flags={canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false},batches=returned.map((r,index)=>({...r,index,returnedProposals:JSON.parse(r.rawResponse)}));
fs.writeFileSync(path.join(ROOT,directory,'independent-batch.json'),JSON.stringify({format:'rcl.k400-independent-selfhost-batch.v1',...flags,batches},null,2)+'\n');
const proposals={format:'rcl.k400-independent-selfhost-proposals.v1',contractRoot:contract.contractRoot,acquisitionBatch:directory+'/independent-batch.json',...flags,trials:batches.map((b,index)=>({id:contract.trials[index].id,context:b.context,proposal:b.returnedProposals[0]}))};
fs.writeFileSync(path.join(ROOT,directory,'general-compiler-columns-proposals.json'),JSON.stringify(proposals,null,2)+'\n');console.log(JSON.stringify({status:'RECORDED',contexts:3,contractRoot:contract.contractRoot}));
