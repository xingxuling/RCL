import { nativeUiRoot } from './ui-ir.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from './ui-event.mjs';
import { RCL_NATIVE_UI_ANDROID_FORMAT } from './ui-schema.mjs';
import { inputKind, inputOptions } from './ui-controls.mjs';

const ROLE_TO_VIEW = Object.freeze({ container: 'ViewGroup', text: 'TextView', action: 'Button', input: 'EditText' });
const EVENT_TO_ANDROID = Object.freeze({
  activate: 'View.OnClickListener', input: 'TextWatcher.afterTextChanged', change: 'TextWatcher.afterTextChanged',
  submit: 'EditorAction', focus: 'OnFocusChange(true)', blur: 'OnFocusChange(false)', navigate: 'Activity navigation gateway',
});
const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

function javaString(value) { return JSON.stringify(String(value)); }
function javaIdentifier(value, fallback = 'node') {
  const normalized = String(value).replace(/[^A-Za-z0-9_$]/gu, '_');
  return /^[A-Za-z_$]/u.test(normalized) ? normalized : `${fallback}_${normalized}`;
}
function javaLiteral(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return javaString(value);
  if (typeof value === 'boolean') return value ? 'Boolean.TRUE' : 'Boolean.FALSE';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}L` : `${value}d`;
  throw new Error(`RCL_UI_ANDROID_LITERAL:${typeof value}`);
}
function collectNodes(root, result = []) {
  result.push(root);
  for (const child of root.children) collectNodes(child, result);
  return result;
}
function property(node, name) { return node.localProperties.find((item) => item.property === name)?.value; }
function fieldName(node) { return `view_${javaIdentifier(node.id)}`; }
function controlExpr(node, name, event = 'event') {
  const bound = node.bindings.find((item) => item.property === name);
  return bound ? `rclTruthy(${emitJavaExpr(bound.expression, 'state', event)})` : property(node, name) === true ? 'true' : 'false';
}
function viewType(node) {
  if (node.role === 'container') return node.layout.mode === 'overlay' ? 'FrameLayout' : node.layout.mode === 'grid' ? 'GridLayout' : 'LinearLayout';
  if (node.role === 'input') return ({checkbox:'CheckBox',switch:'Switch',slider:'SeekBar',select:'Spinner'})[inputKind(node)] ?? 'EditText';
  return ROLE_TO_VIEW[node.role];
}

function emitJavaExpr(expr, snapshot = 'snapshot', event = 'event') {
  if (expr.kind === 'literal') return javaLiteral(expr.value);
  if (expr.kind === 'reference') {
    if (expr.scope === 'state') return `rclPath(${snapshot}, ${javaString(expr.id)})`;
    if (expr.scope === 'derived') return `derive_${javaIdentifier(expr.id)}(${snapshot}, ${event})`;
    return `rclPath(${event}, ${javaString(expr.id)})`;
  }
  if (expr.kind === 'unary') return `rclUnary(${javaString(expr.operator)}, ${emitJavaExpr(expr.expression, snapshot, event)})`;
  if (expr.kind === 'binary') return `rclBinary(${javaString(expr.operator)}, ${emitJavaExpr(expr.left, snapshot, event)}, ${emitJavaExpr(expr.right, snapshot, event)})`;
  if (expr.kind === 'choose') return `rclChoose(${emitJavaExpr(expr.args[0], snapshot, event)}, ${emitJavaExpr(expr.args[1], snapshot, event)}, ${emitJavaExpr(expr.args[2], snapshot, event)})`;
  throw new Error(`RCL_UI_ANDROID_EXPRESSION:${expr.kind}`);
}

function javaDimension(size) {
  if (size.mode === 'fill') return 'ViewGroup.LayoutParams.MATCH_PARENT';
  if (size.mode === 'fixed') return String(Math.round(size.value));
  return 'ViewGroup.LayoutParams.WRAP_CONTENT';
}

function applyStyle(node, variable, lines, indent) {
  const style = node.resolvedStyle.values;
  if (style.foreground && node.role !== 'container' && !['slider','select'].includes(inputKind(node))) lines.push(`${indent}${variable}.setTextColor(Color.parseColor(${javaString(style.foreground)}));`);
  if (style.background) lines.push(`${indent}${variable}.setBackgroundColor(Color.parseColor(${javaString(style.background)}));`);
  if (typeof style.font_size === 'number' && node.role !== 'container' && !['slider','select'].includes(inputKind(node))) lines.push(`${indent}${variable}.setTextSize(${style.font_size}f);`);
  if (node.accessibility.label) lines.push(`${indent}${variable}.setContentDescription(${javaString(node.accessibility.label)});`);
}

function emitNode(node, lines, fieldNodeIds = new Set(), indent = '    ') {
  const variable = fieldName(node);
  const fieldBacked = fieldNodeIds.has(node.id);
  const type = viewType(node);
  lines.push(`${indent}${fieldBacked ? `this.${variable}` : `${type} ${variable}`} = new ${type}(this);`);
  if (node.role === 'container') {
    if (type === 'LinearLayout') lines.push(`${indent}${variable}.setOrientation(LinearLayout.${node.layout.mode === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL'});`);
    if (type === 'GridLayout') lines.push(`${indent}${variable}.setColumnCount(${node.layout.columns});`);
    lines.push(`${indent}${variable}.setPadding(${node.layout.padding}, ${node.layout.padding}, ${node.layout.padding}, ${node.layout.padding});`);
    const gravity = { start: 'Gravity.START', center: 'Gravity.CENTER', end: 'Gravity.END', stretch: 'Gravity.FILL' }[node.layout.alignment];
    if (type === 'LinearLayout') lines.push(`${indent}${variable}.setGravity(${gravity});`);
  }
  if (node.role === 'text') {
    const value = property(node, 'value');
    if (value !== undefined) lines.push(`${indent}${variable}.setText(${javaString(value)});`);
  }
  if (node.role === 'action') {
    lines.push(`${indent}${variable}.setText(${javaString(property(node, 'label') ?? node.id)});`);
    if (property(node, 'disabled') === true) lines.push(`${indent}${variable}.setEnabled(false);`);
    if (node.events.some((item) => item.type === 'activate')) lines.push(`${indent}${variable}.setOnClickListener(clicked -> dispatch(${javaString(node.id)}, "activate", new LinkedHashMap<>()));`);
  }
  if (node.role === 'input') {
    const kind = inputKind(node);
    const inputEvent = node.events.find((item) => item.type === 'input' || item.type === 'change');
    const valueEvent = `Map<String,Object> event = new LinkedHashMap<>(); event.put("value", VALUE); dispatch(${javaString(node.id)}, ${javaString(inputEvent?.type ?? 'change')}, event);`;
    if (['checkbox', 'switch'].includes(kind)) {
      lines.push(`${indent}${variable}.setText(${javaString(property(node, 'accessibility_label') ?? node.id)});`);
      if (property(node, 'value') !== undefined) lines.push(`${indent}${variable}.setChecked(${property(node, 'value') ? 'true' : 'false'});`);
      if (inputEvent) lines.push(`${indent}${variable}.setOnCheckedChangeListener((button,checked) -> { if (!rendering) { ${valueEvent.replace('VALUE','Boolean.valueOf(checked)')} } });`);
    } else if (kind === 'slider') {
      const min=property(node,'min'), max=property(node,'max'),step=property(node,'step');
      lines.push(`${indent}${variable}.setMax(${Math.round((max-min)/step)});`);
      if (inputEvent) lines.push(`${indent}${variable}.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {`, `${indent}  @Override public void onStartTrackingTouch(SeekBar bar) {}`, `${indent}  @Override public void onStopTrackingTouch(SeekBar bar) {}`, `${indent}  @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) { if (fromUser && !rendering) { ${valueEvent.replace('VALUE',`rclSliderValue(${min}, ${step}, progress)`)} } }`, `${indent}});`);
    } else if (kind === 'select') {
      const options = inputOptions(node);
      lines.push(`${indent}ArrayAdapter<String> adapter_${javaIdentifier(node.id)} = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, new String[]{${options.map(javaString).join(',')}});`,`${indent}adapter_${javaIdentifier(node.id)}.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);`,`${indent}${variable}.setAdapter(adapter_${javaIdentifier(node.id)});`);
      const binding = node.bindings.find((item)=>item.property==='value');
      const current = binding ? `String.valueOf(${emitJavaExpr(binding.expression,'state','new LinkedHashMap<>()')})` : javaString(property(node,'value') ?? '');
      if (inputEvent) lines.push(`${indent}${variable}.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {`,`${indent}  @Override public void onNothingSelected(AdapterView<?> parent) {}`,`${indent}  @Override public void onItemSelected(AdapterView<?> parent, View selected, int position, long id) { String chosen=String.valueOf(parent.getItemAtPosition(position)); if (!rendering && !chosen.equals(${current})) { ${valueEvent.replace('VALUE','chosen')} } }`,`${indent}});`);
    } else {
      if (kind === 'email') lines.push(`${indent}${variable}.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);`);
      if (kind === 'password') lines.push(`${indent}${variable}.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);`);
      lines.push(`${indent}inputKeyListeners.put(${javaString(node.id)}, ${variable}.getKeyListener());`);
      const placeholder = property(node, 'placeholder');
      if (placeholder !== undefined) lines.push(`${indent}${variable}.setHint(${javaString(placeholder)});`);
      if (inputEvent) {
        lines.push(`${indent}${variable}.addTextChangedListener(new TextWatcher() {`);
        lines.push(`${indent}  @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}`);
        lines.push(`${indent}  @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}`);
        lines.push(`${indent}  @Override public void afterTextChanged(Editable value) { if (!rendering) { ${valueEvent.replace('VALUE','value.toString()')} } }`);
        lines.push(`${indent}});`);
      }
      if (property(node, 'read_only') === true) lines.push(`${indent}${variable}.setKeyListener(null);`);
    }
    if (property(node, 'disabled') === true || (property(node, 'read_only') === true && ['checkbox','switch','slider','select'].includes(kind))) lines.push(`${indent}${variable}.setEnabled(false);`);
  }
  applyStyle(node, variable, lines, indent);
  for (const child of node.children) {
    const childVariable = emitNode(child, lines, fieldNodeIds, indent);
    const paramsName = `params_${javaIdentifier(node.id)}_${javaIdentifier(child.id)}`;
    const width = javaDimension(child.layout.width);
    const height = javaDimension(child.layout.height);
    if (type === 'LinearLayout') {
      lines.push(`${indent}LinearLayout.LayoutParams ${paramsName} = new LinearLayout.LayoutParams(${width}, ${height});`);
      if (node.layout.gap > 0) lines.push(`${indent}${paramsName}.setMargins(0, ${node.layout.gap}, 0, 0);`);
    } else if (type === 'FrameLayout') lines.push(`${indent}FrameLayout.LayoutParams ${paramsName} = new FrameLayout.LayoutParams(${width}, ${height});`);
    else lines.push(`${indent}GridLayout.LayoutParams ${paramsName} = new GridLayout.LayoutParams(); ${paramsName}.width = ${width}; ${paramsName}.height = ${height};`);
    lines.push(`${indent}${variable}.addView(${childVariable}, ${paramsName});`);
  }
  return variable;
}

