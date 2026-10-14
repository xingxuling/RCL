import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT} from './k400-genomes/shared.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {BROWSER_DIRECTORY,BROWSER_PROFILES} from './k400-browser-definitions.mjs';
import {runBrowserProfile,verifyBrowserProfile} from './k400-browser-engine.mjs';
import {UI_DIRECTORY,UI_PROFILE} from './k400-ui-definitions.mjs';
import {runUiProfile,verifyUiProfile,verifyUiEnvironment} from './k400-ui-engine.mjs';
import {runUiProfile as runGpuUi,verifyUiProfile as verifyGpuUi} from './k400-gpu-ui-engine.mjs';
import {CRDT_DIRECTORY,CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {runCrdtProfile,verifyCrdtProfile} from './k400-crdt-engine.mjs';
import {runSelfhostProfile,verifySelfhostEnvironment} from './k400-selfhost-column-engine.mjs';
import {buildSelfhostIndex} from './k400-selfhost-column-admission.mjs';

const OLD='f76f0234efb271041dc84f9f38fb858e01859d5da6f775f5108668eb3ae80975';
const NEW='9ca2beaa7a9fd1109f01e562788c22e045a01cec0f6015ade689325af7f8a521';
const VERSION='155.0.8059.41';
const D='docs/evidence/browser-toolchain-refresh-2026-10-14',M=D+'/manifest.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const write=(f,v)=>{fs.mkdirSync(path.dirname(path.join(ROOT,f)),{recursive:true});fs.writeFileSync(path.join(ROOT,f),JSON.stringify(v,null,2)+'\n');};
const binary=path.join(ROOT,'_tools/chrome-'+VERSION+'/chrome.exe');
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(directory,e.name)):[path.join(directory,e.name)]);}
function saveManifest(m){m.reportRoot=evidenceRoot({...m,reportRoot:undefined});write(M,m);}
function validateToolchain(m){
  assert.equal(sha(fs.readFileSync(binary)),NEW);
  for(const f of m.toolchain.files)assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256,'Frozen browser component drift: '+f.path);
  for(const f of m.archives){const local=path.join(ROOT,f.archivePath),bytes=fs.existsSync(local)?fs.readFileSync(local):execFileSync('git',['cat-file','blob',f.gitBlob],{cwd:ROOT,windowsHide:true,maxBuffer:256*1024*1024});assert.equal(sha(bytes),f.sha256,'Historical bytes changed: '+f.path);}
}

