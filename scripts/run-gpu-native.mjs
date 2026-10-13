import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {compileReality} from '../src/compiler.mjs';
import {createPortableGpuTarget} from '../src/portable-gpu-target.mjs';
const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/run-gpu-native.mjs program.rcl');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-gpu-cli-'));let target;
try{
  target=await createPortableGpuTarget();const artifact=path.join(directory,'program.rbc');await target.compile(source,artifact);
  const result=await target.execute(artifact,compileReality(fs.readFileSync(source,'utf8')).programRoot);console.log(JSON.stringify(result,null,2));
}finally{
  await target?.dispose();if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-gpu-cli-'))throw new Error('RCL_GPU_TEMP_SCOPE');
  fs.rmSync(directory,{recursive:true,force:true});
}
