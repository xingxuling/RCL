import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),dir='native/gpu-text-runtime';
const donors=['native/gpu-runtime/rcl-stack-vm.cl','native/gpu-runtime/provider.py','src/portable-gpu-target.mjs'];
const bindings=donors.map(path=>({path,sha256:sha(fs.readFileSync(path))}));
function replace(source,from,to){assert.equal(source.split(from).length,2,from.slice(0,90));return source.replace(from,to);}
let kernel=fs.readFileSync(donors[0],'utf8');
kernel=replace(kernel,'int truth(__global Value *values,int id) {',fs.readFileSync(dir+'/device-text.cl','utf8')+'\nint truth(__global Value *values,int id) {');
kernel=replace(kernel,'__global int *records) {','__global int *records,int initial_text_bytes,int text_capacity,__global int *scratch) {');
kernel=replace(kernel,'Frame frames[FRAME_LIMIT];values[0]','int text_used=initial_text_bytes;\n  Frame frames[FRAME_LIMIT];values[0]');
kernel=replace(kernel,'if(values[left].type!=1||values[right].type!=1){error=6;break;}\n        if((ins.op==9||ins.op==44)',
 'if(ins.op==6&&(values[left].type==3||values[right].type==3)){stack[sp++]=text_join(values,&used,text,&text_used,text_capacity,left,right,&error);break;}\n        if(values[left].type!=1||values[right].type!=1){error=6;break;}\n        if((ins.op==9||ins.op==44)');
// The same type guard also occurs in comparisons; replace only its arithmetic occurrence above.
kernel=replace(kernel,'if(ins.a==12){',`if((ins.a>=1&&ins.a<=10&&ins.a!=4)||(ins.a>=15&&ins.a<=20)){
          int args[3];for(int i=ins.b-1;i>=0;i--)args[i]=stack[--sp];
          stack[sp++]=text_builtin(ins.a,ins.b,args,values,&used,text,&text_used,text_capacity,&error);
        }else if(ins.a==62){
          right=stack[--sp];left=stack[--sp];
          if(values[left].type!=4||values[right].type!=4){error=9;break;}
          int count=values[right].length,cursor=right;for(int i=0;i<count;i++){scratch[i]=values[cursor].tail;cursor=values[cursor].parent;}
          id=left;for(int i=count-1;i>=0&&!error;i--){int next=alloc_value(values,&used,4,0,&error);if(error)break;values[next].parent=id;values[next].tail=scratch[i];values[next].length=values[id].length+1;id=next;}stack[sp++]=id;
        }else if(ins.a==12){`);
