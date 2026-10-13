import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {createPortableScientificTarget} from '../src/portable-scientific-target.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {evidenceRoot,campaignCellIdFor,UNIVERSAL_STRESS_GATES} from '../src/universal-program-stress.mjs';
import {ROOT,edit,variant} from './k400-genomes/shared.mjs';
import {SCIENTIFIC_DIRECTORY} from './k400-scientific-definitions.mjs';
import {verifyScientificBinding,verifyScientificRow,verifyScientificControl} from './k400-scientific-traces.mjs';
import {runScientificCounterNetwork,verifyScientificCounterNetwork} from './k400-scientific-network.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const stateRoot=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const matches=(state,expected)=>Object.entries(expected).every(([key,value])=>same(state[key],value));
const staticBindings=["scripts/k400-scientific-engine.mjs","scripts/k400-scientific-traces.mjs","scripts/k400-scientific-definitions.mjs","scripts/k400-genomes/shared.mjs","src/portable-scientific-target.mjs","src/portable-native-vm.mjs","src/native-session.mjs","src/session-compiler.mjs","src/session-contract.mjs","src/selfhost-compiler.mjs","src/native-vm.mjs","src/runtime.mjs","src/compiler.mjs","src/bytecode.mjs","src/semantic-state-root.mjs","src/semantic-state-root-v2.mjs","src/canonical-f64.mjs","selfhost/compiler-core.rcl","selfhost/compiler-main.rcl","selfhost/session-compiler-core.rcl","selfhost/session-compiler-main.rcl","native/rclvm.c","native/rclvm.h","native/rclc.c","native/rclvmd.c","native/semantic_state_v2.h","native/native-windows-manifest.json","src/universal-program-stress.mjs","examples/runtime-hosts/scientific-gate.rcl","examples/scientific/statistics.rcl","native/scientific-runtime/oracle.py"];
const bindingFiles=definition=>[...new Set([...staticBindings,definition.file,'scripts/k400-scientific-network.mjs','scripts/k400-crdt-network-verifier.mjs','scripts/k400-crdt-definitions.mjs','src/replicated-counter-network.mjs'])];

