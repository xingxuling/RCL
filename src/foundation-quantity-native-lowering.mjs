import {
  QUANTITY_TYPES,
  inferBinaryType,
  quantityConstructors,
  quantityConstructorTypes,
} from './quantity.mjs';

export const FOUNDATION_QUANTITY_NATIVE_LOWERING_FORMAT = 'taowind.rcl-foundation-quantity-native-lowering.v0.1';
export const FOUNDATION_QUANTITY_NATIVE_LOWERING_VERSION = '0.1.0';

const QUANTITY_RECORD_TYPE = 'taowind.rcl.native.Quantity.v0.1';
const QUANTITY_UNIT_BY_TYPE = new Map(
  Object.entries(quantityConstructorTypes).map(([name, type]) => [type, quantityConstructors[name](1).unit]),
);

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function literal(valueType, value) {
  return { kind: 'LiteralExpr', valueType, value };
}

function field(object, name) {
  return { kind: 'FieldAccessExpr', object, field: name };
}

function isQuantityType(type) {
  return QUANTITY_TYPES.has(type);
}

function quantityRecord(type, numericValue) {
  const unit = QUANTITY_UNIT_BY_TYPE.get(type);
  if (!unit) {
    const error = new Error(`No canonical native unit is registered for quantity type '${type}'`);
    error.code = 'RCL_FOUNDATION_QUANTITY_NATIVE_UNIT_UNKNOWN';
    throw error;
  }
  return {
    kind: 'RecordConstructExpr',
    canonicalType: QUANTITY_RECORD_TYPE,
    fields: [
      { name: 'kind', value: literal('Text', 'Quantity') },
      { name: 'type', value: literal('Text', type) },
      { name: 'value', value: numericValue },
      { name: 'unit', value: literal('Text', unit) },
    ],
  };
}

function quantityNumber(expression) {
  return field(expression, 'value');
}

function inferCallType(expr, context) {
  if (quantityConstructorTypes[expr.name]) return quantityConstructorTypes[expr.name];
  if (expr.name === 'choose' && expr.args?.length === 3) {
    const thenType = inferExpressionType(expr.args[1], context);
    const elseType = inferExpressionType(expr.args[2], context);
    return thenType === elseType ? thenType : 'Unknown';
  }
  if ((expr.name === 'min' || expr.name === 'max') && expr.args?.length) {
    const types = expr.args.map(arg => inferExpressionType(arg, context));
    return types.every(type => type === types[0]) ? types[0] : 'Unknown';
  }
  return context.reckonTypes.get(expr.name) ?? 'Unknown';
}

function inferExpressionType(expr, context) {
  if (!expr || typeof expr !== 'object') return 'Unknown';
  switch (expr.kind) {
    case 'LiteralExpr': return expr.valueType ?? 'Unknown';
    case 'PathExpr': return context.locals.get(expr.path) ?? context.facets.get(expr.path) ?? 'Unknown';
    case 'UnaryExpr': return inferExpressionType(expr.expression, context);
    case 'BinaryExpr': {
      const left = inferExpressionType(expr.left, context);
      const right = inferExpressionType(expr.right, context);
      return inferBinaryType(expr.operator, left, right) ?? 'Unknown';
    }
    case 'CallExpr': return inferCallType(expr, context);
    case 'FieldAccessExpr': return 'Unknown';
    default: return expr.valueType ?? 'Unknown';
  }
}

