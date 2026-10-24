// Native UI typed controls. The input kind is a source-declared, immutable choice.
export const UI_INPUT_KINDS = Object.freeze(['text', 'email', 'password', 'checkbox', 'switch', 'slider', 'select']);
export function inputKind(node) {
  return node.role === 'input' ? node.localProperties.find((x) => x.property === 'input_kind')?.value ?? 'text' : null;
}
export function inputValueType(kind) {
  return ['checkbox', 'switch'].includes(kind) ? 'Truth' : kind === 'slider' ? 'Number' : 'Text';
}
export function inputOptions(node) {
  const raw = node.localProperties.find((x) => x.property === 'options')?.value;
  return typeof raw === 'string' ? raw.split('|') : [];
}
export function controlPropertyType(role, kind, property, genericTypes) {
  return role === 'input' && property === 'value' ? inputValueType(kind) : genericTypes[property];
}
export function validateInputControl(node) {
  if (node.role !== 'input') return;
  const kind = inputKind(node);
  if (!UI_INPUT_KINDS.includes(kind)) throw new Error(`RCL_UI_INPUT_KIND:${node.id}:${kind}`);
  const get = (name) => node.localProperties.find((x) => x.property === name)?.value;
  const has = (name) => node.localProperties.some((x) => x.property === name);
  const typed = ['checkbox', 'switch', 'slider', 'select'].includes(kind);
  if (!typed && ['options', 'min', 'max', 'step'].some(has)) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if (kind !== 'slider' && ['min', 'max', 'step'].some(has)) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if (kind !== 'select' && has('options')) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if (typed && !node.bindings.some((x) => x.property === 'value')) throw new Error(`RCL_UI_CONTROL_BIND_VALUE_REQUIRED:${node.id}`);
  if (typed && !node.events.some((x) => ['change', 'input'].includes(x.type))) throw new Error(`RCL_UI_CONTROL_CHANGE_REQUIRED:${node.id}`);
  if (typed && !get('accessibility_label')) throw new Error(`RCL_UI_CONTROL_LABEL_REQUIRED:${node.id}`);
  if (kind === 'slider') {
    const min = get('min'), max = get('max'), step = get('step');
    if (![min,max,step].every(Number.isFinite) || !(min < max && step > 0)) throw new Error(`RCL_UI_SLIDER_RANGE:${node.id}`);
    const steps = (max-min)/step;
    if (!Number.isInteger(steps) && Math.abs(steps-Math.round(steps)) > 1e-9) throw new Error(`RCL_UI_SLIDER_STEP:${node.id}`);
    if (steps > 100000) throw new Error(`RCL_UI_SLIDER_STEPS_LIMIT:${node.id}`);
  }
  if (kind === 'select') {
    const values = inputOptions(node);
    if (values.length < 2 || values.length > 64 || values.some((x) => !x || x.trim() !== x) || new Set(values).size !== values.length) throw new Error(`RCL_UI_SELECT_OPTIONS:${node.id}`);
  }
  if (typed) {
    const expected = inputValueType(kind);
    for (const handler of node.events.filter((x) => ['change', 'input'].includes(x.type))) {
      if (handler.parameters.length !== 1 || handler.parameters[0].id !== 'value' || handler.parameters[0].valueType !== expected) throw new Error(`RCL_UI_CONTROL_EVENT_VALUE_TYPE:${node.id}:${expected}`);
    }
  }
}
export function validateControlEvent(node, type, payload) {
  if (node.role !== 'input' || !['input', 'change'].includes(type)) return;
  const kind = inputKind(node), value = payload.value;
  if (kind === 'slider') {
    const read = (name) => node.localProperties.find((x) => x.property === name)?.value;
    const min = read('min'), max = read('max'), step = read('step');
    const index = (value-min)/step;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || Math.abs(index-Math.round(index)) > 1e-8) throw new Error(`RCL_UI_SLIDER_VALUE:${node.id}`);
  }
  if (kind === 'select' && !inputOptions(node).includes(value)) throw new Error(`RCL_UI_SELECT_VALUE:${node.id}`);
}
