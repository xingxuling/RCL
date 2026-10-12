import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {createJobContextTarget} from '../src/job-context-targets.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {evidenceRoot,campaignCellIdFor,UNIVERSAL_STRESS_GATES} from '../src/universal-program-stress.mjs';
import {ROOT,edit,variant} from './k400-genomes/shared.mjs';
import {JOB_DIRECTORY} from './k400-job-definitions.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const stateRoot=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const matches=(state,expected)=>Object.entries(expected).every(([key,value])=>same(state[key],value));
const staticBindings=['scripts/k400-job-engine.mjs','scripts/k400-job-definitions.mjs','scripts/k400-genomes/shared.mjs',
  'src/job-context-targets.mjs','src/portable-serverless-target.mjs','src/portable-database-target.mjs','src/portable-dataflow-target.mjs','src/portable-dataflow-worker.mjs',
  'src/portable-http-target.mjs','src/portable-http-worker.mjs','src/portable-http-client.mjs','src/portable-native-vm.mjs',
  'src/selfhost-compiler.mjs','src/native-vm.mjs','src/compiler.mjs','src/bytecode.mjs','src/semantic-state-root.mjs','src/semantic-state-root-v2.mjs','src/canonical-f64.mjs',
  'native/rclvm.c','native/rclvm.h','native/rclc.c','native/semantic_state_v2.h','src/universal-program-stress.mjs'];
const bindingFiles=definition=>[...new Set([...staticBindings,definition.file])];

