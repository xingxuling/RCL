import { compileReality } from './compiler.mjs';
import { RCLCompileError } from './errors.mjs';

export const RCL_BYTECODE_VERSION = Object.freeze({ major: 1, minor: 1 });
export const RCL_BYTECODE_FEATURE_VERSION = Object.freeze({ major: 1, minor: 2 });
export const RCL_BYTECODE_DOMAIN_VERSION = Object.freeze({ major: 1, minor: 3 });
export const RCL_BYTECODE_MAGIC = 'RCLB';

export const OPCODES = Object.freeze({
  NOP: 0,
  PUSH_NUMBER: 1,
  PUSH_BOOL: 2,
  PUSH_STRING: 3,
  LOAD_STATE: 4,
  STORE_STATE: 5,
  ADD: 6,
  SUB: 7,
  MUL: 8,
  DIV: 9,
  EQ: 10,
  NEQ: 11,
  LT: 12,
  LTE: 13,
  GT: 14,
  GTE: 15,
  AND: 16,
  OR: 17,
  NOT: 18,
  NEGATE: 19,
  JUMP: 20,
  JUMP_IF_FALSE: 21,
  GRANT_WARRANT: 22,
  BEGIN_TX: 23,
  CHECK_WARRANT: 24,
  STAGE_STORE: 25,
  SET_PROJECTED_VIEW: 26,
  CHECK_PRESERVE: 27,
  RECORD_WITNESS: 28,
  COMMIT_TX: 29,
  CALL_BUILTIN: 30,
  HALT: 31,
  LOAD_LOCAL: 32,
  CALL: 33,
  RETURN: 34,
  CALL_PROVIDER: 35,
  MAKE_TYPED_RECORD: 36,
  MAKE_TYPED_UNION: 37,
  GET_TYPED_FIELD: 38,
  IS_UNION_VARIANT: 39,
  GET_UNION_PAYLOAD: 40,
  MAKE_TYPED_REF: 41,
  DEREF_TYPED_REF: 42,
  GET_TYPED_REF_ID: 43,
  MOD: 44,
  DOMAIN_CALL: 45,
});

export const BUILTINS = Object.freeze({
  CONTAINS: 1,
  STARTS_WITH: 2,
  ENDS_WITH: 3,
  LENGTH: 4,
  LOWER_TEXT: 5,
  UPPER_TEXT: 6,
  TEXT: 7,
  TRIM: 8,
  SPLIT_BEFORE: 9,
  SPLIT_AFTER: 10,
  NUMBER_FROM_TEXT: 11,
  EMPTY_SEQUENCE: 12,
  SEQUENCE_APPEND: 13,
  SEQUENCE_GET: 14,
  CHAR_AT: 15,
  SLICE_TEXT: 16,
  IS_WHITESPACE: 17,
  IS_DIGIT: 18,
  IS_IDENTIFIER_START: 19,
  IS_IDENTIFIER_PART: 20,
  MAKE_SPAN: 21,
  MAKE_TOKEN: 22,
  TOKEN_KIND: 23,
  TOKEN_TEXT: 24,
  TOKEN_SPAN: 25,
  SPAN_OFFSET: 26,
  SPAN_LINE: 27,
  SPAN_COLUMN: 28,
  SPAN_LENGTH: 29,
  FACET_AST: 30,
  AST_KIND: 31,
  AST_PATH: 32,
  AST_VALUE_TYPE: 33,
  AST_LITERAL_KIND: 34,
  AST_LITERAL_TEXT: 35,
  AST_SPAN: 36,
  MAKE_PARSE_STATE: 37,
  PARSE_INDEX: 38,
  PARSE_NODES: 39,
  EXPECT_TOKEN: 40,
  MAKE_SYMBOL: 41,
  SYMBOL_PATH: 42,
  SYMBOL_TYPE: 43,
  SYMBOL_SLOT: 44,
  SYMBOL_SPAN: 45,
  SEMANTIC_ASSERT: 46,
  MAKE_SEMANTIC_FACET: 47,
  SEMANTIC_PATH: 48,
  SEMANTIC_TYPE: 49,
  SEMANTIC_LITERAL_KIND: 50,
  SEMANTIC_LITERAL_TEXT: 51,
  SEMANTIC_SLOT: 52,
  SEMANTIC_SPAN: 53,
  MAKE_IR_STORE: 54,
  IR_OP: 55,
  IR_PATH: 56,
  IR_TYPE: 57,
  IR_LITERAL_KIND: 58,
  IR_LITERAL_TEXT: 59,
  IR_SLOT: 60,
  IR_SPAN: 61,
  SEQUENCE_CONCAT: 62,
  BYTES_U8: 63,
  BYTES_U16LE: 64,
  BYTES_U32LE: 65,
  BYTES_I32LE: 66,
  BYTES_F64LE: 67,
  UTF8_BYTES: 68,
  HEX_BYTES: 69,
  SHA256_TEXT: 70,
  SEQUENCE_APPEND_UNIQUE: 71,
  SEQUENCE_UNIQUE: 72,
  DECODE_STRING_SLICE: 73,
  COMPILER_TOKENIZE: 74,
  SEQUENCE_INDEX_OF: 75,
  SEQUENCE_FIND_FIELD: 76,
});

const OPCODE_NAMES = Object.freeze(Object.fromEntries(Object.entries(OPCODES).map(([name, value]) => [value, name])));
const BUILTIN_NAMES = Object.freeze(Object.fromEntries(Object.entries(BUILTINS).map(([name, value]) => [value, name])));

class Pool {
  constructor() {
    this.strings = [];
    this.stringIds = new Map();
    this.numbers = [];
    this.numberIds = new Map();
  }

  string(value) {
    const text = String(value);
    if (this.stringIds.has(text)) return this.stringIds.get(text);
    const id = this.strings.length;
    this.strings.push(text);
    this.stringIds.set(text, id);
    return id;
  }

  number(value) {
    const number = Number(value);
    const key = Object.is(number, -0) ? '-0' : String(number);
    if (this.numberIds.has(key)) return this.numberIds.get(key);
    const id = this.numbers.length;
    this.numbers.push(number);
    this.numberIds.set(key, id);
    return id;
  }
}

class Assembler {
  constructor(pool) {
    this.pool = pool;
    this.instructions = [];
    this.labels = new Map();
    this.patches = [];
    this.labelId = 0;
  }

  emit(op, a = 0, b = 0, c = 0, flags = 0) {
    const index = this.instructions.length;
    this.instructions.push({ op, flags, a, b, c });
    return index;
  }

  label(name) {
    if (this.labels.has(name)) throw new Error(`Duplicate bytecode label '${name}'`);
    this.labels.set(name, this.instructions.length);
  }

  freshLabel(prefix) {
    return `${prefix}_${this.labelId++}`;
  }

  jump(op, label) {
    const index = this.emit(op, 0, 0, 0);
    this.patches.push({ index, label });
    return index;
  }

  call(label, argc) {
    const index = this.emit(OPCODES.CALL, 0, argc, 0);
    this.patches.push({ index, label });
    return index;
  }

  finish() {
    for (const patch of this.patches) {
      const target = this.labels.get(patch.label);
      if (target === undefined) throw new Error(`Unknown bytecode label '${patch.label}'`);
      this.instructions[patch.index].a = target;
    }
    return this.instructions;
  }
}

function diagnostic(code, message, details = {}) {
  return { code, message, details };
}

function primitiveLiteral(expr) {
  return expr?.kind === 'LiteralExpr' && ['Number', 'Truth', 'Text'].includes(expr.valueType);
}

function validateNativeSubset(program) {
  const diagnostics = [];

  const unsupportedDomains = [
  ];
  for (const [field, name] of unsupportedDomains) {
    if ((program[field]?.length ?? 0) > 0) diagnostics.push(diagnostic(
      'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED',
      `Native VM v0.1 does not yet execute the '${name}' provider domain directly`,
      { field, count: program[field].length },
    ));
  }
  for (const domain of program.knowledges) {
    if (domain.revisions.length || domain.decays.length) diagnostics.push(diagnostic(
      'RCL_NATIVE_KNOWLEDGE_MUTATION_UNSUPPORTED',
      `Native knowledge domain '${domain.name}' does not yet lower revise/forget operations`,
      { revisions: domain.revisions.length, decays: domain.decays.length },
    ));
  }

  for (const facet of program.facets) {
    if ((facet.deferred || !facet.value) && !facet.knowledge && !facet.naturalLanguage && !facet.understanding && !facet.creation && !facet.selection && !facet.elementEntity && !facet.science && !facet.experiment && !facet.scienceConclusion && facet.valueType !== 'BodyState' && facet.valueType !== 'SpiritState') {
      diagnostics.push(diagnostic('RCL_NATIVE_FACET_UNSUPPORTED', `Native VM v0.2 requires an executable facet initializer`, { path: facet.path, valueType: facet.valueType }));
    }
  }

  for (const warrant of program.warrants) {
    if (warrant.condition) diagnostics.push(diagnostic('RCL_NATIVE_CONDITIONAL_WARRANT', 'Native VM v0.1 does not yet support conditional warrants', { subject: warrant.subject, capability: warrant.capability }));
  }

  for (const rule of program.rules) {
    if (rule.calls?.length) diagnostics.push(diagnostic('RCL_NATIVE_HOST_CALL', 'Native VM v0.1 does not yet execute host calls', { rule: rule.name }));
  }

  const allowedDirectives = new Set(['Foresee', 'Realize', 'Reflect', 'Advance', 'Observe', 'Propagate', 'Live', 'Inherit', 'Quantify', 'Learn', 'Interpret', 'Understand', 'Create', 'Synchronize', 'Energize', 'Constitute', 'Investigate', 'Embody', 'Integrate']);
  for (const directive of program.directives) {
    if (!allowedDirectives.has(directive.kind)) diagnostics.push(diagnostic('RCL_NATIVE_DIRECTIVE_UNSUPPORTED', `Native VM v0.1 cannot execute '${directive.kind}'`, { directive }));
  }

  return diagnostics;
}

