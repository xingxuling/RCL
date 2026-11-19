import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request} from 'node:http';
import {setTimeout as wait} from 'node:timers/promises';
import {UI_PROFILE,uiVariant,UI_EVENTS} from '../scripts/k400-ui-definitions.mjs';
import {lowerNativeUiEvent,projectNativeUiResult} from '../src/ui/native-event-lowering.mjs';
import {createNativeUiEventRuntime} from '../src/ui/native-event-runtime.mjs';
import {createNativeUiWebBridge} from '../src/ui/native-web-bridge.mjs';
import {runReality} from '../src/runtime.mjs';
const source=UI_PROFILE.source();
const example = (name) => readFileSync(new URL('../examples/native-ui/' + name + '.rcl', import.meta.url), 'utf8');
const event = (nodeId, type = 'activate', value) => ({nodeId, type, payload: value === undefined ? {} : {value}});

async function postSplitEvent(bridge, input, splitText) {
  const body = Buffer.from(JSON.stringify({event: input}));
  const split = body.indexOf(Buffer.from(splitText)) + 1;
  const response = new Promise((resolve, reject) => {
    const send = request(bridge.url + '/api/event', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-rcl-ui-token': bridge.token},
    }, async (received) => {
      try {
        const chunks = [];
        for await (const chunk of received) chunks.push(chunk);
        resolve({status: received.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))});
      } catch (error) { reject(error); }
    });
    send.on('error', reject);
    send.write(body.subarray(0, split));
    void wait(15).then(() => send.end(body.subarray(split)));
  });
  return response;
}

async function assertNativeDenial(runtime, input, code, source) {
  const before = runtime.snapshot();
  const ledgerLength = runtime.ledger().length;
  await assert.rejects(runtime.dispatch(input), (error) => {
    const diagnostic = error.nativeError?.diagnostic;
    assert.equal(diagnostic?.code, code);
    const {offset, length} = diagnostic.span;
    assert.equal(source.slice(offset, offset + length), 'on');
    return true;
  });
  assert.equal(runtime.failures().at(-1).code, code);
  assert.equal(runtime.ledger().length, ledgerLength);
  assert.deepEqual(runtime.snapshot(), before);
}
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
    const explicitNull=await fetch(bridge.url+'/api/event',{method:'POST',headers,body:JSON.stringify({event:UI_EVENTS[0],authorized:null})});assert.equal(explicitNull.status,400);assert.equal((await explicitNull.json()).code,'RCL_UI_NATIVE_AUTHORIZATION_TYPE');
    const absentEvent=await fetch(bridge.url+'/api/event',{method:'POST',headers,body:'{}'});assert.equal(absentEvent.status,400);assert.equal((await absentEvent.json()).code,'RCL_UI_NATIVE_EVENT_UNKNOWN');
    assert.deepEqual(bridge.runtime.snapshot(),before);assert.equal((await fetch(bridge.url+'/api/state')).status,403);
    assert.match(bridge.html,/window\.rclNativeBridge/u);assert.ok(!bridge.html.includes('count + step'));
  }finally{await bridge.dispose();}
});

test('native form admission preserves exact Text and honors the declared validation scope', async () => {
  const form = example('scoped-forms');
  const bridge = await createNativeUiWebBridge(form);
  const {runtime} = bridge;
  try {
    const save = event('SaveContact');
    await assertNativeDenial(runtime, save, 'RCL_UI_FORM_INVALID', form);
    const submit = () => fetch(bridge.url + '/api/event', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-rcl-ui-token': bridge.token},
      body: JSON.stringify({event: save, expectedStateRoot: runtime.snapshot().stateRoot}),
    });
    const whitespace = 'a\u000b@example.com';
    await runtime.dispatch(event('Email', 'input', whitespace));
    assert.equal(runtime.snapshot().state.email, whitespace);
    const denied = await submit();
    assert.equal(denied.status, 400);
    assert.deepEqual(await denied.json(), {code: 'RCL_UI_FORM_INVALID'});

    const before = runtime.snapshot();
    for (const value of ['a\u0000b', 'a\uD800b']) {
      await assert.rejects(runtime.dispatch(event('Email', 'input', value)), /RCL_NATIVE_DATA_TEXT_UNREPRESENTABLE/u);
    }
    assert.deepEqual(runtime.snapshot(), before);
    const valid = '😀u000b@例子.测试';
    const edited = await postSplitEvent(bridge, event('Email', 'input', valid), '😀');
    assert.equal(edited.status, 200);
    assert.equal(edited.body.snapshot.state.email, valid);
    const accepted = await submit();
    assert.equal(accepted.status, 200);
    const {snapshot} = await accepted.json();
    assert.deepEqual(snapshot.state, {email: valid, nickname: '', contactSaved: true, profileSaved: false});
    await assertNativeDenial(runtime, event('SaveProfile'), 'RCL_UI_FORM_INVALID', form);
  } finally { await bridge.dispose(); }
});

