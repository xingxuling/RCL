// ADAPT of scripts/k400-selfhost-http-admission.mjs at SHA256 c2e410049d0af660f3d9fba5ede906a709c8f5ecf329a8f9870d59668fedc1b1; actual two-peer native compilation/execution and fail-closed recovery.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT} from './k400-genomes/shared.mjs';
import {validateSelfhostInputs,verifySelfhostEnvironment} from './k400-selfhost-replica-engine.mjs';
import {evidenceRoot,UNIVERSAL_STRESS_GATES} from '../src/universal-program-stress.mjs';
import {verifyReplicaTransport} from './k400-selfhost-replica-transport.mjs';
const prefix='examples/universal-stress/selfhost-replica/general-compiler-replica',indexPath=prefix+'-runtime.json',sha=b=>createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const policyFiles=['scripts/k400-selfhost-replica-admission.mjs','scripts/k400-selfhost-replica-engine.mjs','scripts/k400-selfhost-replica-target.mjs','scripts/k400-selfhost-replica-transport.mjs','scripts/k400-selfhost-replica-definitions.mjs','scripts/k400-selfhost-mutant-oracle.mjs'];
const bindings=()=>policyFiles.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
function verifyRuntimeCommands(report,contract){verifyReplicaTransport(report,contract);}
function verifyIndependentCandidates(inputs){
  const {contract,batch}=inputs;
  for(const [index,item] of batch.batches.entries()){
    const directory='examples/universal-stress/selfhost-replica/independent-candidates/'+index;
    assert.equal(item.input,directory+'/input.json');assert.equal(item.candidatePath,directory+'/candidate.rcl');assert.equal(item.inputHash,sha(fs.readFileSync(path.join(ROOT,item.input))));assert.equal(item.candidateHash,sha(fs.readFileSync(path.join(ROOT,item.candidatePath))));assert.equal(item.candidateHash,contract.trials[index].mutatedSourceHash);assert.equal(item.toolPolicy,contract.independentGeneration.requestedToolPolicy);
    const request=read(item.input);assert.equal(request.contractRoot,contract.contractRoot);assert.equal(request.candidateHash,item.candidateHash);assert.equal(request.candidatePath,item.candidatePath);assert.equal(request.id,contract.id+'-'+index);assert.equal(request.file,'candidate.rcl');
  }
}
export async function verifySelfhostProfile(supplied){
  const inputs=validateSelfhostInputs(),{contract}=inputs;verifyIndependentCandidates(inputs);if(!supplied&&!fs.existsSync(path.join(ROOT,indexPath)))return{admitted:false,claims:[]};const index=supplied??read(indexPath);
  assert.equal(index.format,'rcl.k400-selfhost-index.v1');assert.equal(index.contractRoot,contract.contractRoot);assert.equal(index.reportRoot,evidenceRoot({...index,reportRoot:undefined}));assert.deepEqual(index.admissionBindings,bindings());assert.deepEqual(index.eligibleCells,contract.eligibleCells);assert.deepEqual(index.receipts.map(r=>r.environment),contract.environments);
  for(const r of index.receipts){assert.equal(r.path,prefix+'-'+r.environment+'-runtime.json');assert.equal(r.sha256,sha(fs.readFileSync(path.join(ROOT,r.path))));const report=read(r.path);assert.equal(r.reportRoot,report.reportRoot);await verifySelfhostEnvironment(report,inputs);verifyRuntimeCommands(report,contract);}
  const refs=[indexPath,prefix+'-contract.json',contract.sourcePath,contract.compilerPath,contract.casesPath,contract.buildPath,prefix+'-proposals.json',inputs.proposals.acquisitionBatch,...index.receipts.map(r=>r.path),...policyFiles];
  return{admitted:true,reportRoot:index.reportRoot,eligibleCells:contract.eligibleCells,claims:contract.environments.map(environment=>({id:environment+'::self-hosting',environment,programFamily:'self-hosting',coverageMode:'native-semantic',lastVerifiedDate:'2026-10-14',changes:[],knownLimits:[contract.scope],requiredGenes:['rcl-general-compiler','generic-persistent-sequence','utf16-source-column-identity','actual-c0-c20-self-compilation','sealed-program-byte-and-state-oracles','fresh-independent-compiler-repair'],gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(g=>[g,{status:'PASS',evidence:refs,note:'Actual complete native-core RCL compiler self-compilation in the selected environment, twenty fixed-point generations, ten rooted sealed programs, exact native byte/state parity and three effective unchanged fresh repairs; real malformed/corrupt rejection and measured budgets.'}]))}))};
}
export async function buildSelfhostIndex(){
  const inputs=validateSelfhostInputs(),{contract}=inputs;assert.ok(contract.environments.every(e=>fs.existsSync(path.join(ROOT,prefix+'-'+e+'-runtime.json'))),'Every frozen environment must finish before admission');
  const receipts=[];for(const environment of contract.environments){const file=prefix+'-'+environment+'-runtime.json',report=read(file);await verifySelfhostEnvironment(report,inputs);receipts.push({environment,path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file))),reportRoot:report.reportRoot});}
  const index={format:'rcl.k400-selfhost-index.v1',contractRoot:contract.contractRoot,eligibleCells:contract.eligibleCells,receipts,admissionBindings:bindings()};index.reportRoot=evidenceRoot(index);const result=await verifySelfhostProfile(index);fs.writeFileSync(path.join(ROOT,indexPath),JSON.stringify(index,null,2)+'\n');return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const result=process.argv[2]==='build'?await buildSelfhostIndex():await verifySelfhostProfile();console.log(JSON.stringify({admitted:result.admitted,reportRoot:result.reportRoot,cells:result.claims.length}));}
