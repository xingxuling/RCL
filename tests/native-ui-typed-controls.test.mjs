import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileReality, tryCompileReality} from '../src/compiler.mjs';
import {createNativeUiRuntime} from '../src/ui/ui-event.mjs';
import {validateCanonicalNativeUi} from '../src/ui/ui-validator.mjs';
import {serializeNativeUiProgram, deserializeNativeUiProgram} from '../src/ui/ui-ir.mjs';
import {compileRclWebApplication, emitStandaloneRclWebHtml, traceNativeUiWebApplication} from '../src/web-application-compiler.mjs';
import {compileRclAndroidApplication, emitNativeAndroidActivity, traceNativeUiAndroidApplication} from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = fs.readFileSync(path.join(ROOT, 'examples/native-ui/typed-control-showcase.rcl'),'utf8');
const compilation=()=>compileReality(SOURCE).nativeUis[0];
const web=()=>compileRclWebApplication(SOURCE,{schema:'rcl.native-ui.web-target.v0.1'});
const android=()=>compileRclAndroidApplication(SOURCE,{schema:'rcl.native-ui.android-target.v0.1',applicationId:'com.taowind.rcl.typed'});
const FAIL=(s,pattern)=>assert.match(tryCompileReality(s).diagnostics[0]?.message ?? '',pattern);
const events=[
  {nodeId:'TermsCheck',type:'change',payload:{value:true}},
  {nodeId:'SoundSwitch',type:'change',payload:{value:false}},
  {nodeId:'VolumeSlider',type:'input',payload:{value:75}},
  {nodeId:'PlanSelect',type:'change',payload:{value:'enterprise'}},
];

test('typed controls: compiler binds values with correct types and canonical root is stable',()=>{
  const ui=compilation();assert.equal(validateCanonicalNativeUi(ui),true);
  assert.equal(compilation().semanticRoot,ui.semanticRoot);
  assert.equal(deserializeNativeUiProgram(serializeNativeUiProgram(ui),validateCanonicalNativeUi).semanticRoot,ui.semanticRoot);
  for(const [nodeId,type] of [['TermsCheck','Truth'],['SoundSwitch','Truth'],['VolumeSlider','Number'],['PlanSelect','Text']]){
    const node=ui.viewTree.children.find(x=>x.id===nodeId);
    assert.equal(node.bindings.find(x=>x.property==='value').expression.valueType,type);
    assert.equal(node.events[0].parameters[0].valueType,type);
  }
});

test('typed controls: canonical runtime executes and yields deterministic state and trace',()=>{
  const rt=createNativeUiRuntime(compilation());for(const e of events)rt.dispatch(e.nodeId,e.type,e.payload);
  assert.deepEqual(rt.snapshot(),{locked:false,agreed:true,sound:false,volume:75,plan:'enterprise'});
  assert.equal(rt.trace.length,4);
});

test('typed controls: guards reject malformed and out of range events atomically',()=>{
 const rt=createNativeUiRuntime(compilation());
 const cases=[['TermsCheck','change',{value:'yes'},/RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/],['VolumeSlider','input',{value:101},/RCL_UI_SLIDER_VALUE/],['VolumeSlider','input',{value:22},/RCL_UI_SLIDER_VALUE/],['VolumeSlider','input',{value:NaN},/RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/],['PlanSelect','change',{value:'admin'},/RCL_UI_SELECT_VALUE/]];
 for(const [id,type,payload,reason] of cases)assert.throws(()=>rt.dispatch(id,type,payload),reason);
 assert.deepEqual(rt.snapshot(),{locked:false,agreed:false,sound:true,volume:20,plan:'pro'});
 assert.equal(rt.trace.length,0);
 rt.dispatch('ToggleLock','activate');
 for(const [id,type,payload] of [['TermsCheck','change',{value:true}],['SoundSwitch','change',{value:false}],['VolumeSlider','input',{value:75}],['PlanSelect','change',{value:'basic'}]])assert.throws(()=>rt.dispatch(id,type,payload),/RCL_UI_EVENT_(DISABLED|READ_ONLY)/);
 assert.equal(rt.trace.length,1);
});

