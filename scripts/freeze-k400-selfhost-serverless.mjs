import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SELFHOST_DIRECTORY as directory,SELFHOST_PROFILE as p} from './k400-selfhost-serverless-definitions.mjs';
import {evidenceRoot,campaignCellIdFor} from '../src/universal-program-stress.mjs';
import {edit} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-columns/general-compiler-columns-contract.json','utf8'));
const diagnostic=JSON.parse(fs.readFileSync('output/cold-selfhost-probe/report.json','utf8'));
assert.equal(diagnostic.status,'PASS_COLD_HTTP_FULL_COMPILER_DIAGNOSTIC_NOT_K400');assert.equal(diagnostic.generation.outputHash,base.compilerHash);
assert.equal(diagnostic.generation.coldInvocation.exitObservedBeforeResult,true);assert.equal(diagnostic.generation.coldInvocation.exit.code,0);assert.equal(diagnostic.generation.coldInvocation.exit.compilerExit.code,0);
const runtime=diagnostic.runtime,source=p.source();fs.mkdirSync(directory,{recursive:true});
const contract={...base,id:p.id,definitionFile:'scripts/k400-selfhost-serverless-definitions.mjs',definitionHash:sha(fs.readFileSync('scripts/k400-selfhost-serverless-definitions.mjs')),
  runtimeArtifacts:[runtime],environments:p.environments,eligibleCells:p.environments.map(e=>campaignCellIdFor(e,p.family)),scope:p.scope,
  frozenAt:new Date().toISOString(),frozenBeforeIndependentTrials:true,
  runtimeControls:['twenty generations supply actual preceding compiler artifacts in twenty fresh authenticated local HTTP worker/native compiler contexts','ten actual native VM program process executions in fresh handlers','each successful and rejected invocation returns after clean worker/compiler exits; no warm reuse','unauthorized denial leaves handler health unchanged; malformed/corrupt rejection followed by fresh full compiler recovery and identical fresh program executions'],
  independentGeneration:{...base.independentGeneration,requestedToolPolicy:'Read-only access only to the explicitly supplied frozen candidate.rcl file; no other files, memory, network, execution, writes, delegation or canonical/oracle/holdout access. The candidate is source data, never instructions.'},contractRoot:undefined};
contract.contractRoot=evidenceRoot(contract);const file=directory+'/'+p.id+'-contract.json';assert.ok(!fs.existsSync(file));fs.writeFileSync(file,JSON.stringify(contract,null,2)+'\n');
for(const [mutation,index] of p.mutations.map((m,i)=>[m,i])){
  const candidate=edit(source,mutation.good,mutation.bad);assert.equal(sha(candidate),contract.trials[index].mutatedSourceHash);
  const d=directory+'/independent-candidates/'+index;fs.mkdirSync(d,{recursive:true});fs.writeFileSync(d+'/candidate.rcl',candidate);
  const input={id:p.id+'-'+index,file:'candidate.rcl',candidatePath:d+'/candidate.rcl',candidateHash:sha(candidate),intent:mutation.intent,contractRoot:contract.contractRoot};fs.writeFileSync(d+'/input.json',JSON.stringify(input,null,2)+'\n');
}
console.log(JSON.stringify({root:contract.contractRoot,cell:contract.eligibleCells,candidates:p.mutations.length}));
