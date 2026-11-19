import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { compileReality, tryCompileReality } from '../src/compiler.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from '../src/ui/ui-event.mjs';
import { formFieldError } from '../src/ui/ui-controls.mjs';
import { validateCanonicalNativeUi } from '../src/ui/ui-validator.mjs';
import { compileRclWebApplication, emitStandaloneRclWebHtml } from '../src/web-application-compiler.mjs';
import { compileRclAndroidApplication, emitNativeAndroidActivity } from '../src/android-application-compiler.mjs';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE=fs.readFileSync(path.join(ROOT,'examples/native-ui/validated-signup-form.rcl'),'utf8');
const ui=()=>compileReality(SOURCE).nativeUis[0];
const validEvents=[
  {nodeId:'FullName',type:'input',payload:{value:'Alice'}},
  {nodeId:'EmailAddress',type:'input',payload:{value:'alice@example.com'}},
  {nodeId:'AcceptTerms',type:'change',payload:{value:true}},
  {nodeId:'SubmitForm',type:'activate'}
];
const compileFail=(source,re)=>assert.match(tryCompileReality(source).diagnostics[0]?.message??'',re);

test('v0.5 sealed syntax and initial missing-required is allowed pending user input',()=>{
 const program=ui();assert.equal(validateCanonicalNativeUi(program),true);
 const rt=createNativeUiRuntime(program);assert.deepEqual(rt.projection().validation,{valid:false,fields:{FullName:'required',EmailAddress:'required',AcceptTerms:'required'}});
 assert.equal(rt.snapshot().submitted,false);
});

test('v0.5 submit cannot bypass validation, and rejection does not mutate state or trace',()=>{
 const rt=createNativeUiRuntime(ui());const initial=rt.snapshot();
 assert.throws(()=>rt.dispatch('SubmitForm','activate'),/RCL_UI_FORM_INVALID:SubmitForm:/);
 assert.deepEqual(rt.snapshot(),initial);assert.equal(rt.trace.length,0);
 rt.dispatch('FullName','input',{value:'A'});rt.dispatch('EmailAddress','input',{value:'broken'});
 assert.deepEqual(rt.projection().validation.fields,{FullName:'min_length',EmailAddress:'email',AcceptTerms:'required'});
 assert.throws(()=>rt.dispatch('SubmitForm','activate'),/RCL_UI_FORM_INVALID/);
 assert.equal(rt.snapshot().submitted,false);assert.equal(rt.trace.length,2);
});

test('v0.5 valid submit commits, sealed IR and semantic traces are deterministic',()=>{
 const rt=createNativeUiRuntime(ui());for(const e of validEvents)rt.dispatch(e.nodeId,e.type,e.payload??{});
 assert.equal(rt.snapshot().submitted,true);assert.equal(rt.projection().validation.valid,true);
 assert.equal(rt.trace.length,4);const a=runNativeUiSemanticTrace(ui(),validEvents,'web');const b=runNativeUiSemanticTrace(ui(),validEvents,'android');
 assert.deepEqual(a.finalState,b.finalState);assert.deepEqual(a.finalValidation,b.finalValidation);
 assert.equal(ui().semanticRoot,ui().semanticRoot);
});

test('v0.5 Unicode codepoints and max length / optional email checks',()=>{
 const program=ui(),nodes=new Map(program.viewTree.children.map(n=>[n.id,n]));
 assert.equal(formFieldError(nodes.get('FullName'),'🦊'), 'min_length');
 assert.equal(formFieldError(nodes.get('FullName'),'🦊舟'),null);
 assert.equal(formFieldError(nodes.get('FullName'),'X'.repeat(41)),'max_length');
 assert.equal(formFieldError(nodes.get('EmailAddress'),'bob@example.com'),null);
 assert.equal(formFieldError(nodes.get('EmailAddress'),'sarah@example.com'),null);
 assert.equal(formFieldError(nodes.get('EmailAddress'),'sarah@example'), 'email');
 assert.equal(formFieldError(nodes.get('EmailAddress'),'sarah\u2003@example.com'),'email');
 assert.equal(formFieldError(nodes.get('EmailAddress'),' bob@example.com'),'email');
});

