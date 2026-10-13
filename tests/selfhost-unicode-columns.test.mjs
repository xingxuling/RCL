import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler} from '../src/native-vm.mjs';
const compiler='native/sequence-runtime/portable/windows/rclc.exe',artifact='selfhost/variants/utf16-columns/compiler.rbc';
for(const[name,source]of [
  ['one supplementary scalar','reality OneEmoji { facet text : Text = "😀" facet later : Number = 1 }'],
  ['two supplementary scalars','reality TwoEmoji { facet text : Text = "😀𐐀中" facet later : Number = 2 }'],
  ['escaped newline spelling','reality Escaped { facet text : Text = "😀\\n𐐀" facet later : Number = 3 }'],
  ['actual multiline text','reality Multiline { facet text : Text = "😀\n𐐀" facet later : Number = 4 }'],
  ['new declaration line','reality NewLine { facet text : Text = "😀"\n facet later : Number = 5 }'],
])test('RCL-authored compiler preserves reference source columns: '+name,()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-column-test-'));
  try{const file=path.join(directory,'input.rcl'),out=path.join(directory,'output.rbc');fs.writeFileSync(file,source);const actual=runNativeCompiler(artifact,file,out,{compilerPath:compiler});assert.deepEqual(actual.bytecode,compileRealityToBytecode(source));}
  finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('rcl-column-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
