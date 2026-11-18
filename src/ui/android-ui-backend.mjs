import { nativeUiRoot } from './ui-ir.mjs';
import { createNativeUiRuntime, runNativeUiSemanticTrace } from './ui-event.mjs';
import { RCL_NATIVE_UI_ANDROID_FORMAT } from './ui-schema.mjs';
import { inputKind, inputOptions, UI_EMAIL_PATTERN } from './ui-controls.mjs';
import { ANDROID_JAVA_EQUAL_HELPER, ANDROID_JAVA_TEXT_HELPER, androidJavaIdentifier as javaIdentifier, androidJavaNumber } from '../android-java-source.mjs';

const ROLE_TO_VIEW = Object.freeze({ container: 'ViewGroup', text: 'TextView', action: 'Button', input: 'EditText' });
const EVENT_TO_ANDROID = Object.freeze({
  activate: 'View.OnClickListener', input: 'TextWatcher.afterTextChanged', change: 'TextWatcher.afterTextChanged',
  submit: 'EditorAction', focus: 'OnFocusChange(true)', blur: 'OnFocusChange(false)', navigate: 'Activity navigation gateway',
});
const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

function javaString(value) { return JSON.stringify(String(value)); }
function javaLiteral(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return javaString(value);
  if (typeof value === 'boolean') return value ? 'Boolean.TRUE' : 'Boolean.FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return androidJavaNumber(value);
  throw new Error(`RCL_UI_ANDROID_LITERAL:${typeof value}`);
}
function collectNodes(root, result = []) {
  result.push(root);
  for (const child of root.children) collectNodes(child, result);
  return result;
}
function property(node, name) { return node.localProperties.find((item) => item.property === name)?.value; }
function fieldName(node) { return `view_${javaIdentifier(node.id)}`; }
export { fieldName as androidViewFieldName };

export function androidLayoutParameterNames(root) {
  const names = new Map();
  const unique = new Set();
  const collisions = new Set();
  for (const parent of collectNodes(root)) {
    for (const child of parent.children) {
      const name = `params_${javaIdentifier(parent.id)}_${javaIdentifier(child.id)}`;
      if (unique.has(name)) collisions.add(name);
      unique.add(name);
      names.set(child.id, name);
    }
  }
  for (const [id, name] of names) {
    // Keep existing names where unambiguous. The disambiguating prefix
    // cannot occur in names assembled from encoded Java identifiers.
    if (collisions.has(name)) names.set(id, `params_$rcl$layout$${javaIdentifier(id)}`);
  }
  return names;
}
function controlExpr(node, name, event = 'event') {
  const bound = node.bindings.find((item) => item.property === name);
  return bound ? `rclTruthy(${emitJavaExpr(bound.expression, 'state', event)})` : property(node, name) === true ? 'true' : 'false';
}
function javaNodeVisibility(node, routesByTarget) {
  const conditions = [];
  if (routesByTarget.has(node.id)) conditions.push(`${javaString(routesByTarget.get(node.id))}.equals(currentRoute)`);
  if (node.bindings.some((binding) => binding.property === 'visible')) conditions.push(controlExpr(node, 'visible'));
  else if (property(node, 'visible') === false) conditions.push('false');
  return conditions.join(' && ');
}
function viewType(node) {
  if (node.role === 'container') return node.layout.mode === 'overlay' ? 'FrameLayout' : node.layout.mode === 'grid' ? 'GridLayout' : 'LinearLayout';
  if (node.role === 'input') return ({checkbox:'CheckBox',switch:'Switch',slider:'SeekBar',select:'Spinner',radio:'RadioGroup',date:'DatePicker'})[inputKind(node)] ?? 'EditText';
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
  if (expr.kind === 'choose') {
    const [condition, whenTrue, whenFalse] = expr.args.map((arg) => emitJavaExpr(arg, snapshot, event));
    return `(rclTruthy(${condition}) ? (Object) (${whenTrue}) : (Object) (${whenFalse}))`;
  }
  throw new Error(`RCL_UI_ANDROID_EXPRESSION:${expr.kind}`);
}

function javaPixel(value, property) {
  const pixels = Math.round(value);
  if (!Number.isInteger(pixels) || pixels < 0 || pixels > 2_147_483_647) {
    throw new Error(`RCL_UI_ANDROID_PIXEL_RANGE:${property}`);
  }
  return String(pixels);
}

