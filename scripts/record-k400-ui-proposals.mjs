import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {UI_DIRECTORY} from './k400-ui-definitions.mjs';
const prefix=UI_DIRECTORY+'/governed-counter',contract=JSON.parse(fs.readFileSync(path.join(ROOT,prefix+'-contract.json'),'utf8'));
const raw=[
  '[{"id":"governed-counter-0","file":"candidate.rcl","old":"count - step","new":"count + step"}]',
  '[{"id":"governed-counter-1","file":"candidate.rcl","old":"\\\"计数：\\\" + step","new":"\\\"计数：\\\" + count"}]',
  '[{"id":"governed-counter-2","file":"candidate.rcl","old":"set count <- step","new":"set count <- initial"}]',
];
const flags={canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false};
const batches=raw.map((rawResponse,index)=>({index,context:'/root/k400_ui_independent_'+['a','b','c'][index],input:'output/k400-ui-independent/batch-'+index+'.json',rawResponse,returnedProposals:JSON.parse(rawResponse)}));
const batch={format:'rcl.k400-independent-ai-batch.v1',...flags,batches};
const proposals={format:'rcl.k400-independent-ai-proposals.v1',...flags,contractRoot:contract.contractRoot,acquisitionBatch:UI_DIRECTORY+'/independent-batch.json',trials:contract.trials.map(t=>({id:t.id,context:batches[t.index].context,proposal:batches[t.index].returnedProposals[0]}))};
for(const[file,value]of [[UI_DIRECTORY+'/independent-batch.json',batch],[prefix+'-proposals.json',proposals]]){const absolute=path.join(ROOT,file);if(fs.existsSync(absolute))throw new Error('UI_PROPOSALS_ALREADY_RECORDED');fs.writeFileSync(absolute,JSON.stringify(value,null,2)+'\n');}
console.log(JSON.stringify({contexts:batches.map(b=>b.context),contractRoot:contract.contractRoot}));
