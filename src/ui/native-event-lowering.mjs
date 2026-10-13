import {createHash} from 'node:crypto';
import {compileNativeUiDeclarations,collectUiNodes} from './ui-compiler.mjs';
import {parseReality} from '../parser.mjs';
import {nativeDataLiteral} from '../native-data-literals.mjs';
import {semanticStateRootForAlgorithm} from '../semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=state=>semanticStateRootForAlgorithm(state,'rcl.semantic-state-root.v2');
const failure=code=>Object.assign(new Error(code),{code});
const identifier=value=>{if(!/^[A-Za-z_][A-Za-z0-9_.]*$/u.test(value))throw failure('RCL_UI_NATIVE_IDENTIFIER');return value;};
const zero=type=>type==='Number'?'0':type==='Truth'?'false':'""';
function typed(value,type){if(type==='Number'&&typeof value==='number'&&Number.isFinite(value)||type==='Text'&&typeof value==='string'||type==='Truth'&&typeof value==='boolean')return nativeDataLiteral(value);throw failure('RCL_UI_NATIVE_INPUT_TYPE');}
export function compileNativeUiForExecution(source){
  const ast=parseReality(source);for(const ui of ast.body.filter(item=>item.kind==='NativeUIDecl'))for(const state of ui.states){
    const e=state.expression;if(e.kind==='UnaryExpr'&&e.operator==='-'&&e.expression?.kind==='LiteralExpr'&&e.expression.valueType==='Number')state.expression={kind:'LiteralExpr',value:-e.expression.value,valueType:'Number'};
  }
  const programs=compileNativeUiDeclarations(ast);if(programs.length!==1)throw failure('RCL_UI_NATIVE_PROGRAM_COUNT');return programs[0];
}