test('typed controls: generated Web elements and value conversion preserve semantic types',()=>{
 const html=emitStandaloneRclWebHtml(web());
 assert.match(html, /data-rcl-node="TermsCheck"[^>]*type="checkbox"/);
 assert.match(html, /data-rcl-node="SoundSwitch"[^>]*role="switch"[^>]*type="checkbox"/);
 assert.match(html, /data-rcl-node="VolumeSlider"[^>]*min="0"[^>]*max="100"[^>]*step="5"[^>]*type="range"/);
 assert.match(html, /<select[^>]*data-rcl-node="PlanSelect"/);
 assert.match(html, /<option value="enterprise">enterprise<\/option>/);
 assert.match(html, /el\.checked=props\.value/);
 assert.match(html, /kind==='slider'\?Number\(el\.value\)/);
 assert.match(html, /RCL_UI_SELECT_VALUE/);
});

test('typed controls: Android native controls and per-type listeners are generated',()=>{
 const src=emitNativeAndroidActivity(android());
 assert.match(src,/new CheckBox\(this\)/);
 assert.match(src,/new Switch\(this\)/);
 assert.match(src,/new SeekBar\(this\)/);
 assert.match(src,/new Spinner\(this\)/);
 assert.match(src,/setOnCheckedChangeListener/);
 assert.match(src,/setOnSeekBarChangeListener/);
 assert.match(src,/setOnItemSelectedListener/);
 assert.match(src,/setSelection/);
 assert.match(src,/RCL_UI_SELECT_VALUE:PlanSelect/);
 assert.match(src,/RCL_UI_SLIDER_VALUE:VolumeSlider/);
 assert.doesNotMatch(src,/Log\.i\([^\n]*state\.toString\(\)/);
});

test('typed controls: projected Web and Android traces match canonical state',()=>{
 const w=web(), a=android();assert.equal(w.uiProgramRoot,a.uiProgramRoot);
 const wt=traceNativeUiWebApplication(w,events),at=traceNativeUiAndroidApplication(a,events);
 assert.deepEqual(wt.finalState,at.finalState);
 assert.deepEqual(wt.events,at.events);
});

test('typed controls: invalid bindings, options, steps and missing labels fail compile',()=>{
 FAIL(SOURCE.replace('bind value <- agreed','bind value <- volume'),/RCL_UI_BINDING_TYPE/);
 FAIL(SOURCE.replace('on change(value : Truth) { set agreed <- value }','on change(value : Text) { set agreed <- value }'),/RCL_UI_EVENT_PARAMETER_TYPE/);
 FAIL(SOURCE.replace('property step = 5','property step = 6'),/RCL_UI_SLIDER_STEP/);
 FAIL(SOURCE.replace('property max = 100','property max = 0'),/RCL_UI_SLIDER_RANGE/);
 FAIL(SOURCE.replace('"basic|pro|enterprise"','"basic|basic"'),/RCL_UI_SELECT_OPTIONS/);
 FAIL(SOURCE.replace('accessibility_label "Enable sound"','placeholder "sound"'),/RCL_UI_CONTROL_LABEL_REQUIRED/);
 FAIL(SOURCE.replace('property input_kind = "checkbox"','property input_kind = "unknown"'),/RCL_UI_INPUT_KIND/);
 FAIL(SOURCE.replace('on change(value : Text) { set plan <- value }',''),/RCL_UI_CONTROL_CHANGE_REQUIRED/);
});

test('typed controls: tampered sealed IR fails validation',()=>{
 const ui=structuredClone(compilation());
 ui.viewTree.children.find(x=>x.id==='PlanSelect').localProperties.find(x=>x.property==='options').value='one|one';
 assert.throws(()=>validateCanonicalNativeUi(ui),/RCL_UI_SELECT_OPTIONS/);
});