function emitRuntimeHelpers() {
  return `  private static Object rclPath(Map<String,Object> snapshot, String path) { if (!snapshot.containsKey(path)) throw new IllegalStateException("RCL_UI_ANDROID_STATE_MISSING:" + path); return snapshot.get(path); }
  private static boolean rclTruthy(Object value) { if (value == null) return false; if (value instanceof Boolean) return (Boolean)value; if (value instanceof Number) return ((Number)value).doubleValue()!=0d; if (value instanceof CharSequence) return ((CharSequence)value).length()>0; return true; }
  private static Number rclSliderValue(double min,double step,int progress) { double value=min+step*progress; return Math.rint(value)==value ? Long.valueOf((long)value) : Double.valueOf(value); }
  private static boolean rclTypeMatches(Object value,String type) { if ("Number".equals(type)) return value instanceof Number; if ("Text".equals(type)) return value instanceof String; if ("Truth".equals(type)) return value instanceof Boolean; return false; }
  private static Object rclChoose(Object condition,Object whenTrue,Object whenFalse) { return rclTruthy(condition)?whenTrue:whenFalse; }
  private static Object rclUnary(String operator,Object value) { if ("not".equals(operator)) return !rclTruthy(value); if ("-".equals(operator)&&value instanceof Number) return -((Number)value).doubleValue(); throw new IllegalStateException("RCL_UI_ANDROID_UNARY:"+operator); }
  private static Object rclBinary(String operator,Object left,Object right) {
    if ("and".equals(operator)) return rclTruthy(left)&&rclTruthy(right); if ("or".equals(operator)) return rclTruthy(left)||rclTruthy(right);
    if ("+".equals(operator)&&(left instanceof CharSequence||right instanceof CharSequence)) return String.valueOf(left)+String.valueOf(right);
    if ("+".equals(operator)||"-".equals(operator)||"*".equals(operator)||"/".equals(operator)||"%".equals(operator)) { if (!(left instanceof Number)||!(right instanceof Number)) throw new IllegalStateException("RCL_UI_ANDROID_NUMBER_REQUIRED:"+operator); double l=((Number)left).doubleValue(),r=((Number)right).doubleValue(),v; if ("+".equals(operator))v=l+r;else if("-".equals(operator))v=l-r;else if("*".equals(operator))v=l*r;else if("/".equals(operator))v=l/r;else v=l%r;return Math.rint(v)==v?Long.valueOf((long)v):Double.valueOf(v); }
    if ("==".equals(operator)) return java.util.Objects.equals(left,right); if ("!=".equals(operator)) return !java.util.Objects.equals(left,right);
    if (left instanceof Number&&right instanceof Number) { double l=((Number)left).doubleValue(),r=((Number)right).doubleValue(); if("<".equals(operator))return l<r;if("<=".equals(operator))return l<=r;if(">".equals(operator))return l>r;if(">=".equals(operator))return l>=r; }
    throw new IllegalStateException("RCL_UI_ANDROID_COMPARISON:"+operator);
  }`;
}

