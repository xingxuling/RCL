import {WASI,File,OpenFile,ConsoleStdout,PreopenDirectory,wasi as definitions} from './shim/index.js';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
const load=async file=>{const bytes=new Uint8Array(await(await fetch(file)).arrayBuffer());return{hash:await sha(bytes),module:await WebAssembly.compile(bytes)};};
const vm=await load('./vm.wasm'),compiler=await load('./compiler.wasm');
const pageToken=crypto.randomUUID();let executions=0;
const decode=chunks=>{const joined=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(joined);};
async function runWasi(module,args,contents){
  const stdout=[],stderr=[],calls={},work=new Map(contents);
  const wasi=new WASI(args,['RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2','TMPDIR=/work'],[
    new OpenFile(new File([])),new ConsoleStdout(bytes=>stdout.push(Uint8Array.from(bytes))),new ConsoleStdout(bytes=>stderr.push(Uint8Array.from(bytes))),
    new PreopenDirectory('/work',work),new PreopenDirectory('/tmp',[])
  ]);
  // The upstream shim leaves path_rename unsupported. Move the actual file
  // within the explicitly opened, ephemeral in-memory directory objects.
  wasi.wasiImport.path_rename=(oldFd,oldPointer,oldLength,newFd,newPointer,newLength)=>{
    const memory=new Uint8Array(wasi.inst.exports.memory.buffer),decoder=new TextDecoder();
    const oldName=decoder.decode(memory.slice(oldPointer,oldPointer+oldLength)),newName=decoder.decode(memory.slice(newPointer,newPointer+newLength));
    const oldDirectory=wasi.fds[oldFd]?.dir?.contents,newDirectory=wasi.fds[newFd]?.dir?.contents;
    if(!oldDirectory||!newDirectory)return definitions.ERRNO_BADF;
    if(!/^[A-Za-z0-9_.-]+$/u.test(oldName)||!/^[A-Za-z0-9_.-]+$/u.test(newName))return definitions.ERRNO_NOTSUP;
    const entry=oldDirectory.get(oldName);if(!entry)return definitions.ERRNO_NOENT;
    if(oldDirectory===newDirectory&&oldName===newName)return definitions.ERRNO_SUCCESS;
    newDirectory.set(newName,entry);oldDirectory.delete(oldName);return definitions.ERRNO_SUCCESS;
  };
  const imports={};for(const[name,operation]of Object.entries(wasi.wasiImport))imports[name]=(...args)=>{calls[name]=(calls[name]??0)+1;return operation(...args);};
  const instance=await WebAssembly.instantiate(module,{wasi_snapshot_preview1:imports});
  const started=performance.now(),exitCode=wasi.start(instance),executionMs=performance.now()-started;executions++;
  return{stdout:decode(stdout),stderr:decode(stderr),exitCode,executionMs,pageToken,instance:executions,userAgent:navigator.userAgent,wasiCalls:calls,work};
}
window.rclBrowserRuntime={
  ready:true,pageToken,wasmHash:vm.hash,compilerHash:compiler.hash,userAgent:navigator.userAgent,
  async execute({bytes,artifactHash,nonce}){
    const bytecode=new Uint8Array(bytes);if(await sha(bytecode)!==artifactHash)throw new Error('RCL_BROWSER_ARTIFACT_HASH_MISMATCH');
    const observed=await runWasi(vm.module,['rclvm','/work/program.rbc'],[['program.rbc',new File(bytecode)]]);
    return{...observed,work:undefined,artifactHash,wasmHash:vm.hash,nonce,executionOwner:'RCL_C_VM_BROWSER_WEBASSEMBLY'};
  },
  async compile({source,sourceHash,compilerBytes,compilerArtifactHash,nonce}){
    const sourceBytes=new TextEncoder().encode(source),artifact=new Uint8Array(compilerBytes);
    if(await sha(sourceBytes)!==sourceHash||await sha(artifact)!==compilerArtifactHash)throw new Error('RCL_BROWSER_COMPILER_INPUT_BINDING');
    const observed=await runWasi(compiler.module,['rclc','/work/compiler.rbc','/work/source.rcl','/work/output.rbc'],[
      ['source.rcl',new File(sourceBytes)],['compiler.rbc',new File(artifact)]
    ]);
    const output=observed.work.get('output.rbc')?.data;
    return{...observed,work:undefined,bytecode:output?Array.from(output):null,artifactHash:output?await sha(output):null,
      sourceHash,compilerHash:compiler.hash,compilerArtifactHash,nonce,executionOwner:'RCL_COMPILER_RBC_BROWSER_WEBASSEMBLY'};
  }
};
document.querySelector('#runtime-status').textContent='浏览器编译与运行环境已就绪';
