import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGpuCompilerTarget} from '../src/gpu-compiler-target.mjs';
import {runNativeBytecode} from '../src/native-vm.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),file='examples/universal-stress/selfhost-native/general-compiler-cases.json';
const compiler='selfhost/variants/utf16-columns/compiler.rbc',bytes=fs.readFileSync(file),cases=JSON.parse(bytes),directory=fs.mkdtempSync(path.resolve('output/gpu-sealed-probe-'));
assert.equal(sha(bytes),'01e5b00206d00ccdd9d37f5b9421a89b00a0221060244ce06f6c427ddfa1685d');assert.equal(cases.length,10);
let target;
try{
 target=await createGpuCompilerTarget({pythonPath:process.env.RCL_GPU_PYTHON??'python'});const receipts=[];
 for(const c of cases){assert.equal(sha(c.source),c.sourceHash);const source=path.join(directory,c.id+'.rcl'),artifact=source+'.rbc';fs.writeFileSync(source,c.source);
   const compiled=await target.compile(compiler,source,artifact);assert.equal(sha(compiled.bytecode),c.artifactHash);
   const executed=await target.execute(artifact,c.sourceRoot),native=runNativeBytecode(compiled.bytecode);
   for(const k of ['state','stateRoot','history','projections'])assert.deepEqual(executed.result[k],native[k]);
   receipts.push({id:c.id,sourceHash:sha(c.source),artifactHash:sha(compiled.bytecode),sourceRoot:c.sourceRoot,compileMs:compiled.ms,executeMs:executed.ms,
     compilerTrace:compiled.compilerTrace,gpuTrace:executed.gpuTrace,result:executed.result});
 }
 const shutdown=await target.dispose(),report={format:'rcl.gpu-sealed-program-diagnostic.v1',status:'PASS_TEN_ORIGINAL_SEALED_PROGRAM_DIAGNOSTIC_NOT_K400',
   casesPath:file,casesHash:sha(bytes),compilerHash:sha(fs.readFileSync(compiler)),binding:target.binding,receipts,shutdown,
   scope:'Original ten sealed byte/source-root/native semantics checked; full twenty-generation/fresh-repair/performance campaign remains unadmitted; no K179 credit'};
 fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:receipts.length,reportPath:path.join(directory,'report.json')}));
}finally{await target?.dispose();}