test('native input admission checks typed values and dynamic control permissions', async () => {
  const controls = example('typed-control-showcase');
  const runtime = await createNativeUiEventRuntime(controls);
  try {
    await assertNativeDenial(runtime, event('VolumeSlider', 'input', 24), 'RCL_UI_SLIDER_VALUE', controls);
    await runtime.dispatch(event('VolumeSlider', 'input', 25));
    assert.equal(runtime.snapshot().state.volume, 25);
    await assertNativeDenial(runtime, event('PlanSelect', 'change', 'unlisted'), 'RCL_UI_SELECT_VALUE', controls);
    await runtime.dispatch(event('ToggleLock'));
    await assertNativeDenial(runtime, event('TermsCheck', 'change', true), 'RCL_UI_EVENT_DISABLED', controls);
    await assertNativeDenial(runtime, event('SoundSwitch', 'change', false), 'RCL_UI_EVENT_READ_ONLY', controls);
  } finally { await runtime.dispose(); }

  const dateForm = example('advanced-form-controls');
  const dates = await createNativeUiEventRuntime(dateForm);
  try {
    await assertNativeDenial(dates, event('ScheduleDate', 'change', '1900-02-29'), 'RCL_UI_DATE_VALUE', dateForm);
    await dates.dispatch(event('ScheduleDate', 'change', '2000-02-29'));
    assert.equal(dates.snapshot().state.date, '2000-02-29');
  } finally { await dates.dispose(); }
});

test('native event admission blocks hidden handlers and active modal background actions', async () => {
  const modal = example('modal-workspace');
  const runtime = await createNativeUiEventRuntime(modal);
  try {
    await assertNativeDenial(runtime, event('Confirm'), 'RCL_UI_EVENT_HIDDEN', modal);
    await runtime.dispatch(event('OpenDialog'));
    await assertNativeDenial(runtime, event('Increment'), 'RCL_UI_MODAL_BLOCKED', modal);
    await runtime.dispatch(event('Confirm'));
    await runtime.dispatch(event('Increment'));
    assert.deepEqual(runtime.snapshot().state, {dialogOpen: false, count: 1, confirmation: 'Confirmed'});
  } finally { await runtime.dispose(); }
});

test('native navigation seals the route with state, and commits both under the same authorization', async () => {
  const routed = readFileSync(new URL('./fixtures/native-ui-routed-modal.rcl', import.meta.url), 'utf8');
  const bridge = await createNativeUiWebBridge(routed);
  const {runtime} = bridge;
  try {
    const initial = runtime.snapshot();
    assert.deepEqual(initial.navigation, {currentRoute: 'home', target: 'Home'});
    await assertNativeDenial(runtime, event('ReturnHome'), 'RCL_UI_EVENT_HIDDEN', routed);
    const opened = await runtime.dispatch(event('OpenDialog'));
    const dialog = runtime.snapshot();
    assert.deepEqual(dialog.state, initial.state);
    assert.notEqual(dialog.stateRoot, initial.stateRoot);
    assert.equal(opened.beforeRoute, 'home');
    assert.equal(opened.afterRoute, 'dialog');
    assert.deepEqual(opened.nativeResult.history[0].authority.needs.map(({capability}) => capability), ['ui.mutate', 'ui.navigate']);
    await assertNativeDenial(runtime, event('ShowHome'), 'RCL_UI_MODAL_BLOCKED', routed);
    await assert.rejects(runtime.dispatch(event('ReturnHome'), {authorized: false}), /RCL_AUTHORITY_DENIED/u);
    assert.deepEqual(runtime.snapshot(), dialog);
    const closed = await runtime.dispatch(event('ReturnHome'));
    assert.equal(closed.projection.navigation.currentRoute, 'home');
    assert.equal(closed.projection.state.homeVisible, false);
    await assertNativeDenial(runtime, event('OpenDialog'), 'RCL_UI_EVENT_HIDDEN', routed);
    await runtime.dispatch(event('ShowHome'));
    assert.equal(runtime.snapshot().stateRoot, initial.stateRoot);
    const response = await fetch(bridge.url + '/api/event', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-rcl-ui-token': bridge.token},
      body: JSON.stringify({event: event('OpenDialog'), expectedStateRoot: initial.stateRoot, expectedRevision: initial.revision}),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {code: 'RCL_UI_NATIVE_STALE_STATE'});
    assert.equal(runtime.snapshot().revision, 3);
    const script = bridge.html.match(/<script>([\s\S]*?)<\/script>/u)[1];
    assert.doesNotThrow(() => new Function(script));
    assert.match(script, /expectedRevision: snapshot\.revision/u);
    assert.doesNotMatch(script, /homeVisible/u);
  } finally { await bridge.dispose(); }
});