function compileBuiltin(expr, asm, compileExpr) {
  if (expr.name === 'typed_ref') {
    if (expr.args.length !== 1) throw new Error('typed_ref() requires one typed object argument');
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.MAKE_TYPED_REF);
    return true;
  }
  if (expr.name === 'typed_deref') {
    if (expr.args.length !== 1) throw new Error('typed_deref() requires one typed reference argument');
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.DEREF_TYPED_REF);
    return true;
  }
  if (expr.name === 'typed_ref_id') {
    if (expr.args.length !== 1) throw new Error('typed_ref_id() requires one typed reference argument');
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.GET_TYPED_REF_ID);
    return true;
  }
  if (expr.name === 'provider_call') {
    if (expr.args.length !== 3) throw new Error('provider_call() requires provider id, capability and request JSON');
    const literalArguments = expr.args.every(arg => arg?.kind === 'LiteralExpr' && arg.valueType === 'Text');
    if (literalArguments) {
      asm.emit(OPCODES.CALL_PROVIDER, asm.pool.string(expr.args[0].value), asm.pool.string(expr.args[1].value), asm.pool.string(expr.args[2].value));
    } else {
      expr.args.forEach(compileExpr);
      asm.emit(OPCODES.CALL_PROVIDER, 0, 0, 0, 1);
    }
    return true;
  }
  if (expr.name === 'domain_call') {
    if (expr.args.length < 2) throw new Error('domain_call() requires domain, operation and optional arguments');
    const literalTarget = expr.args.slice(0, 2).every(arg => arg?.kind === 'LiteralExpr' && arg.valueType === 'Text');
    if (literalTarget) {
      const domainIndex = asm.pool.string(expr.args[0].value);
      const operationIndex = asm.pool.string(expr.args[1].value);
      expr.args.slice(2).forEach(compileExpr);
      asm.emit(OPCODES.DOMAIN_CALL, domainIndex, operationIndex, expr.args.length - 2);
    } else {
      expr.args.forEach(compileExpr);
      asm.emit(OPCODES.DOMAIN_CALL, 0, 0, expr.args.length - 2, 1);
    }
    return true;
  }
  const quantityTypes = {
    meters: 'Length', seconds: 'Time', kilograms: 'Mass',
    meters_per_second: 'Velocity', meters_per_second2: 'Acceleration',
    newtons: 'Force', joules: 'Energy', celsius: 'Temperature',
    hertz: 'Frequency', square_meters: 'Area', cubic_meters: 'Volume',
    pascals: 'Pressure', watts: 'Power', bits: 'Information',
  };
  if (quantityTypes[expr.name]) {
    if (expr.args.length !== 1) throw new Error(`${expr.name}() requires one numeric argument`);
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string(quantityTypes[expr.name]));
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string(''));
    asm.emit(OPCODES.DOMAIN_CALL, asm.pool.string('quantity'), asm.pool.string('make'), 3);
    return true;
  }
  const fieldAccessors = {
    measure_value: 'value', uncertainty: 'uncertainty', confidence: 'confidence', certainty: 'confidence',
    knowledge_value: 'value', belief: 'value', knowledge_status: 'status',
    utterance_text: 'text', utterance_speaker: 'speaker', utterance_locale: 'locale',
    intent_name: 'name', intent_action: 'action', intent_target: 'target', intent_confidence: 'confidence',
    understanding_value: 'value', understanding_confidence: 'confidence', understanding_coverage: 'coverage',
    understanding_coherence: 'coherence', understanding_explanation: 'explanation',
    creation_value: 'value', creation_score: 'score', creation_novelty: 'novelty', creation_utility: 'utility',
    creation_feasibility: 'feasibility', creation_risk: 'risk', creation_target: 'target',
    scientific_value: 'value', falsified: 'falsified', body_coherence: 'coherence', body_maintained: 'maintained',
    spirit_coherence: 'coherence', spirit_integrated: 'integrated', element_symbol: 'symbol', atomic_number: 'atomicNumber',
  };
  if (fieldAccessors[expr.name]) {
    if (expr.args.length !== 1) throw new Error(`${expr.name}() requires one argument`);
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.GET_TYPED_FIELD, asm.pool.string(fieldAccessors[expr.name]));
    return true;
  }
  if (expr.name === 'known' || expr.name === 'supported') {
    if (expr.args.length < 1 || expr.args.length > 2) throw new Error(`${expr.name}() requires knowledge and an optional threshold`);
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.GET_TYPED_FIELD, asm.pool.string('status'));
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string('forgotten'));
    asm.emit(OPCODES.NEQ);
    compileExpr(expr.args[0]);
    asm.emit(OPCODES.GET_TYPED_FIELD, asm.pool.string('confidence'));
    if (expr.args[1]) compileExpr(expr.args[1]);
    else asm.emit(OPCODES.PUSH_NUMBER, asm.pool.number(0.5));
    asm.emit(OPCODES.GTE);
    asm.emit(OPCODES.AND);
    return true;
  }
  if (expr.name === 'intent_matches') {
    if (expr.args.length !== 3) throw new Error('intent_matches() requires intent, action and target');
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'active' });
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'action' });
    compileExpr(expr.args[1]);
    asm.emit(OPCODES.EQ);
    asm.emit(OPCODES.AND);
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'target' });
    compileExpr(expr.args[2]);
    asm.emit(OPCODES.EQ);
    asm.emit(OPCODES.AND);
    return true;
  }
  if (expr.name === 'understood') {
    if (expr.args.length < 1 || expr.args.length > 2) throw new Error('understood() requires understanding and optional threshold');
    const threshold = expr.args[1] ?? { kind: 'LiteralExpr', valueType: 'Number', value: 0.5 };
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'status' });
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string('rejected'));
    asm.emit(OPCODES.NEQ);
    for (const field of ['confidence', 'coherence']) {
      compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field });
      compileExpr(threshold);
      asm.emit(OPCODES.GTE);
      asm.emit(OPCODES.AND);
    }
    return true;
  }
  if (expr.name === 'selected') {
    if (expr.args.length !== 1) throw new Error('selected() requires one creation candidate');
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'status' });
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string('selected'));
    asm.emit(OPCODES.EQ);
    return true;
  }
  if (expr.name === 'reproducible') {
    if (expr.args.length !== 1) throw new Error('reproducible() requires one science value');
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'consistent' });
    return true;
  }
  if (expr.name === 'component_count') {
    if (expr.args.length !== 1) throw new Error('component_count() requires one element');
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'components' });
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.LENGTH, 1);
    return true;
  }
  if (expr.name === 'lower' || expr.name === 'upper') {
    if (expr.args.length !== 1) throw new Error(`${expr.name}() requires one measurement`);
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'value' });
    compileExpr({ kind: 'FieldAccessExpr', object: expr.args[0], field: 'uncertainty' });
    asm.emit(expr.name === 'lower' ? OPCODES.SUB : OPCODES.ADD);
    return true;
  }
  if (expr.name === 'min' || expr.name === 'max') {
    if (expr.args.length < 1) throw new Error(`${expr.name}() requires at least one argument`);
    const selected = expr.args.slice(1).reduce((best, candidate) => ({
      kind: 'CallExpr',
      name: 'choose',
      args: [
        { kind: 'BinaryExpr', operator: expr.name === 'min' ? '<' : '>', left: candidate, right: best },
        candidate,
        best,
      ],
    }), expr.args[0]);
    compileExpr(selected);
    return true;
  }
  if (expr.name === 'point') {
    if (expr.args.length !== 5) throw new Error('point() requires frame, x, y, z and t');
    expr.args.forEach(compileExpr);
    asm.emit(OPCODES.PUSH_STRING, asm.pool.string(''));
    asm.emit(OPCODES.DOMAIN_CALL, asm.pool.string('spacetime'), asm.pool.string('point'), 6);
    return true;
  }
  if (expr.name === 'choose') {
    if (expr.args.length !== 3) throw new Error('choose() requires three arguments');
    const id = asm.freshLabel('choose');
    const elseLabel = `${id}_else`;
    const endLabel = `${id}_end`;
    compileExpr(expr.args[0]);
    asm.jump(OPCODES.JUMP_IF_FALSE, elseLabel);
    compileExpr(expr.args[1]);
    asm.jump(OPCODES.JUMP, endLabel);
    asm.label(elseLabel);
    compileExpr(expr.args[2]);
    asm.label(endLabel);
    return true;
  }

  const map = {
    contains: BUILTINS.CONTAINS,
    starts_with: BUILTINS.STARTS_WITH,
    ends_with: BUILTINS.ENDS_WITH,
    length: BUILTINS.LENGTH,
    lower_text: BUILTINS.LOWER_TEXT,
    upper_text: BUILTINS.UPPER_TEXT,
    text: BUILTINS.TEXT,
    trim: BUILTINS.TRIM,
    split_before: BUILTINS.SPLIT_BEFORE,
    split_after: BUILTINS.SPLIT_AFTER,
    number_from_text: BUILTINS.NUMBER_FROM_TEXT,
    empty_sequence: BUILTINS.EMPTY_SEQUENCE,
    sequence_append: BUILTINS.SEQUENCE_APPEND,
    sequence_get: BUILTINS.SEQUENCE_GET,
    char_at: BUILTINS.CHAR_AT,
    slice_text: BUILTINS.SLICE_TEXT,
    is_whitespace: BUILTINS.IS_WHITESPACE,
    is_digit: BUILTINS.IS_DIGIT,
    is_identifier_start: BUILTINS.IS_IDENTIFIER_START,
    is_identifier_part: BUILTINS.IS_IDENTIFIER_PART,
    make_span: BUILTINS.MAKE_SPAN,
    make_token: BUILTINS.MAKE_TOKEN,
    token_kind: BUILTINS.TOKEN_KIND,
    token_text: BUILTINS.TOKEN_TEXT,
    token_span: BUILTINS.TOKEN_SPAN,
    span_offset: BUILTINS.SPAN_OFFSET,
    span_line: BUILTINS.SPAN_LINE,
    span_column: BUILTINS.SPAN_COLUMN,
    span_length: BUILTINS.SPAN_LENGTH,
    facet_ast: BUILTINS.FACET_AST,
    ast_kind: BUILTINS.AST_KIND,
    ast_path: BUILTINS.AST_PATH,
    ast_value_type: BUILTINS.AST_VALUE_TYPE,
    ast_literal_kind: BUILTINS.AST_LITERAL_KIND,
    ast_literal_text: BUILTINS.AST_LITERAL_TEXT,
    ast_span: BUILTINS.AST_SPAN,
    make_parse_state: BUILTINS.MAKE_PARSE_STATE,
    parse_index: BUILTINS.PARSE_INDEX,
    parse_nodes: BUILTINS.PARSE_NODES,
    expect_token: BUILTINS.EXPECT_TOKEN,
    make_symbol: BUILTINS.MAKE_SYMBOL,
    symbol_path: BUILTINS.SYMBOL_PATH,
    symbol_type: BUILTINS.SYMBOL_TYPE,
    symbol_slot: BUILTINS.SYMBOL_SLOT,
    symbol_span: BUILTINS.SYMBOL_SPAN,
    semantic_assert: BUILTINS.SEMANTIC_ASSERT,
    make_semantic_facet: BUILTINS.MAKE_SEMANTIC_FACET,
    semantic_path: BUILTINS.SEMANTIC_PATH,
    semantic_type: BUILTINS.SEMANTIC_TYPE,
    semantic_literal_kind: BUILTINS.SEMANTIC_LITERAL_KIND,
    semantic_literal_text: BUILTINS.SEMANTIC_LITERAL_TEXT,
    semantic_slot: BUILTINS.SEMANTIC_SLOT,
    semantic_span: BUILTINS.SEMANTIC_SPAN,
    make_ir_store: BUILTINS.MAKE_IR_STORE,
    ir_op: BUILTINS.IR_OP,
    ir_path: BUILTINS.IR_PATH,
    ir_type: BUILTINS.IR_TYPE,
    ir_literal_kind: BUILTINS.IR_LITERAL_KIND,
    ir_literal_text: BUILTINS.IR_LITERAL_TEXT,
    ir_slot: BUILTINS.IR_SLOT,
    ir_span: BUILTINS.IR_SPAN,
    sequence_concat: BUILTINS.SEQUENCE_CONCAT,
    bytes_u8: BUILTINS.BYTES_U8,
    bytes_u16le: BUILTINS.BYTES_U16LE,
    bytes_u32le: BUILTINS.BYTES_U32LE,
    bytes_i32le: BUILTINS.BYTES_I32LE,
    bytes_f64le: BUILTINS.BYTES_F64LE,
    utf8_bytes: BUILTINS.UTF8_BYTES,
    hex_bytes: BUILTINS.HEX_BYTES,
    sha256_text: BUILTINS.SHA256_TEXT,
    sequence_append_unique: BUILTINS.SEQUENCE_APPEND_UNIQUE,
    sequence_unique: BUILTINS.SEQUENCE_UNIQUE,
    decode_string_slice: BUILTINS.DECODE_STRING_SLICE,
    compiler_tokenize: BUILTINS.COMPILER_TOKENIZE,
    sequence_index_of: BUILTINS.SEQUENCE_INDEX_OF,
    sequence_find_field: BUILTINS.SEQUENCE_FIND_FIELD,
  };
  const builtin = map[expr.name];
  if (!builtin) return false;
  expr.args.forEach(compileExpr);
  asm.emit(OPCODES.CALL_BUILTIN, builtin, expr.args.length);
  return true;
}