test('declared UI names retain their own state, derived values, controls and form errors', () => {
 const source = `reality FieldNames { ui Page {
  state __proto__ : Text = "" state submitted : Truth = false
  derived constructor : Text = "Saved: " + __proto__
  view Root {
   input __proto__ { property required = true bind value <- __proto__ on input(value: Text) { set __proto__ <- value } }
   action Save { label "Save" property require_valid_form = true on activate { set submitted <- true } }
   text Status { bind value <- constructor }
  }
 } }`;
 const runtime = createNativeUiRuntime(compileReality(source).nativeUis[0]);
 const initial = runtime.projection();
 assert.equal(Object.hasOwn(initial.rendered, '__proto__'), true);
 assert.equal(Object.hasOwn(initial.derived, 'constructor'), true);
 assert.equal(Object.hasOwn(initial.validation.fields, '__proto__'), true);
 assert.throws(() => runtime.dispatch('Save', 'activate'), /RCL_UI_FORM_INVALID:Save:__proto__/u);
 runtime.dispatch('__proto__', 'input', { value: 'Atlas' });
 const result = runtime.dispatch('Save', 'activate');
 assert.equal(Object.hasOwn(result.afterState, '__proto__'), true);
 assert.equal(result.afterState.__proto__, 'Atlas');
 assert.equal(result.afterState.submitted, true);
 assert.equal(result.renderedSemanticState.Status.value, 'Saved: Atlas');
});

test('v0.5 compile rejects inconsistent validation declarations',()=>{
 compileFail(SOURCE.replace('property min_length = 2','property min_length = -1'),/RCL_UI_LITERAL_REQUIRED/);
 compileFail(SOURCE.replace('property min_length = 2','property min_length = 41'),/RCL_UI_FORM_LENGTH_ORDER/);
 compileFail(SOURCE.replace('property required = true','property required = "yes"'),/RCL_UI_NODE_PROPERTY_TYPE/);
 compileFail(SOURCE.replace('bind value <- name',''),/RCL_UI_FORM_BIND_VALUE_REQUIRED/);
 compileFail(SOURCE.replace('property max_length = 120','property max_length = 10001'),/RCL_UI_FORM_LENGTH_BOUND/);
 compileFail(SOURCE.replace('property min_length = 2','property min_length = 2.5'),/RCL_UI_FORM_LENGTH_BOUND/);
 compileFail(SOURCE.replace('property require_valid_form = true','property require_valid_form = "yes"'),/RCL_UI_NODE_PROPERTY_TYPE/);
});

test('v0.5 readonly state and malformed events retain previous event gates',()=>{
 const rt=createNativeUiRuntime(ui());
 assert.throws(()=>rt.dispatch('EmailAddress','input',{value:false}),/RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE/);
 assert.equal(rt.trace.length,0);
});

test('v0.5 generated web has validation gate, semantic feedback and script is valid',()=>{
 const source=SOURCE.replace('RCL Verified Signup', 'RCL </ScRiPt> Verified Signup');
 const web=compileRclWebApplication(source,{schema:'rcl.native-ui.web-target.v0.1'});
 const html=emitStandaloneRclWebHtml(web);
 assert.match(html,/rclFormValidation/);assert.match(html,/RCL_UI_FORM_INVALID/);
 assert.match(html,/data-rcl-error-for/);assert.match(html,/aria-invalid/);
 const match=html.match(/<script>([\s\S]*?)<\/script>/iu);assert.ok(match);new vm.Script(match[1]);
 const emailPattern=match[1].match(/^const emailPattern = (\/.*\/);$/mu)?.[1];
 assert.ok(emailPattern);
 const pattern=new vm.Script(emailPattern).runInNewContext();
 for(const [address,valid] of [['sarah@example.com',true],['sarah@example',false],['sarah\u2003@example.com',false]]) {
  assert.equal(pattern.test(address),valid,address);
 }
});

test('v0.5 Android generated activity has form validation and safe blocking',()=>{
 const android=compileRclAndroidApplication(SOURCE,{schema:'rcl.native-ui.android-target.v0.1',applicationId:'com.taowind.rcl.forms'});
 const src=emitNativeAndroidActivity(android);
 assert.match(src,/private String rclFormValidation\(\)/);
 assert.match(src,/rclFieldError\(/);
 assert.match(src,/RCL_UI_FORM_INVALID:SubmitForm:/);
 assert.match(src,/Toast\.makeText/);
 assert.doesNotMatch(src,/Log\.i\([^\n]*get\("email"\)/);
});

test('v0.5 sealed semantics reject tampering with form constraint',()=>{
 const forged=structuredClone(ui());
 const node=forged.viewTree.children.find(n=>n.id==='FullName');
 node.localProperties.find(x=>x.property==='max_length').value=-20;
 assert.throws(()=>validateCanonicalNativeUi(forged),/RCL_UI_FORM_LENGTH_BOUND/);
});