function emitEventMethods(ui) {
  const methods = [];
  const dispatch = [];
  const routeLog = ui.extensionPoints.navigation ? ' + " route=" + currentRoute' : '';
  for (const node of collectNodes(ui.viewTree)) for (const handler of node.events) {
    const method = `event_${javaIdentifier(node.id)}_${javaIdentifier(handler.type)}`;
    dispatch.push(`    if (${javaString(node.id)}.equals(nodeId) && ${javaString(handler.type)}.equals(type)) { ${method}(event); return; }`);
    const lines = [`  private void ${method}(Map<String,Object> event) {`];
    if (['action', 'input'].includes(node.role)) lines.push(`    if (${controlExpr(node, 'disabled')}) throw new IllegalStateException(${javaString(`RCL_UI_EVENT_DISABLED:${node.id}:${handler.type}`)});`);
    if (node.role === 'input' && ['input', 'change'].includes(handler.type)) lines.push(`    if (${controlExpr(node, 'read_only')}) throw new IllegalStateException(${javaString(`RCL_UI_EVENT_READ_ONLY:${node.id}:${handler.type}`)});`);
    for (const parameter of handler.parameters) {
      lines.push(`    if (!event.containsKey(${javaString(parameter.id)}) || !rclTypeMatches(event.get(${javaString(parameter.id)}), ${javaString(parameter.valueType)})) throw new IllegalArgumentException(${javaString(`RCL_UI_ANDROID_EVENT_PARAMETER_TYPE:${node.id}:${handler.type}:${parameter.id}:${parameter.valueType}`)});`);
    }
    if (node.role === 'input' && ['change','input'].includes(handler.type) && inputKind(node) === 'slider') {
      const min=property(node,'min'), max=property(node,'max'), step=property(node,'step');
      lines.push(`    double value = ((Number)event.get("value")).doubleValue(); if (!Double.isFinite(value) || value < ${min}d || value > ${max}d || Math.abs((value-${min}d)/${step}d-Math.rint((value-${min}d)/${step}d))>1e-8) throw new IllegalArgumentException(${javaString(`RCL_UI_SLIDER_VALUE:${node.id}`)});`);
    }
    if (node.role === 'input' && ['change','input'].includes(handler.type) && inputKind(node) === 'select') {
      lines.push(`    if (!java.util.Arrays.asList(${inputOptions(node).map(javaString).join(',')}).contains(event.get("value"))) throw new IllegalArgumentException(${javaString(`RCL_UI_SELECT_VALUE:${node.id}`)});`);
    }
    if (handler.authority === 'reality-transaction') {
      lines.push(`    throw new IllegalStateException(${javaString(`RCL_UI_ANDROID_REALITY_GATEWAY_REQUIRED:${node.id}:${handler.type}`)});`);
    } else {
      lines.push('    Map<String,Object> before = new LinkedHashMap<>(state);', '    Map<String,Object> proposed = new LinkedHashMap<>(before);');
      if (ui.extensionPoints.navigation) lines.push('    String proposedRoute = currentRoute;');
      for (const statement of handler.statements) {
        if (statement.kind === 'navigate') lines.push(`    proposedRoute = ${javaString(statement.route)};`);
        else lines.push(`    proposed.put(${javaString(statement.target)}, ${emitJavaExpr(statement.expression, 'before', 'event')});`);
      }
      lines.push('    state.clear(); state.putAll(proposed);');
      if (ui.extensionPoints.navigation) lines.push('    currentRoute = proposedRoute;');
      lines.push(`    history.add(${javaString(`${node.id}:${handler.type}`)});`, `    Log.i(RCL_UI_LOG_TAG, "event node=${node.id} type=${handler.type} before=" + before.keySet().toString() + " after=" + state.keySet().toString()${routeLog});`, '    render();');
    }
    lines.push('  }');
    methods.push(lines.join('\n'));
  }
  return {
    dispatch: `  private void dispatch(String nodeId,String type,Map<String,Object> event) {\n${dispatch.join('\n')}\n    throw new IllegalArgumentException("RCL_UI_ANDROID_EVENT_UNKNOWN:"+nodeId+":"+type);\n  }`,
    methods: methods.join('\n\n'),
  };
}