function compileExpression(expr, asm, pool, context = {}) {
  const compileExpr = child => compileExpression(child, asm, pool, context);
  switch (expr.kind) {
    case 'LiteralExpr':
      if (expr.valueType === 'Number') asm.emit(OPCODES.PUSH_NUMBER, pool.number(expr.value));
      else if (expr.valueType === 'Truth') asm.emit(OPCODES.PUSH_BOOL, expr.value ? 1 : 0);
      else if (expr.valueType === 'Text') asm.emit(OPCODES.PUSH_STRING, pool.string(expr.value));
      else throw new Error(`Native bytecode cannot lower literal type '${expr.valueType}'`);
      return;
    case 'PathExpr': {
      const binding = context.bindings?.get(expr.path);
      if (binding) {
        compileExpression(binding, asm, pool, context);
        return;
      }
      const patternLocal = context.patternLocals?.get(expr.path);
      if (patternLocal) {
        compileExpression(patternLocal.target, asm, pool, context);
        asm.emit(OPCODES.GET_UNION_PAYLOAD, patternLocal.index);
        return;
      }
      const localIndex = context.locals?.get(expr.path);
      if (localIndex !== undefined) asm.emit(OPCODES.LOAD_LOCAL, localIndex);
      else asm.emit(OPCODES.LOAD_STATE, pool.string(expr.path));
      return;
    }
    case 'UnaryExpr':
      compileExpr(expr.expression);
      if (expr.operator === 'not') asm.emit(OPCODES.NOT);
      else if (expr.operator === '-') asm.emit(OPCODES.NEGATE);
      else throw new Error(`Native bytecode cannot lower unary operator '${expr.operator}'`);
      return;
    case 'BinaryExpr': {
      if (expr.operator === 'and') {
        const id = asm.freshLabel('and');
        const falseLabel = `${id}_false`;
        const endLabel = `${id}_end`;
        compileExpr(expr.left);
        asm.jump(OPCODES.JUMP_IF_FALSE, falseLabel);
        compileExpr(expr.right);
        asm.emit(OPCODES.NOT);
        asm.emit(OPCODES.NOT);
        asm.jump(OPCODES.JUMP, endLabel);
        asm.label(falseLabel);
        asm.emit(OPCODES.PUSH_BOOL, 0);
        asm.label(endLabel);
        return;
      }
      if (expr.operator === 'or') {
        const id = asm.freshLabel('or');
        const rightLabel = `${id}_right`;
        const endLabel = `${id}_end`;
        compileExpr(expr.left);
        asm.jump(OPCODES.JUMP_IF_FALSE, rightLabel);
        asm.emit(OPCODES.PUSH_BOOL, 1);
        asm.jump(OPCODES.JUMP, endLabel);
        asm.label(rightLabel);
        compileExpr(expr.right);
        asm.emit(OPCODES.NOT);
        asm.emit(OPCODES.NOT);
        asm.label(endLabel);
        return;
      }
      compileExpr(expr.left);
      compileExpr(expr.right);
      const map = {
        '+': OPCODES.ADD, '-': OPCODES.SUB, '*': OPCODES.MUL, '/': OPCODES.DIV, '%': OPCODES.MOD,
        '==': OPCODES.EQ, '!=': OPCODES.NEQ,
        '<': OPCODES.LT, '<=': OPCODES.LTE, '>': OPCODES.GT, '>=': OPCODES.GTE,
      };
      const op = map[expr.operator];
      if (op === undefined) throw new Error(`Native bytecode cannot lower binary operator '${expr.operator}'`);
      asm.emit(op);
      return;
    }
    case 'RecordConstructExpr': {
      for (const field of expr.fields) compileExpr(field.value ?? field.expression);
      asm.emit(OPCODES.MAKE_TYPED_RECORD, pool.string(expr.canonicalType), pool.string(expr.fields.map(field => field.name).join('\n')), expr.fields.length);
      return;
    }
    case 'UnionConstructExpr': {
      for (const payload of expr.payload) compileExpr(payload.value ?? payload.expression ?? payload);
      asm.emit(OPCODES.MAKE_TYPED_UNION, pool.string(expr.canonicalType), pool.string(expr.variant), expr.payload.length);
      return;
    }
    case 'FieldAccessExpr': {
      compileExpr(expr.object);
      asm.emit(OPCODES.GET_TYPED_FIELD, pool.string(expr.field));
      return;
    }
    case 'MatchUnionExpr': {
      const endLabel = `match_end_${asm.instructions.length}`;
      expr.cases.forEach((item, index) => {
        const nextLabel = `match_next_${asm.instructions.length}_${index}`;
        if (!item.wildcard) {
          compileExpr(expr.target);
          asm.emit(OPCODES.IS_UNION_VARIANT, pool.string(item.variant));
          asm.jump(OPCODES.JUMP_IF_FALSE, nextLabel);
        }
        const patternLocals = new Map(context.patternLocals ?? []);
        item.bindings.forEach((name, payloadIndex) => patternLocals.set(name, { target: expr.target, index: payloadIndex }));
        compileExpression(item.expression, asm, pool, { ...context, patternLocals });
        asm.jump(OPCODES.JUMP, endLabel);
        asm.label(nextLabel);
      });
      asm.emit(OPCODES.PUSH_STRING, pool.string(''));
      asm.label(endLabel);
      return;
    }
    case 'CallExpr': {
      if (compileBuiltin(expr, asm, compileExpr)) return;
      const fn = context.functions?.get(expr.name);
      if (!fn) throw new Error(`Native bytecode cannot lower call '${expr.name}'`);
      expr.args.forEach(compileExpr);
      asm.call(fn.label, expr.args.length);
      return;
    }
    default:
      throw new Error(`Native bytecode cannot lower expression kind '${expr.kind}'`);
  }
}