function rewriteBinary(expr, context) {
  const leftType = inferExpressionType(expr.left, context);
  const rightType = inferExpressionType(expr.right, context);
  const resultType = inferBinaryType(expr.operator, leftType, rightType) ?? 'Unknown';
  const left = rewriteExpression(expr.left, context);
  const right = rewriteExpression(expr.right, context);
  const leftQuantity = isQuantityType(leftType);
  const rightQuantity = isQuantityType(rightType);

  if (!leftQuantity && !rightQuantity) return { ...clone(expr), left, right };
  if (resultType === 'Unknown') {
    const error = new Error(`Cannot lower quantity binary expression '${leftType} ${expr.operator} ${rightType}' to the native Foundation subset`);
    error.code = 'RCL_FOUNDATION_QUANTITY_NATIVE_BINARY_UNSUPPORTED';
    error.details = { operator: expr.operator, leftType, rightType };
    throw error;
  }

  const leftValue = leftQuantity ? quantityNumber(left) : left;
  const rightValue = rightQuantity ? quantityNumber(right) : right;
  const numeric = { kind: 'BinaryExpr', operator: expr.operator, left: leftValue, right: rightValue };

  if (resultType === 'Truth' || resultType === 'Number') return numeric;
  if (isQuantityType(resultType)) return quantityRecord(resultType, numeric);

  const error = new Error(`Quantity binary expression produced unsupported native result type '${resultType}'`);
  error.code = 'RCL_FOUNDATION_QUANTITY_NATIVE_RESULT_UNSUPPORTED';
  error.details = { operator: expr.operator, leftType, rightType, resultType };
  throw error;
}

function rewriteCall(expr, context) {
  const quantityType = quantityConstructorTypes[expr.name];
  if (quantityType) {
    if (expr.args?.length !== 1) {
      const error = new Error(`${expr.name} requires exactly one Number argument for native quantity lowering`);
      error.code = 'RCL_FOUNDATION_QUANTITY_NATIVE_CONSTRUCTOR_ARITY';
      throw error;
    }
    const argumentType = inferExpressionType(expr.args[0], context);
    if (argumentType !== 'Number' && argumentType !== 'Unknown') {
      const error = new Error(`${expr.name} requires Number, received ${argumentType}`);
      error.code = 'RCL_FOUNDATION_QUANTITY_NATIVE_CONSTRUCTOR_TYPE';
      throw error;
    }
    return quantityRecord(quantityType, rewriteExpression(expr.args[0], context));
  }
  return { ...clone(expr), args: (expr.args ?? []).map(arg => rewriteExpression(arg, context)) };
}

function rewriteExpression(expr, context) {
  if (!expr || typeof expr !== 'object') return expr;
  switch (expr.kind) {
    case 'LiteralExpr':
    case 'PathExpr':
      return clone(expr);
    case 'UnaryExpr': {
      const operandType = inferExpressionType(expr.expression, context);
      const expression = rewriteExpression(expr.expression, context);
      if (expr.operator === '-' && isQuantityType(operandType)) {
        return quantityRecord(operandType, { kind: 'UnaryExpr', operator: '-', expression: quantityNumber(expression) });
      }
      return { ...clone(expr), expression };
    }
    case 'BinaryExpr':
      return rewriteBinary(expr, context);
    case 'CallExpr':
      return rewriteCall(expr, context);
    case 'RecordConstructExpr':
      return {
        ...clone(expr),
        fields: (expr.fields ?? []).map(item => ({
          ...clone(item),
          value: rewriteExpression(item.value ?? item.expression, context),
        })),
      };
    case 'UnionConstructExpr':
      return { ...clone(expr), payload: (expr.payload ?? []).map(item => rewriteExpression(item.value ?? item.expression ?? item, context)) };
    case 'FieldAccessExpr':
      return { ...clone(expr), object: rewriteExpression(expr.object, context) };
    case 'MatchUnionExpr':
      return {
        ...clone(expr),
        target: rewriteExpression(expr.target, context),
        cases: (expr.cases ?? []).map(item => ({ ...clone(item), expression: rewriteExpression(item.expression, context) })),
      };
    default:
      return clone(expr);
  }
}

function withLocals(context, params = []) {
  return {
    ...context,
    locals: new Map(params.map(param => [param.name, param.valueType ?? param.type ?? 'Unknown'])),
  };
}

