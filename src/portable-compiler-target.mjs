import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const descriptor=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))});
/** Observable RCL-authored compiler -> RBC -> native VM pipeline, without fallback. */
export function createPortableCompilerTarget(){
  if(process.platform!=='win32')throw new Error('RCL_COMPILER_PIPELINE_WINDOWS_REQUIRED');
  const compiler='native/rclc.exe',vm='native/rclvm.exe',artifact='selfhost/compiler.rbc',session=randomUUID(),ledger=[];let disposed=false;
  const binding={context:'compiler-runtime',os:process.platform,arch:process.arch,execution:'Actual RCL compiler RBC and native VM processes',runtimeOwner:'RCL_COMPILER_PIPELINE',session,
    binary:descriptor(vm),compilerBinary:descriptor(compiler),compilerArtifact:descriptor(artifact),referenceCompilationUsed:false,referenceExecutionUsed:false,externalEffectsClaimed:false,securitySandboxClaimed:false};
  function invoke(kind,executable,args,fields){
    if(disposed)throw new Error('RCL_COMPILER_PIPELINE_CLOSED');const started=performance.now(),process=spawnSync(path.join(ROOT,executable),args,{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024,timeout:60000,env:{...globalThis.process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}}),ended=performance.now();
    const record={index:ledger.length,session,kind,nonce:randomUUID(),...fields,process:{pid:process.pid,started,ended,exitObserved:process.status!==null||process.signal!==null,status:process.status,signal:process.signal,stdoutHash:sha(process.stdout??''),stderrHash:sha(process.stderr??'')},stdout:process.stdout??'',stderr:process.stderr??''};ledger.push(record);
    if(process.error||process.status!==0)throw Object.assign(new Error(record.stderr||record.stdout||process.error?.message),{pipelineFailure:structuredClone(record)});return record;
  }
  return{environment:'compiler-runtime',binding,
    compile(source,output){const text=fs.readFileSync(source,'utf8'),sourceHash=sha(text),record=invoke('compile',compiler,[path.join(ROOT,artifact),source,output],{source:text,sourceHash,compilerHash:binding.compilerBinary.sha256,compilerArtifactHash:binding.compilerArtifact.sha256});
      const metrics=JSON.parse(record.stdout),bytecode=fs.readFileSync(output);if(metrics.status!=='ok'||metrics.bytes!==bytecode.length||!(metrics.executedInstructions>0))throw new Error('RCL_COMPILER_PIPELINE_METRICS');record.metrics=metrics;record.artifactHash=sha(bytecode);record.byteLength=bytecode.length;
      return{bytecode,ms:record.process.ended-record.process.started,compilerCompileTrace:structuredClone(record)};},
    execute(file,sourceRoot){const record=invoke('execute',vm,[file],{artifactHash:sha(fs.readFileSync(file)),expectedSourceRoot:sourceRoot}),payload=JSON.parse(record.stdout);const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      record.sourceRoot=result.sourceRoot;record.stateRoot=result.stateRoot;record.value={state:result.state,stateRoot:result.stateRoot,history:result.history??[],projections:result.projections??[]};
      if(result.sourceRoot!==sourceRoot){record.rejection='RCL_PORTABLE_SOURCE_ROOT_MISMATCH';throw new Error(record.rejection);}
      return{result,ms:record.process.ended-record.process.started,compilerTrace:structuredClone(record)};},
    pipelineLedger:()=>structuredClone(ledger),dispose(){disposed=true;},
  };
}