function compileRuleInvocation(rule, mode, asm, pool, invocationIndex, context = {}) {
  const endLabel = `rule_end_${invocationIndex}_${rule.name}_${mode}`;
  compileExpression(rule.when, asm, pool, context);
  asm.jump(OPCODES.JUMP_IF_FALSE, endLabel);
  asm.emit(
    OPCODES.BEGIN_TX,
    mode === 'realize' ? 1 : 0,
    pool.string(rule.name),
    pool.string(rule.kind === 'Emergence' ? rule.cause : rule.from),
    rule.kind === 'Resonance' ? 1 : 0,
  );
  for (const need of rule.needs) {
    asm.emit(
      OPCODES.CHECK_WARRANT,
      pool.string(rule.kind === 'Emergence' ? rule.cause : rule.from),
      pool.string(need.capability),
      pool.string(need.target),
    );
  }
  for (const alteration of rule.alters) {
    compileExpression(alteration.expression, asm, pool, context);
    asm.emit(OPCODES.STAGE_STORE, pool.string(alteration.target));
  }
  if (rule.preserves.length) {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const preserve of rule.preserves) {
      compileExpression(preserve, asm, pool, context);
      asm.emit(OPCODES.CHECK_PRESERVE);
    }
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 0);
  }
  for (const witness of rule.witnesses) asm.emit(OPCODES.RECORD_WITNESS, pool.string(witness));
  asm.emit(OPCODES.COMMIT_TX);
  asm.label(endLabel);
}

function emitTextSequence(values, asm, pool) {
  asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.EMPTY_SEQUENCE, 0);
  for (const value of values ?? []) {
    asm.emit(OPCODES.PUSH_STRING, pool.string(value));
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
  }
}

function emitQuantity(type, expression, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(type));
  compileExpression(expression, asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('quantity'), pool.string('make'), 3);
}

function emitSpacetimePoint(expression, target, asm, pool, context) {
  if (expression?.kind !== 'CallExpr' || expression.name !== 'point' || expression.args.length !== 5) {
    throw new Error('Spacetime coordinate requires point(frame, x, y, z, t)');
  }
  expression.args.forEach(arg => compileExpression(arg, asm, pool, context));
  asm.emit(OPCODES.PUSH_STRING, pool.string(target ?? ''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('spacetime'), pool.string('point'), 6);
}

function emitMeasurement(decl, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(decl.baseType));
  compileExpression(decl.value, asm, pool, context);
  if (decl.uncertainty) compileExpression(decl.uncertainty, asm, pool, context);
  else if (['Length', 'Time', 'Mass', 'Velocity', 'Acceleration', 'Force', 'Energy', 'Temperature', 'Frequency', 'Area', 'Volume', 'Pressure', 'Power', 'Information'].includes(decl.baseType)) {
    emitQuantity(decl.baseType, { kind: 'LiteralExpr', valueType: 'Number', value: 0 }, asm, pool, context);
  } else asm.emit(OPCODES.PUSH_NUMBER, pool.number(0));
  if (decl.confidence) compileExpression(decl.confidence, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(1));
  asm.emit(OPCODES.PUSH_STRING, pool.string(decl.unit ?? ''));
  asm.emit(OPCODES.PUSH_STRING, pool.string(decl.scale ?? 'ratio'));
  emitTextSequence(decl.evidence, asm, pool);
  asm.emit(OPCODES.PUSH_STRING, pool.string(decl.calibratedBy ?? ''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('quantitative'), pool.string('measure'), 8);
}

function emitKnowledge(spec, asm, pool, context, status = null) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.baseType));
  compileExpression(spec.expression, asm, pool, context);
  const explicitConfidence = spec.confidence ?? { kind: 'LiteralExpr', valueType: 'Number', value: 1 };
  const confidence = (spec.dependencies ?? []).reduce((current, path) => {
    const dependencyConfidence = {
      kind: 'FieldAccessExpr',
      object: { kind: 'PathExpr', path },
      field: 'confidence',
    };
    return {
      kind: 'CallExpr',
      name: 'choose',
      args: [
        { kind: 'BinaryExpr', operator: '<', left: dependencyConfidence, right: current },
        dependencyConfidence,
        current,
      ],
    };
  }, explicitConfidence);
  compileExpression(confidence, asm, pool, context);
  emitTextSequence(spec.evidence, asm, pool);
  for (const path of spec.dependencies ?? []) {
    compileExpression({ kind: 'FieldAccessExpr', object: { kind: 'PathExpr', path }, field: 'evidence' }, asm, pool, context);
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_CONCAT, 2);
  }
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.source ?? ''));
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.scope ?? 'local'));
  asm.emit(OPCODES.PUSH_STRING, pool.string(status ?? spec.status ?? 'provisional'));
  emitTextSequence(spec.dependencies, asm, pool);
  asm.emit(OPCODES.PUSH_NUMBER, pool.number(1));
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('knowledge'), pool.string('claim'), 10);
}

function emitEvidenceWithDependencies(evidence, dependencies, asm, pool, context) {
  emitTextSequence(evidence, asm, pool);
  for (const path of dependencies ?? []) {
    compileExpression({ kind: 'FieldAccessExpr', object: { kind: 'PathExpr', path }, field: 'evidence' }, asm, pool, context);
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_CONCAT, 2);
  }
}

function minimumConfidenceExpression(explicit, dependencies) {
  return (dependencies ?? []).reduce((current, path) => {
    const dependencyConfidence = {
      kind: 'FieldAccessExpr',
      object: { kind: 'PathExpr', path },
      field: 'confidence',
    };
    return {
      kind: 'CallExpr', name: 'choose',
      args: [{ kind: 'BinaryExpr', operator: '<', left: dependencyConfidence, right: current }, dependencyConfidence, current],
    };
  }, explicit ?? { kind: 'LiteralExpr', valueType: 'Number', value: 1 });
}

function emitUtterance(spec, asm, pool, context) {
  compileExpression(spec.expression, asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.speaker ?? 'unknown'));
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.locale ?? 'und'));
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.channel ?? 'text'));
  emitTextSequence(spec.evidence, asm, pool);
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('language'), pool.string('utterance'), 6);
}

function emitIntent(spec, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.name));
  compileExpression(spec.when, asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.action ?? ''));
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.target ?? ''));
  if (spec.confidence) compileExpression(spec.confidence, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(1));
  emitEvidenceWithDependencies(spec.evidence, spec.utterances, asm, pool, context);
  emitTextSequence(spec.utterances, asm, pool);
  asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.EMPTY_SEQUENCE, 0);
  for (const slot of spec.slots ?? []) {
    asm.emit(OPCODES.PUSH_STRING, pool.string(slot.name));
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
    compileExpression(slot.expression, asm, pool, context);
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
  }
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('language'), pool.string('intent'), 9);
}

