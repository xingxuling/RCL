import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {SCIENTIFIC_PROFILES,SCIENTIFIC_DIRECTORY} from './k400-scientific-definitions.mjs';
import {ROOT,edit} from './k400-genomes/shared.mjs';
const batchPath=SCIENTIFIC_DIRECTORY+'/independent-batch.json',batch=JSON.parse(fs.readFileSync(path.join(ROOT,batchPath),'utf8'));
assert.equal(batch.batches.length,3);
for(const definition of SCIENTIFIC_PROFILES){
  const prefix=SCIENTIFIC_DIRECTORY+'/'+definition.id,contract=JSON.parse(fs.readFileSync(path.join(ROOT,prefix+'-contract.json'),'utf8')),source=definition.source();
  const trials=contract.trials.map((trial,index)=>{
    const context=batch.batches[index],proposal=context.returnedProposals.find(item=>item.id===definition.id);
    assert.ok(proposal);const mutation=definition.mutations[index],mutated=edit(source,mutation.good,mutation.bad);edit(mutated,proposal.old,proposal.new);
    return{id:trial.id,context:context.context,proposal};
  });
  const proposals={format:'rcl.k400-independent-scientific-proposals.v1',contractRoot:contract.contractRoot,
    canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
    requestedToolPolicy:batch.requestedToolPolicy,acquisitionBatch:batchPath,trials};
  fs.writeFileSync(path.join(ROOT,prefix+'-proposals.json'),JSON.stringify(proposals,null,2)+'\n');
}
