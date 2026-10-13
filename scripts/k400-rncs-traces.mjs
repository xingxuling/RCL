import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyPhaseLedger,checkPhaseTrace} from './k400-phase-ledger.mjs';
import {createRealitySession} from '../src/runtime.mjs';
import {packRncsValue,unpackRncsValue} from '../src/portable-rncs-target.mjs';
import * as rncs from '../src/vendor/rncs-reality-branch/src/index.mjs';
import {verifyContentSeal} from '../src/vendor/rncs-reality-branch/src/canonical.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),OWNER='RNCS_RBF_CANDIDATE_RUNTIME';
export function verifyRncsBinding(binding,contract){
  assert.equal(binding.context,'rncs-runtime');assert.equal(binding.runtimeOwner,OWNER);assert.equal(binding.os,'win32');assert.equal(binding.hostNativeRclExecution,true);
  for(const field of ['productionRfeCommit','humanAuthorityClaimed','externalEffectsClaimed','securitySandboxClaimed'])assert.equal(binding[field],false);
  assert.equal(binding.compilerBinary.path,contract.compilerBinary.path);assert.equal(binding.compilerBinary.sha256,contract.compilerBinary.sha256);
  assert.equal(binding.compilerArtifact.path,contract.compilerPath);assert.equal(binding.compilerArtifact.sha256,contract.compilerHash);
  assert.deepEqual(binding.vendor.provenance,contract.vendorProvenance);
  for(const item of [binding.binary,binding.compilerBinary,binding.compilerArtifact,binding.vendor.provenance])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  const provenance=JSON.parse(fs.readFileSync(path.join(ROOT,binding.vendor.provenance.path),'utf8'));
  assert.equal(provenance.upstreamSourceUnmodified,true);assert.equal(provenance.commit,binding.vendor.commit);
  assert.equal(provenance.package,binding.vendor.package);assert.equal(provenance.version,binding.vendor.version);
  for(const file of provenance.files)assert.equal(sha(fs.readFileSync(path.join(ROOT,'src/vendor/rncs-reality-branch',file.path))),file.sha256);
  assert.match(binding.initialContextToken,/^[0-9a-f-]{36}$/u);
}
function verifyFlow(trace){
  assert.equal(trace.executionOwner,OWNER);assert.equal(trace.hostNativeRclExecution,true);assert.equal(trace.productionRfeCommit,false);
  assert.equal(rncs.validateWorkspace(trace.workspace).valid,true);assert.equal(rncs.verifySimulation(trace.simulation),true);
  assert.equal(rncs.verifyExecutionPlan(trace.plan),true);assert.equal(rncs.verifyExecutionReceipt(trace.executionReceipt),true);
  assert.equal(rncs.verifyMergeProposal(trace.proposal),true);assert.equal(rncs.verifyAuthorityDecision(trace.authorityDecision,trace.proposal),true);
  assert.equal(trace.plan.workspace_root,trace.workspace.workspace_root);assert.equal(trace.plan.simulation_root,trace.simulation.simulation_root);
  assert.equal(trace.plan.mode,'sandbox');assert.equal(trace.plan.actor,'rcl:dispatcher');
  assert.equal(rncs.createExecutionPlan(trace.workspace,trace.simulation,{actor:'rcl:dispatcher'}).plan_root,trace.plan.plan_root);
  assert.deepEqual(rncs.compareBranches(trace.workspace,[trace.simulation]),trace.comparison);assert.equal(trace.proposal.comparison_root,trace.comparison.comparison_root);
  assert.equal(trace.executionReceipt.plan_root,trace.plan.plan_root);assert.equal(trace.executionReceipt.status,'completed');
  assert.equal(trace.providerCalls,1);assert.equal(trace.rollbacks,0);assert.equal(trace.plan.steps.length,2);
  assert.equal(trace.proposal.execution_receipt_root,trace.executionReceipt.receipt_root);assert.equal(trace.proposal.require_authority,true);
  assert.equal(trace.authorityDecision.request_root,trace.authorityRequest.request_root);assert.equal(trace.authorityRequest.proposal_root,trace.proposal.proposal_root);
  assert.equal(verifyContentSeal(trace.authorityRequest,'request_root',['requested_at']),true);
  checkPhaseTrace('automation-runtime',trace.controllerTrace);
  assert.deepEqual(trace.authorityDecision.conditions,[{kind:'rcl-native-admission',root:trace.controllerTrace.entry.transition.afterRoot},
    {kind:'rcl-native-completion',root:trace.controllerTrace.completion.transition.afterRoot}]);
  assert.equal(trace.authorityDecision.authority_actor,'rcl:source-owned-local-admission');
  const provider=trace.executionReceipt.step_receipts[0];assert.equal(provider.capability_id,'rcl.execute');
  assert.deepEqual(provider.provider_evidence,[{kind:'rcl-native-execution',sourceRoot:trace.sourceRoot,artifactHash:trace.artifactHash,stateRoot:trace.stateRoot}]);
  assert.deepEqual(provider.provider_receipt,{sourceRoot:trace.sourceRoot,artifactHash:trace.artifactHash,stateRoot:trace.stateRoot,
    controllerRoot:trace.controllerTrace.snapshot.stateRoot});
  const merged=rncs.applyMergeProposal(trace.workspace.base_state,trace.proposal,{current_generation_root:trace.beforeGenerationRoot,authority_decision:trace.authorityDecision});
  assert.deepEqual(merged.state,trace.mergedState);assert.equal(merged.state_root,trace.mergedStateRoot);assert.equal(trace.executionReceipt.final_state_root,trace.mergedStateRoot);
  assert.equal(trace.mergedState.body.sourceRoot,trace.sourceRoot);assert.equal(trace.mergedState.body.artifactHash,trace.artifactHash);assert.equal(trace.mergedState.body.stateRoot,trace.stateRoot);
  assert.equal(trace.workspace.base.generation,trace.beforeGeneration);assert.equal(trace.workspace.base.generation_root,trace.beforeGenerationRoot);
  assert.equal(trace.generation,trace.beforeGeneration+1);assert.equal(trace.generationRoot,rncs.rootHash({generation:trace.generation,previous:trace.beforeGenerationRoot,stateRoot:trace.mergedStateRoot,proposalRoot:trace.proposal.proposal_root}));
}
export function verifyRncsRow(item,binding,value){
  const compile=item.compileTrace,trace=item.runtimeTrace;assert.ok(compile&&trace);
  assert.equal(compile.compilationOwner,'RCL_COMPILER_RBC_WINDOWS_NATIVE');assert.equal(compile.sourceHash,item.sourceHash);assert.equal(compile.artifactHash,item.artifactHash);
  assert.equal(compile.compilerHash,binding.compilerBinary.sha256);assert.equal(compile.compilerArtifactHash,binding.compilerArtifact.sha256);
  assert.equal(trace.contextToken,binding.initialContextToken);assert.equal(trace.controllerTrace.processId,binding.controller.processId);
  for(const field of ['sourceRoot','artifactHash'])assert.equal(trace[field],item[field]);assert.equal(trace.stateRoot,item.stateRoot??value.stateRoot);
  assert.match(trace.nonce,/^[0-9a-f-]{36}$/u);assert.ok(Number.isInteger(trace.instance)&&trace.instance>0);verifyFlow(trace);
  assert.deepEqual(trace.mergedState.body.result,packRncsValue({state:value.state,history:value.history,projections:value.projections}));
  assert.deepEqual(unpackRncsValue(trace.mergedState.body.result),{state:value.state,history:value.history,projections:value.projections});
}
export async function verifyRncsControl(backend){
  const control=backend.runtimeControl,guard=control.guard,canonical=backend.rounds[0];assert.equal(control.status,'PASS');assert.equal(control.contextResetObserved,true);assert.equal(control.processResetObserved,true);
  for(const field of ['artifactHash','sourceRoot','stateRoot'])assert.equal(control[field],canonical[field]);
  assert.equal(control.contextTokenBefore,backend.binding.initialContextToken);assert.notEqual(control.contextTokenBefore,control.contextTokenAfter);
  assert.equal(control.processPidBefore,backend.binding.controller.processId);assert.notEqual(control.processPidBefore,control.processPidAfter);
  for(const trace of [control.first,control.next,control.reset])verifyFlow(trace);
  assert.equal(control.next.beforeGenerationRoot,control.first.generationRoot);assert.equal(control.reset.beforeGeneration,0);assert.equal(control.reset.generation,1);
  assert.equal(control.reset.contextToken,control.contextTokenAfter);assert.equal(control.reset.controllerTrace.processId,control.processPidAfter);
  assert.equal(guard.status,'PASS');for(const key of ['unapprovedRejected','staleRejected','rollbackObserved','authorityDenied'])assert.equal(guard[key],true);
  assert.equal(guard.beforeStateRoot,guard.afterStateRoot);assert.equal(guard.generationBefore,guard.generationAfter);
  assert.equal(rncs.verifyExecutionReceipt(guard.failed.receipt),true);assert.equal(rncs.verifyExecutionPlan(guard.failed.plan),true);
  assert.equal(guard.failed.receipt.plan_root,guard.failed.plan.plan_root);assert.equal(guard.failed.receipt.status,'rolled_back');assert.equal(guard.failed.rollbacks,1);
  assert.equal(guard.failed.receipt.rollback.complete,true);assert.equal(rncs.rootHash(guard.failed.state),guard.beforeStateRoot);
  const rows=[...backend.rounds,...backend.inputResults,...backend.trials,...backend.trials.flatMap(trial=>trial.semanticRepairCases),
    ...backend.trials.filter(trial=>trial.broken.kind==='success').map(trial=>trial.broken)].map(row=>({...row,runtimeTrace:row.runtimeTrace.controllerTrace}));
  const phaseBackend={...backend,controllerLedger:control.controllerLedgerBefore,runtimeControl:{...guard.phaseGuard,artifactHash:canonical.artifactHash}};
  await verifyPhaseLedger('automation-runtime',phaseBackend,rows);
  const fresh=createRealitySession(fs.readFileSync(path.join(ROOT,backend.binding.controller.sourcePath),'utf8')),ledger=control.controllerLedgerAfter;
  assert.equal(ledger.length,2);
  for(const[index,item]of ledger.entries()){
    assert.equal(item.index,index);assert.equal(item.error,undefined);assert.deepEqual(item.before.state,fresh.snapshot().state);
    assert.equal(item.before.stateRoot,fresh.snapshot().stateRoot);assert.equal(item.before.native.processId,control.processPidAfter);
    assert.deepEqual(item.result,await fresh.invoke(item.command));assert.deepEqual(item.after.state,fresh.snapshot().state);
    assert.equal(item.after.stateRoot,fresh.snapshot().stateRoot);assert.equal(item.after.native.sourceBound,true);
  }
  assert.equal(ledger[0].command.rule,'admit');assert.equal(ledger[0].command.inputs['event.root'],canonical.sourceRoot);assert.equal(ledger[1].command.rule,'finish');assert.equal(ledger[1].command.inputs['event.success'],true);
  assert.deepEqual(control.reset.controllerTrace.entry,ledger[0].result);assert.deepEqual(control.reset.controllerTrace.completion,ledger[1].result);
  assert.equal(new Set(backend.rounds.map(row=>row.runtimeTrace.nonce)).size,20);
  for(let index=1;index<backend.rounds.length;index++)assert.equal(backend.rounds[index].runtimeTrace.beforeGenerationRoot,backend.rounds[index-1].runtimeTrace.generationRoot);
}