function javaDimension(size) {
  if (size.mode === 'fill') return 'ViewGroup.LayoutParams.MATCH_PARENT';
  if (size.mode === 'fixed') return javaPixel(size.value, 'dimension');
  return 'ViewGroup.LayoutParams.WRAP_CONTENT';
}

function applyStyle(node, variable, lines, indent) {
  const style = node.resolvedStyle.values;
  if (style.foreground && node.role !== 'container' && !['slider','select','radio','date'].includes(inputKind(node))) lines.push(`${indent}${variable}.setTextColor(Color.parseColor(${javaString(style.foreground)}));`);
  if (style.background) lines.push(`${indent}${variable}.setBackgroundColor(Color.parseColor(${javaString(style.background)}));`);
  if (typeof style.font_size === 'number' && node.role !== 'container' && !['slider','select','radio','date'].includes(inputKind(node))) {
    const size = Math.fround(style.font_size);
    if (!Number.isFinite(size)) throw new Error(`RCL_UI_ANDROID_FONT_SIZE_RANGE:${node.id}`);
    lines.push(`${indent}${variable}.setTextSize(${size}f);`);
  }
  if (node.accessibility.label) lines.push(`${indent}${variable}.setContentDescription(${javaString(node.accessibility.label)});`);
}

function emitNode(node, lines, fieldNodeIds, layoutParameterNames, indent = '    ') {
  const variable = fieldName(node);
  const fieldBacked = fieldNodeIds.has(node.id);
  const type = viewType(node);
  lines.push(`${indent}${fieldBacked ? `this.${variable}` : `${type} ${variable}`} = new ${type}(this);`);
  if (node.role === 'container') {
    if (type === 'LinearLayout') lines.push(`${indent}${variable}.setOrientation(LinearLayout.${node.layout.mode === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL'});`);
    if (type === 'GridLayout') lines.push(`${indent}${variable}.setColumnCount(${node.layout.columns});`);
    if (property(node,'modal') === true) lines.push(`${indent}${variable}.setBackgroundColor(Color.argb(239, 17, 24, 39));`, `${indent}${variable}.setElevation(24f);`, `${indent}${variable}.setClickable(true);`, `${indent}${variable}.setFocusable(true);`, `${indent}${variable}.setContentDescription(${javaString(node.accessibility.label ?? node.id)});`);
    const padding = javaPixel(node.layout.padding, 'padding');
    lines.push(`${indent}${variable}.setPadding(${padding}, ${padding}, ${padding}, ${padding});`);
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
    if (node.events.some((item) => item.type === 'activate')) lines.push(`${indent}${variable}.setOnClickListener(clicked -> { try { dispatch(${javaString(node.id)}, "activate", new LinkedHashMap<>()); } catch (IllegalStateException failure) { if (failure.getMessage()!=null && failure.getMessage().startsWith("RCL_UI_FORM_INVALID:")) { formAttempted=true; android.widget.Toast.makeText(this, "Please check required fields", android.widget.Toast.LENGTH_SHORT).show(); render(); } else throw failure; } });`);
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
    } else if (kind === 'radio') {
      lines.push(`${indent}${variable}.setOrientation(RadioGroup.VERTICAL);`);
      for (const option of inputOptions(node)) {
        lines.push(`${indent}{ RadioButton choice = new RadioButton(this); choice.setId(View.generateViewId()); choice.setText(${javaString(option)}); ${variable}.addView(choice); }`);
      }
      if (inputEvent) lines.push(`${indent}${variable}.setOnCheckedChangeListener((group, checkedId) -> { if (!rendering && checkedId != -1) { RadioButton chosen = (RadioButton)group.findViewById(checkedId); if (chosen != null) { ${valueEvent.replace('VALUE','chosen.getText().toString()')} } } });`);
    } else if (kind === 'date') {
      const binding = node.bindings.find((item)=>item.property==='value');
      const initial = binding ? `String.valueOf(${emitJavaExpr(binding.expression,'state','new LinkedHashMap<>()')})` : javaString(property(node,'value') ?? '2000-01-01');
      lines.push(`${indent}String initialDate_${javaIdentifier(node.id)} = ${initial};`, `${indent}LocalDate parsed_${javaIdentifier(node.id)} = LocalDate.parse(initialDate_${javaIdentifier(node.id)});`, `${indent}${variable}.init(parsed_${javaIdentifier(node.id)}.getYear(), parsed_${javaIdentifier(node.id)}.getMonthValue()-1, parsed_${javaIdentifier(node.id)}.getDayOfMonth(), null);`);
      if (inputEvent) lines.push(`${indent}${variable}.setOnDateChangedListener((picker, year, month, day) -> { if (!rendering) { ${valueEvent.replace('VALUE','String.format(java.util.Locale.ROOT,"%04d-%02d-%02d",year,month+1,day)')} } });`);
    } else {
      if (kind === 'textarea') lines.push(`${indent}${variable}.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);`,`${indent}${variable}.setMinLines(3);`,`${indent}${variable}.setGravity(Gravity.TOP | Gravity.START);`);
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
    if (property(node, 'disabled') === true || (property(node, 'read_only') === true && ['checkbox','switch','slider','select','radio','date'].includes(kind))) lines.push(`${indent}${variable}.setEnabled(false);`);
  }
  applyStyle(node, variable, lines, indent);
  for (const child of node.children) {
    const childVariable = emitNode(child, lines, fieldNodeIds, layoutParameterNames, indent);
    const paramsName = layoutParameterNames.get(child.id);
    const width = javaDimension(child.layout.width);
    const height = javaDimension(child.layout.height);
    if (type === 'LinearLayout') {
      lines.push(`${indent}LinearLayout.LayoutParams ${paramsName} = new LinearLayout.LayoutParams(${width}, ${height});`);
      if (node.layout.gap > 0) lines.push(`${indent}${paramsName}.setMargins(0, ${javaPixel(node.layout.gap, 'gap')}, 0, 0);`);
    } else if (type === 'FrameLayout') { lines.push(`${indent}FrameLayout.LayoutParams ${paramsName} = new FrameLayout.LayoutParams(${property(child,'modal') === true ? 'ViewGroup.LayoutParams.MATCH_PARENT' : width}, ${property(child,'modal') === true ? 'ViewGroup.LayoutParams.MATCH_PARENT' : height});`); if (property(child,'modal') === true) lines.push(`${indent}${paramsName}.gravity = Gravity.CENTER;`); }
    else lines.push(`${indent}GridLayout.LayoutParams ${paramsName} = new GridLayout.LayoutParams(); ${paramsName}.width = ${width}; ${paramsName}.height = ${height};`);
    lines.push(`${indent}${variable}.addView(${childVariable}, ${paramsName});`);
  }
  return variable;
}

