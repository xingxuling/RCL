import { compileReality } from './compiler.mjs';
import { RCLCompileError } from './errors.mjs';

export const RCL_BYTECODE_VERSION = Object.freeze({ major: 1, minor: 1 });
export const RCL_BYTECODE_FEATURE_VERSION = Object.freeze({ major: 1, minor: 2 });
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
    ['metaDomains', 'meta-computational'], ['physicals', 'physical'], ['perceptions', 'perception'],
    ['neurals', 'neural'], ['livings', 'living'], ['genetics', 'genetic'],
    ['quantitatives', 'quantitative'], ['knowledges', 'knowledge'], ['naturalLanguages', 'natural-language'],
    ['understandings', 'understanding'], ['creations', 'creation'], ['spacetimes', 'spacetime'],
    ['accelerations', 'acceleration'], ['compressions', 'compression'], ['energies', 'energy'],
    ['elements', 'element'], ['sciences', 'science'], ['embodiments', 'embodiment'], ['spirits', 'spirit'],
  ];
  for (const [field, name] of unsupportedDomains) {
    if ((program[field]?.length ?? 0) > 0) diagnostics.push(diagnostic(
      'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED',
      `Native VM v0.1 does not yet execute the '${name}' provider domain directly`,
      { field, count: program[field].length },
    ));
  }

  for (const facet of program.facets) {
    if (facet.deferred || !facet.value) {
      diagnostics.push(diagnostic('RCL_NATIVE_FACET_UNSUPPORTED', `Native VM v0.2 requires an executable facet initializer`, { path: facet.path, valueType: facet.valueType }));
    }
  }

  for (const warrant of program.warrants) {
    if (warrant.condition) diagnostics.push(diagnostic('RCL_NATIVE_CONDITIONAL_WARRANT', 'Native VM v0.1 does not yet support conditional warrants', { subject: warrant.subject, capability: warrant.capability }));
  }

  for (const rule of program.rules) {
    if (rule.calls?.length) diagnostics.push(diagnostic('RCL_NATIVE_HOST_CALL', 'Native VM v0.1 does not yet execute host calls', { rule: rule.name }));
  }

  const allowedDirectives = new Set(['Foresee', 'Realize']);
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
  if (expr.name === 'choose') {
    if (expr.args.length !== 3) throw new Error('choose() requires three arguments');
    const elseLabel = `choose_else_${asm.instructions.length}`;
    const endLabel = `choose_end_${asm.instructions.length}`;
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

function encodeProgram({ pool, instructions, programNameIndex, sourceRootIndex, flags = 0 }) {
  const headerSize = 36;
  const stringBytes = pool.strings.map(text => Buffer.from(text, 'utf8'));
  const stringsSize = stringBytes.reduce((sum, bytes) => sum + 4 + bytes.length, 0);
  const numbersSize = pool.numbers.length * 8;
  const instructionSize = 16;
  const minorVersion = instructions.some(instruction => (
    instruction.op === OPCODES.MOD
    || (instruction.op === OPCODES.CALL_PROVIDER && (instruction.flags & 1) === 1)
  )) ? RCL_BYTECODE_FEATURE_VERSION.minor : RCL_BYTECODE_VERSION.minor;
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
    compileExpression(facet.value, asm, pool, mainContext);
    asm.emit(OPCODES.STORE_STATE, pool.string(facet.path));
  }
  for (const warrant of program.warrants) {
    asm.emit(OPCODES.GRANT_WARRANT, pool.string(warrant.subject), pool.string(warrant.capability), pool.string(warrant.target));
  }

  const rules = new Map(program.rules.map(rule => [rule.name, rule]));
  program.directives.forEach((directive, index) => {
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
