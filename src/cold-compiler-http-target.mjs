import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {createResidentCompilerHttpTarget} from './resident-compiler-http-target.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const artifact=file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file))),bytes:fs.statSync(path.join(ROOT,file)).size});

/** A fresh local HTTP worker and native compiler per call; results follow clean exits. */
export async function createColdCompilerHttpTarget(){
  if(process.platform!=='win32')throw new Error('RCLC_COLD_WINDOWS_REQUIRED');
  const binding={owner:'RCL_COLD_COMPILER_HTTP',environment:'serverless',transport:'FRESH_AUTHENTICATED_HTTP_LOOPBACK',
    compiler:artifact('native/sequence-compiler/rclcd.exe'),vm:artifact('native/rclvm.exe'),
    referenceCompilationUsed:false,referenceExecutionUsed:false,warmReuse:false,
    cloudDeploymentClaimed:false,securitySandboxClaimed:false};
  let closed=false,busy=false,sequence=0,active;
  async function invoke(operation){
    if(closed)throw new Error('RCLC_COLD_CLOSED');
    if(busy)throw new Error('RCLC_COLD_BACKPRESSURE');
    busy=true;
    active=(async()=>{
      const started=performance.now(),invocation={format:'rcl.cold-compiler-invocation.v1',id:randomUUID(),sequence:++sequence};
      let service,result,failure;
      try{
        service=await createResidentCompilerHttpTarget();invocation.service=service.binding;
        if(!isDeepStrictEqual(service.binding.compiler.binary,binding.compiler)||!isDeepStrictEqual(service.binding.vm,binding.vm))throw new Error('RCLC_COLD_ARTIFACT_CHANGED');
        result=await operation(service);
      }catch(error){failure=error;}
      finally{
        if(service)try{
          invocation.exit=await service.dispose();
          if(invocation.exit.pid!==service.binding.serverPid||invocation.exit.code!==0||invocation.exit.signal!==null||
            invocation.exit.compilerExit?.pid!==service.binding.compiler.pid||invocation.exit.compilerExit.code!==0||invocation.exit.compilerExit.signal!==null)throw new Error('RCLC_COLD_EXIT_BINDING');
          invocation.exitObservedBeforeResult=true;
        }catch(error){if(failure)error.operationFailure={code:failure.code??null,message:failure.message};failure=error;}
        invocation.ms=performance.now()-started;busy=false;
      }
      if(failure){failure.coldInvocation=invocation;throw failure;}
      return{...result,coldInvocation:invocation,ms:invocation.ms};
    })();
    return active;
  }
  return{environment:'serverless',binding,
    async compile(compilerFile,sourceFile,outputFile){
      const result=await invoke(service=>service.compile(compilerFile,sourceFile));
      if(outputFile)fs.writeFileSync(outputFile,result.bytecode);return result;
    },
    execute:(file,sourceRoot)=>invoke(service=>service.execute(file,sourceRoot)),
    verifyUnauthorizedRejection:()=>invoke(async service=>{
      const before=await service.inspectHealth(),unauthorized=await service.verifyUnauthorizedRejection(),after=await service.inspectHealth();
      if(JSON.stringify(before.reply)!==JSON.stringify(after.reply))throw new Error('RCLC_COLD_DENIED_REQUEST_CHANGED_HEALTH');
      return{before,unauthorized,after};
    }),
    async dispose(){closed=true;if(active)await active.catch(()=>{});},
  };
}
