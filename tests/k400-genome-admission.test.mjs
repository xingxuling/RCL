import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceRoot} from '../src/universal-program-stress.mjs';
import {semanticStateRootForAlgorithm} from '../src/semantic-state-root.mjs';
import {verifyGenome} from '../scripts/k400-genome-engine.mjs';
import governance from '../scripts/k400-genomes/governance.mjs';
const receipt=()=>JSON.parse(fs.readFileSync(new URL('../examples/universal-stress/genomes/governance-reactive-runtime.json',import.meta.url),'utf8'));
const reseal=report=>{report.reportRoot=evidenceRoot({...report,generatedAt:undefined,reportRoot:undefined});};
const replaceValue=(report,oldRef,value)=>{
  delete report.values[oldRef];const next=evidenceRoot(value);report.values[next]=value;
  for(const backend of Object.values(report.backends))for(const row of [...backend.rounds,...backend.inputResults,...backend.trials]){
    if(row.valueRef===oldRef){row.valueRef=next;row.stateRoot=value.stateRoot;}
    if(row.broken?.valueRef===oldRef)row.broken.valueRef=next;
  }
};
test('genome admission binds all credited targets and the complete frozen independent repairs',()=>{
  const result=verifyGenome(governance);assert.equal(result.admitted,true);assert.equal(result.claims.length,8);
  assert.equal(new Set(result.claims.map(claim=>claim.id)).size,8);
});
test('rehashed transaction authority, witness and before-root tampering is rejected',()=>{
  for(const alter of [value=>value.history[0].actor='other',value=>value.history[0].witnesses=['forged'],value=>value.history[0].beforeRoot='0'.repeat(64)]){
    const report=receipt(),ref=report.backends.windows.rounds[0].valueRef,value=structuredClone(report.values[ref]);alter(value);replaceValue(report,ref,value);reseal(report);
    assert.throws(()=>verifyGenome(governance,report));
  }
});
test('a freshly rooted wrong audit result is rejected by the independent oracle',()=>{
  const report=receipt(),ref=report.backends.windows.inputResults[1].valueRef,value=structuredClone(report.values[ref]);
  value.state['compiler.audit_count']=999;value.stateRoot=semanticStateRootForAlgorithm(value.state,'rcl.semantic-state-root.v2');
  replaceValue(report,ref,value);reseal(report);assert.throws(()=>verifyGenome(governance,report));
});
test('omitted target records and a generic transport failure cannot stand in for semantic rejection',()=>{
  const omitted=receipt();delete omitted.backends.android;reseal(omitted);assert.throws(()=>verifyGenome(governance,omitted));
  const rejected=receipt();rejected.backends.windows.trials[0].broken={kind:'compile-rejected',semanticCode:'NETWORK_TIMEOUT',diagnostic:'timeout'};
  reseal(rejected);assert.throws(()=>verifyGenome(governance,rejected));
});
