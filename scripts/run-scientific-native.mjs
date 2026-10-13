import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPortableScientificTarget} from '../src/portable-scientific-target.mjs';
import {compileReality} from '../src/compiler.mjs';
const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/run-scientific-native.mjs source.rcl');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-scientific-cli-'));let target;
try{target=await createPortableScientificTarget();const artifact=path.join(directory,'program.rbc');await target.compile(file,artifact);
  const execution=await target.execute(artifact,compileReality(fs.readFileSync(file,'utf8')).programRoot);console.log(JSON.stringify(execution,null,2));
}finally{await target?.dispose();if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-scientific-cli-'))throw new Error('RCL_SCIENCE_TEMP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