function scanExpression(expr, context, summary) {
  if (!expr || typeof expr !== 'object') return;
  if (expr.kind === 'CallExpr' && quantityConstructorTypes[expr.name]) summary.quantityConstructorCount += 1;
  if (expr.kind === 'BinaryExpr') {
    const leftType = inferExpressionType(expr.left, context);
    const rightType = inferExpressionType(expr.right, context);
    if (isQuantityType(leftType) || isQuantityType(rightType)) summary.quantityBinaryCount += 1;
  }
  switch (expr.kind) {
    case 'UnaryExpr': scanExpression(expr.expression, context, summary); break;
    case 'BinaryExpr': scanExpression(expr.left, context, summary); scanExpression(expr.right, context, summary); break;
    case 'CallExpr': (expr.args ?? []).forEach(arg => scanExpression(arg, context, summary)); break;
    case 'RecordConstructExpr': (expr.fields ?? []).forEach(item => scanExpression(item.value ?? item.expression, context, summary)); break;
    case 'UnionConstructExpr': (expr.payload ?? []).forEach(item => scanExpression(item.value ?? item.expression ?? item, context, summary)); break;
    case 'FieldAccessExpr': scanExpression(expr.object, context, summary); break;
    case 'MatchUnionExpr':
      scanExpression(expr.target, context, summary);
      (expr.cases ?? []).forEach(item => scanExpression(item.expression, context, summary));
      break;
    default: break;
  }
}

export function lowerFoundationQuantitiesForNativeBytecode(program) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new TypeError('compiled Foundation program object is required');

  const facets = new Map((program.facets ?? []).map(item => [item.path, item.valueType ?? 'Unknown']));
  const reckons = program.reckons ?? program.functions ?? [];
  const reckonTypes = new Map(reckons.map(item => [item.name, item.returnType ?? item.valueType ?? 'Unknown']));
  const context = { facets, reckonTypes, locals: new Map() };
  const summary = {
    quantityConstructorCount: 0,
    quantityBinaryCount: 0,
    representation: 'existing-native-typed-record',
    canonicalQuantityRecordType: QUANTITY_RECORD_TYPE,
  };

  function lower(expr, localContext = context) {
    scanExpression(expr, localContext, summary);
    return rewriteExpression(expr, localContext);
  }

  const lowered = clone(program);
  lowered.facets = (program.facets ?? []).map(item => ({ ...clone(item), value: lower(item.value) }));
  lowered.reckons = (program.reckons ?? []).map(item => ({
    ...clone(item),
    expression: lower(item.expression, withLocals(context, item.params ?? [])),
  }));
  if (Array.isArray(program.functions)) {
    lowered.functions = program.functions.map(item => ({
      ...clone(item),
      expression: lower(item.expression, withLocals(context, item.params ?? [])),
    }));
  }
  lowered.rules = (program.rules ?? []).map(rule => ({
    ...clone(rule),
    when: lower(rule.when),
    alters: (rule.alters ?? []).map(change => ({ ...clone(change), expression: lower(change.expression) })),
    preserves: (rule.preserves ?? []).map(expression => lower(expression)),
    calls: (rule.calls ?? []).map(call => ({ ...clone(call), args: (call.args ?? []).map(arg => lower(arg)) })),
  }));
  lowered.warrants = (program.warrants ?? []).map(warrant => ({
    ...clone(warrant),
    condition: warrant.condition ? lower(warrant.condition) : warrant.condition,
  }));

  return {
    program: lowered,
    format: FOUNDATION_QUANTITY_NATIVE_LOWERING_FORMAT,
    version: FOUNDATION_QUANTITY_NATIVE_LOWERING_VERSION,
    summary,
    truthBoundary: {
      referenceQuantitySemanticsPreserved: true,
      nativeRepresentationUsesExistingTypedRecordOpcodes: true,
      nativeVmOpcodeExtensionRequired: false,
      nativeVmBinaryReplacementRequired: false,
      quantityMetadataRetained: true,
      unsupportedQuantitySemanticsFailClosed: true,
    },
  };
}