function emitRuntimeHelpers() {
  return `${ANDROID_JAVA_TEXT_HELPER}
${ANDROID_JAVA_EQUAL_HELPER}

  private static Object rclPath(Map<String,Object> snapshot, String path) { if (!snapshot.containsKey(path)) throw new IllegalStateException("RCL_UI_ANDROID_STATE_MISSING:" + path); return snapshot.get(path); }
  private static boolean rclTruthy(Object value) { if (value == null) return false; if (value instanceof Boolean) return (Boolean)value; if (value instanceof Number) return ((Number)value).doubleValue()!=0d; if (value instanceof CharSequence) return ((CharSequence)value).length()>0; return true; }
  private static boolean rclValidDate(String value) {
    try { if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) return false; return LocalDate.parse(value).getYear() >= 1; }
    catch (Exception ignored) { return false; }
  }
  private static String rclFieldError(Object value,String kind,boolean required,int minLength,int maxLength,String options) {
    boolean empty=value==null || Boolean.FALSE.equals(value) || "".equals(value);
    if (required && empty) return "required";
    if (empty) return null;
    if ("email".equals(kind) || "text".equals(kind) || "password".equals(kind) || "textarea".equals(kind)) {
      if (!(value instanceof String)) return "type";
      int length=((String)value).codePointCount(0,((String)value).length());
      if (minLength>=0 && length<minLength) return "min_length";
      if (maxLength>=0 && length>maxLength) return "max_length";
    }
    if ("email".equals(kind) && !String.valueOf(value).matches(${javaString(UI_EMAIL_PATTERN.source)})) return "email";
    if ("date".equals(kind) && !rclValidDate(String.valueOf(value))) return "date";
    if (("radio".equals(kind) || "select".equals(kind)) && !java.util.Arrays.asList(options.split("\\\\|",-1)).contains(value)) return "option";
    return null;
  }
  private static double rclSliderValue(double min,double step,int progress) { return min + step * progress; }
  private static boolean rclTypeMatches(Object value,String type) { if ("Number".equals(type)) return value instanceof Number && Double.isFinite(((Number)value).doubleValue()); if ("Text".equals(type)) return value instanceof String; if ("Truth".equals(type)) return value instanceof Boolean; return false; }
  private static Object rclUnary(String operator,Object value) { if ("not".equals(operator)) return !rclTruthy(value); if ("-".equals(operator)&&value instanceof Number) return -((Number)value).doubleValue(); throw new IllegalStateException("RCL_UI_ANDROID_UNARY:"+operator); }
  private static Object rclBinary(String operator,Object left,Object right) {
    if ("and".equals(operator)) return rclTruthy(left)&&rclTruthy(right); if ("or".equals(operator)) return rclTruthy(left)||rclTruthy(right);
    if ("+".equals(operator)&&(left instanceof CharSequence||right instanceof CharSequence)) return rclText(left)+rclText(right);
    if ("==".equals(operator)) return rclEqual(left,right); if ("!=".equals(operator)) return !rclEqual(left,right);
    if (left instanceof Number && right instanceof Number) {
      double l = ((Number) left).doubleValue(), r = ((Number) right).doubleValue();
      switch (operator) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return l / r;
        case "%": return l % r;
        case "<": return l < r;
        case "<=": return l <= r;
        case ">": return l > r;
        case ">=": return l >= r;
      }
    }
    if (left instanceof String && right instanceof String) {
      int order = ((String) left).compareTo((String) right);
      switch (operator) {
        case "<": return order < 0;
        case "<=": return order <= 0;
        case ">": return order > 0;
        case ">=": return order >= 0;
      }
    }
    throw new IllegalStateException("RCL_UI_ANDROID_COMPARISON:"+operator);
  }`;
}

