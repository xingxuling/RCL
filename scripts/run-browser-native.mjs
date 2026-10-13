import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createPortableBrowserTarget} from '../src/portable-browser-target.mjs';
import {compileReality} from '../src/compiler.mjs';
const file=process.argv[2];if(!file||process.argv.length!==3)throw new Error('Usage: node scripts/run-browser-native.mjs <source.rcl>');
const sourcePath=path.resolve(file),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-browser-cli-'));let target;
try{
  target=await createPortableBrowserTarget();const artifact=path.join(directory,'program.rbc'),compiled=await target.compile(sourcePath,artifact);
  const execution=await target.execute(artifact,compileReality(fs.readFileSync(sourcePath,'utf8')).programRoot);
  console.log(JSON.stringify({ok:true,target:'browser',binding:target.binding,compileMs:compiled.ms,executeMs:execution.ms,result:execution.result},null,2));
}finally{
  await target?.dispose();const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('rcl-browser-cli-'));
  fs.rmSync(resolved,{recursive:true,force:true});
}
