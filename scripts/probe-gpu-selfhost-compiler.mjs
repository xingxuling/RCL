import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGpuCompilerTarget} from '../src/gpu-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const directory=fs.mkdtempSync(path.resolve('output/gpu-full-probe-'));
const compiler='selfhost/variants/utf16-columns/compiler.rbc',source='selfhost/variants/utf16-columns/compiler.rcl',output=path.join(directory,'c1.rbc');
let target;
try{
  target=await createGpuCompilerTarget({pythonPath:process.env.RCL_GPU_PYTHON??'python',timeoutMs:600000});
  const before=fs.readFileSync(compiler),result=await target.compile(compiler,source,output);
  assert.deepEqual(result.bytecode,before);assert.equal(result.compilerTrace.executedInstructions,101897504);
  const ended=await target.dispose(),report={format:'rcl.gpu-full-selfhost-diagnostic.v1',
    status:result.ms<=50000?'PASS_ONE_FIXEDPOINT_DIAGNOSTIC_NOT_K400':'FIXEDPOINT_MATCH_PERFORMANCE_GATE_FAILED_NOT_K400',
    generatedAt:new Date().toISOString(),sourceHash:sha(fs.readFileSync(source)),inputCompilerHash:sha(before),
    outputCompilerHash:sha(result.bytecode),bytes:result.bytecode.length,originalCompileBudgetMs:50000,
    measuredMs:result.ms,compilerTrace:result.compilerTrace,binding:target.binding,shutdown:ended,
    claim:'One actual full generation only; twenty generations, sealed cases and fresh independent repairs NOT_RUN; no K179 credit'};
  fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,bytes:report.bytes,measuredMs:report.measuredMs,reportPath:path.join(directory,'report.json')}));
}finally{await target?.dispose();}