function emitFormValidation(ui) {
  const lines = ['  private String rclFormValidation() { return rclFormValidation(null); }', '  private String rclFormValidation(String scope) {','    Map<String,Object> event = new LinkedHashMap<>();'];
  for (const node of collectNodes(ui.viewTree).filter((n) => n.role === 'input')) {
    const binding=node.bindings.find((item)=>item.property==='value');
    const value=binding?emitJavaExpr(binding.expression,'state','event'):javaLiteral(property(node,'value')??'');
    const min=property(node,'min_length')??-1,max=property(node,'max_length')??-1;
    const inScope = node.identityPath.split('/').slice(0, -1).map((id) => `${javaString(id)}.equals(scope)`).join(' || ');
    lines.push(`    if (scope == null${inScope ? ' || ' + inScope : ''}) { String error = rclFieldError(${value}, ${javaString(inputKind(node))}, ${property(node,'required')===true}, ${min}, ${max}, ${javaString(property(node,'options')??'')}); if(error!=null) return ${javaString(node.id+':')}+error; }`);
  }
  lines.push('    return null;','  }');
  return lines.join('\n');
}

function emitModalAndVisibilityGate(ui, routesByTarget) {
  const parents = new Map();
  const walk = (node, parent = null) => { parents.set(node.id, parent); for (const child of node.children) walk(child, node); };
  walk(ui.viewTree);
  const modal = collectNodes(ui.viewTree).find((n) => property(n, 'modal') === true);
  const modalVisible = modal ? [ui.viewTree, modal].map((node) => javaNodeVisibility(node, routesByTarget)).filter(Boolean).join(' && ') : '';
  const blocks = [];
  for (const node of collectNodes(ui.viewTree)) {
    const chain = [];
    for (let item = node; item; item = parents.get(item.id)) chain.push(item);
    const visibility = chain.map((item) => javaNodeVisibility(item, routesByTarget)).filter(Boolean).join(' && ');
    if (visibility) blocks.push(`    if (${javaString(node.id)}.equals(nodeId) && !(${visibility})) throw new IllegalStateException("RCL_UI_EVENT_HIDDEN:"+nodeId+":"+type);`);
    if (modalVisible && !chain.includes(modal)) blocks.push(`    if (${javaString(node.id)}.equals(nodeId) && (${modalVisible})) throw new IllegalStateException("RCL_UI_MODAL_BLOCKED:"+nodeId+":"+type);`);
  }
  return `  private void assertUiInteractable(String nodeId,String type) {\n    Map<String,Object> event = new LinkedHashMap<>();\n${blocks.join('\n')}\n  }`;
}

