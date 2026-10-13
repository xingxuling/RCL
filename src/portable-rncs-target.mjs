import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {canonicalF64Hex,f64FromCanonicalHex} from './canonical-f64.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {createPhaseContextTarget} from './phase-context-targets.mjs';
import * as rncs from './vendor/rncs-reality-branch/src/index.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const describe=file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))});
const vendorRoot=path.join(ROOT,'src/vendor/rncs-reality-branch');

// RNCS forbids floating point in hashed envelopes. Typed tags preserve the
// exact finite f64 payload without asking RNCS to reinterpret RCL arithmetic.
export function packRncsValue(value){
  if(value===null)return['null'];if(typeof value==='number')return['number',canonicalF64Hex(value)];
  if(typeof value==='string')return['text',value];if(typeof value==='boolean')return['truth',value];
  if(Array.isArray(value))return['sequence',value.map(packRncsValue)];
  if(value&&typeof value==='object')return['object',Object.entries(value).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))).map(([key,item])=>[key,packRncsValue(item)])];
  throw new Error('RCL_RNCS_VALUE_UNSUPPORTED');
}
export function unpackRncsValue(value){
  const[kind,data]=value;
  if(kind==='null')return null;if(kind==='number')return f64FromCanonicalHex(data);
  if(kind==='text'||kind==='truth')return data;if(kind==='sequence')return data.map(unpackRncsValue);
  if(kind==='object')return Object.fromEntries(data.map(([key,item])=>[key,unpackRncsValue(item)]));
  throw new Error('RCL_RNCS_VALUE_TAG_UNSUPPORTED');
}
function verifyVendor(){
  const provenance=JSON.parse(fs.readFileSync(path.join(vendorRoot,'PROVENANCE.json'),'utf8'));
  if(provenance.upstreamSourceUnmodified!==true)throw new Error('RCL_RNCS_VENDOR_NOT_PINNED');
  for(const item of provenance.files)if(sha(fs.readFileSync(path.join(vendorRoot,item.path)))!==item.sha256)throw new Error('RCL_RNCS_VENDOR_SOURCE_DRIFT:'+item.path);
  return provenance;
}

