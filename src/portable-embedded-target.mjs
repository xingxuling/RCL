import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {EmbeddedNativeVm} from './embedded-vm.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Reuse the native daemon's caller-owned RclVmInstance through its C ABI protocol. */
export function createPortableEmbeddedTarget(){
  const compiler=createPortableNativeTarget('windows'),daemon=path.join(ROOT,'native/rclvmd.exe');
  let instance,loadedHash,runs=0;
  async function close(){
    if(!instance)return;
    if(instance.process.exitCode!==null){instance.lines.close();instance=undefined;return;}
    await instance.close();instance=undefined;loadedHash=undefined;
  }
  return{environment:'embedded-runtime',binding:{...compiler.binding,context:'embedded-runtime',execution:'Caller-owned native C ABI instance via rclvmd RUN_RESET',
      binary:{path:'native/rclvmd.exe',sha256:sha(fs.readFileSync(daemon))},protocol:'RCL_NATIVE_DAEMON_C_ABI',microcontrollerOrHardwareClaimed:false},
    compile(source,output){return compiler.compile(source,output);},
    async execute(file,expectedSourceRoot){
      const started=performance.now(),artifactHash=sha(fs.readFileSync(file));
      if(artifactHash!==loadedHash){await close();instance=new EmbeddedNativeVm(file,{daemonPath:daemon});loadedHash=artifactHash;await instance.ready;}
      const reply=await instance.run({resetState:true});
      if(reply.result?.status!=='ok'){
        const body=reply.result??reply;const error=new Error(JSON.stringify(body));error.code=body.code??'RCL_EMBEDDED_REJECTED';throw error;
      }
      const result=verifyNativeSemanticStateRoot(reply.result,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(expectedSourceRoot&&result.sourceRoot!==expectedSourceRoot)throw new Error('RCL_EMBEDDED_SOURCE_ROOT_MISMATCH');
      runs++;return{result,ms:performance.now()-started,instancePid:instance.process.pid,instanceRun:runs};
    },
    inspectInstance(){return{pid:instance?.process.pid,artifactHash:loadedHash,runs,live:instance?.process.exitCode===null};},
    async verifyReset(file,expectedSourceRoot){const first=await this.execute(file,expectedSourceRoot),next=await this.execute(file,expectedSourceRoot);
      if(first.instancePid!==next.instancePid||first.result.stateRoot!==next.result.stateRoot)throw new Error('RCL_EMBEDDED_RESET_OR_INSTANCE_REUSE_FAILED');
      return{status:'PASS',sameInstance:true,stateRoot:first.result.stateRoot,instancePid:first.instancePid,
        firstRun:first.instanceRun,nextRun:next.instanceRun,sourceRoot:first.result.sourceRoot};},
    async dispose(){await close();compiler.dispose();},
  };
}