function emitDerived(ui) {
  return ui.derivedState.map((item) => `  private Object derive_${javaIdentifier(item.id)}(Map<String,Object> snapshot,Map<String,Object> event) { return ${emitJavaExpr(item.expression, 'snapshot', 'event')}; }`).join('\n');
}

function emitRender(ui) {
  const lines = ['  private void render() {', '    rendering = true;', '    Map<String,Object> event = new LinkedHashMap<>();'];
  for (const node of collectNodes(ui.viewTree)) {
    const kind = inputKind(node), field=fieldName(node);
    for (const binding of node.bindings) {
      const value = emitJavaExpr(binding.expression,'state','event');
      if (node.role === 'input' && binding.property === 'value') {
        if (['checkbox','switch'].includes(kind)) lines.push(`    if (${field}.isChecked() != rclTruthy(${value})) ${field}.setChecked(rclTruthy(${value}));`);
        else if (kind === 'slider') {const min=property(node,'min'),step=property(node,'step');lines.push(`    int progress_${javaIdentifier(node.id)}=(int)Math.round((((Number)${value}).doubleValue()-${min}d)/${step}d); if (${field}.getProgress()!=progress_${javaIdentifier(node.id)}) ${field}.setProgress(progress_${javaIdentifier(node.id)});`);}
        else if (kind === 'select') lines.push(`    for (int i=0;i<${field}.getCount();i++) { if (String.valueOf(${field}.getItemAtPosition(i)).equals(String.valueOf(${value}))) { if (${field}.getSelectedItemPosition()!=i) ${field}.setSelection(i); break; } }`);
        else lines.push(`    if (!${field}.getText().toString().equals(String.valueOf(${value}))) ${field}.setText(String.valueOf(${value}));`);
      } else if ((node.role === 'text' && binding.property === 'value') || (node.role === 'action' && binding.property === 'label')) lines.push(`    ${field}.setText(String.valueOf(${value}));`);
      else if (binding.property === 'disabled' && (node.role !== 'input' || !['checkbox','switch','slider','select'].includes(kind))) lines.push(`    ${field}.setEnabled(!rclTruthy(${value}));`);
      else if (binding.property === 'read_only' && node.role === 'input' && ['text','email','password'].includes(kind)) lines.push(`    ${field}.setKeyListener(rclTruthy(${value}) ? null : inputKeyListeners.get(${javaString(node.id)}));`);
    }
    if (node.role==='input' && ['checkbox','switch','slider','select'].includes(kind)) lines.push(`    ${field}.setEnabled(!(${controlExpr(node,'disabled')} || ${controlExpr(node,'read_only')}));`);
  }
  if (ui.extensionPoints.navigation) lines.push('    applyNavigation();');
  if (ui.extensionPoints.deviceAdaptation) lines.push('    applyDeviceAdaptation();');
  lines.push('    rendering = false;', '  }');
  return lines.join('\n');
}