kernel=replace(kernel,'for(int i=0;i<warrant_count*3;i++)result[7+i]=warrants[i];','for(int i=0;i<warrant_count*3;i++)result[7+i]=warrants[i];\n  result[7+WARRANT_LIMIT*3]=text_used;');
const assembled='// Generated from pinned donor and separate Ryu/device Text sources.\n#pragma OPENCL EXTENSION cl_khr_fp64 : enable\n#pragma OPENCL FP_CONTRACT OFF\n'+fs.readFileSync(dir+'/ryu-opencl.cl','utf8')+'\n'+kernel;
fs.writeFileSync(dir+'/rcl-text-stack-vm.cl',assembled);
let provider=fs.readFileSync(donors[1],'utf8');
provider=provider.replaceAll("native/gpu-runtime/rcl-stack-vm.cl","native/gpu-text-runtime/rcl-text-stack-vm.cl").replaceAll('RCL_OPENCL_RBC_STACK_VM','RCL_OPENCL_RBC_TEXT_STACK_VM');
provider=replace(provider,'BUILTIN_ARITY = {4: 1, 12: 0, 13: 2, 14: 2}','TEXT_CAPACITY = 8 * 1024 * 1024\nBUILTIN_ARITY = {1:2,2:2,3:2,4:1,5:1,6:1,7:1,8:1,9:2,10:2,12:0,13:2,14:2,15:2,16:3,17:1,18:1,19:1,20:1,62:2}');
provider=replace(provider,"22: 'RCL_GPU_RECORD_LIMIT', 23: 'RCL_GPU_UNFINISHED_EXECUTION',","22: 'RCL_GPU_RECORD_LIMIT', 23: 'RCL_GPU_UNFINISHED_EXECUTION',\n    24: 'RCL_GPU_TEXT_LIMIT', 25: 'RCL_TEXT_SLICE',");
provider=replace(provider,'btext, bvalues = allocate(bytes(text) or bytes(1)), allocate(size=VALUE_COUNT * VALUE_BYTES)',"if len(text) > TEXT_CAPACITY:\n                reject('RCL_GPU_TEXT_LIMIT')\n            initial_text_bytes = len(text)\n            btext, bvalues = allocate(bytes(text) + bytes(TEXT_CAPACITY-len(text))), allocate(size=VALUE_COUNT * VALUE_BYTES)");
provider=replace(provider,'size=(7 + 256 * 3) * 4','size=(8 + 256 * 3) * 4');
provider=replace(provider,'args = [bcode, transport.CLInt(len(instructions)), bnum, bstrings, btext, transport.CLInt(len(strings)), bvalues, bstate, bresult, brecords]','bscratch = allocate(size=VALUE_COUNT * 4)\n            args = [bcode, transport.CLInt(len(instructions)), bnum, bstrings, btext, transport.CLInt(len(strings)), bvalues, bstate, bresult, brecords, transport.CLInt(initial_text_bytes), transport.CLInt(TEXT_CAPACITY), bscratch]');
provider=replace(provider,"error, used, steps, frames, stack, record_count, warrant_count = struct.unpack('<7i', read(bresult, 28))","result_words = struct.unpack('<' + 'i' * (8 + 256 * 3), read(bresult, (8 + 256 * 3) * 4))\n            error, used, steps, frames, stack, record_count, warrant_count = result_words[:7]");
provider=replace(provider,'values = read(bvalues, used * VALUE_BYTES)',"text_used = result_words[-1]\n            if not initial_text_bytes <= text_used <= TEXT_CAPACITY:\n                reject('RCL_GPU_RESULT_TEXT_RANGE')\n            text = read(btext, text_used)\n            values = read(bvalues, used * VALUE_BYTES)");
provider=replace(provider,"warrant_ids = struct.unpack('<' + 'i' * (7 + warrant_count * 3), read(bresult, (7 + warrant_count * 3) * 4))[7:]","warrant_ids = result_words[7:7+warrant_count*3]");
provider=replace(provider,"'kernelMs': elapsed, 'sourceRoot': source_root, 'artifactHash': artifact_hash,","'kernelMs': elapsed, 'textArenaUsed': text_used, 'textArenaCapacity': TEXT_CAPACITY, 'sourceRoot': source_root, 'artifactHash': artifact_hash,");
fs.writeFileSync(dir+'/provider.py',provider);
let target=fs.readFileSync(donors[2],'utf8').replaceAll('createPortableGpuTarget','createPortableGpuTextTarget').replaceAll('RCL_OPENCL_RBC_STACK_VM','RCL_OPENCL_RBC_TEXT_STACK_VM');
target=target.replaceAll('native/gpu-runtime/provider.py',dir+'/provider.py').replaceAll('native/gpu-runtime/rcl-stack-vm.cl',dir+'/rcl-text-stack-vm.cl');
const vendor=JSON.parse(fs.readFileSync(dir+'/vendor/ryu/PROVENANCE.json','utf8'));
const extra=[dir+'/device-text.cl',dir+'/ryu-opencl.cl',dir+'/ryu-build.json',dir+'/vendor/ryu/PROVENANCE.json',...vendor.files.map(f=>f.path)];
target=replace(target,"'native/tensor-engine/amd_opencl_bf16_provider.py'];","'native/tensor-engine/amd_opencl_bf16_provider.py',"+extra.map(p=>JSON.stringify(p)).join(',')+'];');
target=replace(target,"artifact=path.join(ROOT,'selfhost/compiler.rbc')","artifact=path.join(ROOT,'selfhost/variants/scientific-numbers/compiler.rbc')");
fs.writeFileSync('src/portable-gpu-text-target.mjs','// ADAPT of frozen GPU target; separate device Text/Number runtime, no CPU fallback.\n'+target);
fs.writeFileSync(dir+'/build.json',JSON.stringify({format:'rcl.gpu-text-runtime-build.v1',status:'SOURCE_GENERATED_GPU_REPLAY_PENDING',donors:bindings,sourceBindings:['scripts/build-gpu-text-runtime.mjs',dir+'/device-text.cl',dir+'/ryu-opencl.cl'].map(path=>({path,sha256:sha(fs.readFileSync(path))})),outputs:[dir+'/rcl-text-stack-vm.cl',dir+'/provider.py','src/portable-gpu-text-target.mjs'].map(path=>({path,sha256:sha(fs.readFileSync(path))})),scope:'Separate AMD FP64 GPU runtime with dynamic UTF-8 Text arena, device Ryu scalar formatting and persistent Sequence concat; original runtime and frozen contracts preserved'},null,2)+'\n');
console.log(JSON.stringify({status:'SOURCE_GENERATED_GPU_REPLAY_PENDING',donors:bindings}));