function validateInputs(definition){
  const prefix=JOB_DIRECTORY+'/'+definition.id,contract=read(prefix+'-contract.json');
  const source=fs.readFileSync(path.join(ROOT,contract.sourcePath),'utf8'),cases=read(contract.casesPath);
  assert.equal(evidenceRoot({...contract,contractRoot:undefined}),contract.contractRoot);
  assert.equal(contract.format,'rcl.k400-job-contract.v1');assert.equal(contract.id,definition.id);
  assert.equal(contract.frozenBeforeIndependentTrials,true);
  assert.equal(contract.independentGeneration.requiredFreshContexts,3);
  for(const key of ['canonicalSourceProvided','oracleEditsProvided','holdoutTestsProvided','osIsolationClaimed'])assert.equal(contract.independentGeneration[key],false);
  assert.deepEqual(contract.runtimeControls,['fresh terminated request handlers','SQLite reopen recovery and rejected-result rollback','worker-thread pipeline backpressure']);
  assert.equal(contract.trials.length,3);assert.deepEqual(contract.trials.map(item=>item.index),[0,1,2]);
  assert.deepEqual(contract.trials.map(item=>item.id),definition.mutations.map(item=>item.id));
  for(const[file,hash]of [[contract.sourcePath,contract.sourceHash],[contract.casesPath,contract.casesHash],
    [contract.compilerPath,contract.compilerHash],[contract.definitionFile,contract.definitionHash],[contract.jobDefinitionFile,contract.jobDefinitionHash]]){
    assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash);
  }
  assert.equal(contract.sourcePath,definition.sourcePath);assert.equal(contract.definitionFile,definition.file);
  assert.deepEqual(contract.environments,definition.environments);assert.deepEqual(contract.families,definition.families);assert.deepEqual(contract.baseline,definition.baseline);
  assert.deepEqual(contract.eligibleCells,definition.environments.flatMap(environment=>definition.families.map(family=>campaignCellIdFor(environment,family))));
  assert.equal(contract.rounds,20);assert.equal(cases.length,10);
  for(const item of cases){assert.equal(sha(variant(source,item.inputs)),item.sourceHash);assert.deepEqual(item.expected,definition.oracle(item.inputs));}
  return{prefix,contract,source,cases};
}
function validateProposals(prefix,contract){
  const proposalsPath=prefix+'-proposals.json',proposals=read(proposalsPath),batch=read(proposals.acquisitionBatch);
  assert.equal(proposals.acquisitionBatch,JOB_DIRECTORY+'/independent-batch.json');assert.equal(batch.batches.length,3);
  assert.equal(batch.format,'rcl.k400-independent-job-batch.v1');
  assert.equal(proposals.format,'rcl.k400-independent-job-proposals.v1');assert.equal(proposals.contractRoot,contract.contractRoot);
  for(const object of [proposals,batch])for(const key of ['canonicalSourceProvided','oracleEditsProvided','holdoutTestsProvided','osIsolationClaimed'])assert.equal(object[key],false);
  assert.equal(proposals.trials.length,3);assert.equal(new Set(proposals.trials.map(item=>item.context)).size,3);
  for(const frozen of contract.trials){
    const item=proposals.trials.find(trial=>trial.id===frozen.id);assert.ok(item);
    const context=batch.batches[frozen.index];assert.equal(item.context,context.context);
    assert.deepEqual(item.proposal,context.returnedProposals.find(proposal=>[contract.id,contract.id+'-'+frozen.index].includes(proposal.id)));assert.equal(item.proposal.file,'candidate.rcl');
  }
  return{proposalsPath,proposals,batchHash:sha(fs.readFileSync(path.join(ROOT,proposals.acquisitionBatch)))};
}
function checkValue(value,expected,source){
  assert.ok(matches(value.state,expected.state),'Independent oracle result');assert.equal(value.stateRoot,stateRoot(value.state));
  assert.deepEqual(value.history.map(record=>record.rule),expected.historyRules);assert.deepEqual(value.projections.map(record=>record.rule),expected.historyRules);
  const rules=compileReality(source).rules;let previous=structuredClone(value.state);
  for(let index=value.history.length-1;index>=0;index--){
    const record=value.history[index],projection=value.projections[index],rule=rules.find(rule=>rule.name===record.rule);
    assert.equal(record.actor,rule.cause);assert.equal(record.mode,'realize');assert.equal(record.status,'realized');
    assert.equal(record.stateRootAlgorithm,'rcl.semantic-state-root.v2');assert.deepEqual(record.authority.needs,rule.needs);
    assert.deepEqual(record.witnesses,rule.witnesses);assert.deepEqual(record.hostCalls,[]);
    assert.deepEqual(record.changes.map(change=>change.target),rule.alters.map(alter=>alter.target));assert.equal(record.afterRoot,stateRoot(previous));
    for(const change of record.changes){assert.deepEqual(previous[change.target],change.after);previous[change.target]=change.before;}
    assert.equal(record.beforeRoot,stateRoot(previous));assert.equal(projection.beforeRoot,record.beforeRoot);assert.equal(projection.afterRoot,record.afterRoot);
    assert.equal(projection.mode,'foresee');assert.equal(projection.actor,record.actor);assert.deepEqual(projection.authority,record.authority);assert.deepEqual(projection.witnesses,record.witnesses);
  }
}
function rejection(error){
  const code=/"code"\s*:\s*"([A-Z0-9_]+)"/u.exec(error.message)?.[1];
  if(!code)throw error;return{kind:'rejected',code,diagnostic:error.message};
}
function effective(broken,expected,values){
  if(broken.kind==='compile-rejected')return broken.semanticCode==='RCL_WARRANT_MISSING'&&/RCL_WARRANT_MISSING:/u.test(broken.diagnostic);
  if(broken.kind==='rejected')return ['RCL_AUTHORITY_DENIED','RCL_REALITY_BOUND_BROKEN'].includes(broken.code);
  if(broken.kind!=='success')return false;
  const value=broken.value??values?.[broken.valueRef];assert.ok(value);assert.equal(stateRoot(value.state),value.stateRoot);
  return !matches(value.state,expected.state)||!same(value.history.map(record=>record.rule),expected.historyRules);
}
function verifyTrace(environment,trace){
  assert.ok(trace);
  if(environment==='serverless'){
    assert.ok(Number.isInteger(trace.handlerPid)&&trace.handlerPid>0);assert.equal(trace.terminationObserved,true);assert.equal(trace.processExited,true);
    assert.ok(Number.isInteger(trace.request)&&trace.request>0);
  }else if(environment==='database'){
    assert.match(trace.runId,/^[0-9a-f-]{36}$/u);assert.equal(trace.committed,true);
    assert.equal(trace.sqlFunction,'rcl_execute');assert.equal(trace.sqlInvocations,1);assert.match(trace.sqliteVersion,/^3\.[0-9.]+$/u);
  }else if(environment==='dataflow-runtime'){
    assert.ok(Number.isInteger(trace.threadId)&&trace.threadId>0);assert.ok(Number.isInteger(trace.delivery)&&trace.delivery>0);
    assert.deepEqual(trace.stages,['source-binding','native-execution','receipt-sink']);assert.match(trace.inputHash,/^[0-9a-f]{64}$/u);
  }else throw new Error('RCL_JOB_TRACE_ENVIRONMENT:'+environment);
}
function verifyControls(environment,backend){
  const control=backend.runtimeControl,canonical=backend.rounds[0];assert.equal(control.status,'PASS');
  assert.equal(control.stateRoot,canonical.stateRoot);assert.equal(control.artifactHash,canonical.artifactHash);assert.equal(control.sourceRoot,canonical.sourceRoot);
  if(environment==='serverless'){
    assert.equal(control.freshHandlers,true);assert.equal(control.terminationObserved,true);assert.equal(control.processExited,true);assert.equal(control.handlerPids.length,2);
    assert.equal(new Set(control.handlerPids).size,2);assert.ok(control.handlerPids.every(pid=>Number.isInteger(pid)&&pid>0));
  }else if(environment==='database'){
    assert.equal(control.reopened,true);assert.notEqual(control.persistedRunId,control.replayRunId);
    for(const id of [control.persistedRunId,control.replayRunId])assert.match(id,/^[0-9a-f-]{36}$/u);
    assert.equal(control.rollback.status,'PASS');assert.equal(control.rollback.wrongRootRejected,true);
    assert.ok(Number.isInteger(control.rollback.before)&&control.rollback.before>0);assert.equal(control.rollback.before,control.rollback.after);
    assert.equal(control.rollback.sourceRoot,canonical.sourceRoot);
  }else if(environment==='dataflow-runtime'){
    assert.equal(control.backpressureRejected,true);assert.equal(control.threadId,backend.binding.threadId);
    assert.ok(Number.isInteger(control.delivery)&&control.delivery>0);
  }
}

