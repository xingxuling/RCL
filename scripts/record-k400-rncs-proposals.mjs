import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {RNCS_PROFILES,RNCS_DIRECTORY} from './k400-rncs-definitions.mjs';
import {ROOT,edit} from './k400-genomes/shared.mjs';
const batchPath=RNCS_DIRECTORY+'/independent-batch.json',batch=JSON.parse(fs.readFileSync(path.join(ROOT,batchPath),'utf8'));
assert.equal(batch.batches.length,3);
for(const definition of RNCS_PROFILES){
  const prefix=RNCS_DIRECTORY+'/'+definition.id,contract=JSON.parse(fs.readFileSync(path.join(ROOT,prefix+'-contract.json'),'utf8')),source=definition.source();
  const trials=contract.trials.map((trial,index)=>{
    const context=batch.batches[index],proposal=context.returnedProposals.find(item=>item.id===definition.id);
    assert.ok(proposal);const mutation=definition.mutations[index],mutated=edit(source,mutation.good,mutation.bad);edit(mutated,proposal.old,proposal.new);
    return{id:trial.id,context:context.context,proposal};
  });
  const proposals={format:'rcl.k400-independent-rncs-proposals.v1',contractRoot:contract.contractRoot,
    canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false,
    requestedToolPolicy:batch.requestedToolPolicy,acquisitionBatch:batchPath,trials};
  fs.writeFileSync(path.join(ROOT,prefix+'-proposals.json'),JSON.stringify(proposals,null,2)+'\n');
}
