import { nativeDataLiteral } from '../native-data-literals.mjs';
import { collectUiNodes } from './ui-compiler.mjs';
import { formValidationNodes, inputKind, inputOptions, UI_EMAIL_WHITESPACE } from './ui-controls.mjs';

const property = (node, name) => node.localProperties.find((item) => item.property === name)?.value;
const binding = (node, name) => node.bindings.find((item) => item.property === name)?.expression;
const and = (conditions) => conditions.length ? conditions.map((condition) => `(${condition})`).join(' and ') : 'true';

const emailChecks = [
  `  reckon rcl_ui_email_domain(value : Text) -> Truth =
    length(value) >= 3 and not contains(value, "@") and contains(slice_text(value, 1, length(value) - 2), ".")`,
  `  reckon rcl_ui_email(value : Text) -> Truth =
    contains(value, "@") and length(split_before(value, "@")) > 0
    and rcl_ui_email_domain(split_after(value, "@"))
    and ${and(UI_EMAIL_WHITESPACE.map((character) => `not contains(value, ${nativeDataLiteral(character)})`))}`,
];
const dateChecks = [
  `  reckon rcl_ui_month_days(year : Number, month : Number) -> Number =
    choose(month == 2, choose(year % 4 == 0 and (year % 100 != 0 or year % 400 == 0), 29, 28),
      choose(month == 4 or month == 6 or month == 9 or month == 11, 30, 31))`,
  `  reckon rcl_ui_date_fields(year : Number, month : Number, day : Number) -> Truth =
    year >= 1 and month >= 1 and month <= 12 and day >= 1 and day <= rcl_ui_month_days(year, month)`,
  `  reckon rcl_ui_date(value : Text) -> Truth =
    length(value) == 10 and char_at(value, 4) == "-" and char_at(value, 7) == "-"
    and ${and([0, 1, 2, 3, 5, 6, 8, 9].map((index) => `is_digit(char_at(value, ${index}))`))}
    and rcl_ui_date_fields(number_from_text(slice_text(value, 0, 4)), number_from_text(slice_text(value, 5, 2)), number_from_text(slice_text(value, 8, 2)))`,
];
const sliderCheck = `  reckon rcl_ui_slider_aligned(index : Number) -> Truth =
    index % 1 <= 0.00000001 or 1 - index % 1 <= 0.00000001`;

function optionsCondition(node, value) {
  return inputOptions(node).map((option) => `(${value}) == ${nativeDataLiteral(option)}`).join(' or ');
}

function formFieldCondition(node, emitExpression, helpers) {
  const kind = inputKind(node);
  const required = property(node, 'required') === true;
  const fieldBinding = binding(node, 'value');
  const initial = property(node, 'value');
  const value = fieldBinding ? emitExpression(fieldBinding) : nativeDataLiteral(initial ?? '');
  const empty = `(${value}) == ${['checkbox', 'switch'].includes(kind) ? 'false' : '""'}`;
  const checks = [];
  const minimum = property(node, 'min_length'), maximum = property(node, 'max_length');
  if (minimum !== undefined) checks.push(`length(${value}) >= ${minimum}`);
  if (maximum !== undefined) checks.push(`length(${value}) <= ${maximum}`);
  if (kind === 'email') {
    helpers.add('email');
    checks.push(`rcl_ui_email(${value})`);
  }
  if (kind === 'date') {
    helpers.add('date');
    checks.push(`rcl_ui_date(${value})`);
  }
  if (['radio', 'select'].includes(kind)) checks.push(optionsCondition(node, value));
  if (required) return and([`not (${empty})`, ...checks]);
  return checks.length ? `(${empty}) or (${and(checks)})` : null;
}

function eventSpan(source, handler) {
  const { line, column } = handler.source ?? { line: 1, column: 1 };
  const offset = source.split('\n', line).slice(0, -1).reduce((start, text) => start + text.length + 1, 0) + column - 1;
  const length = source.startsWith('on', offset) ? 2 : 0;
  return `make_span(${offset}, ${line}, ${column}, ${length})`;
}

export function lowerNativeUiEventGuards(ui, source, handler, emitExpression) {
  const nodes = collectUiNodes(ui.viewTree);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const target = byId.get(handler.nodeId);
  const lineage = target.identityPath.split('/').map((id) => byId.get(id));
  const helpers = new Set();
  const tests = [];
  const location = eventSpan(source, handler);
  const assert = (condition, code, detail = `${target.id}:${handler.type}`) => {
    tests.push(`semantic_assert(${condition}, ${nativeDataLiteral(code)}, ${nativeDataLiteral(detail)}, ${location})`);
  };
  const truth = (node, name) => {
    const bound = binding(node, name);
    return bound ? emitExpression(bound) : property(node, name)?.toString();
  };

  for (const ancestor of lineage) {
    const visible = truth(ancestor, 'visible');
    if (visible && visible !== 'true') assert(visible, 'RCL_UI_EVENT_HIDDEN');
  }
  const modal = ui.viewTree.children.find((node) => property(node, 'modal') === true);
  if (modal && !lineage.includes(modal)) {
    const rootVisible = truth(ui.viewTree, 'visible') ?? 'true';
    assert(`not (${and([rootVisible, truth(modal, 'visible')])})`, 'RCL_UI_MODAL_BLOCKED');
  }
  const disabled = truth(target, 'disabled');
  if (disabled && disabled !== 'false') assert(`not (${disabled})`, 'RCL_UI_EVENT_DISABLED');
  if (target.role === 'action' && handler.type === 'activate' && property(target, 'require_valid_form') === true) {
    const scope = property(target, 'validation_scope') ?? null;
    for (const field of formValidationNodes(nodes, scope)) {
      if (field.role !== 'input') continue;
      const valid = formFieldCondition(field, emitExpression, helpers);
      if (valid) assert(valid, 'RCL_UI_FORM_INVALID', `${target.id}:${field.id}`);
    }
  }
  if (target.role === 'input' && ['input', 'change'].includes(handler.type)) {
    const readOnly = truth(target, 'read_only');
    if (readOnly && readOnly !== 'false') assert(`not (${readOnly})`, 'RCL_UI_EVENT_READ_ONLY');
    const kind = inputKind(target);
    const value = 'ui.input.value';
    if (kind === 'slider') {
      helpers.add('slider');
      const min = nativeDataLiteral(property(target, 'min'));
      const max = nativeDataLiteral(property(target, 'max'));
      const step = nativeDataLiteral(property(target, 'step'));
      assert(and([`${value} >= ${min}`, `${value} <= ${max}`, `rcl_ui_slider_aligned((${value} - ${min}) / ${step})`]), 'RCL_UI_SLIDER_VALUE');
    }
    if (['select', 'radio'].includes(kind)) assert(optionsCondition(target, value), 'RCL_UI_SELECT_VALUE');
    if (kind === 'date') {
      helpers.add('date');
      assert(`rcl_ui_date(${value})`, 'RCL_UI_DATE_VALUE');
    }
  }
  return {
    condition: tests.length ? and(tests) : null,
    definitions: [
      ...(helpers.has('email') ? emailChecks : []),
      ...(helpers.has('date') ? dateChecks : []),
      ...(helpers.has('slider') ? [sliderCheck] : []),
    ],
  };
}