function emitEventMethods(ui) {
  const methods = [];
  const dispatch = [];
  const routeLog = ui.extensionPoints.navigation ? ' + " route=" + currentRoute' : '';
  for (const node of collectNodes(ui.viewTree)) for (const handler of node.events) {
    const method = `event_${javaIdentifier(node.id)}_${javaIdentifier(handler.type)}`;
    dispatch.push(`    if (${javaString(node.id)}.equals(nodeId) && ${javaString(handler.type)}.equals(type)) { ${method}(event); return; }`);
    const lines = [`  private void ${method}(Map<String,Object> event) {`, `    assertUiInteractable(${javaString(node.id)}, ${javaString(handler.type)});`];
    if (['action', 'input'].includes(node.role)) lines.push(`    if (${controlExpr(node, 'disabled')}) throw new IllegalStateException(${javaString(`RCL_UI_EVENT_DISABLED:${node.id}:${handler.type}`)});`);
    if (node.role === 'action' && property(node,'require_valid_form') === true && handler.type === 'activate') {
      const scope = property(node, 'validation_scope');
      lines.push(`    { String error=rclFormValidation(${scope === undefined ? '' : javaString(scope)}); if(error!=null) throw new IllegalStateException("RCL_UI_FORM_INVALID:${node.id}:"+error); }`);
    }
    if (node.role === 'input' && ['input', 'change'].includes(handler.type)) lines.push(`    if (${controlExpr(node, 'read_only')}) throw new IllegalStateException(${javaString(`RCL_UI_EVENT_READ_ONLY:${node.id}:${handler.type}`)});`);
    for (const parameter of handler.parameters) {
      lines.push(`    if (!event.containsKey(${javaString(parameter.id)}) || !rclTypeMatches(event.get(${javaString(parameter.id)}), ${javaString(parameter.valueType)})) throw new IllegalArgumentException(${javaString(`RCL_UI_ANDROID_EVENT_PARAMETER_TYPE:${node.id}:${handler.type}:${parameter.id}:${parameter.valueType}`)});`);
    }
    if (node.role === 'input' && ['change','input'].includes(handler.type) && inputKind(node) === 'slider') {
      const min=property(node,'min'), max=property(node,'max'), step=property(node,'step');
      lines.push(`    double value = ((Number)event.get("value")).doubleValue(); if (!Double.isFinite(value) || value < ${min}d || value > ${max}d || Math.abs((value-${min}d)/${step}d-Math.rint((value-${min}d)/${step}d))>1e-8) throw new IllegalArgumentException(${javaString(`RCL_UI_SLIDER_VALUE:${node.id}`)});`);
    }
    if (node.role === 'input' && ['change','input'].includes(handler.type) && ['select','radio'].includes(inputKind(node))) {
      lines.push(`    if (!java.util.Arrays.asList(${inputOptions(node).map(javaString).join(',')}).contains(event.get("value"))) throw new IllegalArgumentException(${javaString(`RCL_UI_SELECT_VALUE:${node.id}`)});`);
    }
    if (node.role === 'input' && ['change','input'].includes(handler.type) && inputKind(node) === 'date') lines.push(`    if (!rclValidDate((String)event.get("value"))) throw new IllegalArgumentException(${javaString(`RCL_UI_DATE_VALUE:${node.id}`)});`);
    if (handler.authority === 'reality-transaction') {
      lines.push(`    throw new IllegalStateException(${javaString(`RCL_UI_ANDROID_REALITY_GATEWAY_REQUIRED:${node.id}:${handler.type}`)});`);
    } else {
      lines.push('    Map<String,Object> before = new LinkedHashMap<>(state);', '    Map<String,Object> proposed = new LinkedHashMap<>(before);');
      if (ui.extensionPoints.navigation) lines.push('    String proposedRoute = currentRoute;');
      for (const statement of handler.statements) {
        if (statement.kind === 'navigate') lines.push(`    proposedRoute = ${javaString(statement.route)};`);
        else {
          const target = javaString(statement.target);
          const type = javaString(statement.expression.valueType);
          const error = javaString(`RCL_UI_EVENT_MUTATION_RUNTIME_TYPE:${statement.target}:${statement.expression.valueType}`);
          lines.push(`    { Object next = ${emitJavaExpr(statement.expression, 'before', 'event')}; if (!rclTypeMatches(next, ${type})) throw new IllegalStateException(${error}); proposed.put(${target}, next); }`);
        }
      }
      lines.push('    state.clear(); state.putAll(proposed);');
      if (ui.extensionPoints.navigation) lines.push('    currentRoute = proposedRoute;');
      lines.push(`    history.add(${javaString(`${node.id}:${handler.type}`)});`, `    Log.i(RCL_UI_LOG_TAG, "event node=${node.id} type=${handler.type} before=" + before.keySet().toString() + " after=" + state.keySet().toString()${routeLog});`, '    render();');
    }
    lines.push('  }');
    methods.push(lines.join('\n'));
  }
  return {
    dispatch: `  private void dispatch(String nodeId, String type, Map<String, Object> event) {
    try {
      dispatchEvent(nodeId, type, event);
    } catch (IllegalStateException failure) {
      String code = failure.getMessage();
      if (code == null || !code.startsWith("RCL_UI_EVENT_MUTATION_RUNTIME_TYPE:")) throw failure;
      Log.w(RCL_UI_LOG_TAG, "rejected " + code);
      android.widget.Toast.makeText(this, "The action produced an invalid value", android.widget.Toast.LENGTH_SHORT).show();
      render();
    }
  }
  private void dispatchEvent(String nodeId, String type, Map<String, Object> event) {
${dispatch.join('\n')}
    throw new IllegalArgumentException("RCL_UI_ANDROID_EVENT_UNKNOWN:" + nodeId + ":" + type);
  }`,
    methods: methods.join('\n\n'),
  };
}

