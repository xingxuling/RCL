import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {compileReality} from '../compiler.mjs';
import {compileRealityToBytecode} from '../bytecode.mjs';
import {createPortableNativeTarget} from '../portable-native-vm.mjs';
import {lowerNativeUiEvent,projectNativeUiResult} from './native-event-lowering.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>Object.assign(new Error(code),{code});
export const nativeUiExecutionErrorCode=error=>/"code"\s*:\s*"([A-Z0-9_]+)"/u.exec(error.message)?.[1]??/\b(RCL_AUTHORITY_DENIED)\b/u.exec(error.message)?.[1]??error.code??null;
/** Current UI state and render properties only come from the selected RCL target. */
export async function createNativeUiEventRuntime(source,{factory=()=>createPortableNativeTarget('windows')}={}){
  const target=await factory(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-ui-native-')),ledger=[],failures=[];let projection,state,revision=0,busy=false,closed=false;
  async function run(event,authorized=true){
    const started=performance.now(),lowered=lowerNativeUiEvent(source,{state,event,authorized}),file=path.join(directory,randomUUID()+'.rcl'),artifact=file+'.rbc';fs.writeFileSync(file,lowered.source);
    const compiled=await target.compile(file,artifact);if(!compiled.bytecode.equals(compileRealityToBytecode(lowered.source)))throw fail('RCL_UI_NATIVE_BYTE_PARITY');const sourceRoot=compileReality(lowered.source).programRoot;
    let executed;
    try{executed=await target.execute(artifact,sourceRoot);}catch(error){failures.push({index:failures.length,event:structuredClone(event),authorized,source:lowered.source,sourceHash:sha(lowered.source),sourceRoot,artifactHash:sha(compiled.bytecode),
      beforeState:lowered.beforeState,beforeStateRoot:lowered.beforeStateRoot,code:nativeUiExecutionErrorCode(error),diagnostic:error.message,
      contextFailure:error.realtimeFailure??error.scientificFailure??error.aiFailure??null});throw error;}
    const next=projectNativeUiResult(lowered,executed.result);
    const record={index:ledger.length,event,authorized,uiSourceHash:sha(source),uiRoot:lowered.ui.semanticRoot,source:lowered.source,sourceHash:sha(lowered.source),sourceRoot,artifactHash:sha(compiled.bytecode),
      beforeState:lowered.beforeState,beforeStateRoot:lowered.beforeStateRoot,projection:next,nativeResult:executed.result,compileMs:compiled.ms,executeMs:executed.ms,totalMs:performance.now()-started,
      compilation:compiled,runtime:executed};
    // Keep bytecode/artifact locations out of the durable receipt, not out of execution.
    delete record.compilation.bytecode;delete record.runtime.result;ledger.push(record);state=next.state;projection=next;return record;
  }
  try{await run(null);}catch(error){await target.dispose();fs.rmSync(directory,{recursive:true,force:true});throw error;}
  return{target,ui:lowerNativeUiEvent(source).ui,
    snapshot:()=>({...structuredClone(projection),revision}),ledger:()=>structuredClone(ledger),failures:()=>structuredClone(failures),
    async dispatch(event,{expectedStateRoot=null,authorized=true}={}){
      if(closed)throw fail('RCL_UI_NATIVE_CLOSED');if(busy)throw fail('RCL_UI_NATIVE_BACKPRESSURE');if(expectedStateRoot&&expectedStateRoot!==projection.stateRoot)throw fail('RCL_UI_NATIVE_STALE_STATE');busy=true;
      try{const record=await run(event,authorized);revision++;return record;}finally{busy=false;}
    },
    async dispose(){closed=true;while(busy)await new Promise(r=>setTimeout(r,1));await target.dispose();const absolute=path.resolve(directory);if(path.dirname(absolute)!==path.resolve(os.tmpdir())||!path.basename(absolute).startsWith('rcl-ui-native-'))throw fail('RCL_UI_NATIVE_TEMP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
  };
}
