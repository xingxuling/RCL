import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {readSelfHostedCompilerSource} from '../src/selfhost-compiler.mjs';
import {runReality} from '../src/runtime.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
const root=path.resolve(import.meta.dirname,'..'), work=path.join(root,'output/selfhost/identifier-portable');
fs.mkdirSync(work,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const target=file=>{const s=path.resolve(root,file).replaceAll('\\','/');return '/mnt/'+s[0].toLowerCase()+s.slice(2);};
const run=(command,args)=>spawnSync(command,args,{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});
const linux=args=>run('wsl.exe',['-d','RCL-K400-Alpine','--','env','RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2',...args]);
const good=result=>{assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return result;};
const chars=['A','_','0','中','é','Ω','١','Ⅷ','²','𐐀','𝟘','😀','。','—','́','‍','\u0085','','abc','12','中a','a\n','\ufeff'];
const source='reality PortableCharacters {'+chars.flatMap((ch,i)=>['is_digit','is_whitespace','is_identifier_start','is_identifier_part'].map((name,j)=>`facet c${i}_${j} : Truth = ${name}(${JSON.stringify(ch)})`)).join('\n')+'}';
const sourceFile=path.join(work,'chars.rcl'),bytecodeFile=path.join(work,'chars.rbc'),outputFile=path.join(work,'compiled.rbc');
const bytes=compileRealityToBytecode(source);fs.writeFileSync(sourceFile,source);fs.writeFileSync(bytecodeFile,bytes);
const reference=await runReality(source), reports=[];
const identity=good(linux(['uname','-s','-r','-m'])).stdout.trim();
for(const environment of ['linux','wasi']){
 fs.writeFileSync(sourceFile,source);
 const vm=environment==='linux'?'native/linux/rclvm':'native/wasi/rclvm.wasm', compiler=environment==='linux'?'native/linux/rclc':'native/wasi-compiler/rclc.wasm';
 const execute=file=>environment==='linux'?linux([target(vm),target(file)]):run(process.execPath,['scripts/run-native-wasi.mjs',vm,file]);
 const compile=(input,output,artifact='selfhost/compiler.rbc')=>environment==='linux'?linux([target(compiler),target(artifact),target(input),target(output)]):run(process.execPath,['scripts/run-sequence-wasi-compiler.mjs',compiler,path.resolve(root,artifact),input,output]);
 const actual=verifyNativeSemanticStateRoot(JSON.parse(good(execute(bytecodeFile)).stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
 assert.deepEqual(actual.state,reference.state);
 good(compile(sourceFile,outputFile));assert.deepEqual(fs.readFileSync(outputFile),bytes);
 const quoted=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r').replaceAll('\t','\\t')+'"';
 const valid=['reality 名称 { facet 数值١ : Number = .5 }','\ufeffreality\u2003Names { facet value : Truth = true }',
  'reality Ordered { facet 龍 : Number = 1 facet 中a : Number = 2 facet 中 : Number = 3 facet É : Number = 4 capability_policy P { budget 龍 1 budget 中 2 budget A 3 } }',
  'reality Exponents { facet small : Number = 5e-324 facet large : Number = 1.7976931348623157e308 facet scaled : Number = -.125e2 }',
  ...[Array.from({length:31},(_,i)=>String.fromCodePoint(i+1)).join(''),Array.from({length:95},(_,i)=>String.fromCodePoint(i+32)).join(''),'中文 😀𐐀'].map(value=>'reality Text { facet value : Text = '+quoted(value)+' }')];
 for(const text of valid){fs.writeFileSync(sourceFile,text);good(compile(sourceFile,outputFile));assert.deepEqual(fs.readFileSync(outputFile),compileRealityToBytecode(text));}
 const numericInputs=['5e-324','1e-324','2.225073858507201e-308','\u20031.5\ufeff','0o77','0b101','0x20000000000003'];
 const numericSource='reality NumberText { '+numericInputs.map((value,index)=>
  `facet value${index} : Text = text(number_from_text(${JSON.stringify(value)}))`).join(' ')+' }';
 fs.writeFileSync(sourceFile,numericSource);good(compile(sourceFile,outputFile));
 assert.deepEqual(fs.readFileSync(outputFile),compileRealityToBytecode(numericSource));
 const numeric=verifyNativeSemanticStateRoot(JSON.parse(good(execute(outputFile)).stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
 assert.deepEqual(numeric.state,(await runReality(numericSource)).state);
 const invalidNumber='reality InvalidNumber { facet value : Number = number_from_text("0x1p2") }';
 fs.writeFileSync(outputFile,compileRealityToBytecode(invalidNumber));
 const rejectedNumber=execute(outputFile);assert.equal(rejectedNumber.status,1);
 assert.ok(rejectedNumber.stderr.includes('RCL_TEXT_NUMBER_INVALID'),rejectedNumber.stderr);
 const invalid=['😀','。','á','a١😀','𐐀'];
 for(const name of invalid){const text='reality Invalid { facet '+name+' : Number = 1 }';assert.throws(()=>compileRealityToBytecode(text));fs.writeFileSync(sourceFile,text);const retained=Buffer.from('retained-'+environment);fs.writeFileSync(outputFile,retained);const result=compile(sourceFile,outputFile);assert.notEqual(result.status,0);assert.deepEqual(fs.readFileSync(outputFile),retained);}
 const diagnosticCases=[
  ['\ufeffreality Span {\r\n # 😀𐐀\r\n facet text : Text = "😀\\n" facet x : Number = missing.value }','RCL_SEMANTIC_UNKNOWN_PATH','missing'],
  ['reality Incomplete { facet text : Text = "😀\\','RCL_UNTERMINATED_TEXT','"😀\\'],
  ['reality Incomplete {\n # 😀𐐀','RCL_REALITY_UNCLOSED',''],
  ['reality Header { facet value : Number = 0 emergence update { when true alter value <- 1 } }','RCL_EMERGENCE_CAUSE_REQUIRED','update'],
  ['reality Missing { realize absent }','RCL_DIRECTIVE_RULE_UNKNOWN','absent'],
  ['reality Duplicate { host local {} host local {} }','RCL_HOST_DUPLICATE','local',true],
  ['reality Types { facet value : Number = 1 + true }','RCL_TYPE_BINARY','+'],
 ];
 for(const [text,code,spelling,lastOccurrence] of diagnosticCases){
  const offset=spelling?(lastOccurrence?text.lastIndexOf(spelling):text.indexOf(spelling)):text.length,before=text.slice(0,offset).split('\n');
  const expected={format:'rcl.semantic-diagnostic.v1',code,span:{offset,line:before.length,column:before.at(-1).length+1,length:spelling.length}};
  fs.writeFileSync(sourceFile,text);const retained=Buffer.from('retained-diagnostic-'+environment);fs.writeFileSync(outputFile,retained);
  const result=compile(sourceFile,outputFile);assert.notEqual(result.status,0);
  const payload=JSON.parse(result.stderr.slice(result.stderr.indexOf('{')).trim());
  assert.deepEqual(payload.cause.diagnostic,expected);assert.deepEqual(fs.readFileSync(outputFile),retained);
 }
 const longErrorFile=path.join(work,'long-unicode-error.rbc');
 fs.writeFileSync(longErrorFile,compileRealityToBytecode('reality UnicodeError { facet valid : Truth = semantic_assert(false, "RCL_LONG_PORTABLE", "'+'😀'.repeat(200)+'", make_span(17, 3, 9, 6)) }'));
 const rawError=environment==='linux'
  ?spawnSync('wsl.exe',['-d','RCL-K400-Alpine','--','env','RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2',target(vm),target(longErrorFile)],{timeout:120000,windowsHide:true})
  :spawnSync(process.execPath,['scripts/run-native-wasi.mjs',vm,longErrorFile],{timeout:120000,windowsHide:true});
 assert.equal(rawError.status,1);
 const errorText=new TextDecoder('utf-8',{fatal:true}).decode(rawError.stderr),unicodeError=JSON.parse(errorText.slice(errorText.indexOf('{')));
 assert.deepEqual(unicodeError.diagnostic,{format:'rcl.semantic-diagnostic.v1',code:'RCL_LONG_PORTABLE',span:{offset:17,line:3,column:9,length:6}});
 const compilerSource=readSelfHostedCompilerSource(),fixedSource=path.join(work,'compiler-source.rcl'),firstPath=path.join(work,environment+'-c1.rbc'),secondPath=path.join(work,environment+'-c2.rbc');
 fs.writeFileSync(fixedSource,compilerSource);
 const first=JSON.parse(good(compile(fixedSource,firstPath)).stdout),second=JSON.parse(good(compile(fixedSource,secondPath,firstPath)).stdout);
 const generations=['selfhost/compiler.rbc',firstPath,secondPath].map(file=>hash(fs.readFileSync(file)));
 assert.equal(generations[0],generations[1]);assert.equal(generations[1],generations[2]);
 assert.ok(first.instructionBudget-first.executedInstructions>=180000000);assert.ok(second.instructionBudget-second.executedInstructions>=180000000);
 const fixedPoint={compilerSourceSha256:hash(Buffer.from(compilerSource)),generations,byteIdentical:true,executedInstructions:[first.executedInstructions,second.executedInstructions],instructionBudget:first.instructionBudget,minimumHeadroom:180000000};
 reports.push({environment,execution:environment==='linux'?identity:'Node '+process.version+' WASI Preview 1',stateFacets:Object.keys(actual.state).length,stateRoot:actual.stateRoot,compilerByteParity:true,unicodeErrorStrictUtf8:true,fixedPoint,structuredDiagnosticCases:diagnosticCases.length,validSources:valid.length+1,rejectedSources:invalid.length,outputPreserved:true,numericConversions:numericInputs.length,numericRoot:numeric.stateRoot,invalidHexFloatRejected:true,vmSha256:hash(fs.readFileSync(vm)),compilerSha256:hash(fs.readFileSync(compiler)),compilerArtifactSha256:hash(fs.readFileSync('selfhost/compiler.rbc'))});
}
const report={format:'rcl.identifier-portable-check.v1',ok:true,characterInputs:chars,sourceSha256:hash(Buffer.from(source)),reports,physicalHardwareClaimed:false,k400Rerun:false};
fs.writeFileSync('output/selfhost/identifier-portable-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
