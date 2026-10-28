// Native UI typed controls. The input kind is a source-declared, immutable choice.
export const UI_INPUT_KINDS = Object.freeze(['text', 'email', 'password', 'checkbox', 'switch', 'slider', 'select', 'radio', 'date', 'textarea']);
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
  const typed = ['checkbox', 'switch', 'slider', 'select', 'radio', 'date', 'textarea'].includes(kind);
  if (!typed && ['options', 'min', 'max', 'step'].some(has)) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if (kind !== 'slider' && ['min', 'max', 'step'].some(has)) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if (!['select','radio'].includes(kind) && has('options')) throw new Error(`RCL_UI_CONTROL_PROPERTY_KIND:${node.id}:${kind}`);
  if ((has('min_length') || has('max_length')) && !['text','email','password','textarea'].includes(kind)) throw new Error(`RCL_UI_FORM_LENGTH_KIND:${node.id}:${kind}`);
  const minLength = get('min_length'), maxLength = get('max_length');
  for (const [label, value] of [['min_length', minLength], ['max_length', maxLength]]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 10000)) throw new Error(`RCL_UI_FORM_LENGTH_BOUND:${node.id}:${label}`);
  }
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) throw new Error(`RCL_UI_FORM_LENGTH_ORDER:${node.id}`);
  if (has('required') && kind === 'slider') throw new Error(`RCL_UI_FORM_REQUIRED_KIND:${node.id}`);
  if (['required','min_length','max_length'].some(has) && !node.bindings.some((x)=>x.property==='value')) throw new Error(`RCL_UI_FORM_BIND_VALUE_REQUIRED:${node.id}`);
  if (typed && !node.bindings.some((x) => x.property === 'value')) throw new Error(`RCL_UI_CONTROL_BIND_VALUE_REQUIRED:${node.id}`);
  if (typed && !node.events.some((x) => ['change', 'input'].includes(x.type))) throw new Error(`RCL_UI_CONTROL_CHANGE_REQUIRED:${node.id}`);
  if (typed && !get('accessibility_label')) throw new Error(`RCL_UI_CONTROL_LABEL_REQUIRED:${node.id}`);
  if (kind === 'date' && has('value') && !isRclIsoDate(get('value'))) throw new Error(`RCL_UI_DATE_VALUE:${node.id}`);
  if (kind === 'slider') {
    const min = get('min'), max = get('max'), step = get('step');
    if (![min,max,step].every(Number.isFinite) || !(min < max && step > 0)) throw new Error(`RCL_UI_SLIDER_RANGE:${node.id}`);
    const steps = (max-min)/step;
    if (!Number.isInteger(steps) && Math.abs(steps-Math.round(steps)) > 1e-9) throw new Error(`RCL_UI_SLIDER_STEP:${node.id}`);
    if (steps > 100000) throw new Error(`RCL_UI_SLIDER_STEPS_LIMIT:${node.id}`);
  }
  if (['select','radio'].includes(kind)) {
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
export function isRclIsoDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const year = Number(value.slice(0,4)), month = Number(value.slice(5,7)), day = Number(value.slice(8,10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const days = [31, ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
  return day <= days[month-1];
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
  if (kind === 'date' && !isRclIsoDate(value)) throw new Error(`RCL_UI_DATE_VALUE:${node.id}`);
  if (['select','radio'].includes(kind) && !inputOptions(node).includes(value)) throw new Error(`RCL_UI_SELECT_VALUE:${node.id}`);
}

// Shared, deterministic, message-free validation; never echo field values into errors.
export function formFieldError(node, value) {
  if (node.role !== 'input') return null;
  const prop = (name) => node.localProperties.find((item) => item.property === name)?.value;
  const kind = inputKind(node);
  const empty = value === '' || value === null || value === undefined || value === false;
  if (prop('required') === true && empty) return 'required';
  if (empty) return null;
  if (['text', 'email', 'password', 'textarea'].includes(kind)) {
    if (typeof value !== 'string') return 'type';
    const length = Array.from(value).length;
    if (prop('min_length') !== undefined && length < prop('min_length')) return 'min_length';
    if (prop('max_length') !== undefined && length > prop('max_length')) return 'max_length';
  }
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  if (kind === 'date' && !isRclIsoDate(value)) return 'date';
  if (['select', 'radio'].includes(kind) && !inputOptions(node).includes(value)) return 'option';
  return null;
}
export function formValidationNodes(nodes, scopeId = null) {
  if (scopeId === null) return nodes;
  const scope = nodes.find((node) => node.id === scopeId);
  if (!scope || scope.role !== 'container') throw new Error(`RCL_UI_FORM_SCOPE_TARGET:${scopeId}`);
  const selected = [];
  const walk = (node) => { selected.push(node); for (const child of node.children) walk(child); };
  walk(scope);
  return selected;
}
export function formValidation(nodes, rendered, scopeId = null) {
  const fields = {};
  for (const node of formValidationNodes(nodes, scopeId)) {
    if (node.role !== 'input') continue;
    const binding = rendered[node.id] ?? {};
    const value = binding.value ?? node.localProperties.find((x) => x.property === 'value')?.value;
    const error = formFieldError(node, value);
    if (error) fields[node.id] = error;
  }
  return { valid: Object.keys(fields).length === 0, fields };
}
