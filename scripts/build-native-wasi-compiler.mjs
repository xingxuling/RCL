import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const ROOT=path.resolve(import.meta.dirname,'..');
const candidates=[process.env.ZIG,path.join(ROOT,'_tools/zig-x86_64-windows-0.16.0/zig.exe'),'zig'].filter(Boolean);
const zig=candidates.find(file=>spawnSync(file,['version'],{windowsHide:true}).status===0);if(!zig)throw new Error('RCL_WASI_COMPILER_ZIG_MISSING');
const directory=path.join(ROOT,'native/wasi-compiler');fs.mkdirSync(directory,{recursive:true});
const env={...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(ROOT,'_tools/zig-global-cache'),ZIG_LOCAL_CACHE_DIR:path.join(ROOT,'_tools/zig-local-cache')};
const run=args=>{const result=spawnSync(zig,args,{cwd:ROOT,env,encoding:'utf8',timeout:120000,windowsHide:true});if(result.status!==0)throw new Error(result.stderr||result.stdout||result.error?.message);};
const object=path.join(ROOT,'build/wasi-compiler-sha256.o');fs.mkdirSync(path.dirname(object),{recursive:true});
run(['build-obj','native/wasi-sha256.zig','-target','wasm32-wasi','-O','ReleaseSmall','-femit-bin='+object]);
const binary=path.join(directory,'rclc.wasm');
run(['cc','-target','wasm32-wasi','-std=c11','-O2','-DRCLVM_EMBEDDED_ONLY','-D_WASI_EMULATED_GETPID','-I','native/wasi-compat',
  'native/rclvm.c','native/rclc.c','native/wasi-compat/stdio-capture.c',object,'-lwasi-emulated-getpid','-lm','-o',binary]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=['native/rclvm.c','native/rclvm.h','native/rclc.c','native/semantic_state_v2.h','native/wasi-sha256.zig',
  'native/wasi-compat/openssl/sha.h','native/wasi-compat/stdio-capture.c','scripts/build-native-wasi-compiler.mjs'];
const manifest={format:'rcl.native-wasi-compiler-build.v1',status:'BUILT_NOT_RUNTIME_VERIFIED',target:'wasm32-wasi',
  zigVersion:spawnSync(zig,['version'],{encoding:'utf8',windowsHide:true}).stdout.trim(),
  sources:sources.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))})),
  binary:{path:'native/wasi-compiler/rclc.wasm',bytes:fs.statSync(binary).size,sha256:sha(fs.readFileSync(binary))},
  compilerOwner:'RCL-authored compiler RBC through unchanged native/rclc.c host adapter',getpid:'WASI-libc emulated PID; no physical process identity claim'};
fs.writeFileSync(path.join(directory,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,binary:manifest.binary,sourceFiles:sources.length}));
