import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ROOT} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),describe=file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))});
const base=fs.readFileSync(path.join(ROOT,'native/rclvm.c'),'utf8'),patch=fs.readFileSync(path.join(ROOT,'native/sequence-runtime/concat-case.c'),'utf8');
assert.equal(sha(fs.readFileSync(path.join(ROOT,'native/rclvm.c'))),'0214c1715b5fcd1e275e213ee0ee0897e61f08b73ffef137e62d306761837156');
const start=base.indexOf('    case BUILTIN_SEQUENCE_CONCAT:'),end=base.indexOf('    case BUILTIN_BYTES_U8:',start);assert.ok(start>0&&end>start);
const directory=path.join(ROOT,'output/sequence-portable');fs.mkdirSync(directory,{recursive:true});
const source=path.join(directory,'rclvm.c');fs.writeFileSync(source,base.slice(0,start)+patch+'\n'+base.slice(end));
const zig=process.env.ZIG??path.join(ROOT,'_tools/zig-x86_64-windows-0.16.0/zig.exe'),cache=path.join(process.env.LOCALAPPDATA??directory,'RCL/sequence-zig-cache');
const env={...process.env,ZIG_GLOBAL_CACHE_DIR:process.env.ZIG_GLOBAL_CACHE_DIR??path.join(cache,'global'),ZIG_LOCAL_CACHE_DIR:process.env.ZIG_LOCAL_CACHE_DIR??path.join(cache,'local')},commands=[],artifacts=[];
const version=spawnSync(zig,['version'],{encoding:'utf8',windowsHide:true});assert.equal(version.status,0);
function run(args){const r=spawnSync(zig,args,{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024,env});commands.push({args,status:r.status,stdoutHash:sha(r.stdout??''),stderrHash:sha(r.stderr??'')});if(r.error||r.status!==0)throw new Error('RCL_SEQUENCE_PORTABLE_BUILD:'+String(r.stderr??r.error));}
for(const[target,label]of [['x86_64-linux-musl','linux'],['wasm32-wasi','wasi']]){
  const out=path.join(directory,label);fs.mkdirSync(out,{recursive:true});const object=path.join(out,'sha256.o');
  run(['build-obj','native/wasi-sha256.zig','-target',target,'-O','ReleaseSmall','-femit-bin='+object]);
  const common=['cc','-target',target,'-std=c11','-O2','-I',path.join(ROOT,'native'),'-I',path.join(ROOT,'native/wasi-compat')];
  const compat=label==='wasi'?[path.join(ROOT,'native/wasi-compat/stdio-capture.c')]:[];
  const vm=path.join(out,label==='wasi'?'rclvm.wasm':'rclvm'),compiler=path.join(out,label==='wasi'?'rclc.wasm':'rclc');
  run([...common,source,...compat,object,'-lm','-o',vm]);
  run([...common,'-DRCLVM_EMBEDDED_ONLY',...(label==='wasi'?['-D_WASI_EMULATED_GETPID']:[]),source,path.join(ROOT,'native/rclc.c'),...compat,object,...(label==='wasi'?['-lwasi-emulated-getpid']:[]),'-lm','-o',compiler]);
  artifacts.push({environment:label,vm:describe(vm),compiler:describe(compiler)});console.log(JSON.stringify({phase:'built',environment:label}));
}
const sourcePaths=['native/rclvm.c','native/rclvm.h','native/rclc.c','native/semantic_state_v2.h','native/sequence-runtime/concat-case.c','native/wasi-sha256.zig','native/wasi-compat/openssl/sha.h','native/wasi-compat/stdio-capture.c','scripts/build-native-sequence-portable.mjs'];
const report={format:'rcl.native-sequence-portable-build.v1',status:'BUILT_CANDIDATE_NOT_RUNTIME_VERIFIED',generatedSourceHash:sha(fs.readFileSync(source)),sourceBindings:sourcePaths.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))})),toolchain:{...describe(zig),version:version.stdout.trim()},commands,artifacts,scope:'Separate Linux-musl and WASI candidates using the same generic persistent Sequence overlay; original native and WASI anchors unchanged'};
fs.writeFileSync(path.join(directory,'build.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,artifacts}));
