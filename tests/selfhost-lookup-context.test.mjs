import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler,runNativeBytecode} from '../src/native-vm.mjs';
let directory;
test.before(()=>{directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-lookup-context-'));});
test.after(()=>{if(directory)fs.rmSync(directory,{recursive:true,force:true});});
function compile(source){const input=path.join(directory,'input.rcl'),output=path.join(directory,'output.rbc');fs.writeFileSync(input,source);return runNativeCompiler('selfhost/compiler.rbc',input,output).bytecode;}

test('colliding function and pool indices preserve addresses and declaration order',()=>{
 const names=Array.from({length:72},(_,i)=>'fn'+String(i).padStart(3,'0'));
 for(const order of [names,[...names].reverse()]){
  const source='reality Collisions {'+order.map(name=>`reckon ${name}(x : Number) -> Number = x + ${Number(name.slice(2))}`).join('\n')
   +names.map((name,i)=>`facet value${String(i).padStart(3,'0')} : Number = ${name}(10)`).join('\n')+'}';
  const bytes=compile(source);assert.deepEqual(bytes,compileRealityToBytecode(source));
  const actual=runNativeBytecode(bytes).state;for(const [i]of names.entries())assert.equal(actual['value'+String(i).padStart(3,'0')],i+10);
 }
});

test('derived indices preserve Unicode strings and independently compiled names',()=>{
 for(const [name,value]of [['first','😀'],['other','𐐀中'],['first','different'],['other','"\\\n\r\t']]){
  const source=`reality Names { reckon ${name}() -> Text = ${JSON.stringify(value)} facet text : Text = ${name}() }`;
  const bytes=compile(source);assert.deepEqual(bytes,compileRealityToBytecode(source));assert.equal(runNativeBytecode(bytes).state.text,value);
 }
});

test('unknown functions in populated collision buckets retain their diagnostic and output',()=>{
 const source='reality Missing { reckon aa(x : Number) -> Number = x reckon bb(x : Number) -> Number = x facet value : Number = cc(1) }';
 assert.throws(()=>compileRealityToBytecode(source));
 const output=path.join(directory,'output.rbc'),retained=Buffer.from('retained-index-miss');fs.writeFileSync(output,retained);
 assert.throws(()=>compile(source),error=>error.diagnostic?.code==='RCL_SEMANTIC_UNKNOWN_CALL');assert.deepEqual(fs.readFileSync(output),retained);
});
