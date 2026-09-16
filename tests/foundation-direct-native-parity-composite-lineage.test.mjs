import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyFoundationDirectNativeParityComposite } from '../src/foundation-direct-native-parity-composite.mjs';

const root = state => `root:${JSON.stringify(state)}`;
function deps({ livingOk=true, genericOk=true }={}) {
  let lineageLowering = null;
  const lowering = {
    lowered:[
      { domain:'perception', syntheticRule:'p' },
      { domain:'living', syntheticRule:'l-sense' },
      { domain:'living', syntheticRule:'l-cycle' },
    ],
    summary:{ loweredCount:3, livingLoweredStageCount:2 },
  };
  return {
    getLineageLowering:()=>lineageLowering,
    options:{
      compileProgram:value=>value,
      compileDirectBytecode:async()=>({ok:true,bytecode:new Uint8Array([1]),foundationDirectLowering:lowering}),
      runReference:async()=>({state:{x:1},history:[]}),
      runNative:async()=>({state:{x:1},semanticStateRoot:root({x:1}),nativeStateRoot:'n',stateRootVerified:true,stateRootParity:true,history:[]}),
      semanticStateRoot:root,
      semanticValue:value=>value,
      verifyLineage:input=>{ lineageLowering=input; return {required:true,ok:genericOk}; },
      verifyGenericReceipt:()=>({required:true,ok:genericOk,rootAlgorithm:'g',receiptRoot:'g-root'}),
      verifyLivingReceipt:()=>({required:true,ok:livingOk,rootAlgorithm:'l',receiptRoot:'l-root'}),
    }
  };
}

test('generic lineage sees only non-Living lowering while Living receipt supplies Living lineage evidence', async()=>{
  const injected=deps();
  const result=await verifyFoundationDirectNativeParityComposite({name:'mixed'},injected.options);
  assert.deepEqual(injected.getLineageLowering().lowered.map(item=>item.domain),['perception']);
  assert.equal(result.lineage.generic.ok,true);
  assert.equal(result.lineage.living.ok,true);
  assert.equal(result.lineage.living.evidenceSource,'living-staged-receipt');
  assert.equal(result.parity.loweringLineage,true);
  assert.equal(result.status,'native-verified');
});

test('Living receipt failure is non-compensatory for lowering lineage', async()=>{
  const injected=deps({livingOk:false});
  const result=await verifyFoundationDirectNativeParityComposite({name:'mixed'},injected.options);
  assert.equal(result.lineage.generic.ok,true);
  assert.equal(result.lineage.living.ok,false);
  assert.equal(result.parity.loweringLineage,false);
  assert.equal(result.parity.domainReceipt,false);
  assert.equal(result.status,'parity-failed');
});

test('generic lineage failure remains non-compensatory even when Living evidence passes', async()=>{
  const injected=deps({genericOk:false,livingOk:true});
  const result=await verifyFoundationDirectNativeParityComposite({name:'mixed'},injected.options);
  assert.equal(result.lineage.generic.ok,false);
  assert.equal(result.lineage.living.ok,true);
  assert.equal(result.parity.loweringLineage,false);
  assert.equal(result.status,'parity-failed');
});
