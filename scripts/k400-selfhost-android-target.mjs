import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ROOT} from './k400-genomes/shared.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ADB='C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe';
// ADAPT of portable-native-vm's verified flat Android transfer ownership. Every
// compile accepts the preceding generation as input; no host compilation path.
export async function createSelfhostTarget(environment,contract,directory){
  assert.equal(environment,'android');assert.ok(contract.environments.includes(environment));
  const runtime=contract.runtimeArtifacts.find(r=>r.environment==='android');assert.ok(runtime);
  for(const item of [runtime.vm,runtime.compiler])assert.equal(sha(fs.readFileSync(path.join(ROOT,item.path))),item.sha256);
  const serial=contract.deviceSerial??'emulator-5556';assert.equal(serial,'emulator-5556');
  const session=randomUUID(),remoteRoot='/data/local/tmp/rcl-selfhost-'+session,owned=new Set(),ledger=[],commands=[];
  function remote(name){assert.match(name,/^[a-zA-Z0-9_.-]+$/u);const result=remoteRoot+'/'+name;assert.ok(result.startsWith(remoteRoot+'/'));owned.add(result);return result;}
  async function adb(args){
    const index=commands.length,started=performance.now(),nonce=randomUUID();
    const value=await new Promise(resolve=>{const child=execFile(ADB,['-s',serial,...args],{encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:64*1024*1024},(error,stdout,stderr)=>resolve({pid:child.pid,status:error?(typeof error.code==='number'?error.code:null):0,signal:error?.signal??null,stdout,stderr,error:error?.message??null}));});
    const item={index,nonce,command:ADB,args:['-s',serial,...args],started,ended:performance.now(),...value};item.stdoutHash=sha(item.stdout);item.stderrHash=sha(item.stderr);commands.push(item);
    if(value.status!==0){const error=new Error(value.stdout+'\n'+value.stderr+'\n'+(value.error??''));error.commandIndex=index;throw error;}
    return item;
  }
  async function push(file,destination){await adb(['push',file,destination]);const checked=await adb(['shell','sha256sum',destination]);assert.equal(checked.stdout.slice(0,64),sha(fs.readFileSync(file)));}
  assert.equal((await adb(['get-state'])).stdout.trim(),'device');
  const device={serial,api:(await adb(['shell','getprop','ro.build.version.sdk'])).stdout.trim(),abi:(await adb(['shell','getprop','ro.product.cpu.abi'])).stdout.trim(),arch:(await adb(['shell','uname','-m'])).stdout.trim(),fingerprint:(await adb(['shell','getprop','ro.build.fingerprint'])).stdout.trim(),emulator:(await adb(['shell','getprop','ro.kernel.qemu'])).stdout.trim()==='1'};
  assert.equal(device.api,'35');assert.equal(device.abi,'x86_64');assert.equal(device.arch,'x86_64');assert.equal(device.emulator,true);
  if(contract.devicePolicy)assert.deepEqual(device,contract.devicePolicy);
  await adb(['shell','mkdir',remoteRoot]);const vm=remote('rclvm'),compiler=remote('rclc');
  async function cleanup(){for(const file of owned){assert.ok(file.startsWith(remoteRoot+'/'));await adb(['shell','rm','-f',file]);}await adb(['shell','rmdir',remoteRoot]);}
  try{await push(path.join(ROOT,runtime.vm.path),vm);await push(path.join(ROOT,runtime.compiler.path),compiler);await adb(['shell','chmod','755',vm,compiler]);}catch(error){try{await cleanup();}catch(failure){error.cleanupError=failure.message;}throw error;}
  const binding={environment,session,runtime,acquisitionRoot:path.resolve(ROOT),referenceCompilationUsed:false,referenceExecutionUsed:false,compilerSemanticsOwner:'RCL_GENERAL_COMPILER_SOURCE',compilerLocation:'ANDROID_TARGET_NATIVE_C_ABI_RCL_COMPILER_RBC',hostCompilationFallback:false,device,remoteRoot,adb:{path:ADB,sha256:sha(fs.readFileSync(ADB))},hostEffects:'Owned local outputs and individually tracked flat Android temporary files only',securitySandboxClaimed:false,physicalDeviceClaimed:false,mobileUiClaimed:false};
  function command(binary,args){for(const value of [binary,...args])assert.match(value,/^\/data\/local\/tmp\/rcl-selfhost-[a-f0-9-]+\/[a-zA-Z0-9_.-]+$/u);return 'printf \'RCL_TARGET_PID:%s\\n\' "$$" >&2; exec env RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2 RCLC_OUTPUT_STATE=compiler.output '+[binary,...args].join(' ');}
  async function call(kind,{compilerFile,sourceFile,outputFile,artifactFile,sourceRoot}){
    const started=performance.now(),index=ledger.length,nonce=randomUUID(),start=commands.length;
    const trace={index,nonce,session,environment,kind,inputCompilerHash:kind==='compile'?sha(fs.readFileSync(compilerFile)):null,source:sourceFile?fs.readFileSync(sourceFile,'utf8'):null,sourceHash:sourceFile?sha(fs.readFileSync(sourceFile)):null,artifactHash:artifactFile?sha(fs.readFileSync(artifactFile)):null,sourceRoot:sourceRoot??null};
    try{
      let text,remoteOutput;
      if(kind==='compile'){
        assert.ok(path.resolve(outputFile).startsWith(path.resolve(directory)+path.sep));if(fs.existsSync(outputFile))fs.unlinkSync(outputFile);
        const input=remote(trace.inputCompilerHash+'.rbc'),source=remote(trace.sourceHash+'.rcl');remoteOutput=remote(nonce+'.rbc');await push(compilerFile,input);await push(sourceFile,source);text=command(compiler,[input,source,remoteOutput]);
      }else{const input=remote(trace.artifactHash+'.rbc');await push(artifactFile,input);text=command(vm,[input]);}
      trace.invocationIndex=commands.length;let invocation;
      try{invocation=await adb(['shell',text]);}catch(error){invocation=commands[error.commandIndex];Object.assign(trace,{command:ADB,args:invocation.args,hostProcessPid:invocation.pid,status:invocation.status,signal:invocation.signal,exitObserved:invocation.status!==null,stdout:invocation.stdout,stderr:invocation.stderr});throw error;}
      Object.assign(trace,{command:ADB,args:invocation.args,hostProcessPid:invocation.pid,status:invocation.status,signal:invocation.signal,exitObserved:true,stdout:invocation.stdout,stderr:invocation.stderr});
      if(kind==='compile'){
        trace.metrics=JSON.parse(trace.stdout);await adb(['pull',remoteOutput,path.resolve(outputFile)]);const bytes=fs.readFileSync(outputFile);trace.outputHash=sha(bytes);trace.outputBytes=bytes.length;trace.remoteOutputHash=(await adb(['shell','sha256sum',remoteOutput])).stdout.slice(0,64);assert.equal(trace.remoteOutputHash,trace.outputHash);
      }else{trace.result=verifyNativeSemanticStateRoot(JSON.parse(trace.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});assert.equal(trace.result.sourceRoot,sourceRoot);}
      trace.pid=Number(/^RCL_TARGET_PID:([0-9]+)\r?$/mu.exec(trace.stderr)?.[1]);assert.ok(Number.isInteger(trace.pid)&&trace.pid>0);
      trace.stdoutHash=sha(trace.stdout);trace.stderrHash=sha(trace.stderr);trace.ms=performance.now()-started;trace.adbRange={start,end:commands.length};ledger.push(trace);return trace;
    }catch(error){
      trace.pid=Number(/^RCL_TARGET_PID:([0-9]+)\r?$/mu.exec(trace.stderr??'')?.[1]);trace.stdoutHash=sha(trace.stdout??'');trace.stderrHash=sha(trace.stderr??'');trace.ms=performance.now()-started;trace.adbRange={start,end:commands.length};trace.error={code:error.code??null,message:error.message};ledger.push(trace);throw Object.assign(error,{traceIndex:index});
    }
  }
  return{binding,ledger:()=>structuredClone(ledger),commands:()=>structuredClone(commands),compile:(compilerFile,sourceFile,outputFile)=>call('compile',{compilerFile,sourceFile,outputFile}),execute:(artifactFile,sourceRoot)=>call('execute',{artifactFile,sourceRoot}),dispose:cleanup};
}