function emitNavigation(ui) {
  const navigation = ui.extensionPoints.navigation;
  if (!navigation) return { field: '', method: '' };
  const lines = ['  private void applyNavigation() {'];
  for (const route of navigation.routes) {
    lines.push(`    ${fieldName({ id: route.target })}.setVisibility(${javaString(route.id)}.equals(currentRoute) ? View.VISIBLE : View.GONE);`);
  }
  lines.push('  }');
  return { field: `  private String currentRoute = ${javaString(navigation.initialRoute)};`, method: lines.join('\n') };
}

function emitDeviceAdaptation(ui) {
  const adaptation = ui.extensionPoints.deviceAdaptation;
  if (!adaptation) return { field: '', method: '' };
  const profileLines = adaptation.profiles.map((profile) => {
    const upper = profile.maxWidth === null ? '' : ` && widthDp <= ${profile.maxWidth}`;
    return `    if (widthDp >= ${profile.minWidth}${upper}) return ${javaString(profile.id)};`;
  });
  const layoutLines = [];
  for (const node of collectNodes(ui.viewTree).filter((item) => item.adaptiveLayouts.length > 0)) {
    const name = javaIdentifier(node.id);
    const orientation = node.layout.mode === 'horizontal' ? 'LinearLayout.HORIZONTAL' : 'LinearLayout.VERTICAL';
    layoutLines.push(`    int orientation_${name} = ${orientation};`);
    for (const override of node.adaptiveLayouts) {
      const target = override.mode === 'horizontal' ? 'LinearLayout.HORIZONTAL' : 'LinearLayout.VERTICAL';
      layoutLines.push(`    if (${javaString(override.profile)}.equals(currentDeviceProfile)) orientation_${name} = ${target};`);
    }
    layoutLines.push(`    ${fieldName(node)}.setOrientation(orientation_${name});`);
  }
  return {
    field: `  private String currentDeviceProfile = ${javaString(adaptation.defaultProfile)};`,
    method: `  private String selectDeviceProfile(int widthDp) {\n${profileLines.join('\n')}\n    return ${javaString(adaptation.defaultProfile)};\n  }\n  private void applyDeviceAdaptation() {\n    currentDeviceProfile = selectDeviceProfile(getResources().getConfiguration().screenWidthDp);\n${layoutLines.join('\n')}\n  }`,
  };
}