const mode=process.argv[2];
if(mode==='freeze'){
  assert.ok(!fs.existsSync(path.join(ROOT,M)),'Refresh was already frozen');
  assert.equal(sha(fs.readFileSync(binary)),NEW);
  const receipts=[...BROWSER_PROFILES.map(p=>BROWSER_DIRECTORY+'/'+p.id+'-runtime.json'),
    ...UI_PROFILE.environments.map(e=>UI_DIRECTORY+'/'+UI_PROFILE.id+'-'+e+'-runtime.json'),
    CRDT_DIRECTORY+'/'+CRDT_PROFILE.id+'-runtime.json',
    'examples/universal-stress/selfhost-columns/general-compiler-columns-browser-runtime.json',
    'examples/universal-stress/gpu-ui/gpu-text-counter-gpu-runtime.json'];
  const indexes=[UI_DIRECTORY+'/'+UI_PROFILE.id+'-runtime.json',
    'examples/universal-stress/selfhost-columns/general-compiler-columns-runtime.json',
    'examples/universal-stress/gpu-ui/gpu-text-counter-runtime.json',
    'examples/universal-stress/k400-current-evidence.json'];
  const archives=[];
  for(const f of [...receipts,...indexes]){
    const bytes=fs.readFileSync(path.join(ROOT,f));if(receipts.includes(f))assert.ok(bytes.toString().includes(OLD),'Unexpected acquisition browser: '+f);
    const archivePath=D+'/acquisition-155.0.8059.40/'+f+'.txt';fs.mkdirSync(path.dirname(path.join(ROOT,archivePath)),{recursive:true});fs.writeFileSync(path.join(ROOT,archivePath),bytes);
    archives.push({path:f,archivePath,sha256:sha(bytes),bytes:bytes.length,previousReportRoot:read(f).reportRoot??null});
  }
  const m={format:'rcl.k400-browser-toolchain-refresh.v1',status:'FROZEN_REFRESH_PENDING',generatedAt:new Date().toISOString(),
    reason:'Installed Chrome changed binary identity. No historical hash is rebound to the new binary; affected runtime evidence must be reacquired.',
    previousBinarySha256:OLD,previousBinaryAvailable:false,previousVersion:'155.0.8059.40',
    toolchain:{version:VERSION,executablePath:binary,sha256:NEW,localIgnoredBundle:true,redistributed:false,
      files:files(path.dirname(binary)).map(f=>({path:path.relative(ROOT,f).replaceAll('\\','/'),sha256:sha(fs.readFileSync(f)),bytes:fs.statSync(f).size}))},
    frozenProgramsChanged:false,independentRepairsChanged:false,performanceBudgetsChanged:false,admissionChecksWeakened:false,
    actionsUsed:false,archives,phases:[]};saveManifest(m);console.log(JSON.stringify({status:m.status,archived:archives.length,toolchainFiles:m.toolchain.files.length}));
}else if(mode==='run'){
  const m=read(M);assert.equal(m.reportRoot,evidenceRoot({...m,reportRoot:undefined}));validateToolchain(m);
  process.env.RCL_BROWSER_EXECUTABLE=binary;
  async function phase(id,fn){
    if(m.phases.some(p=>p.id===id&&p.status==='PASS'))return;
    console.log(JSON.stringify({phase:id,status:'BEGIN',time:new Date().toISOString()}));
    const result=await fn();validateToolchain(m);m.phases.push({id,status:'PASS',finishedAt:new Date().toISOString(),...result});saveManifest(m);
    console.log(JSON.stringify({phase:id,status:'PASS'}));
  }
  for(const p of BROWSER_PROFILES)await phase('browser:'+p.id,async()=>{
    const report=await runBrowserProfile(p);await verifyBrowserProfile(p);return{reportRoot:report.reportRoot};
  });
  await phase('crdt:browser',async()=>{
    // The acquisition engine already supports source-bound checkpoint reuse.
    // Retain the original fourteen other environments; reacquire only browser.
    const old=read(CRDT_DIRECTORY+'/'+CRDT_PROFILE.id+'-runtime.json');
    for(const f of old.sourceBindings)assert.equal(sha(fs.readFileSync(path.join(ROOT,f.path))),f.sha256);
    const key=evidenceRoot({contractRoot:old.contractRoot,sourceBindings:old.sourceBindings,proposalsHash:old.proposalsHash,batchHash:old.batchHash});
    const checkpoint='output/k400-crdt-checkpoint-'+key+'.json';
    const backends=structuredClone(old.backends);backends.browser=null;let values=old.values,reusedFreshBrowser=false;
    if(fs.existsSync(path.join(ROOT,checkpoint))){const captured=read(checkpoint);assert.equal(captured.key,key);assert.equal(captured.format,'rcl.k400-crdt-acquisition-candidate.v1');
      if(captured.backends.browser?.binding?.browser?.sha256===NEW){backends.browser=captured.backends.browser;values=captured.values;reusedFreshBrowser=true;}
    }
    if(fs.existsSync(path.join(ROOT,checkpoint))){const archived=checkpoint+'.before-browser-refresh';if(!fs.existsSync(path.join(ROOT,archived)))fs.copyFileSync(path.join(ROOT,checkpoint),path.join(ROOT,archived));}
    // A null slot preserves the frozen environment order when the acquisition
    // engine replaces it. Reuse a completed source-bound refreshed checkpoint
    // after a verifier-only ordering failure, without claiming a new execution.
    write(checkpoint,{format:'rcl.k400-crdt-acquisition-candidate.v1',key,backends,values});
    const report=await runCrdtProfile(CRDT_PROFILE);await verifyCrdtProfile(CRDT_PROFILE);
    const retained=Object.keys(backends).filter(e=>e!=='browser');for(const e of retained)assert.deepEqual(report.backends[e],old.backends[e]);
    return{reportRoot:report.reportRoot,reacquiredEnvironments:['browser'],retainedEnvironments:retained,retainedEvidenceFreshlyExecuted:false,
      refreshedBrowserCapturedFromPreviousAttempt:reusedFreshBrowser};
  });
  await phase('selfhost:browser',async()=>{
    await runSelfhostProfile(['browser']);const f='examples/universal-stress/selfhost-columns/general-compiler-columns-browser-runtime.json';
    const report=read(f);await verifySelfhostEnvironment(report);const index=await buildSelfhostIndex();return{reportRoot:report.reportRoot,indexRoot:index.reportRoot};
  });
  await phase('ui:all-browser-flows',async()=>{
    const pending=[],retained=[];
    for(const e of UI_PROFILE.environments){const report=read(UI_DIRECTORY+'/'+UI_PROFILE.id+'-'+e+'-runtime.json');
      if(report.rounds[0].flow.driverBinding.browser.sha256===NEW){await verifyUiEnvironment(report);retained.push(e);}else pending.push(e);
    }
    const result=pending.length?await runUiProfile({environments:pending}):await verifyUiProfile();assert.equal(result.admitted,true);await verifyUiProfile();
    return{reportRoot:result.reportRoot,reacquiredEnvironments:UI_PROFILE.environments,completedFreshEnvironmentsRetainedFromPreviousAttempt:retained,retainedFreshEvidenceExecutedAgain:false};
  });
  await phase('gpu:browser-ui',async()=>{const result=await runGpuUi();assert.equal(result.admitted,true);await verifyGpuUi();return{reportRoot:result.reportRoot};});
  m.status='PASS_REACQUIRED_BROWSER_TOOLCHAIN';m.completedAt??=new Date().toISOString();saveManifest(m);
  console.log(JSON.stringify({status:m.status,reportRoot:m.reportRoot,phases:m.phases.length}));
}else throw new Error('BROWSER_REFRESH_MODE: freeze | run');
