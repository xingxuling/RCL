import test from 'node:test';
import assert from 'node:assert/strict';
import {UI_PROFILE,uiVariant,UI_EVENTS} from '../scripts/k400-ui-definitions.mjs';
import {lowerNativeUiEvent,projectNativeUiResult} from '../src/ui/native-event-lowering.mjs';
import {createNativeUiEventRuntime} from '../src/ui/native-event-runtime.mjs';
import {createNativeUiWebBridge} from '../src/ui/native-web-bridge.mjs';
import {runReality} from '../src/runtime.mjs';
const source=UI_PROFILE.source();
test('negative inputs and Text labels are computed by ordinary RCL; invalid authority types fail closed',async()=>{
  const text=uiVariant(source,{initial:-7,step:-3}),initial=lowerNativeUiEvent(text),first=projectNativeUiResult(initial,await runReality(initial.source));
  assert.equal(first.state.count,-7);assert.equal(first.rendered.CounterText.value,'计数：-7');
  const lowered=lowerNativeUiEvent(text,{state:first.state,event:UI_EVENTS[0]}),next=projectNativeUiResult(lowered,await runReality(lowered.source));
  assert.equal(next.state.count,-10);assert.equal(next.derived.count_label,'计数：-10');
  assert.throws(()=>lowerNativeUiEvent(text,{event:UI_EVENTS[0],authorized:'false'}),/RCL_UI_NATIVE_AUTHORIZATION_TYPE/u);
  assert.throws(()=>lowerNativeUiEvent(text,{state:{count:0}}),/RCL_UI_NATIVE_STATE_SHAPE/u);
});
test('native event runtime preserves committed state after denied authority and stale revisions',async()=>{
  const runtime=await createNativeUiEventRuntime(source);
  try{for(const e of UI_EVENTS)await runtime.dispatch(e);const before=runtime.snapshot();assert.equal(before.state.count,1);assert.equal(before.revision,4);
    await assert.rejects(()=>runtime.dispatch(UI_EVENTS[0],{authorized:false}),/RCL_AUTHORITY_DENIED/u);assert.deepEqual(runtime.snapshot(),before);assert.equal(runtime.failures()[0].code,'RCL_AUTHORITY_DENIED');
    await assert.rejects(()=>runtime.dispatch(UI_EVENTS[0],{expectedStateRoot:'0'.repeat(64)}),/RCL_UI_NATIVE_STALE_STATE/u);assert.deepEqual(runtime.snapshot(),before);
    assert.deepEqual(runtime.ledger().map(r=>r.nativeResult.history.map(h=>h.rule)),[['paint'],...Array.from({length:4},()=>['dispatch','paint'])]);
  }finally{await runtime.dispose();}
});
test('authenticated loopback bridge transports native projections and does not grant authority from a string',async()=>{
  const bridge=await createNativeUiWebBridge(source),headers={'content-type':'application/json','x-rcl-ui-token':bridge.token};
  try{const before=await(await fetch(bridge.url+'/api/state',{headers})).json();assert.equal(before.state.count,0);
    const response=await fetch(bridge.url+'/api/event',{method:'POST',headers,body:JSON.stringify({event:UI_EVENTS[0],authorized:'false',expectedStateRoot:before.stateRoot})});assert.equal(response.status,400);assert.equal((await response.json()).code,'RCL_UI_NATIVE_AUTHORIZATION_TYPE');
    assert.deepEqual(bridge.runtime.snapshot(),before);assert.equal((await fetch(bridge.url+'/api/state')).status,403);
    assert.match(bridge.html,/window\.rclNativeBridge/u);assert.ok(!bridge.html.includes('count + step'));
  }finally{await bridge.dispose();}
});
