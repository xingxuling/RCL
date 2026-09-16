import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyFoundationDirectNativeParityComposite } from '../src/foundation-direct-native-parity-composite.mjs';

const root=state=>`root:${JSON.stringify(state)}`;
const semanticValue=value=>value;
const livingItem={domain:'living',declaration:'organism',directive:'Live',directiveIndex:0,stage:'sense',stageIndex:1,stageCount:1,syntheticRule:'sense',stateTargets:['sense'],witness:'ws',authorityClass:'intrinsic-life-cycle',sourceReality:'organism',stepIndex:1,stepCount:1,cycleIndex:null,cycleName:null,originalWitnesses:[],livingNeeds:[],changeModes:['sense-sync']};
const physicalItem={domain:'physical',declaration:'law',directive:'Advance',directiveIndex:1,syntheticRule:'law',stateTargets:['x'],witness:'wp',authorityClass:'natural-law',sourceReality:'world',dtExpression:{kind:'LiteralExpr',valueType:'Number',value:1},stepIndex:1,stepCount:1,originalWitnesses:[]};
function lowering(items=[livingItem]){ return { lowered:items, summary:{loweredCount:items.length,livingLoweredStageCount:items.filter(i=>i.domain==='living').length} }; }
function deps({items=[livingItem],genericOk=true,livingOk=true,lineageOk=true,state={x:1},nativeState={x:1},nativeError=null}={}){
  const l=lowering(items);
  return {
    compileProgram:v=>v,
    compileDirectBytecode:async()=>({ok:true,bytecode:new Uint8Array([1]),foundationDirectLowering:l}),
    runReference:async()=>({state,history:[{kind:'reference'}]}),
    runNative:async()=>{ if(nativeError) throw nativeError; return {state:nativeState,semanticStateRoot:root(nativeState),nativeStateRoot:'native',stateRootVerified:true,stateRootParity:true,history:[{kind:'native'}]}; },
    semanticStateRoot:root, semanticValue,
    verifyLineage:()=>({ok:lineageOk}),
    verifyGenericReceipt:received=>({required:received.lowered.length>0,ok:genericOk,receiptRoot:`generic:${received.lowered.map(i=>i.domain).join(',')}`,rootAlgorithm:'generic'}),
    verifyLivingReceipt:received=>({required:received.lowered.some(i=>i.domain==='living'),ok:livingOk,receiptRoot:`living:${livingOk}`,rootAlgorithm:'living'}),
  };
}

test('composite parity can certify Living when generic non-Living receipt and Living receipt both pass',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps());
  assert.equal(result.status,'native-verified');
  assert.equal(result.domainReceipt.ok,true);
  assert.equal(result.truthBoundary.compositeReceiptIntegratesLiving,true);
});

test('generic receipt receives Living-filtered lowering only',async()=>{
  let seen=[]; const d=deps({items:[livingItem,physicalItem]});
  d.verifyGenericReceipt=received=>{ seen=received.lowered.map(i=>i.domain); return {required:true,ok:true,receiptRoot:'g',rootAlgorithm:'g'}; };
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},d);
  assert.deepEqual(seen,['physical']); assert.equal(result.verified,true);
});

test('Living receipt failure is non-compensating',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({livingOk:false}));
  assert.equal(result.status,'parity-failed'); assert.equal(result.parity.domainReceipt,false);
});

test('generic non-Living receipt failure is non-compensating',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({items:[livingItem,physicalItem],genericOk:false}));
  assert.equal(result.status,'parity-failed'); assert.equal(result.parity.domainReceipt,false);
});

test('lineage failure remains non-compensating',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({lineageOk:false}));
  assert.equal(result.status,'parity-failed'); assert.ok(result.gaps.includes('loweringLineage'));
});

test('final state mismatch cannot be repaired by receipt success',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({state:{x:1},nativeState:{x:2}}));
  assert.equal(result.status,'parity-failed'); assert.equal(result.parity.state,false);
});

test('native VM missing remains native-blocked',async()=>{
  const error=Object.assign(new Error('missing'),{code:'RCL_NATIVE_VM_MISSING'});
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({nativeError:error}));
  assert.equal(result.status,'native-blocked'); assert.deepEqual(result.gaps,['native-vm-missing']);
});

test('compile failure remains compile-blocked',async()=>{
  const d=deps(); d.compileDirectBytecode=async()=>({ok:false,diagnostics:[{code:'X'}]});
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},d);
  assert.equal(result.status,'compile-blocked'); assert.equal(result.verified,false);
});

test('composite receipt root binds Living failure evidence',async()=>{
  const good=await verifyFoundationDirectNativeParityComposite({name:'P'},deps());
  const bad=await verifyFoundationDirectNativeParityComposite({name:'P'},deps({livingOk:false}));
  assert.notEqual(good.roots.foundationCompositeReceiptRoot,bad.roots.foundationCompositeReceiptRoot);
});

test('new composite entry point does not pretend the legacy entry point was replaced',async()=>{
  const result=await verifyFoundationDirectNativeParityComposite({name:'P'},deps());
  assert.equal(result.truthBoundary.legacyFoundationDirectNativeParityEntryPointReplaced,false);
  assert.equal(result.truthBoundary.livingSenseOnlyReferenceGapRemainsFailClosed,true);
});