function emitUnderstanding(spec, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.baseType));
  compileExpression(spec.expression, asm, pool, context);
  compileExpression(minimumConfidenceExpression(spec.confidence, spec.dependencies), asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.explanation ?? ''));
  emitEvidenceWithDependencies(spec.evidence, spec.dependencies, asm, pool, context);
  emitTextSequence(spec.dependencies, asm, pool);
  if (spec.coverage) compileExpression(spec.coverage, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(spec.dependencies?.length ? 1 : 0.75));
  if (spec.coherence) compileExpression(spec.coherence, asm, pool, context);
  else compileExpression(minimumConfidenceExpression(spec.confidence, spec.dependencies), asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.status ?? 'hypothesis'));
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('understanding'), pool.string('model'), 10);
}

function emitCreationCandidate(spec, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.baseType));
  compileExpression(spec.expression, asm, pool, context);
  compileExpression(spec.when, asm, pool, context);
  asm.emit(OPCODES.PUSH_STRING, pool.string(spec.target ?? ''));
  for (const [field, fallback] of [['novelty', 0.5], ['utility', 0.5], ['feasibility', 0.5], ['risk', 0.5]]) {
    if (spec[field]) compileExpression(spec[field], asm, pool, context);
    else asm.emit(OPCODES.PUSH_NUMBER, pool.number(fallback));
  }
  emitEvidenceWithDependencies(spec.evidence, spec.basedOn, asm, pool, context);
  emitTextSequence(spec.basedOn, asm, pool);
  asm.emit(OPCODES.PUSH_STRING, pool.string(''));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('creation'), pool.string('candidate'), 11);
}

function bestCreationExpression(paths) {
  if (!paths?.length) throw new Error('Creation selection requires at least one candidate');
  return paths.slice(1).reduce((winner, path) => {
    const candidate = { kind: 'PathExpr', path };
    return {
      kind: 'CallExpr', name: 'choose',
      args: [
        {
          kind: 'BinaryExpr', operator: '>',
          left: { kind: 'FieldAccessExpr', object: candidate, field: 'score' },
          right: { kind: 'FieldAccessExpr', object: winner, field: 'score' },
        },
        candidate,
        winner,
      ],
    };
  }, { kind: 'PathExpr', path: paths[0] });
}

function emitPairs(items, asm, pool, context, emitValue) {
  asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.EMPTY_SEQUENCE, 0);
  for (const item of items) {
    asm.emit(OPCODES.PUSH_STRING, pool.string(item.key));
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
    emitValue(item, asm, pool, context);
    asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
  }
}

function emitScienceClaim({ baseType, value, confidence, status, evidence, method = '', replications = null, reproducibility = null, falsified = null, source = '' }, asm, pool, context) {
  asm.emit(OPCODES.PUSH_STRING, pool.string(baseType));
  compileExpression(value, asm, pool, context);
  if (confidence) compileExpression(confidence, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(1));
  asm.emit(OPCODES.PUSH_STRING, pool.string(status));
  if (evidence?.expression) compileExpression(evidence.expression, asm, pool, context);
  else emitTextSequence(evidence, asm, pool);
  asm.emit(OPCODES.PUSH_STRING, pool.string(method));
  if (replications) compileExpression(replications, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(0));
  if (reproducibility) compileExpression(reproducibility, asm, pool, context);
  else asm.emit(OPCODES.PUSH_NUMBER, pool.number(0));
  if (falsified) compileExpression(falsified, asm, pool, context);
  else asm.emit(OPCODES.PUSH_BOOL, 0);
  asm.emit(OPCODES.PUSH_STRING, pool.string(source));
  asm.emit(OPCODES.DOMAIN_CALL, pool.string('science'), pool.string('claim'), 10);
}

function booleanAllExpression(expressions) {
  return expressions.reduce((left, right) => ({ kind: 'BinaryExpr', operator: 'and', left, right }), { kind: 'LiteralExpr', valueType: 'Truth', value: true });
}

function booleanRatioExpression(expressions) {
  if (!expressions.length) return { kind: 'LiteralExpr', valueType: 'Number', value: 1 };
  const count = expressions
    .map(expression => ({ kind: 'CallExpr', name: 'choose', args: [expression, { kind: 'LiteralExpr', valueType: 'Number', value: 1 }, { kind: 'LiteralExpr', valueType: 'Number', value: 0 }] }))
    .reduce((left, right) => ({ kind: 'BinaryExpr', operator: '+', left, right }));
  return { kind: 'BinaryExpr', operator: '/', left: count, right: { kind: 'LiteralExpr', valueType: 'Number', value: expressions.length } };
}

function averageExpression(expressions) {
  if (!expressions.length) return { kind: 'LiteralExpr', valueType: 'Number', value: 1 };
  const sum = expressions.reduce((left, right) => ({ kind: 'BinaryExpr', operator: '+', left, right }));
  return { kind: 'BinaryExpr', operator: '/', left: sum, right: { kind: 'LiteralExpr', valueType: 'Number', value: expressions.length } };
}

function directiveCount(directive) {
  if (!directive?.count || directive.count.kind !== 'LiteralExpr' || directive.count.valueType !== 'Number') {
    throw new Error(`${directive?.kind ?? 'Domain'} currently requires a literal step count for native lowering`);
  }
  const count = Number(directive.count.value);
  if (!Number.isInteger(count) || count < 0) throw new Error(`${directive.kind} step count must be a non-negative integer`);
  return count;
}

function compileGuardedTransition({ name, when, changes, preserves = [], witnesses = [], context }, asm, pool) {
  const end = asm.freshLabel(`domain_${name.replaceAll('.', '_')}`);
  if (when) {
    compileExpression(when, asm, pool, context);
    asm.jump(OPCODES.JUMP_IF_FALSE, end);
  }
  asm.emit(OPCODES.BEGIN_TX, 1, pool.string(name), pool.string(name));
  for (const change of changes) {
    compileExpression(change.expression, asm, pool, context);
    asm.emit(OPCODES.STAGE_STORE, pool.string(change.target));
  }
  asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
  for (const preserve of preserves) {
    compileExpression(preserve, asm, pool, context);
    asm.emit(OPCODES.CHECK_PRESERVE);
  }
  asm.emit(OPCODES.SET_PROJECTED_VIEW, 0);
  for (const witness of witnesses) asm.emit(OPCODES.RECORD_WITNESS, pool.string(witness));
  asm.emit(OPCODES.COMMIT_TX);
  asm.label(end);
}

