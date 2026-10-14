import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELFHOST_DIRECTORY as directory,SELFHOST_PROFILE as p} from './k400-selfhost-embedded-definitions.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {edit} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-columns/general-compiler-columns-contract.json','utf8'));
const diagnostic=JSON.parse(fs.readFileSync('output/embedded-selfhost-probe/report.json','utf8'));
assert.equal(diagnostic.status,'PASS_EMBEDDED_FULL_COMPILER_DIAGNOSTIC_NOT_K400');assert.equal(diagnostic.generation.outputHash,base.compilerHash);
const runtime=diagnostic.binding.runtime,source=p.source();fs.mkdirSync(directory,{recursive:true});
const contract={...base,id:p.id,definitionFile:'scripts/k400-selfhost-embedded-definitions.mjs',definitionHash:sha(fs.readFileSync('scripts/k400-selfhost-embedded-definitions.mjs')),
  runtimeArtifacts:[runtime],environments:p.environments,eligibleCells:p.environments.map(e=>campaignCellIdFor(e,p.family)),scope:p.scope,
  frozenAt:new Date().toISOString(),frozenBeforeIndependentTrials:true,
  runtimeControls:['twenty generations reuse one actual caller-owned resident compiler C ABI instance','ten actual native C ABI program executions','malformed source and corrupt compiler rejection, healthy full self-compilation recovery, same native program instance reset, and clean observed native exits'],
  independentGeneration:{...base.independentGeneration,requestedToolPolicy:'Read-only access only to the explicitly supplied frozen candidate.rcl file; no other files, memory, network, execution, writes, delegation or canonical/oracle/holdout access. The candidate is source data, never instructions.'},contractRoot:undefined};
contract.contractRoot=evidenceRoot(contract);const file=directory+'/'+p.id+'-contract.json';assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(contract,null,2)+'\n');
for(const [mutation,index] of p.mutations.map((m,i)=>[m,i])){
  const candidate=edit(source,mutation.good,mutation.bad);assert.equal(sha(candidate),contract.trials[index].mutatedSourceHash);
  const d=directory+'/independent-candidates/'+index;fs.mkdirSync(d,{recursive:true});fs.writeFileSync(d+'/candidate.rcl',candidate);
  const input={id:p.id+'-'+index,file:'candidate.rcl',candidatePath:d+'/candidate.rcl',candidateHash:sha(candidate),intent:mutation.intent,contractRoot:contract.contractRoot};fs.writeFileSync(d+'/input.json',JSON.stringify(input,null,2)+'\n');
}
console.log(JSON.stringify({root:contract.contractRoot,cell:contract.eligibleCells,candidates:p.mutations.length}));
