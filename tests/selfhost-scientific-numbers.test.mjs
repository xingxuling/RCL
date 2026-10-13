import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileReality} from '../src/scientific-compiler.mjs';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler} from '../src/native-vm.mjs';
const compiler='native/sequence-runtime/portable/windows/rclc.exe';
const artifact='selfhost/variants/scientific-numbers/compiler.rbc';
function temporary(run){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-exponent-test-'));try{return run(directory);}finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-exponent-test-'));fs.rmSync(directory,{recursive:true,force:true});}}
for(const [literal,value] of [['1e3',1000],['1E+3',1000],['1e-3',.001],['1.25e2',125],['-2.5E-2',-.025],['0e99',0],['1e21',1e21],['1.2345678901234567e10',12345678901.234568]]){
  test('RCL-authored scientific-number compiler emits and executes '+literal,()=>temporary(directory=>{
    const source='reality Exponent { facet prefix : Text = "😀中" facet value : Number = '+literal+' }';
    const input=path.join(directory,'input.rcl'),out=path.join(directory,'output.rbc');fs.writeFileSync(input,source);
    const actual=runNativeCompiler(artifact,input,out,{compilerPath:compiler});assert.deepEqual(actual.bytecode,compileRealityToBytecode(compileReality(source)));
    const execution=spawnSync(path.resolve('native/rclvm.exe'),[out],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});assert.equal(execution.status,0,execution.stderr);assert.deepEqual(JSON.parse(execution.stdout).state,{prefix:'😀中',value});
  }));
}
for(const literal of ['1e','1e+','1e-','1E+ x','1e2e3'])test('incomplete or duplicate decimal exponent is rejected: '+literal,()=>temporary(directory=>{
  const source='reality InvalidExponent { facet value : Number = '+literal+' }';assert.throws(()=>compileReality(source));
  const input=path.join(directory,'input.rcl');fs.writeFileSync(input,source);
  assert.throws(()=>runNativeCompiler(artifact,input,input+'.rbc',{compilerPath:compiler}));
}));
test('scientific-number compiler has a native RCL fixed point',()=>temporary(directory=>{
  const source='selfhost/variants/scientific-numbers/compiler.rcl',expected=fs.readFileSync(artifact),first=path.join(directory,'c1.rbc'),second=path.join(directory,'c2.rbc');
  assert.deepEqual(runNativeCompiler(artifact,source,first,{compilerPath:compiler,timeout:300000}).bytecode,expected);
  assert.deepEqual(runNativeCompiler(first,source,second,{compilerPath:compiler,timeout:300000}).bytecode,expected);
}));