function compileDomainTransition(domain, kind, asm, pool, context, directive = null) {
  if (kind === 'Reflect') {
    compileGuardedTransition({ name: domain.name, changes: domain.revisions, preserves: domain.preserves, witnesses: [`domain:reflect:${domain.name}`], context }, asm, pool);
    return;
  }
  if (kind === 'Advance') {
    const bindings = new Map(context.bindings ?? []);
    bindings.set(domain.step.name, directive.dt);
    for (let step = 0; step < directiveCount(directive); step += 1) {
      compileGuardedTransition({
        name: domain.name, when: domain.when, changes: domain.evolves, preserves: domain.conserves,
        witnesses: domain.witnesses, context: { ...context, bindings },
      }, asm, pool);
    }
    return;
  }
  if (kind === 'Propagate') {
    for (let step = 0; step < directiveCount(directive); step += 1) {
      for (const pathway of domain.pathways) compileGuardedTransition({
        name: pathway.name, when: pathway.when, changes: pathway.changes,
        preserves: pathway.preserves, witnesses: pathway.witnesses, context,
      }, asm, pool);
    }
    return;
  }
  if (kind === 'Live') {
    for (let step = 0; step < directiveCount(directive); step += 1) {
      compileGuardedTransition({
        name: `${domain.name}.sense`,
        changes: domain.senses.map(sense => ({ target: sense.path, expression: { kind: 'PathExpr', path: sense.source } })),
        context,
      }, asm, pool);
      for (const cycle of domain.cycles) compileGuardedTransition({
        name: cycle.name, when: cycle.when, changes: cycle.changes,
        preserves: domain.maintains, witnesses: cycle.witnesses, context,
      }, asm, pool);
    }
    return;
  }
  if (kind === 'Inherit') {
    for (let generation = 0; generation < directiveCount(directive); generation += 1) {
      asm.emit(OPCODES.BEGIN_TX, 1, pool.string(domain.name), pool.string(domain.name));
      for (const mutation of domain.mutations) {
        compileExpression({
          kind: 'BinaryExpr', operator: '+',
          left: { kind: 'PathExpr', path: mutation.target }, right: mutation.expression,
        }, asm, pool, context);
        asm.emit(OPCODES.STAGE_STORE, pool.string(mutation.target));
      }
      asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
      for (const expression of domain.expressions) {
        compileExpression(expression.expression, asm, pool, context);
        asm.emit(OPCODES.STAGE_STORE, pool.string(expression.target));
      }
      for (const preserve of domain.preserves) {
        compileExpression(preserve, asm, pool, context);
        asm.emit(OPCODES.CHECK_PRESERVE);
      }
      asm.emit(OPCODES.SET_PROJECTED_VIEW, 0);
      for (const witness of domain.witnesses) asm.emit(OPCODES.RECORD_WITNESS, pool.string(witness));
      asm.emit(OPCODES.COMMIT_TX);
    }
    return;
  }
  if (kind === 'Synchronize') {
    const count = directiveCount(directive);
    for (let step = 0; step < count; step += 1) {
      asm.emit(OPCODES.BEGIN_TX, 1, pool.string(domain.name), pool.string(domain.name));
      for (const clock of domain.clocks) {
        compileExpression({ kind: 'PathExpr', path: clock.path }, asm, pool, context);
        asm.emit(OPCODES.PUSH_STRING, pool.string('Time'));
        compileExpression(clock.tick, asm, pool, context);
        asm.emit(OPCODES.GET_TYPED_FIELD, pool.string('value'));
        compileExpression(clock.rate, asm, pool, context);
        asm.emit(OPCODES.MUL);
        asm.emit(OPCODES.PUSH_STRING, pool.string(''));
        asm.emit(OPCODES.DOMAIN_CALL, pool.string('quantity'), pool.string('make'), 3);
        asm.emit(OPCODES.ADD);
        asm.emit(OPCODES.STAGE_STORE, pool.string(clock.path));
      }
      asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
      const defaultClock = domain.clocks[0]?.path;
      for (const coordinate of domain.coordinates) {
        compileExpression({ kind: 'PathExpr', path: coordinate.path }, asm, pool, context);
        compileExpression({ kind: 'PathExpr', path: coordinate.clock ?? defaultClock }, asm, pool, context);
        asm.emit(OPCODES.PUSH_STRING, pool.string(coordinate.target ?? ''));
        asm.emit(OPCODES.DOMAIN_CALL, pool.string('spacetime'), pool.string('retime'), 3);
        asm.emit(OPCODES.STAGE_STORE, pool.string(coordinate.path));
      }
      for (const preserve of domain.preserves) {
        compileExpression(preserve, asm, pool, context);
        asm.emit(OPCODES.CHECK_PRESERVE);
      }
      asm.emit(OPCODES.SET_PROJECTED_VIEW, 0);
      asm.emit(OPCODES.RECORD_WITNESS, pool.string(`domain:synchronize:${domain.name}`));
      asm.emit(OPCODES.COMMIT_TX);
    }
    return;
  }
  if (kind === 'Accelerate' || kind === 'Compress' || kind === 'Restore') {
    compileGuardedTransition({
      name: domain.name, changes: [], preserves: domain.preserves ?? [],
      witnesses: [`domain:${kind.toLowerCase()}:${domain.name}`], context,
    }, asm, pool);
    return;
  }
  asm.emit(OPCODES.BEGIN_TX, 1, pool.string(domain.name), pool.string(domain.name));
  if (kind === 'Quantify') {
    for (const measure of domain.measures) {
      emitMeasurement(measure, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(measure.path));
    }
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const derive of domain.derives) {
      compileExpression(derive.expression, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(derive.path));
    }
  } else if (kind === 'Observe') {
    for (const channel of domain.channels) {
      compileExpression(channel.expression, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(channel.path));
    }
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
  } else if (kind === 'Learn') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const claim of domain.claims) {
      emitKnowledge(claim, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(claim.path));
    }
    for (const derive of domain.derives) {
      emitKnowledge(derive, asm, pool, context, 'derived');
      asm.emit(OPCODES.STAGE_STORE, pool.string(derive.path));
    }
  } else if (kind === 'Interpret') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const utterance of domain.utterances) {
      emitUtterance(utterance, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(utterance.path));
    }
    for (const intent of domain.intents) {
      emitIntent(intent, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(intent.path));
    }
  } else if (kind === 'Understand') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const hypothesis of domain.hypotheses) {
      emitUnderstanding(hypothesis, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(hypothesis.path));
    }
  } else if (kind === 'Create') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const candidate of domain.candidates) {
      emitCreationCandidate(candidate, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(candidate.path));
    }
    compileExpression(bestCreationExpression(domain.selection.candidates), asm, pool, context);
    emitTextSequence(domain.selection.candidates, asm, pool);
    asm.emit(OPCODES.DOMAIN_CALL, pool.string('creation'), pool.string('select'), 2);
    asm.emit(OPCODES.STAGE_STORE, pool.string(domain.selection.path));
  } else if (kind === 'Energize') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const flow of domain.flows) {
      compileExpression({ kind: 'PathExpr', path: flow.from }, asm, pool, context);
      compileExpression(flow.amount, asm, pool, context);
      asm.emit(OPCODES.SUB);
      asm.emit(OPCODES.STAGE_STORE, pool.string(flow.from));
      compileExpression({ kind: 'PathExpr', path: flow.to }, asm, pool, context);
      compileExpression(flow.amount, asm, pool, context);
      compileExpression(flow.efficiency, asm, pool, context);
      asm.emit(OPCODES.DOMAIN_CALL, pool.string('energy'), pool.string('scale'), 2);
      asm.emit(OPCODES.ADD);
      asm.emit(OPCODES.STAGE_STORE, pool.string(flow.to));
    }
  } else if (kind === 'Constitute') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const spec of domain.species) {
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.localName));
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.symbol ?? ''));
      compileExpression(spec.atomicNumber ?? { kind: 'LiteralExpr', valueType: 'Number', value: 0 }, asm, pool, context);
      compileExpression(spec.atomicMass ?? { kind: 'LiteralExpr', valueType: 'Number', value: 0 }, asm, pool, context);
      compileExpression(spec.charge ?? { kind: 'LiteralExpr', valueType: 'Number', value: 0 }, asm, pool, context);
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.phase ?? 'unspecified'));
      emitTextSequence(spec.evidence, asm, pool);
      asm.emit(OPCODES.DOMAIN_CALL, pool.string('element'), pool.string('species'), 7);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.path));
    }
    for (const spec of domain.compounds) {
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.localName));
      emitPairs(spec.components.map(item => ({ key: item.component, expression: item.coefficient })), asm, pool, context,
        item => compileExpression(item.expression, asm, pool, context));
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.bond ?? ''));
      emitTextSequence(spec.evidence, asm, pool);
      asm.emit(OPCODES.DOMAIN_CALL, pool.string('element'), pool.string('compound'), 4);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.path));
    }
  } else if (kind === 'Investigate') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    for (const spec of domain.hypotheses) {
      emitScienceClaim({
        baseType: spec.baseType, value: spec.expression, confidence: spec.confidence,
        status: 'hypothesis', evidence: spec.evidence, source: spec.path,
      }, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.path));
    }
    for (const spec of domain.experiments) {
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.localName));
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.hypothesis));
      asm.emit(OPCODES.PUSH_STRING, pool.string(spec.method ?? 'deterministic'));
      compileExpression(spec.repeats, asm, pool, context);
      asm.emit(OPCODES.PUSH_BOOL, 1);
      asm.emit(OPCODES.PUSH_NUMBER, pool.number(1));
      asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.EMPTY_SEQUENCE, 0);
      const hypothesis = domain.hypotheses.find(item => item.path === spec.hypothesis);
      const repeats = spec.repeats?.kind === 'LiteralExpr' ? Math.max(1, Math.floor(spec.repeats.value)) : 1;
      for (let index = 0; index < repeats; index += 1) {
        compileExpression(hypothesis.expression, asm, pool, context);
        asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
      }
      emitTextSequence(spec.evidence, asm, pool);
      asm.emit(OPCODES.DOMAIN_CALL, pool.string('science'), pool.string('experiment'), 8);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.path));

      const old = { kind: 'PathExpr', path: spec.hypothesis };
      emitScienceClaim({
        baseType: hypothesis.baseType,
        value: { kind: 'FieldAccessExpr', object: old, field: 'value' },
        confidence: { kind: 'FieldAccessExpr', object: old, field: 'confidence' },
        status: 'supported',
        evidence: {
          expression: {
            kind: 'CallExpr', name: 'sequence_concat',
            args: [
              { kind: 'FieldAccessExpr', object: old, field: 'evidence' },
              { kind: 'FieldAccessExpr', object: { kind: 'PathExpr', path: spec.path }, field: 'evidence' },
            ],
          },
        },
        method: spec.method ?? '', replications: spec.repeats,
        reproducibility: { kind: 'LiteralExpr', valueType: 'Number', value: 1 },
        source: hypothesis.path,
      }, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.hypothesis));
    }
    for (const spec of domain.conclusions) {
      const source = { kind: 'PathExpr', path: spec.source };
      emitScienceClaim({
        baseType: 'Truth',
        value: {
          kind: 'BinaryExpr', operator: 'and',
          left: {
            kind: 'BinaryExpr', operator: '==',
            left: { kind: 'FieldAccessExpr', object: source, field: 'status' },
            right: { kind: 'LiteralExpr', valueType: 'Text', value: 'supported' },
          },
          right: { kind: 'UnaryExpr', operator: 'not', expression: { kind: 'FieldAccessExpr', object: source, field: 'falsified' } },
        },
        confidence: spec.confidence, status: 'conclusion',
        evidence: {
          expression: {
            kind: 'CallExpr', name: 'sequence_concat',
            args: [{ kind: 'FieldAccessExpr', object: source, field: 'evidence' }, { kind: 'CallExpr', name: 'empty_sequence', args: [] }],
          },
        },
        method: '', replications: { kind: 'FieldAccessExpr', object: source, field: 'replications' },
        reproducibility: { kind: 'FieldAccessExpr', object: source, field: 'reproducibility' },
        falsified: { kind: 'FieldAccessExpr', object: source, field: 'falsified' }, source: spec.source,
      }, asm, pool, context);
      asm.emit(OPCODES.STAGE_STORE, pool.string(spec.path));
    }
  } else if (kind === 'Embody') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    asm.emit(OPCODES.PUSH_STRING, pool.string(domain.name));
    emitTextSequence(domain.systems.map(item => item.path), asm, pool);
    emitTextSequence(domain.organs.map(item => item.path), asm, pool);
    emitPairs(Object.entries(domain.bindings).map(([key, value]) => ({ key, value })), asm, pool, context,
      item => asm.emit(OPCODES.PUSH_STRING, pool.string(item.value)));
    compileExpression(booleanAllExpression(domain.maintains), asm, pool, context);
    compileExpression(booleanRatioExpression(domain.maintains), asm, pool, context);
    emitTextSequence(domain.evidence, asm, pool);
    asm.emit(OPCODES.DOMAIN_CALL, pool.string('body'), pool.string('state'), 7);
    asm.emit(OPCODES.STAGE_STORE, pool.string(`${domain.name}.state`));
  } else if (kind === 'Integrate') {
    asm.emit(OPCODES.SET_PROJECTED_VIEW, 1);
    asm.emit(OPCODES.PUSH_STRING, pool.string(domain.name));
    const identity = domain.facets.find(item => item.path.endsWith('.identity'));
    compileExpression(identity?.value ?? { kind: 'LiteralExpr', valueType: 'Text', value: domain.name }, asm, pool, context);
    for (const items of [domain.values, domain.purposes, domain.affects]) {
      emitPairs(items.map(item => ({ key: item.localName, item })), asm, pool, context, entry => {
        asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.EMPTY_SEQUENCE, 0);
        compileExpression({ kind: 'PathExpr', path: entry.item.path }, asm, pool, context);
        asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
        compileExpression(entry.item.weight, asm, pool, context);
        asm.emit(OPCODES.CALL_BUILTIN, BUILTINS.SEQUENCE_APPEND, 2);
      });
    }
    const normalizedWeight = averageExpression([...domain.values, ...domain.purposes, ...domain.affects].map(item => item.weight));
    compileExpression({
      kind: 'BinaryExpr', operator: '*',
      left: booleanRatioExpression(domain.preserves),
      right: { kind: 'CallExpr', name: 'choose', args: [
        { kind: 'BinaryExpr', operator: '<', left: normalizedWeight, right: { kind: 'LiteralExpr', valueType: 'Number', value: 1 } },
        normalizedWeight,
        { kind: 'LiteralExpr', valueType: 'Number', value: 1 },
      ] },
    }, asm, pool, context);
    compileExpression(booleanAllExpression(domain.preserves), asm, pool, context);
    emitTextSequence(domain.evidence, asm, pool);
    asm.emit(OPCODES.DOMAIN_CALL, pool.string('spirit'), pool.string('state'), 8);
    asm.emit(OPCODES.STAGE_STORE, pool.string(`${domain.name}.state`));
  }
  for (const preserve of domain.preserves ?? []) {
    compileExpression(preserve, asm, pool, context);
    asm.emit(OPCODES.CHECK_PRESERVE);
  }
  asm.emit(OPCODES.SET_PROJECTED_VIEW, 0);
  asm.emit(OPCODES.RECORD_WITNESS, pool.string(`domain:${kind.toLowerCase()}:${domain.name}`));
  asm.emit(OPCODES.COMMIT_TX);
}