function emitLifecycle(ui) {
  const init = ui.state.map((item) => `    state.put(${javaString(item.id)}, ${javaLiteral(item.initial)});`).join('\n');
  const save = ui.state.filter((item) => ui.lifecycle.restore.includes(item.id)).map((item) => {
    const key = javaString(`rcl.ui.state.${item.id}`);
    if (item.valueType === 'Text') return `    outState.putString(${key}, String.valueOf(state.get(${javaString(item.id)})));`;
    if (item.valueType === 'Truth') return `    outState.putBoolean(${key}, rclTruthy(state.get(${javaString(item.id)})));`;
    return `    outState.putLong(${key}, ((Number)state.get(${javaString(item.id)})).longValue());`;
  }).join('\n');
  const restore = ui.state.filter((item) => ui.lifecycle.restore.includes(item.id)).map((item) => {
    const key = javaString(`rcl.ui.state.${item.id}`);
    if (item.valueType === 'Text') return `    if (savedState.containsKey(${key})) state.put(${javaString(item.id)}, savedState.getString(${key}));`;
    if (item.valueType === 'Truth') return `    if (savedState.containsKey(${key})) state.put(${javaString(item.id)}, savedState.getBoolean(${key}));`;
    return `    if (savedState.containsKey(${key})) state.put(${javaString(item.id)}, savedState.getLong(${key}));`;
  }).join('\n');
  return { init, save, restore };
}

