import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler,runNativeBytecode} from '../src/native-vm.mjs';
let directory;
test.before(()=>{directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-json-text-parity-'));});
test.after(()=>{if(directory)fs.rmSync(directory,{recursive:true,force:true});});
const literal=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r').replaceAll('\t','\\t')+'"';
function check(value){
 const source='reality TextRoot { facet text : Text = '+literal(value)+' }';
 const input=path.join(directory,'input.rcl'),output=path.join(directory,'output.rbc');fs.writeFileSync(input,source);
 const bytes=runNativeCompiler('selfhost/compiler.rbc',input,output).bytecode;assert.deepEqual(bytes,compileRealityToBytecode(source),JSON.stringify(value));assert.equal(runNativeBytecode(bytes).state.text,value);
}
test('native canonical JSON escapes every admitted ASCII control character',()=>{
 for(let cp=1;cp<32;cp++)check(String.fromCodePoint(cp));
 check(Array.from({length:31},(_,i)=>String.fromCodePoint(i+1)).join(''));
});
test('native canonical JSON preserves printable ASCII and non-ASCII scalar text',()=>{
 check(Array.from({length:95},(_,i)=>String.fromCodePoint(i+32)).join(''));
 check('中文 😀𐐀 \u2028 \u2029 " \\ \n\r\t');
 check('');
});
