import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
  verifyFoundationDirectNativeParity,
  verifyFoundationDirectNativeParityGeneric,
} from '../src/foundation-direct-native-parity.mjs';

const root=state=>`root:${JSON.stringify(state)}`;
function options(lowered,{livingOk=true,includeAttestation=true,attestationOk=true}={}){
  const lowering={lowered,summary:{loweredCount:lowered.length,livingLoweredStageCount:lowered.filter(x=>x.domain==='living').length}};
  const nativeExecutionAttestation=includeAttestation?{attestationRoot:'test-attestation'}:null;
  return {
    compileProgram:v=>v,
    compileDirectBytecode:async()=>({ok:true,bytecode:new Uint8Array([1]),foundationDirectLowering:lowering}),
    runReference:async()=>({state:{x:1},history:[]}),
    runNative:async()=>({state:{x:1},semanticStateRoot:root({x:1}),nativeStateRoot:'n',stateRootVerified:true,stateRootParity:true,history:[],nativeVmExecutionAttestation:nativeExecutionAttestation}),
    semanticStateRoot:root,
    semanticValue:v=>v,
    verifyLineage:()=>({required:lowered.some(x=>x.domain!=='living'),ok:true,entries:[{ok:true}]}),
    verifyGenericReceipt:()=>({required:lowered.some(x=>x.domain!=='living'),ok:true,entries:[{ok:true}],rootAlgorithm:'g',receiptRoot:'g-root'}),
    verifyLivingReceipt:()=>({required:lowered.some(x=>x.domain==='living'),ok:livingOk,rootAlgorithm:'l',receiptRoot:'l-root'}),
    verifyExecutionAttestation:attestation=>({ok:attestationOk&&attestation?.attestationRoot==='test-attestation',checks:{attestationRoot:attestationOk&&attestation?.attestationRoot==='test-attestation'}}),
  };
}

test('default entry point requires attested composite parity while preserving non-Living result shape',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'P'},options([{domain:'perception'}]));
  assert.equal(result.format,FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT);
  assert.equal(result.status,'native-verified');
  assert.equal(result.verified,true);
  assert.equal(result.parity.nativeExecutionAttestation,true);
  assert.equal(Array.isArray(result.lineage.entries),true);
  assert.equal(Array.isArray(result.domainReceipt.entries),true);
  assert.equal(result.roots.foundationDomainReceiptRoot,'g-root');
  assert.equal(result.truthBoundary.legacyFoundationDirectNativeParityEntryPointReplaced,true);
  assert.equal(result.truthBoundary.defaultEntryPointRequiresNativeExecutionAttestation,true);
  assert.equal(result.truthBoundary.defaultFoundationParityEntryPointPromotedToAttested,true);
  assert.equal(result.truthBoundary.nonLivingCompatibilityProjection,true);
});

test('Living default entry point keeps composite evidence and requires attestation',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'L'},options([{domain:'living'}]));
  assert.equal(result.status,'native-verified');
  assert.equal(result.parity.nativeExecutionAttestation,true);
  assert.equal(result.lineage.living.ok,true);
  assert.equal(result.domainReceipt.living.ok,true);
  assert.equal(result.truthBoundary.nonLivingCompatibilityProjection,false);
});

test('Living evidence failure stays fail-closed after attested default promotion',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'L'},options([{domain:'living'}],{livingOk:false}));
  assert.equal(result.status,'parity-failed');
  assert.equal(result.parity.loweringLineage,false);
  assert.equal(result.parity.domainReceipt,false);
});

test('missing execution attestation fails closed on the default Foundation parity path',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'P'},options([{domain:'perception'}],{includeAttestation:false}));
  assert.equal(result.status,'parity-failed');
  assert.equal(result.verified,false);
  assert.equal(result.parity.nativeExecutionAttestation,false);
  assert.ok(result.gaps.includes('nativeExecutionAttestation'));
});

test('invalid execution attestation cannot compensate prior composite parity success',async()=>{
  const result=await verifyFoundationDirectNativeParity({name:'P'},options([{domain:'perception'}],{attestationOk:false}));
  assert.equal(result.status,'parity-failed');
  assert.equal(result.verified,false);
  assert.equal(result.executionAttestationVerification.ok,false);
});

test('legacy generic verifier remains explicitly addressable',async()=>{
  assert.equal(typeof verifyFoundationDirectNativeParityGeneric,'function');
  const result=await verifyFoundationDirectNativeParityGeneric({name:'legacy'},options([{domain:'perception'}]));
  assert.equal(typeof result,'object');
  assert.equal(result.status,'native-verified');
});
