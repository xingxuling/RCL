import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {WASI} from 'node:wasi';
const [moduleFile,compilerFile,sourceFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw new Error('Usage: run-sequence-wasi-compiler <rclc.wasm> <compiler.rbc> <source.rcl> <output.rbc>');
const inputDirectory=path.dirname(path.resolve(sourceFile)),artifactDirectory=path.dirname(path.resolve(compilerFile));
assert.equal(path.dirname(path.resolve(outputFile)),inputDirectory);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-wasi-compiler-'));
try {
const wasi=new WASI({version:'preview1',args:['rclc','/compiler/'+path.basename(compilerFile),'/work/'+path.basename(sourceFile),'/work/'+path.basename(outputFile)],env:{RCLC_OUTPUT_STATE:'compiler.output',RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2',TMPDIR:'/tmp'},preopens:{'/compiler':artifactDirectory,'/work':inputDirectory,'/tmp':temporary},returnOnExit:true});
const module=await WebAssembly.compile(fs.readFileSync(moduleFile)),instance=await WebAssembly.instantiate(module,wasi.getImportObject());
process.exitCode=wasi.start(instance);

} finally {
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('rcl-wasi-compiler-'));
  fs.rmSync(temporary,{recursive:true,force:true});
}