function validateInputs(definition){
  const prefix=SCIENTIFIC_DIRECTORY+'/'+definition.id,contract=read(prefix+'-contract.json');
  const source=fs.readFileSync(path.join(ROOT,contract.sourcePath),'utf8'),cases=read(contract.casesPath);
  assert.equal(evidenceRoot({...contract,contractRoot:undefined}),contract.contractRoot);
  assert.equal(contract.format,'rcl.k400-scientific-contract.v1');assert.equal(contract.id,definition.id);
  assert.equal(contract.frozenBeforeIndependentTrials,true);
  assert.equal(contract.independentGeneration.requiredFreshContexts,3);
  for(const key of ['canonicalSourceProvided','oracleEditsProvided','holdoutTestsProvided','osIsolationClaimed'])assert.equal(contract.independentGeneration[key],false);
  assert.deepEqual(contract.runtimeControls,['actual native program and native numerical kernel with independent NumPy/SciPy observation','source-owned numeric-error publication and entire independent controller replay','pause/source/empty/oversized/nonfinite rejection, actual numeric mutant failure settlement, real controller reset and observer exit']);
  assert.equal(sha(fs.readFileSync(path.join(ROOT,contract.compilerBinary.path))),contract.compilerBinary.sha256);
  for(const item of [contract.controllerSource,contract.kernelSource,contract.oracleSource])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  assert.deepEqual(contract.numericalPolicy,{tolerance:1e-9,maximumMeasuredScalars:256,minimumNonzeroMagnitude:1e-12,maximumMagnitude:1e24});assert.deepEqual(contract.controlOptions,{sampleVector:[1,2,4,8],oversizedCount:257});
  assert.deepEqual(contract.performanceBudget,{compileP95Ms:5000,executeP95Ms:2000});
  assert.equal(contract.trials.length,3);assert.deepEqual(contract.trials.map(item=>item.index),[0,1,2]);
  assert.deepEqual(contract.trials.map(item=>item.id),definition.mutations.map(item=>item.id));
  for(const[file,hash]of [[contract.sourcePath,contract.sourceHash],[contract.casesPath,contract.casesHash],
    [contract.compilerPath,contract.compilerHash],[contract.definitionFile,contract.definitionHash],[contract.scientificDefinitionFile,contract.scientificDefinitionHash]]){
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
  assert.equal(proposals.acquisitionBatch,SCIENTIFIC_DIRECTORY+'/independent-batch.json');assert.equal(batch.batches.length,3);
  assert.equal(batch.format,'rcl.k400-independent-scientific-batch.v1');
  assert.equal(proposals.format,'rcl.k400-independent-scientific-proposals.v1');assert.equal(proposals.contractRoot,contract.contractRoot);
  for(const object of [proposals,batch])for(const key of ['canonicalSourceProvided','oracleEditsProvided','holdoutTestsProvided','osIsolationClaimed'])assert.equal(object[key],false);
  assert.equal(proposals.trials.length,3);assert.equal(new Set(proposals.trials.map(item=>item.context)).size,3);
  for(const context of batch.batches)assert.deepEqual(JSON.parse(context.rawResponse),context.returnedProposals);
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
const verifyControls=(_environment,backend,contract,values)=>verifyScientificControl(backend,contract,values);

export async function runScientificProfile(definition){
  const{prefix,contract,source,cases}=validateInputs(definition),{proposalsPath,proposals,batchHash}=validateProposals(prefix,contract);
  const sourceBindings=bindingFiles(definition).map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}));
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-scientific-')),targets=[],values={},backends={};
  const addValue=value=>{const ref=evidenceRoot(value);values[ref]??=value;return ref;};
  async function compile(target,text,name){
    const file=path.join(temporary,target.environment+'-'+name+'.rcl'),out=file+'.rbc';fs.writeFileSync(file,text);
    const compilation=await target.compile(file,out);assert.ok(compilation.bytecode.equals(compileRealityToBytecode(text)),'Native/Bootstrap exact RBC parity');
    const compileTrace=compilation.scientificCompileTrace;
    return{path:out,artifactHash:sha(compilation.bytecode),sourceHash:sha(text),sourceRoot:compileReality(text).programRoot,compileMs:compilation.ms,compileTrace};
  }
  async function observe(target,artifact){
    try{
      const execution=await target.execute(artifact.path,artifact.sourceRoot),result=execution.result;
      const runtimeTrace=execution.scientificTrace;
      return{kind:'success',executeMs:execution.ms,runtimeTrace,value:{state:result.state,stateRoot:result.stateRoot,history:result.history??[],projections:result.projections??[]}};
    }catch(error){return rejection(error);}
  }
  async function row(target,text,name,expected){
    const artifact=await compile(target,text,name),observed=await observe(target,artifact);assert.equal(observed.kind,'success','Target execution: '+target.environment);
    checkValue(observed.value,expected,text);const{path:_path,...fields}=artifact;
    return{...fields,executeMs:observed.executeMs,runtimeTrace:observed.runtimeTrace,stateRoot:observed.value.stateRoot,valueRef:addValue(observed.value)};
  }
  try{
    for(const environment of contract.environments){assert.equal(environment,'scientific-runtime');targets.push(await createPortableScientificTarget());}
    for(const target of targets){
      console.log(JSON.stringify({status:'SCIENTIFIC_TARGET_RUNNING',id:definition.id,environment:target.environment}));
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
      runtimeControl=await target.verifyRuntimeControl(artifact.path,artifact.sourceRoot);
      const malformed=path.join(temporary,target.environment+'-malformed.rcl');fs.writeFileSync(malformed,source.replace(/^reality /u,'realty '));
      let malformedRejected=false,malformedDiagnostic='';try{await target.compile(malformed,malformed+'.rbc');}catch(error){malformedDiagnostic=error.message;malformedRejected=/RCL_SEMANTIC_ASSERT: reality at/u.test(error.message);}
      const corrupt=path.join(temporary,target.environment+'-corrupt.rbc');fs.writeFileSync(corrupt,Buffer.from('RCLB'));
      let corruptRejected=false,corruptDiagnostic='';try{await target.execute(corrupt,artifact.sourceRoot);}catch(error){corruptDiagnostic=error.message;corruptRejected=/RCL_NATIVE_TRUNCATED/u.test(error.message);}
      assert.equal(malformedRejected&&corruptRejected,true);
      const performance={compileP95Ms:p95(rounds.map(item=>item.compileMs)),executeP95Ms:p95(rounds.map(item=>item.executeMs))};
      for(const field of Object.keys(performance))assert.ok(performance[field]<=contract.performanceBudget[field],field+': '+performance[field]);
      const backend={binding:target.binding,rounds,inputResults,trials,performance,runtimeControl,controllerLedger:target.controllerLedger(),observerRecords:target.observerRecords(),observerExit:await target.dispose(),
        negativeControls:{malformedRejected,malformedDiagnostic,corruptRejected,corruptDiagnostic,semanticMutationsDetected:3},
        gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,'PASS']))};
      if(definition.families.includes('distributed')){backend.networkControl=await runScientificCounterNetwork(source);await verifyScientificCounterNetwork(backend.networkControl,contract,source,definition.oracle);}
      await verifyControls(target.environment,backend,contract,values);backends[target.environment]=backend;
      console.log(JSON.stringify({status:'SCIENTIFIC_TARGET_PASS',id:definition.id,environment:target.environment,performance}));
    }
    for(const file of sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,file.path))),file.sha256,'Source changed during acquisition');
    const report={format:'rcl.k400-scientific-runtime.v1',status:'PASS_NATIVE_SCIENTIFIC_WORKBENCH',id:definition.id,generatedAt:new Date().toISOString(),
      contractRoot:contract.contractRoot,sourceHash:contract.sourceHash,casesHash:contract.casesHash,compilerHash:contract.compilerHash,
      proposalsPath,proposalsHash:sha(fs.readFileSync(path.join(ROOT,proposalsPath))),batchHash,eligibleCells:contract.eligibleCells,
      sourceBindings,backends,values,scope:contract.scope,osIsolationClaimed:false,hostedCi:'NOT_RUN_USER_INSTRUCTION',reportRoot:null};
    report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});await verifyScientificProfile(definition,report);
    fs.writeFileSync(path.join(ROOT,prefix+'-runtime.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,id:definition.id,reportRoot:report.reportRoot,eligibleCells:report.eligibleCells}));return report;
  }finally{
    for(const target of targets)await target.dispose();
    const resolved=path.resolve(temporary);assert.ok(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('rcl-scientific-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}

export async function verifyScientificProfile(definition,supplied){
  const{prefix,contract,source,cases}=validateInputs(definition);
  if(!supplied&&!fs.existsSync(path.join(ROOT,prefix+'-runtime.json')))return{admitted:false,claims:[],id:definition.id};
  const report=supplied??read(prefix+'-runtime.json'),{proposalsPath,proposals,batchHash}=validateProposals(prefix,contract);
  assert.equal(report.format,'rcl.k400-scientific-runtime.v1');assert.equal(report.status,'PASS_NATIVE_SCIENTIFIC_WORKBENCH');assert.equal(report.id,definition.id);
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
    const value=report.values[item.valueRef];assert.ok(value);assert.equal(value.stateRoot,item.stateRoot);checkValue(value,expected,text);verifyScientificRow(item,report.backends[environment].binding,value);

    for(const metric of ['compileMs','executeMs'])assert.ok(Number.isFinite(item[metric])&&item[metric]>=0);
  }
  for(const[environment,backend]of Object.entries(report.backends)){
    assert.equal(environment,'scientific-runtime');verifyScientificBinding(backend.binding,contract);
    assert.equal(backend.rounds.length,contract.rounds);assert.deepEqual(backend.rounds.map(item=>item.index),Array.from({length:contract.rounds},(_,index)=>index));
    assert.equal(new Set(backend.rounds.map(item=>item.valueRef)).size,1);
    for(const item of backend.rounds)verifyRow(environment,item,source,definition.oracle(definition.baseline));

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
        if(item.broken.kind==='success')verifyScientificRow(item.broken,backend.binding,report.values[item.broken.valueRef]);
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
    await verifyControls(environment,backend,contract,report.values);for(const gate of UNIVERSAL_STRESS_GATES)assert.equal(backend.gates[gate],'PASS');
    if(definition.families.includes('distributed'))await verifyScientificCounterNetwork(backend.networkControl,contract,source,definition.oracle);
    else assert.equal(backend.networkControl,undefined);
  }
  const all=Object.values(report.backends);assert.equal(new Set(all.map(backend=>backend.rounds[0].valueRef)).size,1);
  for(const item of cases)assert.equal(new Set(all.map(backend=>backend.inputResults[item.index].valueRef)).size,1);
  const refs=[prefix+'-contract.json',prefix+'-runtime.json',contract.casesPath,proposalsPath,proposals.acquisitionBatch];
  return{admitted:true,id:definition.id,reportRoot:report.reportRoot,eligibleCells:contract.eligibleCells,
    claims:definition.environments.flatMap(environment=>definition.families.map(programFamily=>({id:`${environment}::${programFamily}`,environment,programFamily,
      coverageMode:'native-semantic',lastVerifiedDate:'2026-10-13',changes:[],knownLimits:[contract.scope,
        '20 actual context rounds, ten pre-sealed inputs, three fresh candidate-only repairs. Noncanonical repairs additionally replay all ten sealed inputs; input-domain agreement is not full-language semantic equivalence.',
        'Native RCL program and shifted moments/regression kernel with exact binary64 data, independent actual NumPy/SciPy observation, source-owned error publication, settlement, controller reset and real observer exit; no arbitrary HPC or external effects claim.'],
      requiredGenes:['native-rcl-owned-rbc','root-v2','actual-context-controls','sealed-input-oracles','independent-repair','transaction-root-continuity'],
      gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,{status:'PASS',evidence:refs,
        note:'Actual native program/numerical-kernel traces, independent NumPy/SciPy data/result binding and worker exit, source-owned error publication/failure settlement, exact RBC parity, frozen oracles, measured budgets and unchanged independent repairs.'}]))})))};
}
