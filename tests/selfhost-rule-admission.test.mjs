import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileRealityToBytecode,compileRealitySessionBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler,runNativeBytecode} from '../src/native-vm.mjs';
let directory,sessionCompiler;
test.before(()=>{directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-rule-admission-'));const read=name=>fs.readFileSync(new URL('../selfhost/'+name,import.meta.url),'utf8');sessionCompiler=path.join(directory,'session.rbc');fs.writeFileSync(sessionCompiler,compileRealityToBytecode(read('compiler-core.rcl')+'\n'+read('session-compiler-core.rcl')+'\n'+read('session-compiler-main.rcl')));});
test.after(()=>{if(directory)fs.rmSync(directory,{recursive:true,force:true});});
const cases=[
 ['emergence update { when true alter value <- 1 }','RCL_EMERGENCE_CAUSE_REQUIRED'],
 ['emergence update { cause missing when true alter value <- 1 }','RCL_SUBJECT_UNKNOWN'],
 ['resonance update { into peer when true alter value <- 1 }','RCL_RESONANCE_FROM_REQUIRED'],
 ['resonance update { from actor when true alter value <- 1 }','RCL_RESONANCE_INTO_REQUIRED'],
 ['resonance update { from missing into peer when true alter value <- 1 }','RCL_SUBJECT_UNKNOWN'],
 ['resonance update { from actor into missing when true alter value <- 1 }','RCL_SUBJECT_UNKNOWN'],
 ['emergence update { cause actor alter value <- 1 }','RCL_RULE_WHEN_REQUIRED'],
 ['emergence update { cause actor when true preserve true }','RCL_RULE_EFFECT_REQUIRED'],
 ['resonance update { from actor into peer alter value <- 1 }','RCL_RULE_WHEN_REQUIRED'],
 ['resonance update { from actor into peer when true }','RCL_RULE_EFFECT_REQUIRED'],
];
for(const [rule,code]of cases)test('native rule admission: '+code+' '+rule,()=>{
 for(const newline of ['\n','\r\n']){
  const source=['reality Rules {','# 😀 declaration before rule','facet value : Number = 0','subject actor {} subject peer {}',rule,'}'].join(newline);
  const offset=source.indexOf('update'),before=source.slice(0,offset).split('\n');
  for(const [artifact,reference]of [['selfhost/compiler.rbc',compileRealityToBytecode],[sessionCompiler,compileRealitySessionBytecode]]){
   assert.throws(()=>reference(source),error=>error.diagnostics?.some(item=>item.code===code));
   const input=path.join(directory,'input.rcl'),output=path.join(directory,'output.rbc'),retained=Buffer.from('retained-rule-admission');fs.writeFileSync(input,source);fs.writeFileSync(output,retained);
   assert.throws(()=>runNativeCompiler(artifact,input,output),error=>{assert.equal(error.diagnostic?.code,code,error.message);assert.deepEqual(error.diagnostic.span,{offset,line:before.length,column:before.at(-1).length+1,length:6});return true;});assert.deepEqual(fs.readFileSync(output),retained);
  }
 }
});

test('valid rule actors resolve forward declarations and retain canonical bytes',()=>{
 for(const rule of ['emergence update { cause actor when true alter value <- 1 }','resonance update { from actor into peer when true alter value <- 1 }']){
  const source='reality Forward { facet value : Number = 0 '+rule+' subject actor {} subject peer {} realize update }';
  const input=path.join(directory,'input.rcl'),output=path.join(directory,'output.rbc');fs.writeFileSync(input,source);
  const bytes=runNativeCompiler('selfhost/compiler.rbc',input,output).bytecode;assert.deepEqual(bytes,compileRealityToBytecode(source));assert.equal(runNativeBytecode(bytes).state.value,1);
 }
});

test('both native entries reject unknown directives and ambiguous rule names before output', () => {
  const rule = 'emergence step { cause actor when true alter value <- 1 }';
  const cases = [
    ['realize absent', 'absent', 'RCL_DIRECTIVE_RULE_UNKNOWN'],
    ['foresee absent', 'absent', 'RCL_DIRECTIVE_RULE_UNKNOWN'],
    [rule + ' ' + rule + ' realize step', 'step { cause actor', 'RCL_RULE_DUPLICATE'],
    [rule + ' resonance step { from actor into peer when true alter value <- 2 }', 'step { from actor', 'RCL_RULE_DUPLICATE'],
  ];
  const input = path.join(directory, 'input.rcl');
  const output = path.join(directory, 'output.rbc');
  const retained = Buffer.from('retained-directive-output');
  for (const [body, marker, code] of cases) {
    const source = 'reality Rules {\r\n facet value : Number = 0\r\n'
      + ' subject actor {} subject peer {} facet label : Text = "😀" ' + body + '\r\n}';
    const offset = source.lastIndexOf(marker);
    const before = source.slice(0, offset).split('\n');
    const span = { offset, line: before.length, column: before.at(-1).length + 1, length: marker.split(' ')[0].length };
    for (const [artifact, reference] of [
      ['selfhost/compiler.rbc', compileRealityToBytecode], [sessionCompiler, compileRealitySessionBytecode],
    ]) {
      assert.throws(() => reference(source), error => error.diagnostics?.some(item => item.code === code));
      fs.writeFileSync(input, source);
      fs.writeFileSync(output, retained);
      assert.throws(() => runNativeCompiler(artifact, input, output), error => {
        assert.equal(error.diagnostic?.code, code, error.message);
        assert.deepEqual(error.diagnostic.span, span);
        return true;
      });
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  }
});

test('forward directives preserve reference bytes in both native entries', () => {
  const source = 'reality Rules { realize step foresee step facet value : Number = 0 '
    + 'subject actor {} emergence step { cause actor when true alter value <- 1 } }';
  const input = path.join(directory, 'input.rcl');
  const output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source);
  for (const [artifact, reference] of [
    ['selfhost/compiler.rbc', compileRealityToBytecode], [sessionCompiler, compileRealitySessionBytecode],
  ]) {
    assert.deepEqual(runNativeCompiler(artifact, input, output).bytecode, reference(source));
  }
});

test('both native entries reject duplicates in the core declaration namespaces', () => {
  const cases = [
    ['facet state : Number = 1 facet state : Number = 2', 'facet state', 'RCL_FACET_DUPLICATE', 'facet'],
    ['subject actor { facet value : Number = 1 } facet actor.value : Number = 2', 'facet actor.value', 'RCL_FACET_DUPLICATE', 'facet'],
    ['reckon label() -> Text = "first" reckon label() -> Text = "second"', 'label()', 'RCL_RECKON_DUPLICATE', 'label'],
    ['subject actor {} subject actor {}', 'actor {}', 'RCL_SUBJECT_DUPLICATE', 'actor'],
    ['host local {} host local {}', 'local {}', 'RCL_HOST_DUPLICATE', 'local'],
    ['host local { offers ping -> Text offers ping -> Number }', 'ping -> Number', 'RCL_HOST_OFFER_DUPLICATE', 'ping'],
  ];
  const input = path.join(directory, 'input.rcl');
  const output = path.join(directory, 'output.rbc');
  const retained = Buffer.from('retained-duplicate-output');
  for (const [body, marker, code, spelling] of cases) {
    const source = 'reality Names {\r\n facet note : Text = "😀" ' + body + '\r\n}';
    const offset = source.lastIndexOf(marker);
    const before = source.slice(0, offset).split('\n');
    const span = { offset, line: before.length, column: before.at(-1).length + 1, length: spelling.length };
    for (const [artifact, reference] of [
      ['selfhost/compiler.rbc', compileRealityToBytecode], [sessionCompiler, compileRealitySessionBytecode],
    ]) {
      assert.throws(() => reference(source), error => error.diagnostics?.some(item => item.code === code));
      fs.writeFileSync(input, source);
      fs.writeFileSync(output, retained);
      assert.throws(() => runNativeCompiler(artifact, input, output), error => {
        assert.equal(error.diagnostic?.code, code, error.message);
        assert.deepEqual(error.diagnostic.span, span);
        return true;
      });
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  }
});
