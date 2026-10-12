import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileReality} from '../src/compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {createPortableNativeTarget} from '../src/portable-native-vm.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {evidenceRoot,campaignCellIdFor,UNIVERSAL_STRESS_GATES} from '../src/universal-program-stress.mjs';
import {ROOT,DIRECTORY,edit,variant} from './k400-genomes/shared.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const stateRoot=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const matches=(state,expected)=>Object.entries(expected).every(([key,value])=>same(state[key],value));
const staticBindings=['scripts/k400-genome-engine.mjs','scripts/k400-genomes/shared.mjs','src/portable-native-vm.mjs',
  'src/selfhost-compiler.mjs','src/native-vm.mjs','src/compiler.mjs','src/bytecode.mjs','src/semantic-state-root.mjs','src/semantic-state-root-v2.mjs','src/canonical-f64.mjs',
  'scripts/run-native-wasi.mjs','native/rclvm.c','native/rclvm.h','native/rclc.c','native/semantic_state_v2.h','native/wasi-sha256.zig','native/wasi-compat/openssl/sha.h','native/wasi-compat/stdio-capture.c'];
const bindingFiles=definition=>[...staticBindings,definition.file];
function validateInputs(definition){
  const prefix=DIRECTORY+'/'+definition.id,contract=read(prefix+'-contract.json'),source=fs.readFileSync(path.join(ROOT,contract.sourcePath),'utf8'),cases=read(contract.casesPath);
  assert.equal(evidenceRoot({...contract,contractRoot:undefined}),contract.contractRoot);
  assert.equal(contract.format,'rcl.k400-genome-contract.v1');assert.equal(contract.id,definition.id);assert.equal(contract.frozenBeforeIndependentTrials,true);
  assert.equal(sha(source),contract.sourceHash);assert.equal(sha(fs.readFileSync(path.join(ROOT,contract.casesPath))),contract.casesHash);
  assert.equal(sha(fs.readFileSync(path.join(ROOT,contract.compilerPath))),contract.compilerHash);
  assert.equal(contract.definitionFile,definition.file);assert.equal(sha(fs.readFileSync(path.join(ROOT,definition.file))),contract.definitionHash);
  assert.deepEqual(contract.environments,definition.environments);assert.deepEqual(contract.families,definition.families);assert.deepEqual(contract.baseline,definition.baseline);
  assert.deepEqual(contract.eligibleCells,definition.environments.flatMap(environment=>definition.families.map(family=>campaignCellIdFor(environment,family))));
  assert.equal(cases.length,10);
  for(const item of cases){assert.equal(sha(variant(source,item.inputs)),item.sourceHash);assert.deepEqual(item.expected,definition.oracle(item.inputs));}
  return{prefix,contract,source,cases};
}
function checkValue(value,expected,source){
  assert.ok(matches(value.state,expected.state),'Independent oracle result');
  assert.equal(value.stateRoot,stateRoot(value.state));
  assert.deepEqual(value.history.map(record=>record.rule),expected.historyRules);
  assert.deepEqual(value.projections.map(record=>record.rule),expected.historyRules);
  const rules=compileReality(source).rules;
  let previous=structuredClone(value.state);
  for(let index=value.history.length-1;index>=0;index--){
    const record=value.history[index],projection=value.projections[index],rule=rules.find(rule=>rule.name===record.rule);
    assert.equal(record.actor,rule.cause);assert.equal(record.mode,'realize');assert.equal(record.status,'realized');
    assert.equal(record.stateRootAlgorithm,'rcl.semantic-state-root.v2');
    assert.deepEqual(record.authority.needs,rule.needs);assert.deepEqual(record.witnesses,rule.witnesses);assert.deepEqual(record.hostCalls,[]);
    assert.deepEqual(record.changes.map(change=>change.target),rule.alters.map(alter=>alter.target));
    assert.equal(record.afterRoot,stateRoot(previous));
    for(const change of record.changes){assert.deepEqual(previous[change.target],change.after);previous[change.target]=change.before;}
    assert.equal(record.beforeRoot,stateRoot(previous));
    assert.equal(projection.beforeRoot,record.beforeRoot);assert.equal(projection.afterRoot,record.afterRoot);assert.equal(projection.mode,'foresee');
    assert.equal(projection.actor,record.actor);assert.deepEqual(projection.authority,record.authority);assert.deepEqual(projection.witnesses,record.witnesses);
  }
}
function rejected(error){
  const match=/"code"\s*:\s*"([A-Z0-9_]+)"/u.exec(error.message);
  if(!match)throw error;
  return{kind:'rejected',code:match[1],diagnostic:error.message};
}
export function runGenome(definition){
  const{prefix,contract,source,cases}=validateInputs(definition);
  const proposalsPath=prefix+'-proposals.json',proposals=read(proposalsPath);
  assert.equal(proposals.contractRoot,contract.contractRoot);assert.equal(proposals.trials.length,3);
  assert.equal(new Set(proposals.trials.map(trial=>trial.context)).size,3);
  assert.equal(proposals.canonicalSourceProvided||proposals.oracleEditsProvided||proposals.holdoutTestsProvided||proposals.osIsolationClaimed,false);
  const sourceBindings=bindingFiles(definition).map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}));
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-genome-'));const targets=[];const values={},backends={};
  const addValue=value=>{const ref=evidenceRoot(value);values[ref]??=value;return ref;};
  function compile(target,text,name){
    const file=path.join(temporary,target.environment+'-'+name+'.rcl'),out=file+'.rbc';fs.writeFileSync(file,text);
    const compilation=target.compile(file,out);assert.ok(compilation.bytecode.equals(compileRealityToBytecode(text)),'Native/Bootstrap exact RBC parity');
    return{path:out,artifactHash:sha(compilation.bytecode),sourceHash:sha(text),sourceRoot:compileReality(text).programRoot,compileMs:compilation.ms};
  }
  function observe(target,artifact){
    try{const execution=target.execute(artifact.path,artifact.sourceRoot);const result=execution.result;
      return{kind:'success',executeMs:execution.ms,value:{state:result.state,stateRoot:result.stateRoot,history:result.history??[],projections:result.projections??[]}};
    }catch(error){return rejected(error);}
  }
  function row(target,text,name,expected){
    const artifact=compile(target,text,name),observed=observe(target,artifact);assert.equal(observed.kind,'success','Target execution: '+target.environment);
    checkValue(observed.value,expected,text);
    const{path:_path,...fields}=artifact;
    return{...fields,executeMs:observed.executeMs,stateRoot:observed.value.stateRoot,valueRef:addValue(observed.value)};
  }
  try{
    for(const environment of contract.environments)targets.push(createPortableNativeTarget(environment));
    for(const target of targets){
      console.log(JSON.stringify({status:'GENOME_TARGET_RUNNING',id:definition.id,environment:target.environment}));
      const expected=definition.oracle(definition.baseline),rounds=[],inputResults=[],trials=[];
      for(let index=0;index<contract.rounds;index++)rounds.push({index,...row(target,source,'round-'+index,expected)});
      assert.equal(new Set(rounds.map(item=>item.stateRoot)).size,1);
      for(const item of cases)inputResults.push({index:item.index,inputs:item.inputs,...row(target,variant(source,item.inputs),'case-'+item.index,item.expected)});
      for(const frozen of contract.trials){
        const proposalTrial=proposals.trials.find(item=>item.id===frozen.id),mutation=definition.mutations.find(item=>item.id===frozen.id);
        const mutated=edit(source,mutation.good,mutation.bad);assert.equal(sha(mutated),frozen.mutatedSourceHash);
        let broken;
        try{const brokenArtifact=compile(target,mutated,'broken-'+frozen.id);broken=observe(target,brokenArtifact);}
        catch(error){if(!/RCL_WARRANT_MISSING:/u.test(error.message))throw error;broken={kind:'compile-rejected',semanticCode:'RCL_WARRANT_MISSING',diagnostic:error.message};}
        const detected=broken.kind==='compile-rejected'?broken.semanticCode==='RCL_WARRANT_MISSING':broken.kind==='rejected'?
          ['RCL_AUTHORITY_DENIED','RCL_REALITY_BOUND_BROKEN'].includes(broken.code):!matches(broken.value.state,expected.state)||!same(broken.value.history.map(record=>record.rule),expected.historyRules);
        assert.equal(detected,true,'Effective semantic mutation: '+frozen.id);
        const repaired=edit(mutated,proposalTrial.proposal.old,proposalTrial.proposal.new);assert.equal(repaired,source,'Unchanged independent proposal must restore canonical source');
        trials.push({id:frozen.id,context:proposalTrial.context,proposal:proposalTrial.proposal,mutatedSourceHash:frozen.mutatedSourceHash,
          broken:broken.kind!=='success'?broken:{kind:'success',valueRef:addValue(broken.value)},exactCanonicalRestoration:true,
          ...row(target,repaired,'repaired-'+frozen.id,expected)});
      }
      const malformed=path.join(temporary,target.environment+'-malformed.rcl');fs.writeFileSync(malformed,source.replace(/^reality /u,'realty '));
      let malformedRejected=false,malformedDiagnostic='';try{target.compile(malformed,malformed+'.rbc');}catch(error){malformedDiagnostic=error.message;malformedRejected=/COMPILE|compil|reality/iu.test(error.message);}
      const corrupt=path.join(temporary,target.environment+'-corrupt.rbc');fs.writeFileSync(corrupt,Buffer.from('RCLB'));
      let corruptRejected=false,corruptDiagnostic='';try{target.execute(corrupt);}catch(error){corruptDiagnostic=error.message;corruptRejected=/BYTECODE|bytecode|header|truncat|magic/iu.test(error.message);}
      assert.equal(malformedRejected&&corruptRejected,true);
      const performance={compileP95Ms:p95(rounds.map(item=>item.compileMs)),executeP95Ms:p95(rounds.map(item=>item.executeMs))};
      for(const field of Object.keys(performance))assert.ok(performance[field]<=contract.performanceBudget[field]);
      backends[target.environment]={binding:target.binding,rounds,inputResults,trials,performance,negativeControls:{malformedRejected,malformedDiagnostic,corruptRejected,corruptDiagnostic,semanticMutationsDetected:3},
        gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,'PASS']))};
      console.log(JSON.stringify({status:'GENOME_TARGET_PASS',id:definition.id,environment:target.environment,performance}));
    }
    const all=Object.values(backends);assert.equal(new Set(all.map(backend=>backend.rounds[0].artifactHash)).size,1);assert.equal(new Set(all.map(backend=>backend.rounds[0].valueRef)).size,1);
    for(const item of cases)assert.equal(new Set(all.map(backend=>backend.inputResults[item.index].valueRef)).size,1);
    for(const file of sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,file.path))),file.sha256,'Source changed during acquisition');
    const report={format:'rcl.k400-genome-runtime.v1',status:'PASS_LOCAL_BOUND_TARGETS',id:definition.id,generatedAt:new Date().toISOString(),
      contractRoot:contract.contractRoot,sourceHash:contract.sourceHash,casesHash:contract.casesHash,compilerHash:contract.compilerHash,
      proposalsPath,proposalsHash:sha(fs.readFileSync(path.join(ROOT,proposalsPath))),eligibleCells:contract.eligibleCells,
      sourceBindings,backends,values,scope:contract.scope,osIsolationClaimed:false,hostedCi:'NOT_RUN_USER_INSTRUCTION',reportRoot:null};
    report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});
    fs.writeFileSync(path.join(ROOT,prefix+'-runtime.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,id:definition.id,reportRoot:report.reportRoot,eligibleCells:report.eligibleCells}));return report;
  }finally{for(const target of targets)target.dispose();fs.rmSync(temporary,{recursive:true,force:true});}
}
export function verifyGenome(definition, supplied){
  const{prefix,contract,source,cases}=validateInputs(definition);
  if(!supplied&&!fs.existsSync(path.join(ROOT,prefix+'-runtime.json')))return{admitted:false,claims:[],id:definition.id};
  const report=supplied??read(prefix+'-runtime.json'),proposals=read(report.proposalsPath);
  assert.equal(report.format,'rcl.k400-genome-runtime.v1');assert.equal(report.status,'PASS_LOCAL_BOUND_TARGETS');assert.equal(report.id,definition.id);
  assert.equal(evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined}),report.reportRoot);assert.equal(report.contractRoot,contract.contractRoot);
  for(const field of ['sourceHash','casesHash','compilerHash'])assert.equal(report[field],contract[field]);
  assert.deepEqual(report.eligibleCells,contract.eligibleCells);assert.deepEqual(Object.keys(report.backends),contract.environments);
  assert.equal(report.proposalsHash,sha(fs.readFileSync(path.join(ROOT,report.proposalsPath))));assert.equal(proposals.contractRoot,contract.contractRoot);
  assert.equal(proposals.canonicalSourceProvided||proposals.oracleEditsProvided||proposals.holdoutTestsProvided||proposals.osIsolationClaimed,false);
  assert.equal(proposals.trials.length,3);assert.equal(new Set(proposals.trials.map(item=>item.context)).size,3);
  assert.deepEqual(report.sourceBindings.map(item=>item.path),bindingFiles(definition));
  for(const item of report.sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  for(const[ref,value]of Object.entries(report.values)){assert.equal(evidenceRoot(value),ref);assert.equal(stateRoot(value.state),value.stateRoot);}
  function verifyRow(item,text,expected){
    assert.equal(item.artifactHash,sha(compileRealityToBytecode(text)));assert.equal(item.sourceHash,sha(text));assert.equal(item.sourceRoot,compileReality(text).programRoot);
    const value=report.values[item.valueRef];assert.ok(value);assert.equal(value.stateRoot,item.stateRoot);checkValue(value,expected,text);
    assert.ok(Number.isFinite(item.compileMs)&&item.compileMs>=0);assert.ok(Number.isFinite(item.executeMs)&&item.executeMs>=0);
  }
  for(const[environment,backend]of Object.entries(report.backends)){
    const binary=environment==='windows'?'native/rclvm.exe':environment==='wasm-vm'?'native/wasi/rclvm.wasm':'native/linux/rclvm';
    const compiler=['windows','wasm-vm'].includes(environment)?'native/rclc.exe':'native/linux/rclc';
    assert.equal(backend.binding.binary.path,binary);assert.equal(backend.binding.compilerBinary.path,compiler);assert.equal(backend.binding.compilerArtifact.sha256,contract.compilerHash);
    for(const item of [backend.binding.binary,backend.binding.compilerBinary,backend.binding.compilerArtifact])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
    if(environment==='android'){assert.equal(backend.binding.emulator,true);assert.equal(backend.binding.physicalDeviceClaimed,false);assert.equal(backend.binding.mobileUiClaimed,false);assert.equal(backend.binding.arch,'x86_64');}
    if(environment==='linux')assert.ok(/^Linux .* x86_64$/u.test(backend.binding.identity));
    if(environment==='windows')assert.equal(backend.binding.os,'win32');if(environment==='wasm-vm')assert.equal(backend.binding.os,'WASI');
    assert.equal(backend.rounds.length,contract.rounds);assert.deepEqual(backend.rounds.map(item=>item.index),Array.from({length:contract.rounds},(_,index)=>index));
    assert.equal(new Set(backend.rounds.map(item=>item.valueRef)).size,1);
    for(const item of backend.rounds)verifyRow(item,source,definition.oracle(definition.baseline));
    assert.equal(backend.inputResults.length,cases.length);
    for(const item of cases){const row=backend.inputResults[item.index];assert.equal(row.index,item.index);assert.deepEqual(row.inputs,item.inputs);verifyRow(row,variant(source,item.inputs),item.expected);}
    assert.equal(backend.trials.length,3);assert.equal(new Set(backend.trials.map(item=>item.context)).size,3);
    for(const frozen of contract.trials){
      const item=backend.trials.find(item=>item.id===frozen.id),proposalTrial=proposals.trials.find(item=>item.id===frozen.id),mutation=definition.mutations.find(item=>item.id===frozen.id);
      assert.equal(item.context,proposalTrial.context);assert.deepEqual(item.proposal,proposalTrial.proposal);assert.equal(item.proposal.file,'candidate.rcl');
      const mutated=edit(source,mutation.good,mutation.bad);assert.equal(sha(mutated),frozen.mutatedSourceHash);assert.equal(item.mutatedSourceHash,frozen.mutatedSourceHash);
      assert.equal(edit(mutated,item.proposal.old,item.proposal.new),source);assert.equal(item.exactCanonicalRestoration,true);
      if(item.broken.kind==='compile-rejected'){assert.equal(item.broken.semanticCode,'RCL_WARRANT_MISSING');assert.ok(/RCL_WARRANT_MISSING:/u.test(item.broken.diagnostic));}
      else if(item.broken.kind==='rejected')assert.ok(['RCL_AUTHORITY_DENIED','RCL_REALITY_BOUND_BROKEN'].includes(item.broken.code));
      else{const value=report.values[item.broken.valueRef];assert.ok(value);assert.ok(!matches(value.state,definition.oracle(definition.baseline).state)||!same(value.history.map(record=>record.rule),definition.oracle(definition.baseline).historyRules));}
      verifyRow(item,source,definition.oracle(definition.baseline));
    }
    for(const field of ['compileP95Ms','executeP95Ms']){const metric=field==='compileP95Ms'?'compileMs':'executeMs';assert.equal(backend.performance[field],p95(backend.rounds.map(item=>item[metric])));assert.ok(backend.performance[field]<=contract.performanceBudget[field]);}
    assert.equal(backend.negativeControls.malformedRejected&&backend.negativeControls.corruptRejected,true);assert.equal(backend.negativeControls.semanticMutationsDetected,3);
    for(const gate of UNIVERSAL_STRESS_GATES)assert.equal(backend.gates[gate],'PASS');
  }
  const all=Object.values(report.backends);assert.equal(new Set(all.map(backend=>backend.rounds[0].valueRef)).size,1);
  for(const item of cases)assert.equal(new Set(all.map(backend=>backend.inputResults[item.index].valueRef)).size,1);
  const refs=[prefix+'-contract.json',prefix+'-runtime.json',contract.casesPath,report.proposalsPath];
  return{admitted:true,id:definition.id,reportRoot:report.reportRoot,eligibleCells:contract.eligibleCells,
    claims:definition.environments.flatMap(environment=>definition.families.map(programFamily=>({id:`${environment}::${programFamily}`,environment,programFamily,coverageMode:'native-semantic',lastVerifiedDate:'2026-10-13',changes:[],
      knownLimits:[definition.scope,'20 actual target rounds, ten pre-sealed parametric cases, three fresh candidate-only exact repairs; local replay with no hosted CI/OS sandbox authority.',
        'Linux runs in WSL2; Android uses an x86_64 emulator. No mobile UI/physical-device or whole-family claim.'],
      requiredGenes:['portable-native-rbc','root-v2','sealed-input-oracles','independent-repair','transaction-root-continuity'],
      gates:Object.fromEntries(UNIVERSAL_STRESS_GATES.map(gate=>[gate,{status:'PASS',evidence:refs,note:'Bound native execution, independent oracles, exact RBC parity, measured budgets, effective mutations and source-declared transaction evidence.'}]))})))};
}
