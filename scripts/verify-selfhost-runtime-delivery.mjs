import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const snapshot=path.resolve(process.argv[2]??''),output=path.resolve(process.argv[3]??'output/selfhost-runtime-source-verification');
const mode=process.argv[4]??'full',resume=mode==='--resume-after-tests';
assert.ok(path.basename(snapshot).startsWith('k4-sr-'),'Owned source-only snapshot required');fs.mkdirSync(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),commands=[];
function run(id,args){const log=path.join(output,id+'.log'),fd=fs.openSync(log,'w');try{execFileSync(process.execPath,args,{cwd:snapshot,windowsHide:true,timeout:900000,stdio:['ignore',fd,fd],env:process.env});}finally{fs.closeSync(fd);}commands.push({id,args,status:0,log,sha256:sha(fs.readFileSync(log))});console.log(JSON.stringify({id,status:'PASS'}));}
const binary='native/sequence-compiler/rclcd.exe',build='native/sequence-compiler/build.json';
const capturedBinary=fs.readFileSync(path.join(snapshot,binary)),expectedBinary=sha(capturedBinary),capturedBuild=fs.readFileSync(path.join(snapshot,build));
function peIdentity(bytes){
  const normalized=Buffer.from(bytes),pe=bytes.readUInt32LE(60),optional=pe+24;
  assert.equal(bytes.toString('ascii',pe,pe+4),'PE\u0000\u0000');assert.equal(bytes.readUInt16LE(optional),0x20b);
  const fields=[{kind:'COFF_TimeDateStamp',offset:pe+8,length:4}],table=optional+bytes.readUInt16LE(pe+20);
  const directory=optional+112+6*8,rva=bytes.readUInt32LE(directory),size=bytes.readUInt32LE(directory+4);let debug;
  for(let i=0;i<bytes.readUInt16LE(pe+6);i++){const s=table+i*40,start=bytes.readUInt32LE(s+12),length=bytes.readUInt32LE(s+16);if(rva>=start&&rva<start+length)debug=bytes.readUInt32LE(s+20)+rva-start;}
  assert.ok(Number.isInteger(debug));assert.equal(size%28,0);
  for(let i=0;i<size/28;i++){const s=debug+i*28;fields.push({kind:'DEBUG_TimeDateStamp',offset:s+4,length:4});if(bytes.readUInt32LE(s+12)===2){const p=bytes.readUInt32LE(s+24);assert.equal(bytes.toString('ascii',p,p+4),'RSDS');fields.push({kind:'CODEVIEW_PDB_GUID',offset:p+4,length:16});}}
  for(const f of fields)normalized.fill(0,f.offset,f.offset+f.length);return{normalized,fields};
}
function prior(id){const log=path.join(output,id+'.log');assert.ok(fs.existsSync(log));commands.push({id,execution:'CAPTURED_PREVIOUS_SOURCE_PHASE_NOT_RERUN',log,sha256:sha(fs.readFileSync(log))});}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function inputs(){return files(snapshot).filter(f=>{const p=path.relative(snapshot,f).replaceAll('\\','/');if(p==='scripts/verify-selfhost-runtime-delivery.mjs'||p.endsWith('.pdb'))return false;return ['src/','scripts/','native/','selfhost/','tests/','examples/universal-stress/selfhost-','examples/sequence-runtime/'].some(s=>p.startsWith(s))||p==='package.json';}).map(f=>({path:path.relative(snapshot,f).replaceAll('\\','/'),sha256:sha(fs.readFileSync(f))}));}
if(mode==='--capture-completed-tests'){
  const captured=JSON.parse(fs.readFileSync(path.join(output,'pe-build-identity.json'),'utf8'));assert.equal(expectedBinary,captured.capturedRawSha256);
  for(const [id,count] of [['rebuilt-runtime-tests',2],['focused-tests',40]]){const log=fs.readFileSync(path.join(output,id+'.log'),'utf8');assert.match(log,new RegExp('pass '+count));assert.match(log,/fail 0/u);assert.match(log,/skipped 0/u);prior(id);}
  fs.writeFileSync(path.join(output,'tested-inputs.json'),JSON.stringify(inputs(),null,2)+'\n');
  fs.writeFileSync(path.join(output,'capture-after-manifest-walker-repair.json'),JSON.stringify({status:'PASS_CAPTURED_COMPLETED_SOURCE_PHASES_NO_TEST_RERUN',snapshot,commands,scope:'Only the orchestration manifest walker was repaired. Actual rebuilt-runtime and captured-runtime test logs remain unchanged; product source, binaries and self-host inputs were not modified.'},null,2)+'\n');process.exit(0);
}
if(resume){const captured=JSON.parse(fs.readFileSync(path.join(output,'tested-inputs.json'),'utf8')).filter(f=>!f.path.endsWith('.pdb'));assert.deepEqual(inputs(),captured,'Tested source, binaries and self-host inputs must be unchanged');prior('resident-native-build');prior('rebuilt-runtime-tests');}
else{
run('resident-native-build',['scripts/build-resident-sequence-compiler.mjs']);
const rebuiltBinary=fs.readFileSync(path.join(snapshot,binary)),left=peIdentity(capturedBinary),right=peIdentity(rebuiltBinary);
assert.deepEqual(left.fields,right.fields);assert.deepEqual(left.normalized,right.normalized,'Rebuilt native code/data or non-build-identity bytes changed');
const freshBuild=fs.readFileSync(path.join(snapshot,build));fs.writeFileSync(path.join(output,'fresh-build.json'),freshBuild);
const identity={capturedRawSha256:expectedBinary,rebuiltRawSha256:sha(rebuiltBinary),rawByteIdentical:capturedBinary.equals(rebuiltBinary),normalizedSha256:sha(left.normalized),excludedMetadataFields:left.fields,
  scope:'Only parsed PE COFF/debug timestamps and CodeView PDB GUID differ. Every other byte is checked. Raw historical binary admission bindings remain unchanged; this is not raw-byte reproducibility.'};
fs.writeFileSync(path.join(output,'pe-build-identity.json'),JSON.stringify(identity,null,2)+'\n');
run('rebuilt-runtime-tests',['--test','--test-concurrency=1','tests/resident-sequence-compiler.test.mjs','tests/resident-compiler-http.test.mjs']);
const rebuiltTests=fs.readFileSync(path.join(output,'rebuilt-runtime-tests.log'),'utf8');assert.match(rebuiltTests,/pass 2/u);assert.match(rebuiltTests,/fail 0/u);
// Command paths differ after relocation. Preserve both build receipts and restore
// the original acquisition metadata before replaying source-bound admissions.
fs.writeFileSync(path.join(snapshot,build),capturedBuild);
fs.writeFileSync(path.join(snapshot,binary),capturedBinary);
}
const freshBuild=fs.readFileSync(path.join(output,'fresh-build.json'));
if(resume)prior('focused-tests');else{
run('focused-tests',['--test','--test-concurrency=1','tests/resident-sequence-compiler.test.mjs','tests/k400-selfhost-android-admission.test.mjs','tests/k400-selfhost-embedded-admission.test.mjs','tests/resident-compiler-http.test.mjs','tests/k400-selfhost-http-admission.test.mjs']);
}
const tests=fs.readFileSync(path.join(output,'focused-tests.log'),'utf8');assert.match(tests,/tests 40/u);assert.match(tests,/pass 40/u);assert.match(tests,/fail 0/u);assert.match(tests,/skipped 0/u);
if(mode==='--until-tests'){fs.writeFileSync(path.join(output,'tested-inputs.json'),JSON.stringify(inputs(),null,2)+'\n');console.log(JSON.stringify({status:'PASS_SOURCE_BUILD_AND_40_TESTS_AGGREGATE_PENDING',snapshot}));process.exit(0);}
run('k400-evidence',['scripts/build-k400-evidence.mjs']);
run('k400-report',['scripts/universal-program-stress-report.mjs','examples/universal-stress/k400-current-evidence.json','output/universal-stress-selfhost-source']);
const report=JSON.parse(fs.readFileSync(path.join(snapshot,'output/universal-stress-selfhost-source/universal-stress-report.json'),'utf8'));
const expected=JSON.parse(fs.readFileSync('output/universal-stress-k400/universal-stress-report.json','utf8'));assert.equal(report.reportRoot,expected.reportRoot);
run('doctor',['src/reality-hub-cli.mjs','doctor','--json']);const doctor=JSON.parse(fs.readFileSync(path.join(output,'doctor.log'),'utf8'));
assert.equal(doctor.ok,true);assert.equal(doctor.researchReadiness.k400.passedCells,report.k400Completion.passedCells);assert.equal(doctor.researchReadiness.formalLanguageRelease,false);assert.equal(doctor.researchReadiness.versionPromotionFrozen,true);
const result={format:'rcl.selfhost-runtime-source-delivery.v1',status:'PASS_SOURCE_ONLY_REPLAY',snapshot,commands,
  resumedAfterTests:resume,
  capturedBinarySha256:expectedBinary,rebuildIdentity:JSON.parse(fs.readFileSync(path.join(output,'pe-build-identity.json'),'utf8')),rebuiltRuntimeTests:2,
  freshBuildReceiptSha256:sha(freshBuild),capturedBinaryAndBuildReceiptRestoredForHistoricalAdmission:true,
  focusedTests:40,failedTests:0,skippedTests:0,doctorOk:true,k400Passed:report.k400Completion.passedCells,k400Untested:report.k400Completion.remainingCells,
  k400Verdict:report.k400Completion.verdict,reportRoot:report.reportRoot,
  scope:'Materialized Git sources reproduce every native code/data and non-build-identity byte; parsed PE timestamp/PDB GUID differences are retained explicitly, so raw binary reproducibility is not claimed. The rebuilt artifact passes two actual C ABI/HTTP runtime tests, then the original captured binary/build metadata is restored for forty source-bound runtime/admission checks. Successful prior phases are retained on resume without rerunning or reattributing them. Existing matrix receipts independently reverify. External pinned Zig and frozen browser bundle remain local prerequisites. Android is not freshly reacquired; no additional device, visual-pixel, independent OS or hosted CI claim.'};
fs.writeFileSync(path.join(output,'replay.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,tests:40,passed:result.k400Passed,root:result.reportRoot}));