export function lowerNativeUiToAndroid(ui, target = {}) {
  if (target.document || target.styles || target.screen) throw new Error('RCL_UI_BACKEND_MORPHOLOGY_FORBIDDEN:android');
  const applicationId = target.applicationId ?? 'org.rcl.nativeui';
  if (!PACKAGE_PATTERN.test(applicationId)) throw new Error(`RCL_UI_ANDROID_APPLICATION_ID:${applicationId}`);
  const report = {
    schema: RCL_NATIVE_UI_ANDROID_FORMAT,
    backend: 'android',
    backendVersion: '0.1.0',
    program: ui.reality,
    uiProgramRoot: ui.semanticRoot,
    ui,
    application: {
      applicationId,
      activity: target.activity ?? 'MainActivity',
      title: target.title ?? ui.id,
      minSdk: Number(target.minSdk ?? 26),
      compileSdk: Number(target.compileSdk ?? 35),
      targetSdk: Number(target.targetSdk ?? target.compileSdk ?? 35),
      theme: target.theme ?? 'light',
    },
    nodeMappings: collectNodes(ui.viewTree).map((node) => ({ nodeId: node.id, canonicalRole: node.role, target: viewType(node) })),
    eventMappings: ui.eventGraph.events.map((event) => ({ nodeId: event.nodeId, canonicalEvent: event.type, targetEvent: EVENT_TO_ANDROID[event.type] ?? 'custom-event gateway' })),
    navigationMapping: ui.extensionPoints.navigation ? { strategy: 'View.VISIBLE_OR_GONE', routes: ui.extensionPoints.navigation.routes } : null,
    deviceAdaptationMapping: ui.extensionPoints.deviceAdaptation ? { axis: 'Configuration.screenWidthDp', strategy: 'activity-recreation-plus-linear-layout-orientation', profiles: ui.extensionPoints.deviceAdaptation.profiles } : null,
    layoutMapping: { vertical: 'LinearLayout.VERTICAL', horizontal: 'LinearLayout.HORIZONTAL', overlay: 'FrameLayout', grid: 'GridLayout' },
    lifecycleMapping: { create: 'Activity.onCreate', activate: 'Activity.onStart', suspend: 'Activity.onPause', resume: 'Activity.onResume', destroy: 'Activity.onDestroy' },
    coverage: { semantic: 'native-ui-ir', visualFidelity: 'structural-v0.1', runtime: 'android-view-project' },
  };
  return Object.freeze({ ...report, loweringRoot: nativeUiRoot(report) });
}

