import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler} from '../src/native-vm.mjs';
const original='selfhost/variants/utf16-columns/compiler.rbc',candidate='selfhost/variants/indexed-core/compiler.rbc',source='selfhost/variants/indexed-core/compiler.rcl';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('indexed complete compiler preserves fixed points, old compiler emission, core/UI/provider bytes and diagnostics',()=>{
  const directory=fs.mkdtempSync(path.resolve('output/indexed-core-compat-')),receipts=[];let job=0;
  function compile(compiler,text,label){const file=path.join(directory,(job++)+'.rcl'),out=file+'.rbc';fs.writeFileSync(file,text);
    try{const r=runNativeCompiler(compiler,file,out,{compilerPath:'native/sequence-runtime/portable/windows/rclc.exe',timeout:180000});receipts.push({label,compilerHash:sha(fs.readFileSync(compiler)),sourceHash:sha(text),artifactHash:sha(r.bytecode),steps:r.executedInstructions});return r;}
    catch(e){assert.equal(fs.existsSync(out),false);receipts.push({label,sourceHash:sha(text),rejected:true,code:e.code,message:e.message});throw e;}
  }
  const text=fs.readFileSync(source,'utf8'),c0=fs.readFileSync(candidate);assert.deepEqual(c0,compileRealityToBytecode(text));
  const first=compile(candidate,text,'new-C1');assert.deepEqual(first.bytecode,c0);const second=compile(first.output,text,'new-C2');assert.deepEqual(second.bytecode,c0);
  assert.equal(first.executedInstructions,29249053);assert.equal(second.executedInstructions,29249053);
  assert.deepEqual(compile(candidate,fs.readFileSync('selfhost/variants/utf16-columns/compiler.rcl','utf8'),'complete-original-source').bytecode,fs.readFileSync(original));
  const fixtures=['examples/selfhost-core/literal.rcl','examples/selfhost-core/text-truth.rcl','examples/selfhost-core/reckon-choose.rcl','examples/selfhost-core/subject-warrants.rcl','examples/selfhost-core/emergence-multi.rcl','examples/selfhost-core/resonance-multi.rcl','examples/rcl-native-absorption-kernel.rcl','examples/whole-language-parser-target.rcl','examples/selfhost-core/dynamic-provider-v12.rcl','examples/selfhost-core/native-ui-minimal.rcl','examples/native-ui/navigation.rcl','examples/native-ui/device-adaptation.rcl','examples/universal-stress/k337-k338-compiler-governance-reactive.rcl'];
  const cases=JSON.parse(fs.readFileSync('examples/universal-stress/selfhost-native/general-compiler-cases.json','utf8')).map(c=>[c.id,c.source]);
  const unicode=[['one supplementary scalar','reality OneEmoji { facet text : Text = "😀" facet later : Number = 1 }'],['two supplementary scalars','reality TwoEmoji { facet text : Text = "😀𐐀中" facet later : Number = 2 }'],['escaped newline spelling','reality Escaped { facet text : Text = "😀\\n𐐀" facet later : Number = 3 }'],['actual multiline text','reality Multiline { facet text : Text = "😀\n𐐀" facet later : Number = 4 }'],['new declaration line','reality NewLine { facet text : Text = "😀"\n facet later : Number = 5 }']];
  for(const [label,input]of [...fixtures.map(f=>[f,fs.readFileSync(f,'utf8')]),...cases,...unicode])assert.deepEqual(compile(candidate,input,label).bytecode,compileRealityToBytecode(input),label);
  const rejected=['realty Misspelled { facet x : Number = 1 }','reality Trailing { facet x : Number = 1 } trailing','reality Unclosed { facet x : Number = 1','reality UnknownTop { mystery unsupported }','reality UnknownPath { facet x : Number = missing.value }','reality UnknownCall { facet x : Number = missing_call(1) }','reality WrongLiteral { facet x : Number = "one" }','reality UnsupportedNative { physical universe { } }','reality MissingUIView { ui App { } }',fs.readFileSync(fixtures.at(-1),'utf8').replace('    warrant compiler.inspect on source\n','')];
  for(const [i,input]of rejected.entries()){let oldError,newError;try{compile(original,input,'old-reject-'+i);}catch(e){oldError=e;}try{compile(candidate,input,'new-reject-'+i);}catch(e){newError=e;}assert.ok(oldError&&newError);assert.equal(newError.code,oldError.code);assert.equal(newError.message,oldError.message);}
  // Cached counts must preserve the original consumption point of malformed
  // choices, including nested calls and reckon construction before validation.
  const countDiagnostics=[
    'reality MissingChoice { facet x : Number = choose(1) }',
    'reality MissingBranch { facet x : Number = choose(true, 1) }',
    'reality EmptyChoice { facet x : Number = choose() }',
    'reality BadReckon { reckon bad() -> Number = choose(true, 1) facet x : Number = 1 }',
    'reality NestedBad { reckon bad() -> Number = 3 + choose(true, 1) facet x : Number = 1 }',
    'reality NestedCallBad { reckon bad() -> Number = length(choose(true)) facet x : Number = 1 }',
    'reality ExtraChoice { facet x : Number = choose(true, 1, 2, 3) }',
  ];
  for(const [i,input]of countDiagnostics.entries()){
    const outcomes=[original,candidate].map((compiler,index)=>{try{return{bytes:compile(compiler,input,'count-diagnostic-'+i+'-'+index).bytecode};}catch(e){return{code:e.code,message:e.message};}});
    assert.deepEqual(outcomes[1],outcomes[0]);
  }
  fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({status:'PASS_FULL_CORE_COMPILER_COMPATIBILITY_NOT_K400',candidateHash:sha(c0),originalHash:sha(fs.readFileSync(original)),receipts},null,2)+'\n');
});