function emitDerived(ui) {
  return ui.derivedState.map((item) => `  private Object derive_${javaIdentifier(item.id)}(Map<String,Object> snapshot,Map<String,Object> event) { return ${emitJavaExpr(item.expression, 'snapshot', 'event')}; }`).join('\n');
}

function emitRender(ui, routesByTarget) {
  const lines = ['  private void render() {', '    rendering = true;', '    Map<String,Object> event = new LinkedHashMap<>();'];
  for (const node of collectNodes(ui.viewTree)) {
    const kind = inputKind(node), field=fieldName(node);
    const visibility = javaNodeVisibility(node, routesByTarget);
    if (visibility) lines.push(`    ${field}.setVisibility(${visibility} ? View.VISIBLE : View.GONE);`);
    for (const binding of node.bindings) {
      const value = emitJavaExpr(binding.expression,'state','event');
      if (node.role === 'input' && binding.property === 'value') {
        if (['checkbox','switch'].includes(kind)) lines.push(`    if (${field}.isChecked() != rclTruthy(${value})) ${field}.setChecked(rclTruthy(${value}));`);
        else if (kind === 'slider') {const min=property(node,'min'),step=property(node,'step');lines.push(`    int progress_${javaIdentifier(node.id)}=(int)Math.round((((Number)${value}).doubleValue()-${min}d)/${step}d); if (${field}.getProgress()!=progress_${javaIdentifier(node.id)}) ${field}.setProgress(progress_${javaIdentifier(node.id)});`);}
        else if (kind === 'radio') lines.push(`    for (int i=0;i<${field}.getChildCount();i++) { RadioButton radio = (RadioButton)${field}.getChildAt(i); if (radio.getText().toString().equals(String.valueOf(${value}))) { if (${field}.getCheckedRadioButtonId()!=radio.getId()) ${field}.check(radio.getId()); break; } }`);
        else if (kind === 'date') lines.push(`    LocalDate parsed_${javaIdentifier(node.id)} = LocalDate.parse(String.valueOf(${value})); if (${field}.getYear()!=parsed_${javaIdentifier(node.id)}.getYear() || ${field}.getMonth()!=parsed_${javaIdentifier(node.id)}.getMonthValue()-1 || ${field}.getDayOfMonth()!=parsed_${javaIdentifier(node.id)}.getDayOfMonth()) ${field}.updateDate(parsed_${javaIdentifier(node.id)}.getYear(),parsed_${javaIdentifier(node.id)}.getMonthValue()-1,parsed_${javaIdentifier(node.id)}.getDayOfMonth());`);
        else if (kind === 'select') lines.push(`    for (int i=0;i<${field}.getCount();i++) { if (String.valueOf(${field}.getItemAtPosition(i)).equals(String.valueOf(${value}))) { if (${field}.getSelectedItemPosition()!=i) ${field}.setSelection(i); break; } }`);
        else lines.push(`    if (!${field}.getText().toString().equals(String.valueOf(${value}))) ${field}.setText(String.valueOf(${value}));`);
      } else if ((node.role === 'text' && binding.property === 'value') || (node.role === 'action' && binding.property === 'label')) lines.push(`    ${field}.setText(rclText(${value}));`);
      else if (binding.property === 'disabled' && (node.role !== 'input' || !['checkbox','switch','slider','select','radio','date'].includes(kind))) lines.push(`    ${field}.setEnabled(!rclTruthy(${value}));`);
      else if (binding.property === 'read_only' && node.role === 'input' && ['text','email','password','textarea'].includes(kind)) lines.push(`    ${field}.setKeyListener(rclTruthy(${value}) ? null : inputKeyListeners.get(${javaString(node.id)}));`);
    }
    if (node.role==='input' && ['checkbox','switch','slider','select','radio','date'].includes(kind)) {lines.push(`    ${field}.setEnabled(!(${controlExpr(node,'disabled')} || ${controlExpr(node,'read_only')}));`);if (kind==='radio') lines.push(`    for (int i=0;i<${field}.getChildCount();i++) ${field}.getChildAt(i).setEnabled(!(${controlExpr(node,'disabled')} || ${controlExpr(node,'read_only')}));`);}
  }
  for (const node of collectNodes(ui.viewTree).filter((n)=>n.role==='input' && ['text','email','password','textarea'].includes(inputKind(n)))) {
    const binding=node.bindings.find((item)=>item.property==='value');
    const value=binding?emitJavaExpr(binding.expression,'state','event'):javaLiteral(property(node,'value')??'');
    lines.push(`    if (formAttempted) { String issue=rclFieldError(${value}, ${javaString(inputKind(node))}, ${property(node,'required')===true}, ${property(node,'min_length')??-1}, ${property(node,'max_length')??-1}, ${javaString('')}); ${fieldName(node)}.setError(issue==null?null:issue.replace('_',' ')); }`);
  }
  if (ui.extensionPoints.deviceAdaptation) lines.push('    applyDeviceAdaptation();');
  lines.push('    rendering = false;', '  }');
  return lines.join('\n');
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
    return `    outState.putDouble(${key}, ((Number)state.get(${javaString(item.id)})).doubleValue());`;
  }).join('\n');
  const restore = ui.state.filter((item) => ui.lifecycle.restore.includes(item.id)).map((item) => {
    const key = javaString(`rcl.ui.state.${item.id}`);
    const id = javaString(item.id);
    const type = javaString(item.valueType);
    const error = javaString(`RCL_UI_RESTORE_TYPE:${item.id}:${item.valueType}`);
    return `    if (savedState.containsKey(${key})) { Object value = savedState.get(${key}); if (!rclTypeMatches(value, ${type})) throw new IllegalArgumentException(${error}); restored.put(${id}, value); }`;
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
  const navigation = ui.extensionPoints.navigation;
  const routesByTarget = new Map((navigation?.routes ?? []).map((route) => [route.target, route.id]));
  const fieldNodes = collectNodes(ui.viewTree).filter((node) => node.bindings.length > 0 || property(node,'visible') === false || property(node,'modal') === true || routesByTarget.has(node.id) || node.adaptiveLayouts.length > 0);
  const fieldNodeIds = new Set(fieldNodes.map((node) => node.id));
  const fields = fieldNodes.map((node) => `  private ${viewType(node)} ${fieldName(node)};`).join('\n');
  const uiLines = [];
  const root = emitNode(ui.viewTree, uiLines, fieldNodeIds, androidLayoutParameterNames(ui.viewTree));
  const events = emitEventMethods(ui);
  const lifecycle = emitLifecycle(ui);
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
import android.widget.RadioGroup;
import android.widget.RadioButton;
import android.widget.DatePicker;
import java.time.LocalDate;
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
  private boolean formAttempted = false;
${navigation ? `  private String currentRoute = ${javaString(navigation.initialRoute)};` : ''}
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
${emitModalAndVisibilityGate(ui, routesByTarget)}
${emitDerived(ui)}
${events.dispatch}
${emitFormValidation(ui)}
${events.methods}
${emitRender(ui, routesByTarget)}
${adaptation.method}

  private void restoreState(Bundle savedState) {
    if (savedState == null) return;
    Map<String, Object> restored = new LinkedHashMap<>();
${lifecycle.restore}
    state.putAll(restored);
  }
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