export async function runJobProfile(definition){
  const{prefix,contract,source,cases}=validateInputs(definition),{proposalsPath,proposals,batchHash}=validateProposals(prefix,contract);
  const sourceBindings=bindingFiles(definition).map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}));
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-job-')),targets=[],values={},backends={};
  const addValue=value=>{const ref=evidenceRoot(value);values[ref]??=value;return ref;};
  async function compile(target,text,name){
    const file=path.join(temporary,target.environment+'-'+name+'.rcl'),out=file+'.rbc';fs.writeFileSync(file,text);
    const compilation=await target.compile(file,out);assert.ok(compilation.bytecode.equals(compileRealityToBytecode(text)),'Native/Bootstrap exact RBC parity');
    const compileTrace=target.environment==='serverless'?{handlerPid:compilation.handlerPid,terminationObserved:compilation.terminationObserved,
      processExited:compilation.processExited,request:compilation.request}:null;
    if(compileTrace)verifyTrace(target.environment,compileTrace);
    return{path:out,artifactHash:sha(compilation.bytecode),sourceHash:sha(text),sourceRoot:compileReality(text).programRoot,compileMs:compilation.ms,compileTrace};
  }
  async function observe(target,artifact){
    try{
      const execution=await target.execute(artifact.path,artifact.sourceRoot),result=execution.result;
      const runtimeTrace=target.environment==='serverless'?{handlerPid:execution.handlerPid,terminationObserved:execution.terminationObserved,processExited:execution.processExited,request:execution.request}:
        target.environment==='database'?{runId:execution.runId,committed:execution.committed,sqlFunction:execution.sqlFunction,sqlInvocations:execution.sqlInvocations,sqliteVersion:execution.sqliteVersion}:
          {threadId:execution.threadId,delivery:execution.delivery,stages:execution.stages,inputHash:execution.inputHash};
      verifyTrace(target.environment,runtimeTrace);
      return{kind:'success',executeMs:execution.ms,runtimeTrace,value:{state:result.state,stateRoot:result.stateRoot,history:result.history??[],projections:result.projections??[]}};
    }catch(error){return rejection(error);}
  }
  async function row(target,text,name,expected){
    const artifact=await compile(target,text,name),observed=await observe(target,artifact);assert.equal(observed.kind,'success','Target execution: '+target.environment);
    checkValue(observed.value,expected,text);const{path:_path,...fields}=artifact;
    return{...fields,executeMs:observed.executeMs,runtimeTrace:observed.runtimeTrace,stateRoot:observed.value.stateRoot,valueRef:addValue(observed.value)};
  }
  try{
    for(const environment of contract.environments)targets.push(await createJobContextTarget(environment));
    for(const target of targets){
      console.log(JSON.stringify({status:'JOB_TARGET_RUNNING',id:definition.id,environment:target.environment}));
      const expected=definition.oracle(definition.baseline),rounds=[],inputResults=[],trials=[];
      for(let index=0;index<contract.rounds;index++)rounds.push({index,...await row(target,source,'round-'+index,expected)});
      for(const item of cases)inputResults.push({index:item.index,inputs:item.inputs,...await row(target,variant(source,item.inputs),'case-'+item.index,item.expected)});
      for(const frozen of contract.trials){
        const proposalTrial=proposals.trials.find(item=>item.id===frozen.id),mutation=definition.mutations.find(item=>item.id===frozen.id);
        const mutated=edit(source,mutation.good,mutation.bad);assert.equal(sha(mutated),frozen.mutatedSourceHash);let broken;
        try{const brokenArtifact=await compile(target,mutated,'broken-'+frozen.id),{path:_path,...binding}=brokenArtifact;
          broken={...await observe(target,brokenArtifact),...binding};}
        catch(error){if(!/RCL_WARRANT_MISSING:/u.test(error.message))throw error;broken={kind:'compile-rejected',semanticCode:'RCL_WARRANT_MISSING',diagnostic:error.message};}
        assert.equal(effective(broken,expected),true,'Effective semantic mutation: '+frozen.id);
        const repaired=edit(mutated,proposalTrial.proposal.old,proposalTrial.proposal.new),exactCanonicalRestoration=repaired===source;
        const semanticRepairCases=[];
        // Apply the returned proposal unchanged. A different correct spelling must pass every pre-sealed case.
        if(!exactCanonicalRestoration)for(const item of cases)semanticRepairCases.push({index:item.index,inputs:item.inputs,
          ...await row(target,variant(repaired,item.inputs),'repair-'+frozen.id+'-case-'+item.index,item.expected)});
        trials.push({id:frozen.id,context:proposalTrial.context,proposal:proposalTrial.proposal,mutatedSourceHash:frozen.mutatedSourceHash,
          broken:broken.kind!=='success'?broken:{...broken,value:undefined,valueRef:addValue(broken.value)},exactCanonicalRestoration,semanticRepairCases,
          ...await row(target,repaired,'repaired-'+frozen.id,expected)});
      }
      const artifact=await compile(target,source,'runtime-control');let runtimeControl;
      if(target.environment==='serverless')runtimeControl={...target.verifyColdStart(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
      else if(target.environment==='database')runtimeControl={...target.verifyRecovery(artifact.path,artifact.sourceRoot),
        rollback:target.verifyRollback(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
      else runtimeControl={...await target.verifyBackpressure(artifact.path,artifact.sourceRoot),artifactHash:artifact.artifactHash};
      const malformed=path.join(temporary,target.environment+'-malformed.rcl');fs.writeFileSync(malformed,source.replace(/^reality /u,'realty '));
      let malformedRejected=false,malformedDiagnostic='';try{await target.compile(malformed,malformed+'.rbc');}catch(error){malformedDiagnostic=error.message;malformedRejected=/RCL_SEMANTIC_ASSERT: reality at/u.test(error.message);}
      const corrupt=path.join(temporary,target.environment+'-corrupt.rbc');fs.writeFileSync(corrupt,Buffer.from('RCLB'));
      let corruptRejected=false,corruptDiagnostic='';try{await target.execute(corrupt);}catch(error){corruptDiagnostic=error.message;corruptRejected=/RCL_NATIVE_TRUNCATED/u.test(error.message);}
      assert.equal(malformedRejected&&corruptRejected,true);
      const performance={compileP95Ms:p95(rounds.map(item=>item.compileMs)),executeP95Ms:p95(rounds.map(item=>item.executeMs))};
      for(const field of Object.keys(performance))assert.ok(performance[field]<=contract.performanceBudget[field],field+': '+performance[field]);
      const backend={binding:target.binding,rounds,inputResults,trials,performance,runtimeControl,
        negativeControls:{malformedRejected,malformedDiagnostic,corruptRejected,corruptDiagnostic,semanticMutationsDetected:3},
        gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,'PASS']))};
      verifyControls(target.environment,backend);backends[target.environment]=backend;
      console.log(JSON.stringify({status:'JOB_TARGET_PASS',id:definition.id,environment:target.environment,performance}));
    }
    for(const file of sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,file.path))),file.sha256,'Source changed during acquisition');
    const report={format:'rcl.k400-job-runtime.v1',status:'PASS_LOCAL_BOUND_JOBS',id:definition.id,generatedAt:new Date().toISOString(),
      contractRoot:contract.contractRoot,sourceHash:contract.sourceHash,casesHash:contract.casesHash,compilerHash:contract.compilerHash,
      proposalsPath,proposalsHash:sha(fs.readFileSync(path.join(ROOT,proposalsPath))),batchHash,eligibleCells:contract.eligibleCells,
      sourceBindings,backends,values,scope:contract.scope,osIsolationClaimed:false,hostedCi:'NOT_RUN_USER_INSTRUCTION',reportRoot:null};
    report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});verifyJobProfile(definition,report);
    fs.writeFileSync(path.join(ROOT,prefix+'-runtime.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,id:definition.id,reportRoot:report.reportRoot,eligibleCells:report.eligibleCells}));return report;
  }finally{
    for(const target of targets)await target.dispose();
    const resolved=path.resolve(temporary);assert.ok(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('rcl-job-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}

export function verifyJobProfile(definition,supplied){
  const{prefix,contract,source,cases}=validateInputs(definition);
  if(!supplied&&!fs.existsSync(path.join(ROOT,prefix+'-runtime.json')))return{admitted:false,claims:[],id:definition.id};
  const report=supplied??read(prefix+'-runtime.json'),{proposalsPath,proposals,batchHash}=validateProposals(prefix,contract);
  assert.equal(report.format,'rcl.k400-job-runtime.v1');assert.equal(report.status,'PASS_LOCAL_BOUND_JOBS');assert.equal(report.id,definition.id);
  assert.equal(evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined}),report.reportRoot);assert.equal(report.contractRoot,contract.contractRoot);
  for(const field of ['sourceHash','casesHash','compilerHash'])assert.equal(report[field],contract[field]);
  assert.equal(report.proposalsPath,proposalsPath);assert.equal(report.proposalsHash,sha(fs.readFileSync(path.join(ROOT,proposalsPath))));assert.equal(report.batchHash,batchHash);
  assert.equal(report.osIsolationClaimed,false);assert.equal(report.hostedCi,'NOT_RUN_USER_INSTRUCTION');assert.equal(report.scope,contract.scope);
  assert.deepEqual(report.eligibleCells,contract.eligibleCells);assert.deepEqual(Object.keys(report.backends),contract.environments);
  assert.deepEqual(report.sourceBindings.map(item=>item.path),bindingFiles(definition));
  for(const item of report.sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  for(const[ref,value]of Object.entries(report.values)){assert.equal(evidenceRoot(value),ref);assert.equal(stateRoot(value.state),value.stateRoot);}
  function verifyRow(environment,item,text,expected){
    assert.equal(item.artifactHash,sha(compileRealityToBytecode(text)));assert.equal(item.sourceHash,sha(text));assert.equal(item.sourceRoot,compileReality(text).programRoot);
    const value=report.values[item.valueRef];assert.ok(value);assert.equal(value.stateRoot,item.stateRoot);checkValue(value,expected,text);verifyTrace(environment,item.runtimeTrace);
    const binding=report.backends[environment].binding;
    if(environment==='serverless'){verifyTrace(environment,item.compileTrace);assert.notEqual(item.compileTrace.handlerPid,item.runtimeTrace.handlerPid);
      assert.ok(item.compileTrace.request<item.runtimeTrace.request);}
    else assert.equal(item.compileTrace,null);
    if(environment==='database')assert.equal(item.runtimeTrace.sqliteVersion,binding.sqliteVersion);
    if(environment==='dataflow-runtime'){assert.equal(item.runtimeTrace.threadId,binding.threadId);assert.equal(item.runtimeTrace.inputHash,item.artifactHash);}
    for(const metric of ['compileMs','executeMs'])assert.ok(Number.isFinite(item[metric])&&item[metric]>=0);
  }
  for(const[environment,backend]of Object.entries(report.backends)){
    const binary='native/rclvm.exe';
    assert.equal(backend.binding.context,environment);assert.equal(backend.binding.binary.path,binary);assert.equal(backend.binding.compilerBinary.path,'native/rclc.exe');
    assert.equal(backend.binding.compilerArtifact.sha256,contract.compilerHash);assert.equal(backend.binding.os,'win32');
    for(const item of [backend.binding.binary,backend.binding.compilerBinary,backend.binding.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
    const host=backend.binding.hostRuntime;
    assert.equal(host.nodeVersion,process.version);assert.equal(host.binaryPath,process.execPath);assert.equal(sha(fs.readFileSync(host.binaryPath)),host.sha256);
    if(environment==='serverless'){assert.equal(backend.binding.cloudFaasClaimed,false);assert.equal(backend.binding.warmProcessReused,false);}
    if(environment==='database'){assert.equal(backend.binding.engine,'SQLite');assert.equal(backend.binding.opaqueSqlSemanticDelegation,false);}
    if(environment==='dataflow-runtime'){assert.equal(backend.binding.maxInFlight,1);assert.equal(backend.binding.externalStreamClaimed,false);}
    assert.equal(backend.rounds.length,contract.rounds);assert.deepEqual(backend.rounds.map(item=>item.index),Array.from({length:contract.rounds},(_,index)=>index));
    assert.equal(new Set(backend.rounds.map(item=>item.valueRef)).size,1);
    for(const item of backend.rounds)verifyRow(environment,item,source,definition.oracle(definition.baseline));
    if(environment==='serverless')assert.equal(new Set(backend.rounds.map(item=>item.runtimeTrace.handlerPid)).size,contract.rounds);
    if(environment==='database')assert.equal(new Set(backend.rounds.map(item=>item.runtimeTrace.runId)).size,contract.rounds);
    assert.equal(backend.inputResults.length,cases.length);
    for(const item of cases){const row=backend.inputResults[item.index];assert.equal(row.index,item.index);assert.deepEqual(row.inputs,item.inputs);verifyRow(environment,row,variant(source,item.inputs),item.expected);}
    assert.equal(backend.trials.length,3);assert.equal(new Set(backend.trials.map(item=>item.context)).size,3);
    for(const frozen of contract.trials){
      const item=backend.trials.find(trial=>trial.id===frozen.id),proposalTrial=proposals.trials.find(trial=>trial.id===frozen.id),mutation=definition.mutations.find(trial=>trial.id===frozen.id);
      assert.ok(item);assert.equal(item.context,proposalTrial.context);assert.deepEqual(item.proposal,proposalTrial.proposal);
      const mutated=edit(source,mutation.good,mutation.bad);assert.equal(sha(mutated),frozen.mutatedSourceHash);assert.equal(item.mutatedSourceHash,frozen.mutatedSourceHash);
      assert.equal(effective(item.broken,definition.oracle(definition.baseline),report.values),true);
      if(item.broken.kind!=='compile-rejected'){
        assert.equal(item.broken.sourceHash,sha(mutated));assert.equal(item.broken.sourceRoot,compileReality(mutated).programRoot);
        assert.equal(item.broken.artifactHash,sha(compileRealityToBytecode(mutated)));
        if(item.broken.kind==='success')verifyTrace(environment,item.broken.runtimeTrace);
      }
      const repaired=edit(mutated,item.proposal.old,item.proposal.new);assert.equal(item.exactCanonicalRestoration,repaired===source);
      assert.equal(item.semanticRepairCases.length,repaired===source?0:cases.length);
      for(const frozenCase of repaired===source?[]:cases){const row=item.semanticRepairCases[frozenCase.index];assert.equal(row.index,frozenCase.index);assert.deepEqual(row.inputs,frozenCase.inputs);
        verifyRow(environment,row,variant(repaired,frozenCase.inputs),frozenCase.expected);}
      verifyRow(environment,item,repaired,definition.oracle(definition.baseline));
    }
    for(const field of ['compileP95Ms','executeP95Ms']){const metric=field==='compileP95Ms'?'compileMs':'executeMs';assert.equal(backend.performance[field],p95(backend.rounds.map(item=>item[metric])));assert.ok(backend.performance[field]<=contract.performanceBudget[field]);}
    assert.equal(backend.negativeControls.malformedRejected&&backend.negativeControls.corruptRejected,true);assert.equal(backend.negativeControls.semanticMutationsDetected,3);
    assert.ok(/RCL_SEMANTIC_ASSERT: reality at/u.test(backend.negativeControls.malformedDiagnostic));assert.ok(/RCL_NATIVE_TRUNCATED/u.test(backend.negativeControls.corruptDiagnostic));
    verifyControls(environment,backend);for(const gate of UNIVERSAL_STRESS_GATES)assert.equal(backend.gates[gate],'PASS');
  }
  const all=Object.values(report.backends);assert.equal(new Set(all.map(backend=>backend.rounds[0].valueRef)).size,1);
  for(const item of cases)assert.equal(new Set(all.map(backend=>backend.inputResults[item.index].valueRef)).size,1);
  const refs=[prefix+'-contract.json',prefix+'-runtime.json',contract.casesPath,proposalsPath,proposals.acquisitionBatch];
  return{admitted:true,id:definition.id,reportRoot:report.reportRoot,eligibleCells:contract.eligibleCells,
    claims:definition.environments.flatMap(environment=>definition.families.map(programFamily=>({id:`${environment}::${programFamily}`,environment,programFamily,
      coverageMode:'native-semantic',lastVerifiedDate:'2026-10-13',changes:[],knownLimits:[contract.scope,
        '20 actual context rounds, ten pre-sealed inputs, three fresh candidate-only repairs. Noncanonical repairs additionally replay all ten sealed inputs; input-domain agreement is not full-language semantic equivalence.',
        'Local Windows cold handlers, SQLite SQL-function commits and bounded worker-thread dataflow; no cloud FaaS, arbitrary SQL/streams or OS sandbox authority.'],
      requiredGenes:['native-rcl-owned-rbc','root-v2','actual-context-controls','sealed-input-oracles','independent-repair','transaction-root-continuity'],
      gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,{status:'PASS',evidence:refs,
        note:'Actual handler termination, SQL recovery/rollback and backpressure controls, exact RBC parity, frozen independent oracles, measured budgets, effective mutations and source-declared transaction evidence.'}]))})))};
}
