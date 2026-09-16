import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
  verifyFoundationDirectNativeParity,
  verifyFoundationDirectNativeParityGeneric,
} from '../src/foundation-direct-native-parity.mjs';

const root=state=>`root:${JSON.stringify(state)}`;
function options(lowered,{livingOk=true}={}){
  const lowering={lowered,summary:{loweredCount:lowered.length,livingLoweredStageCount:lowered.filter(x=>x.domain==='living').length}};
  return {
    compileProgram:v=>v,
    compileDirectBytecode:async()=>({ok:true,bytecode:new Uint8Array([1]),foundationDirectLowering:lowering}),
    runReference:async()=>({state:{x:1},history:[]}),
    runNative:async()=>({state:{x:1},semanticStateRoot:root({x:1}),nativeStateRoot:'n',stateRootVerified:true,stateRootParity:true,history:[]}),
    semanticStateRoot:root,
    semanticValue:v=>v,
    verifyLineage:()=>({required:lowered.some(x=>x.domain!=='living'),ok:true,entries:[{ok:true}]}),
    verifyGenericReceipt:()=>({required:lowered.some(x=>x.domain!=='living'),ok:true,entries:[{ok:true}],rootAlgorithm:'g',receiptRoot:'g-root'}),
    verifyLivingReceipt:()=>({required:lowered.some(x=>x.domain==='living'),ok:livingOk,rootAlgorithm:'l',receiptRoot:'l-root'}),
  };
}

test('default entry point promotes composite parity while preserving non-Living result shape',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'P'},options([{domain:'perception'}]));
  assert.equal(result.format,FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT);
  assert.equal(result.status,'native-verified');
  assert.equal(Array.isArray(result.lineage.entries),true);
  assert.equal(Array.isArray(result.domainReceipt.entries),true);
  assert.equal(result.roots.foundationDomainReceiptRoot,'g-root');
  assert.equal(result.truthBoundary.legacyFoundationDirectNativeParityEntryPointReplaced,true);
  assert.equal(result.truthBoundary.nonLivingCompatibilityProjection,true);
});

test('Living default entry point keeps composite evidence instead of flattening it',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'L'},options([{domain:'living'}]));
  assert.equal(result.status,'native-verified');
  assert.equal(result.lineage.living.ok,true);
  assert.equal(result.domainReceipt.living.ok,true);
  assert.equal(result.truthBoundary.nonLivingCompatibilityProjection,false);
});

test('Living evidence failure stays fail-closed after default promotion',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'L'},options([{domain:'living'}],{livingOk:false}));
  assert.equal(result.status,'parity-failed');
  assert.equal(result.parity.loweringLineage,false);
  assert.equal(result.parity.domainReceipt,false);
});

test('legacy generic verifier remains explicitly addressable',async()=>{
  const result=await verifyFoundationDirectNativeParityGeneric({name:'legacy'});
  assert.equal(typeof result,'object');
});
