import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createColdCompilerHttpTarget} from '../src/cold-compiler-http-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),directory='output/cold-selfhost-probe';fs.mkdirSync(directory,{recursive:true});
const target=await createColdCompilerHttpTarget();
try{
  const compiler=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl');
  const result=await target.compile(compiler,source);assert.deepEqual(result.bytecode,fs.readFileSync(compiler));
  const report={status:'PASS_COLD_HTTP_FULL_COMPILER_DIAGNOSTIC_NOT_K400',runtime:{environment:'serverless',compiler:target.binding.compiler,vm:target.binding.vm},binding:target.binding,
    generation:{outputHash:sha(result.bytecode),bytes:result.bytecode.length,compilerTrace:result.nativeCompilerTrace,httpTrace:result.httpTrace,coldInvocation:result.coldInvocation}};
  fs.writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,artifactHash:report.generation.outputHash,ms:result.ms}));
}finally{await target.dispose();}