/** Actual frozen RNCS candidate runtime; production RFE writes remain outside this adapter. */
export async function createPortableRncsTarget(){
  const provenance=verifyVendor(),native=createPortableNativeTarget('windows');let phase=await createPhaseContextTarget('automation-runtime');
  let state={body:null,status:'empty'},generation=0,generationRoot='0'.repeat(64),token=randomUUID(),instance=0,busy=false,disposed=false;
  const initialPhaseBinding=structuredClone(phase.binding),initialController=phase.snapshotController();
  function flow(payload,artifactHash,sourceRoot){
    const branchId='branch:'+artifactHash,branch=rncs.createBranch({branch_id:branchId,operations:[
      {op:'set',path:'body',value:payload,capability_id:'rcl.execute',operation_id:'execute-bound-rcl'},
      {op:'set',path:'status',value:'candidate',capability_id:'rncs.stage',operation_id:'stage-candidate'}],
      invariants:[{path:'body.sourceRoot',operator:'equals',value:sourceRoot},{path:'body.artifactHash',operator:'equals',value:artifactHash}]});
    const workspace=rncs.createWorkspace({reality_id:'rcl-local-candidate',base_generation:generation,base_generation_root:generationRoot,
      project_root:sourceRoot,base_state:state,branches:[branch],authority_policy:{required:true,resolver:'rcl:source-owned-local-admission'}});
    const simulation=rncs.simulateBranch(workspace,branchId),comparison=rncs.compareBranches(workspace,[simulation]);
    const plan=rncs.createExecutionPlan(workspace,simulation,{actor:'rcl:dispatcher'});
    return{workspace,simulation,comparison,plan,branchId};
  }
  async function executeOne(file,sourceRoot,options={}){
    if(disposed)throw new Error('RCL_RNCS_TARGET_CLOSED');if(busy)throw new Error('RCL_RNCS_BACKPRESSURE');
    if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw new Error('RCL_RNCS_SOURCE_ROOT_REQUIRED');
    const started=performance.now(),bytes=fs.readFileSync(file),artifactHash=sha(bytes),nonce=randomUUID();busy=true;
    try{
      verifyVendor();const preview=native.execute(file,sourceRoot),payload={sourceRoot,artifactHash,stateRoot:preview.result.stateRoot,
        result:packRncsValue({state:preview.result.state,history:preview.result.history??[],projections:preview.result.projections??[]})};
      const{workspace,simulation,comparison,plan,branchId}=flow(payload,artifactHash,sourceRoot),ledgerStart=phase.controllerLedger().length;
      let execution,providerCalls=0,rollbacks=0;
      const result=await rncs.executePlan(workspace.base_state,plan,{failAtStep:options.failAtStep??null,providers:{'rcl.execute':{
        async execute({step}){
          providerCalls++;execution=await phase.execute(file,sourceRoot);
          if(sha(fs.readFileSync(file))!==artifactHash||execution.result.stateRoot!==step.operation.value.stateRoot
              ||rncs.rootHash(packRncsValue({state:execution.result.state,history:execution.result.history??[],projections:execution.result.projections??[]}))!==rncs.rootHash(step.operation.value.result))return{ok:false,code:'RCL_RNCS_PROVIDER_BINDING'};
          return{ok:true,evidence:[{kind:'rcl-native-execution',sourceRoot,artifactHash,stateRoot:execution.result.stateRoot}],
            receipt:{sourceRoot,artifactHash,stateRoot:execution.result.stateRoot,controllerRoot:execution.controllerTrace.snapshot.stateRoot}};
        },async rollback(){rollbacks++;return{ok:true,evidence:[{kind:'stateless-native-output-discarded',artifactHash}]};},
      }}});
      if(result.receipt.status!=='completed'){
        const error=new Error(JSON.stringify({code:result.receipt.failure?.code??'RCL_RNCS_EXECUTION_ROLLED_BACK',message:'RNCS candidate execution rejected'}));
        error.code=result.receipt.failure?.code;error.rncsFailure={workspace,plan,receipt:result.receipt,state:result.state,providerCalls,rollbacks};throw error;
      }
      if(!execution||providerCalls!==1)throw new Error('RCL_RNCS_PROVIDER_NOT_EXECUTED');
      const proposal=rncs.createMergeProposal(workspace,comparison,branchId,{actor:'rcl:dispatcher',execution_receipt:result.receipt});
      const request=rncs.createAuthorityRequest(proposal,{resolver:'rcl:source-owned-local-admission',risk_class:'reversible-local-candidate'});
      const entry=execution.controllerTrace.entry;
      if(entry.status!=='realized'||entry.transition?.authority?.needs?.[0]?.capability!=='pipeline.dispatch')throw new Error('RCL_RNCS_SOURCE_AUTHORITY_REQUIRED');
      const decision=rncs.issueAuthorityDecision(request,{decision:'approved',authority_actor:'rcl:source-owned-local-admission',
        reason:'Source-declared RCL conditional warrant admitted this completed, root-bound local candidate',
        conditions:[{kind:'rcl-native-admission',root:entry.transition.afterRoot},{kind:'rcl-native-completion',root:execution.controllerTrace.completion.transition.afterRoot}]});
      const merged=rncs.applyMergeProposal(state,proposal,{current_generation_root:generationRoot,authority_decision:decision});
      if(rncs.rootHash(merged.state)!==result.receipt.final_state_root)throw new Error('RCL_RNCS_MERGE_ROOT_MISMATCH');
      const decoded=unpackRncsValue(merged.state.body.result);
      if(rncs.rootHash(packRncsValue(decoded))!==rncs.rootHash(packRncsValue({state:execution.result.state,history:execution.result.history??[],projections:execution.result.projections??[]})))throw new Error('RCL_RNCS_MATERIALIZATION_MISMATCH');
      const beforeGeneration=generation,beforeGenerationRoot=generationRoot;state=merged.state;generation++;
      generationRoot=rncs.rootHash({generation,previous:generationRoot,stateRoot:merged.state_root,proposalRoot:proposal.proposal_root});instance++;
      return{result:execution.result,ms:performance.now()-started,rncsTrace:{nonce,contextToken:token,instance,executionOwner:'RNCS_RBF_CANDIDATE_RUNTIME',
        hostNativeRclExecution:true,productionRfeCommit:false,sourceRoot,artifactHash,stateRoot:execution.result.stateRoot,providerCalls,rollbacks,
        workspace,simulation,comparison,plan,executionReceipt:result.receipt,proposal,authorityRequest:request,authorityDecision:decision,
        mergedState:state,mergedStateRoot:merged.state_root,beforeGeneration,beforeGenerationRoot,generation,generationRoot,
        controllerTrace:execution.controllerTrace,ledgerRange:{start:ledgerStart,end:phase.controllerLedger().length}}};
    }finally{busy=false;}
  }
  const target={environment:'rncs-runtime',binding:{...native.binding,context:'rncs-runtime',runtimeOwner:'RNCS_RBF_CANDIDATE_RUNTIME',
    execution:'Frozen canonical RNCS RBF simulates a branch, calls the RCL native provider, verifies execution, binds source-owned admission and merges a local candidate',
    vendor:{commit:provenance.commit,package:provenance.package,version:provenance.version,provenance:describe(path.join(vendorRoot,'PROVENANCE.json'))},
    controller:initialPhaseBinding.controller,initialController,initialContextToken:token,hostNativeRclExecution:true,
    productionRfeCommit:false,humanAuthorityClaimed:false,externalEffectsClaimed:false,securitySandboxClaimed:false},
    async compile(source,out){
      if(disposed)throw new Error('RCL_RNCS_TARGET_CLOSED');if(busy)throw new Error('RCL_RNCS_BACKPRESSURE');
      const result=native.compile(source,out);return{...result,rncsCompileTrace:{compilationOwner:'RCL_COMPILER_RBC_WINDOWS_NATIVE',sourceHash:sha(fs.readFileSync(source)),
        artifactHash:sha(result.bytecode),compilerHash:native.binding.compilerBinary.sha256,compilerArtifactHash:native.binding.compilerArtifact.sha256}};
    },execute:executeOne,
    async verifyReset(file,sourceRoot){
      const first=await executeOne(file,sourceRoot),next=await executeOne(file,sourceRoot),beforeToken=token,beforePid=phase.binding.controller.processId;
      const ledgerBefore=phase.controllerLedger();await phase.dispose();phase=await createPhaseContextTarget('automation-runtime');
      state={body:null,status:'empty'};generation=0;generationRoot='0'.repeat(64);instance=0;token=randomUUID();
      const reset=await executeOne(file,sourceRoot);
      if(first.result.stateRoot!==reset.result.stateRoot||next.rncsTrace.generation!==first.rncsTrace.generation+1||reset.rncsTrace.generation!==1
          ||token===beforeToken||phase.binding.controller.processId===beforePid)throw new Error('RCL_RNCS_CONTEXT_RESET_FAILED');
      return{status:'PASS',contextResetObserved:true,processResetObserved:true,contextTokenBefore:beforeToken,contextTokenAfter:token,
        processPidBefore:beforePid,processPidAfter:phase.binding.controller.processId,first:first.rncsTrace,next:next.rncsTrace,reset:reset.rncsTrace,
        controllerLedgerBefore:ledgerBefore,controllerLedgerAfter:phase.controllerLedger(),artifactHash:sha(fs.readFileSync(file)),sourceRoot,stateRoot:reset.result.stateRoot};
    },
    controllerLedger(){return phase.controllerLedger();},
    async verifyContextGuard(file,sourceRoot){
      const healthy=await executeOne(file,sourceRoot),trace=healthy.rncsTrace,before=rncs.rootHash(state),beforeGeneration=generation;
      let unapprovedRejected=false,staleRejected=false,rollbackObserved=false,authorityDenied=false;
      try{rncs.applyMergeProposal(trace.workspace.base_state,trace.proposal,{current_generation_root:trace.beforeGenerationRoot});}
      catch(error){if(error.code!=='RBF_AUTHORITY_REQUIRED')throw error;unapprovedRejected=true;}
      try{rncs.applyMergeProposal(trace.workspace.base_state,trace.proposal,{current_generation_root:'f'.repeat(64),authority_decision:trace.authorityDecision});}
      catch(error){if(error.code!=='RBF_STALE_BASE')throw error;staleRejected=true;}
      let failed;try{await executeOne(file,sourceRoot,{failAtStep:'step:0002'});}catch(error){failed=error.rncsFailure;}
      rollbackObserved=failed?.receipt.status==='rolled_back'&&failed.rollbacks===1&&rncs.rootHash(failed.state)===before&&generation===beforeGeneration;
      // Reuse the RCL source-owned pause/resume gate, never a JS self-grant.
      const guard=await phase.verifyContextGuard(file,sourceRoot);authorityDenied=guard.sourceAuthorityDenied;
      if(!unapprovedRejected||!staleRejected||!rollbackObserved||!authorityDenied||rncs.rootHash(state)!==before)throw new Error('RCL_RNCS_GUARD_CONTROL_FAILED');
      return{status:'PASS',unapprovedRejected,staleRejected,rollbackObserved,authorityDenied,failed,phaseGuard:guard,
        beforeStateRoot:before,afterStateRoot:rncs.rootHash(state),generationBefore:beforeGeneration,generationAfter:generation,sourceRoot,stateRoot:healthy.result.stateRoot};
    },async dispose(){disposed=true;await phase.dispose();native.dispose();},
  };
  return target;
}
