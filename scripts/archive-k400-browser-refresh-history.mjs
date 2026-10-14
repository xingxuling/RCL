import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
const D='docs/evidence/browser-toolchain-refresh-2026-10-14',file=path.join(ROOT,D,'manifest.json');
const sha=b=>createHash('sha256').update(b).digest('hex'),m=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(m.status,'PASS_REACQUIRED_BROWSER_TOOLCHAIN');assert.equal(m.reportRoot,evidenceRoot({...m,reportRoot:undefined}));
assert.equal(m.historyStorage,undefined,'History already archived');
const baseline='ef03574c6760d97d55a8d75ce42a310fb90cef84';
const source=path.resolve(ROOT,D,'acquisition-155.0.8059.40'),destination=path.resolve(ROOT,'output/browser-toolchain-refresh-history/acquisition-155.0.8059.40');
for(const target of [source,destination])assert.ok(target.startsWith(path.resolve(ROOT)+path.sep),'History move must remain inside the workspace');
assert.ok(fs.existsSync(source));assert.ok(!fs.existsSync(destination));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
assert.deepEqual(files(source).map(f=>path.resolve(f)).sort(),m.archives.map(f=>path.resolve(ROOT,f.archivePath)).sort(),'Only this refresh owns the archive tree');
for(const f of m.archives){
  assert.ok(f.path.startsWith('examples/universal-stress/'));assert.equal(sha(fs.readFileSync(path.join(ROOT,f.archivePath))),f.sha256);
  const blob=execFileSync('git',['rev-parse',baseline+':'+f.path],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();assert.match(blob,/^[0-9a-f]{40}$/u);
  assert.equal(sha(execFileSync('git',['cat-file','blob',blob],{cwd:ROOT,windowsHide:true,maxBuffer:256*1024*1024})),f.sha256,'Historical Git bytes differ');
  f.gitCommit=baseline;f.gitBlob=blob;f.previousArchivePath=f.archivePath;
  f.archivePath='output/browser-toolchain-refresh-history/acquisition-155.0.8059.40/'+path.relative(source,path.join(ROOT,f.archivePath)).replaceAll('\\','/');
}
// Keep the local captured bytes without duplicating already committed history.
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.renameSync(source,destination);
m.acquisitionHistoryMetadataRoot=m.reportRoot;m.historyStorage='Pinned reachable Git commit/blob identities; exact local archive copies retained under ignored output';m.reportRoot=evidenceRoot({...m,reportRoot:undefined});
fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({status:'PASS_EXACT_GIT_HISTORY_PRESERVED',files:m.archives.length,bytes:m.archives.reduce((n,f)=>n+f.bytes,0),baseline,root:m.reportRoot}));