/** Lower existing UI IR expressions/events to ordinary native RCL constructs. */
export function lowerNativeUiEvent(source,{state=null,event=null,authorized=true}={}){
  if(typeof authorized!=='boolean')throw failure('RCL_UI_NATIVE_AUTHORIZATION_TYPE');
  const ui=compileNativeUiForExecution(source),before=state??Object.fromEntries(ui.state.map(s=>[s.id,s.initial]));
  if(ui.extensionPoints.navigation||ui.extensionPoints.deviceAdaptation)throw failure('RCL_UI_NATIVE_EXTENSION_UNSUPPORTED');
  if(Object.keys(before).sort().join('|')!==ui.state.map(s=>s.id).sort().join('|'))throw failure('RCL_UI_NATIVE_STATE_SHAPE');
  let handler;if(event){handler=ui.eventGraph.events.find(h=>h.nodeId===event.nodeId&&h.type===event.type);if(!handler)throw failure('RCL_UI_NATIVE_EVENT_UNKNOWN');
    if(handler.authority!=='ui-local'||handler.statements.some(s=>s.kind!=='set-state'))throw failure('RCL_UI_NATIVE_AUTHORITY_UNSUPPORTED');
    if(new Set(handler.statements.map(s=>s.target)).size!==handler.statements.length)throw failure('RCL_UI_NATIVE_DUPLICATE_SET');}
  const parameters=handler?.parameters??[];for(const p of parameters)typed(event?.payload?.[p.id],p.valueType);
  const active=new Set();
  function expression(e){
    if(e.kind==='literal')return nativeDataLiteral(e.value);
    if(e.kind==='reference'){
      if(e.scope==='state')return'ui.state.'+identifier(e.id);
      if(e.scope==='event'){const p=parameters.find(p=>p.id===e.id);if(!p)throw failure('RCL_UI_NATIVE_EVENT_PARAMETER');return'ui.input.'+identifier(e.id);}
      if(e.scope==='derived'){if(active.has(e.id))throw failure('RCL_UI_NATIVE_DERIVED_CYCLE');const d=ui.derivedState.find(d=>d.id===e.id);if(!d)throw failure('RCL_UI_NATIVE_DERIVED_UNKNOWN');active.add(e.id);const value=expression(d.expression);active.delete(e.id);return'('+value+')';}
    }
    if(e.kind==='unary')return'('+e.operator+' '+expression(e.expression)+')';
    if(e.kind==='binary'){const l=expression(e.left),r=expression(e.right);return e.operator==='+'&&e.valueType==='Text'?'(text('+l+') + text('+r+'))':'('+l+' '+e.operator+' '+r+')';}
    if(e.kind==='choose')return'choose('+e.args.map(expression).join(', ')+')';
    throw failure('RCL_UI_NATIVE_EXPRESSION_UNSUPPORTED');
  }
  const nodes=collectUiNodes(ui.viewTree),rendered=nodes.flatMap(n=>n.bindings.map(b=>({nodeId:n.id,property:b.property,type:b.expression.valueType,path:'ui.rendered.'+identifier(n.id)+'.'+identifier(b.property),expression:b.expression})));
  const declarations=[...ui.state.map(s=>'  facet ui.state.'+identifier(s.id)+' : '+s.valueType+' = '+typed(before[s.id],s.valueType)),
    ...parameters.map(p=>'  facet ui.input.'+identifier(p.id)+' : '+p.valueType+' = '+typed(event.payload[p.id],p.valueType)),
    ...ui.derivedState.map(d=>'  facet ui.derived.'+identifier(d.id)+' : '+d.valueType+' = '+zero(d.valueType)),
    ...rendered.map(r=>'  facet '+r.path+' : '+r.type+' = '+zero(r.type))];
  const code=['reality NativeUiEventExecution {',
    '  reckon binary_scale(value : Number, exponent : Number) -> Number = choose(exponent == 0, value, choose(exponent > 0, binary_scale(value * 2, exponent - 1), binary_scale(value / 2, exponent + 1)))',
    '  facet ui.semantic_root : Text = '+JSON.stringify(ui.semanticRoot),
    '  facet ui.before_root : Text = '+JSON.stringify(root(before)),
    '  facet event.authorized : Truth = '+String(Boolean(authorized)),
    '  facet event.phase : Number = '+(handler?'0':'1'),...declarations,
    '  subject handler { warrant ui.mutate on ui.state while event.authorized }',
    '  subject painter { warrant ui.paint on ui }'];
  if(handler)code.push('  emergence dispatch {','    cause handler','    when event.phase == 0','    needs ui.mutate on ui.state',
    ...handler.statements.map(s=>'    alter ui.state.'+identifier(s.target)+' <- '+expression(s.expression)),
    '    alter event.phase <- 1','    witness "ui:source-owned-event"','  }');
  code.push('  emergence paint {','    cause painter','    when event.phase == 1','    needs ui.paint on ui',
    ...ui.derivedState.map(d=>'    alter ui.derived.'+identifier(d.id)+' <- '+expression(d.expression)),
    ...rendered.map(r=>'    alter '+r.path+' <- '+expression(r.expression)),
    '    alter event.phase <- 2','    witness "ui:source-owned-projection"','  }');
  if(handler)code.push('  foresee dispatch','  realize dispatch');
  code.push('  foresee paint','  realize paint','}');
  return{format:'rcl.native-ui.event-lowering.v1',ui,source:code.join('\n')+'\n',uiSourceHash:sha(source),beforeState:structuredClone(before),beforeStateRoot:root(before),event:structuredClone(event),authorized:Boolean(authorized),renderBindings:rendered.map(({expression,...r})=>r)};
}
export function projectNativeUiResult(lowered,result){
  const state=Object.fromEntries(lowered.ui.state.map(s=>[s.id,result.state['ui.state.'+s.id]])),derived=Object.fromEntries(lowered.ui.derivedState.map(d=>[d.id,result.state['ui.derived.'+d.id]])),rendered=Object.fromEntries(collectUiNodes(lowered.ui.viewTree).map(n=>[n.id,{}]));
  for(const b of lowered.renderBindings)(rendered[b.nodeId]??={})[b.property]=result.state[b.path];
  return{uiRoot:lowered.ui.semanticRoot,state,stateRoot:root(state),derived,rendered};
}
