import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
// These are the actual replies of three fresh proposal-only contexts. The same
// replies are replayed in both frozen contracts; this is three contexts, not six.
const raw = [
  '[{"id":"gpu-text-counter-0","file":"candidate.rcl","old":"count - step","new":"count + step"}]',
  '[{"id":"gpu-text-counter-1","file":"candidate.rcl","old":"derived count_label : Text = \\"计数：\\" + step","new":"derived count_label : Text = \\"计数：\\" + count"}]',
  '[{"id":"gpu-text-counter-2","file":"candidate.rcl","old":"on activate { set count <- step }","new":"on activate { set count <- initial }"}]',
];
const flags = {canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false};
for (const [directory,kind] of [['examples/universal-stress/gpu-ui','ai'],['examples/universal-stress/gpu-mobile','mobile']]) {
  const prefix=directory+'/gpu-text-counter',contract=JSON.parse(fs.readFileSync(path.join(ROOT,prefix+'-contract.json'),'utf8'));
  const batches=raw.map((rawResponse,index)=>({index,context:'/root/k400_gpu_ui_fresh_'+['a','b','c'][index],input:'output/gpu-ui-independent/batch-'+index+'.json',rawResponse,returnedProposals:JSON.parse(rawResponse)}));
  const batch={format:'rcl.k400-independent-'+kind+'-batch.v1',...flags,batches};
  const proposals={format:'rcl.k400-independent-'+kind+'-proposals.v1',...flags,contractRoot:contract.contractRoot,acquisitionBatch:directory+'/independent-batch.json',trials:contract.trials.map(t=>({id:t.id,context:batches[t.index].context,proposal:batches[t.index].returnedProposals[0]}))};
  for(const [file,value] of [[directory+'/independent-batch.json',batch],[prefix+'-proposals.json',proposals]]){
    const absolute=path.join(ROOT,file);if(fs.existsSync(absolute))throw new Error('GPU_UI_PROPOSALS_ALREADY_RECORDED');
    fs.writeFileSync(absolute,JSON.stringify(value,null,2)+'\n');
  }
  console.log(JSON.stringify({directory,contexts:batches.map(b=>b.context),contractRoot:contract.contractRoot}));
}