function encodeProgram({ pool, instructions, programNameIndex, sourceRootIndex, flags = 0 }) {
  const headerSize = 36;
  const stringBytes = pool.strings.map(text => Buffer.from(text, 'utf8'));
  const stringsSize = stringBytes.reduce((sum, bytes) => sum + 4 + bytes.length, 0);
  const numbersSize = pool.numbers.length * 8;
  const instructionSize = 16;
  const minorVersion = instructions.reduce((requiredMinor, instruction) => {
    if (instruction.op === OPCODES.DOMAIN_CALL) return Math.max(requiredMinor, RCL_BYTECODE_DOMAIN_VERSION.minor);
    if (instruction.op === OPCODES.MOD || (instruction.op === OPCODES.CALL_PROVIDER && (instruction.flags & 1) === 1)) {
      return Math.max(requiredMinor, RCL_BYTECODE_FEATURE_VERSION.minor);
    }
    return requiredMinor;
  }, RCL_BYTECODE_VERSION.minor);
  const buffer = Buffer.alloc(headerSize + stringsSize + numbersSize + instructions.length * instructionSize);
  let offset = 0;
  buffer.write(RCL_BYTECODE_MAGIC, offset, 4, 'ascii'); offset += 4;
  buffer.writeUInt16LE(RCL_BYTECODE_VERSION.major, offset); offset += 2;
  buffer.writeUInt16LE(minorVersion, offset); offset += 2;
  buffer.writeUInt32LE(flags >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(programNameIndex >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(sourceRootIndex >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(pool.strings.length >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(pool.numbers.length >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(instructions.length >>> 0, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;
  for (const bytes of stringBytes) {
    buffer.writeUInt32LE(bytes.length >>> 0, offset); offset += 4;
    bytes.copy(buffer, offset); offset += bytes.length;
  }
  for (const number of pool.numbers) {
    buffer.writeDoubleLE(number, offset); offset += 8;
  }
  for (const instruction of instructions) {
    buffer.writeUInt8(instruction.op, offset); offset += 1;
    buffer.writeUInt8(instruction.flags ?? 0, offset); offset += 1;
    buffer.writeUInt16LE(0, offset); offset += 2;
    buffer.writeInt32LE(instruction.a ?? 0, offset); offset += 4;
    buffer.writeInt32LE(instruction.b ?? 0, offset); offset += 4;
    buffer.writeInt32LE(instruction.c ?? 0, offset); offset += 4;
  }
  return buffer;
}

function lowerToBytecode(program) {
  const diagnostics = validateNativeSubset(program);
  if (diagnostics.length) return { ok: false, diagnostics, program: null, bytecode: null };

  const pool = new Pool();
  const asm = new Assembler(pool);
  const programNameIndex = pool.string(program.name);
  const sourceRootIndex = pool.string(program.programRoot);
  const functions = new Map(program.reckons.map((decl, index) => [decl.name, { decl, label: `reckon_${index}_${decl.name}` }]));
  const mainContext = { locals: new Map(), functions };

  for (const facet of program.facets) {
    if (facet.deferred) continue;
    if (facet.measure) emitMeasurement(facet.measure, asm, pool, mainContext);
    else if (facet.spacetimeCoordinate) emitSpacetimePoint(facet.value, facet.spacetimeCoordinate.target, asm, pool, mainContext);
    else compileExpression(facet.value, asm, pool, mainContext);
    asm.emit(OPCODES.STORE_STATE, pool.string(facet.path));
  }
  for (const warrant of program.warrants) {
    asm.emit(OPCODES.GRANT_WARRANT, pool.string(warrant.subject), pool.string(warrant.capability), pool.string(warrant.target));
  }

  const rules = new Map(program.rules.map(rule => [rule.name, rule]));
  const domains = {
    Reflect: new Map(program.metaDomains.map(domain => [domain.name, domain])),
    Advance: new Map(program.physicals.flatMap(domain => domain.laws).map(law => [law.name, law])),
    Observe: new Map(program.perceptions.map(domain => [domain.name, domain])),
    Propagate: new Map(program.neurals.map(domain => [domain.name, domain])),
    Live: new Map(program.livings.map(domain => [domain.name, domain])),
    Inherit: new Map(program.genetics.map(domain => [domain.name, domain])),
    Quantify: new Map(program.quantitatives.map(domain => [domain.name, domain])),
    Learn: new Map(program.knowledges.map(domain => [domain.name, domain])),
    Interpret: new Map(program.naturalLanguages.map(domain => [domain.name, domain])),
    Understand: new Map(program.understandings.map(domain => [domain.name, domain])),
    Create: new Map(program.creations.map(domain => [domain.name, domain])),
    Synchronize: new Map(program.spacetimes.map(domain => [domain.name, domain])),
    Accelerate: new Map(program.accelerations.map(domain => [domain.name, domain])),
    Compress: new Map(program.compressions.map(domain => [domain.name, domain])),
    Restore: new Map(program.compressions.map(domain => [domain.name, domain])),
    Energize: new Map(program.energies.map(domain => [domain.name, domain])),
    Constitute: new Map(program.elements.map(domain => [domain.name, domain])),
    Investigate: new Map(program.sciences.map(domain => [domain.name, domain])),
    Embody: new Map(program.embodiments.map(domain => [domain.name, domain])),
    Integrate: new Map(program.spirits.map(domain => [domain.name, domain])),
  };
  program.directives.forEach((directive, index) => {
    if (domains[directive.kind]) {
      const domain = domains[directive.kind].get(directive.name);
      if (!domain) throw new Error(`Unknown ${directive.kind} domain '${directive.name}' during bytecode lowering`);
      compileDomainTransition(domain, directive.kind, asm, pool, mainContext, directive);
      return;
    }
    const rule = rules.get(directive.rule);
    if (!rule) throw new Error(`Unknown rule '${directive.rule}' during bytecode lowering`);
    compileRuleInvocation(rule, directive.kind === 'Realize' ? 'realize' : 'foresee', asm, pool, index, mainContext);
  });
  asm.emit(OPCODES.HALT);
  for (const fn of functions.values()) {
    asm.label(fn.label);
    const locals = new Map(fn.decl.params.map((param, index) => [param.name, index]));
    compileExpression(fn.decl.expression, asm, pool, { locals, functions });
    asm.emit(OPCODES.RETURN);
  }
  const instructions = asm.finish();
  const bytecode = encodeProgram({ pool, instructions, programNameIndex, sourceRootIndex });
  return { ok: true, diagnostics: [], program, bytecode };
}

export function tryCompileRealityToBytecode(sourceOrProgram) {
  try {
    const program = typeof sourceOrProgram === 'string' ? compileReality(sourceOrProgram) : sourceOrProgram;
    return lowerToBytecode(program);
  } catch (error) {
    if (error instanceof RCLCompileError) return { ok: false, diagnostics: error.diagnostics ?? [{ code: 'RCL_COMPILE_FAILURE', message: error.message }], program: null, bytecode: null };
    return { ok: false, diagnostics: [diagnostic(error.code ?? 'RCL_BYTECODE_LOWERING', error.message, error.details ?? {})], program: null, bytecode: null };
  }
}

export function compileRealityToBytecode(sourceOrProgram) {
  const result = tryCompileRealityToBytecode(sourceOrProgram);
  if (!result.ok) throw new RCLCompileError(result.diagnostics);
  return result.bytecode;
}

export function decodeBytecode(bufferLike) {
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike);
  if (buffer.length < 36 || buffer.toString('ascii', 0, 4) !== RCL_BYTECODE_MAGIC) throw new Error('Invalid RCL bytecode magic');
  let offset = 4;
  const major = buffer.readUInt16LE(offset); offset += 2;
  const minor = buffer.readUInt16LE(offset); offset += 2;
  const flags = buffer.readUInt32LE(offset); offset += 4;
  const programNameIndex = buffer.readUInt32LE(offset); offset += 4;
  const sourceRootIndex = buffer.readUInt32LE(offset); offset += 4;
  const stringCount = buffer.readUInt32LE(offset); offset += 4;
  const numberCount = buffer.readUInt32LE(offset); offset += 4;
  const instructionCount = buffer.readUInt32LE(offset); offset += 4;
  offset += 4;
  const strings = [];
  for (let i = 0; i < stringCount; i += 1) {
    const length = buffer.readUInt32LE(offset); offset += 4;
    strings.push(buffer.toString('utf8', offset, offset + length));
    offset += length;
  }
  const numbers = [];
  for (let i = 0; i < numberCount; i += 1) {
    numbers.push(buffer.readDoubleLE(offset)); offset += 8;
  }
  const instructions = [];
  for (let i = 0; i < instructionCount; i += 1) {
    const op = buffer.readUInt8(offset); offset += 1;
    const instructionFlags = buffer.readUInt8(offset); offset += 1;
    offset += 2;
    const a = buffer.readInt32LE(offset); offset += 4;
    const b = buffer.readInt32LE(offset); offset += 4;
    const c = buffer.readInt32LE(offset); offset += 4;
    instructions.push({ index: i, op, name: OPCODE_NAMES[op] ?? `UNKNOWN_${op}`, flags: instructionFlags, a, b, c, builtin: op === OPCODES.CALL_BUILTIN ? BUILTIN_NAMES[a] : undefined });
  }
  return {
    format: 'rcl.bytecode.v1',
    version: { major, minor },
    flags,
    program: strings[programNameIndex],
    sourceRoot: strings[sourceRootIndex],
    strings,
    numbers,
    instructions,
    byteLength: buffer.length,
  };
}

export function assembleAstProgram({ program = 'BootstrapAstProgram', ast, sourceRoot = 'bootstrap:selfhost-stage2' }) {
  if (!Array.isArray(ast) || ast.length === 0) throw new TypeError('ast must be a non-empty Sequence of facet nodes');
  const pool = new Pool();
  const asm = new Assembler(pool);
  const programNameIndex = pool.string(program);
  const sourceRootIndex = pool.string(sourceRoot);
  for (const node of ast) {
    if (!node || node.kind !== 'FacetDecl' || !node.value || node.value.kind !== 'LiteralExpr') throw new TypeError('Stage-2 AST supports FacetDecl literal nodes');
    const value = node.value.value;
    if (typeof value === 'number') asm.emit(OPCODES.PUSH_NUMBER, pool.number(value));
    else if (typeof value === 'boolean') asm.emit(OPCODES.PUSH_BOOL, value ? 1 : 0);
    else if (typeof value === 'string') asm.emit(OPCODES.PUSH_STRING, pool.string(value));
    else throw new TypeError(`Unsupported AST literal for '${node.path}'`);
    asm.emit(OPCODES.STORE_STATE, pool.string(node.path));
  }
  asm.emit(OPCODES.HALT);
  return encodeProgram({ pool, instructions: asm.finish(), programNameIndex, sourceRootIndex, flags: 2 });
}


export function assembleIrProgram({ program = 'BootstrapIrProgram', ir, sourceRoot = 'bootstrap:selfhost-stage3' }) {
  if (!Array.isArray(ir) || ir.length === 0) throw new TypeError('ir must be a non-empty Sequence of IRStore nodes');
  const pool = new Pool();
  const asm = new Assembler(pool);
  const programNameIndex = pool.string(program);
  const sourceRootIndex = pool.string(sourceRoot);
  const ordered = [...ir].sort((a, b) => a.slot - b.slot);
  for (const node of ordered) {
    if (!node || node.kind !== 'IRStore' || node.op !== 'STORE_FACET') throw new TypeError('Stage-3 IR supports STORE_FACET nodes');
    let value;
    if (node.literalKind === 'Number') value = Number(node.literalText);
    else if (node.literalKind === 'Truth') value = node.literalText === 'true';
    else if (node.literalKind === 'Text') value = node.literalText;
    else throw new TypeError(`Unsupported IR literal kind '${node.literalKind}'`);
    if (typeof value === 'number') asm.emit(OPCODES.PUSH_NUMBER, pool.number(value));
    else if (typeof value === 'boolean') asm.emit(OPCODES.PUSH_BOOL, value ? 1 : 0);
    else asm.emit(OPCODES.PUSH_STRING, pool.string(value));
    asm.emit(OPCODES.STORE_STATE, pool.string(node.path));
  }
  asm.emit(OPCODES.HALT);
  return encodeProgram({ pool, instructions: asm.finish(), programNameIndex, sourceRootIndex, flags: 3 });
}

export function assembleLiteralProgram({ program = 'BootstrapLiteral', path, value, sourceRoot = 'bootstrap:selfhost-stage1' }) {
  if (!path || typeof path !== 'string') throw new TypeError('path is required');
  const pool = new Pool();
  const asm = new Assembler(pool);
  const programNameIndex = pool.string(program);
  const sourceRootIndex = pool.string(sourceRoot);
  if (typeof value === 'number') asm.emit(OPCODES.PUSH_NUMBER, pool.number(value));
  else if (typeof value === 'boolean') asm.emit(OPCODES.PUSH_BOOL, value ? 1 : 0);
  else if (typeof value === 'string') asm.emit(OPCODES.PUSH_STRING, pool.string(value));
  else throw new TypeError('literal value must be number, boolean, or string');
  asm.emit(OPCODES.STORE_STATE, pool.string(path));
  asm.emit(OPCODES.HALT);
  return encodeProgram({ pool, instructions: asm.finish(), programNameIndex, sourceRootIndex, flags: 1 });
}