export function emitNativeUiAndroidActivity(manifest) {
  if (manifest.schema !== RCL_NATIVE_UI_ANDROID_FORMAT) throw new Error('RCL_UI_ANDROID_MANIFEST_FORMAT');
  const ui = manifest.ui;
  const navigationTargetIds = new Set(ui.extensionPoints.navigation?.routes.map((route) => route.target) ?? []);
  const fieldNodes = collectNodes(ui.viewTree).filter((node) => node.bindings.length > 0 || navigationTargetIds.has(node.id) || node.adaptiveLayouts.length > 0);
  const fieldNodeIds = new Set(fieldNodes.map((node) => node.id));
  const fields = fieldNodes.map((node) => `  private ${viewType(node)} ${fieldName(node)};`).join('\n');
  const uiLines = [];
  const root = emitNode(ui.viewTree, uiLines, fieldNodeIds);
  const events = emitEventMethods(ui);
  const lifecycle = emitLifecycle(ui);
  const navigation = emitNavigation(ui);
  const adaptation = emitDeviceAdaptation(ui);
  return `package ${manifest.application.applicationId};

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.Switch;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.AdapterView;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ${manifest.application.activity} extends Activity {
  public static final String RCL_UI_PROGRAM_ROOT = ${javaString(ui.semanticRoot)};
  private static final String RCL_UI_LOG_TAG = "RCLNativeUI";
  private final Map<String,Object> state = new LinkedHashMap<>();
  private final List<String> history = new ArrayList<>();
  private final Map<String,android.text.method.KeyListener> inputKeyListeners = new LinkedHashMap<>();
  private final List<String> lifecycleTrace = new ArrayList<>();
  private boolean rendering = false;
${navigation.field}
${adaptation.field}
${fields}

  @Override protected void onCreate(Bundle savedState) { super.onCreate(savedState); initializeState(); restoreState(savedState); buildUi(); render(); lifecycleTrace.add("create"); Log.i(RCL_UI_LOG_TAG, "lifecycle create uiRoot=" + RCL_UI_PROGRAM_ROOT + " stateKeys=" + state.keySet().toString()); }
  @Override protected void onStart() { super.onStart(); lifecycleTrace.add("activate"); Log.i(RCL_UI_LOG_TAG, "lifecycle activate state=" + state.keySet().toString()); }
  @Override protected void onResume() { super.onResume(); lifecycleTrace.add("resume"); Log.i(RCL_UI_LOG_TAG, "lifecycle resume state=" + state.keySet().toString()); }
  @Override protected void onPause() { lifecycleTrace.add("suspend"); Log.i(RCL_UI_LOG_TAG, "lifecycle suspend state=" + state.keySet().toString()); super.onPause(); }
  @Override protected void onDestroy() { lifecycleTrace.add("destroy"); Log.i(RCL_UI_LOG_TAG, "lifecycle destroy state=" + state.keySet().toString()); super.onDestroy(); }
  private void initializeState() {\n${lifecycle.init}\n  }
  private void buildUi() {\n${uiLines.join('\n')}\n    setContentView(${root});\n  }

${emitRuntimeHelpers()}
${emitDerived(ui)}
${events.dispatch}
${events.methods}
${emitRender(ui)}
${navigation.method}
${adaptation.method}

  private void restoreState(Bundle savedState) { if (savedState == null) return;\n${lifecycle.restore}\n  }
  @Override protected void onSaveInstanceState(Bundle outState) { super.onSaveInstanceState(outState);\n${lifecycle.save}\n  }
}
`;
}

export function simulateNativeUiAndroidApplication(manifest, events = []) {
  if (manifest.schema !== RCL_NATIVE_UI_ANDROID_FORMAT) throw new Error('RCL_UI_ANDROID_MANIFEST_FORMAT');
  const runtime = createNativeUiRuntime(manifest.ui);
  runtime.lifecycle('create'); runtime.lifecycle('resume');
  for (const event of events) runtime.dispatch(event.nodeId, event.type, event.payload ?? {});
  return { state: runtime.snapshot(), rendered: runtime.projection().rendered, history: structuredClone(runtime.trace), ...(manifest.ui.extensionPoints.navigation ? { currentRoute: runtime.currentRoute() } : {}) };
}

export function traceNativeUiAndroidApplication(manifest, events = [], options = {}) {
  return runNativeUiSemanticTrace(manifest.ui, events, 'android', options);
}
