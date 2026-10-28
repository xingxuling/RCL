import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ROOT} from './k400-genomes/shared.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const basePath='native/sequence-runtime/frozen-rclvm.c',patchPath='native/sequence-runtime/concat-case.c';
const base=fs.readFileSync(path.join(ROOT,basePath),'utf8'),patch=fs.readFileSync(path.join(ROOT,patchPath),'utf8');
assert.equal(sha(fs.readFileSync(path.join(ROOT,basePath))),'0214c1715b5fcd1e275e213ee0ee0897e61f08b73ffef137e62d306761837156','Frozen native source must match the overlay donor');
const start=base.indexOf('    case BUILTIN_SEQUENCE_CONCAT:'),end=base.indexOf('    case BUILTIN_BYTES_U8:',start);
assert.ok(start>0&&end>start);assert.equal(base.indexOf('    case BUILTIN_SEQUENCE_CONCAT:',start+1),-1);
const directory=path.join(ROOT,'output/native-sequence-runtime');fs.mkdirSync(directory,{recursive:true});
const sourcePath=path.join(directory,'rclvm.c');fs.writeFileSync(sourcePath,base.slice(0,start)+patch+'\n'+base.slice(end));
const zig=process.env.ZIG??path.join(ROOT,'_tools/zig-x86_64-windows-0.16.0/zig.exe');
const cacheRoot=path.join(process.env.LOCALAPPDATA??directory,'RCL/sequence-zig-cache');
const env={...process.env,ZIG_GLOBAL_CACHE_DIR:process.env.ZIG_GLOBAL_CACHE_DIR??path.join(cacheRoot,'global'),ZIG_LOCAL_CACHE_DIR:process.env.ZIG_LOCAL_CACHE_DIR??path.join(cacheRoot,'local')};
const version=spawnSync(zig,['version'],{encoding:'utf8',windowsHide:true});assert.equal(version.status,0);
assert.equal(process.platform,'win32','Initial candidate is Windows only');
const common=['cc','-target','x86_64-windows-gnu','-O3','-std=c11','-Wall','-Wextra','-Wpedantic','-I',path.join(ROOT,'native')],commands=[],artifacts=[];
for(const[name,args]of [
  ['rclvm-frozen.exe',[path.join(ROOT,basePath)]],
  ['rclvm.exe',[sourcePath]],
  ['rclc.exe',['-DRCLVM_EMBEDDED_ONLY',path.join(ROOT,'native/rclc.c'),sourcePath]],
]){
  const output=path.join(directory,name),argv=[...common,...args,'-o',output,'-lbcrypt','-lm'],run=spawnSync(zig,argv,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024,env});
  commands.push({argv,status:run.status,stdoutHash:sha(run.stdout??''),stderrHash:sha(run.stderr??'')});
  if(run.error||run.status!==0)throw new Error('RCL_SEQUENCE_BUILD_FAILED:'+String(run.stderr??run.error));
  artifacts.push({path:path.relative(ROOT,output).replaceAll('\\','/'),bytes:fs.statSync(output).size,sha256:sha(fs.readFileSync(output))});
}
const bindings=[basePath,patchPath,'native/rclvm.h','native/semantic_state_v2.h','native/rclc.c','scripts/build-native-sequence-runtime.mjs'].map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));
const receipt={format:'rcl.native-sequence-runtime-build.v1',status:'BUILT_CANDIDATE',scope:'Windows candidate generic persistent Sequence concatenation overlay; original compiler/runtime and all K400 anchors preserved',sourceBindings:bindings,generatedSourceHash:sha(fs.readFileSync(sourcePath)),toolchain:{path:zig,version:version.stdout.trim(),sha256:sha(fs.readFileSync(zig))},commands,artifacts};
fs.writeFileSync(path.join(directory,'build.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,artifacts}));
