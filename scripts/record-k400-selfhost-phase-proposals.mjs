import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_DIRECTORY as directory,SELFHOST_PROFILE as p} from './k400-selfhost-phase-definitions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Verbatim completed replies from the three fresh proposal-only contexts.
const raw=[
  String.raw`[{"id":"general-compiler-phase-0","file":"candidate.rcl","old":"choose(operator == \"+\", 7,","new":"choose(operator == \"+\", 6,"}]`,
  String.raw`[{"id":"general-compiler-phase-1","file":"candidate.rcl","old":"choose(operator == \"<=\", 12,","new":"choose(operator == \"<=\", 13,"}]`,
  String.raw`[{"id":"general-compiler-phase-2","file":"candidate.rcl","old":"choose(operator == \">=\", 14, 44)","new":"choose(operator == \">=\", 15, 44)"}]`,
];
const prefix=directory+'/'+p.id,contract=JSON.parse(fs.readFileSync(prefix+'-contract.json','utf8'));
const flags={canonicalSourceProvided:false,oracleEditsProvided:false,holdoutTestsProvided:false,osIsolationClaimed:false};
const batches=raw.map((rawResponse,index)=>{const input=directory+'/independent-candidates/'+index+'/input.json',request=JSON.parse(fs.readFileSync(input,'utf8'));assert.equal(request.contractRoot,contract.contractRoot);assert.equal(sha(fs.readFileSync(request.candidatePath)),request.candidateHash);return{index,context:'/root/k400_phase_selfhost_fresh_'+['a','b','c'][index],input,inputHash:sha(fs.readFileSync(input)),candidatePath:request.candidatePath,candidateHash:request.candidateHash,toolPolicy:contract.independentGeneration.requestedToolPolicy,rawResponse,returnedProposals:JSON.parse(rawResponse)};});
const batch={format:'rcl.k400-independent-selfhost-batch.v1',...flags,batches},proposals={format:'rcl.k400-independent-selfhost-proposals.v1',...flags,contractRoot:contract.contractRoot,acquisitionBatch:directory+'/independent-batch.json',trials:p.mutations.map((m,i)=>({id:m.id,context:batches[i].context,proposal:batches[i].returnedProposals[0]}))};
for(const [file,value]of [[directory+'/independent-batch.json',batch],[prefix+'-proposals.json',proposals]]){const absolute=path.join(ROOT,file);assert.ok(!fs.existsSync(absolute));fs.writeFileSync(absolute,JSON.stringify(value,null,2)+'\n');}console.log(JSON.stringify({root:contract.contractRoot,contexts:batches.map(b=>b.context)}));
