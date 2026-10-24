import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { createNativeUiRuntime } from '../src/ui/ui-event.mjs';
import { isRclIsoDate } from '../src/ui/ui-controls.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml, traceNativeUiWebApplication } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity, traceNativeUiAndroidApplication } from '../src/android-application-compiler.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT,'examples/native-ui/advanced-form-controls.rcl'),'utf8');
const ui=()=>compileReality(SOURCE).nativeUis[0];
const web=()=>compileRclWebApplication(SOURCE,{schema:'rcl.native-ui.web-target.v0.1'});
const android=()=>compileRclAndroidApplication(SOURCE,{schema:'rcl.native-ui.android-target.v0.1',applicationId:'com.taowind.rcl.form'});
const events=[
  {nodeId:'ContactMethod',type:'change',payload:{value:'post'}},
  {nodeId:'ScheduleDate',type:'change',payload:{value:'2028-02-29'}},
  {nodeId:'NotesArea',type:'input',payload:{value:'Hello\nworld'}}
];
const FAIL=(src,expected)=>assert.match(tryCompileReality(src).diagnostics[0]?.message??'',expected);

test('advanced form: canonical semantic root stable and node value bindings remain typed',()=>{
  const a=ui();assert.equal(validateCanonicalNativeUi(a),true);assert.equal(a.semanticRoot,ui().semanticRoot);
  for(const id of ['ContactMethod','ScheduleDate','NotesArea']){
    const node=a.viewTree.children.find(x=>x.id===id);
    assert.equal(node.bindings.find(x=>x.property==='value').expression.valueType,'Text');
    assert.equal(node.events[0].parameters[0].valueType,'Text');
  }
});

test('advanced form: edits and semantic traces have matching final state',()=>{
  const rt=createNativeUiRuntime(ui());
  for(const e of events)rt.dispatch(e.nodeId,e.type,e.payload);
  assert.deepEqual(rt.snapshot(),{locked:false,date:'2028-02-29',contact:'post',notes:'Hello\nworld'});
  const w=web(),a=android();assert.equal(w.uiProgramRoot,a.uiProgramRoot);
  assert.deepEqual(traceNativeUiWebApplication(w,events).finalState,traceNativeUiAndroidApplication(a,events).finalState);
});

test('advanced form: invalid date, illegal radio option and bad value type are rejected atomically',()=>{
  const rt=createNativeUiRuntime(ui()),before=rt.snapshot();
  const candidates=[
    ['ScheduleDate','change',{value:'2026-02-29'},/RCL_UI_DATE_VALUE/],
    ['ScheduleDate','change',{value:'2028-02-30'},/RCL_UI_DATE_VALUE/],
    ['ScheduleDate','change',{value:'0000-12-12'},/RCL_UI_DATE_VALUE/],
    ['ScheduleDate','change',{value:'2026-2-3'},/RCL_UI_DATE_VALUE/],
    ['ScheduleDate','change',{value:20261025},/RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/],
    ['ContactMethod','change',{value:'telegram'},/RCL_UI_SELECT_VALUE/],
    ['NotesArea','input',{value:false},/RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/]
  ];
  for(const [id,type,payload,error] of candidates)assert.throws(()=>rt.dispatch(id,type,payload),error);
  assert.deepEqual(rt.snapshot(),before);assert.equal(rt.trace.length,0);
});

test('advanced form: disabled and readonly states reject events without mutations',()=>{
  const rt=createNativeUiRuntime(ui());rt.dispatch('ToggleLocked','activate');
  for(const e of events)assert.throws(()=>rt.dispatch(e.nodeId,e.type,e.payload),/RCL_UI_EVENT_(READ_ONLY|DISABLED)/);
  assert.deepEqual(rt.snapshot(),{locked:true,date:'2026-10-25',contact:'email',notes:'Hello from RCL'});
  assert.equal(rt.trace.length,1);
});

test('advanced form: date validation includes Gregorian leap-year and calendar boundaries',()=>{
  for(const value of ['2028-02-29','2000-02-29','2026-12-31','0001-01-01','9999-12-31']) assert.equal(isRclIsoDate(value),true);
  for(const value of ['1900-02-29','0000-01-01','2026-13-01','2026-04-31','2026-02-29','2026-02-3','2026-11-00','2026-11-32','2026/11/12']) assert.equal(isRclIsoDate(value),false);
});

test('advanced form: compiler rejects invalid choices and date initial state',()=>{
  FAIL(SOURCE.replace('"email|phone|post"','"post|post"'),/RCL_UI_SELECT_OPTIONS/);
  FAIL(SOURCE.replace('state date : Text = "2026-10-25"','state date : Text = "2026-02-30"'),/RCL_UI_DATE_INITIAL/);
  FAIL(SOURCE.replace('state contact : Text = "email"','state contact : Text = "telegram"'),/RCL_UI_RADIO_INITIAL/);
  FAIL(SOURCE.replace('on input(value : Text) { set notes <- value }','on input(value : Truth) { set notes <- value }'),/RCL_UI_EVENT_PARAMETER_TYPE/);
});

test('advanced form: Web widgets are native controls with matching event contract',()=>{
  const html=emitStandaloneRclWebHtml(web());
  assert.match(html,/<fieldset[^>]*data-rcl-node="ContactMethod"/);
  assert.match(html,/<input type="radio" name="rcl-ContactMethod" value="phone"/);
  assert.match(html,/<input[^>]*data-rcl-node="ScheduleDate"[^>]*type="date"/);
  assert.match(html,/<textarea[^>]*data-rcl-node="NotesArea"/);
  assert.match(html,/host=event\.target\.closest/);
  assert.match(html,/el instanceof HTMLTextAreaElement/);
  assert.match(html,/rclIsoDate\(payload.value\)/);
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)?.[1]??'');
});

test('advanced form: Android uses native DatePicker/RadioGroup and guarded events',()=>{
  const code=emitNativeAndroidActivity(android());
  assert.match(code,/new RadioGroup\(this\)/);
  assert.match(code,/new RadioButton\(this\)/);
  assert.match(code,/new DatePicker\(this\)/);
  assert.match(code,/setOnDateChangedListener/);
  assert.match(code,/setOnCheckedChangeListener/);
  assert.match(code,/getChildAt\(i\)\.setEnabled/);
  assert.match(code,/LocalDate\.parse/);
  assert.match(code,/TYPE_TEXT_FLAG_MULTI_LINE/);
  assert.match(code,/RCL_UI_DATE_VALUE:ScheduleDate/);
  assert.match(code,/RCL_UI_SELECT_VALUE:ContactMethod/);
});

test('advanced form: sealed IR cannot change initial date without validation failure',()=>{
  const altered=structuredClone(ui());
  altered.state.find(x=>x.id==='date').initial='2026-02-30';
  assert.throws(()=>validateCanonicalNativeUi(altered),/RCL_UI_DATE_INITIAL/);
});
