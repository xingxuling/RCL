import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';

export const RCL_TYPED_BYTECODE_LAYOUT_VERSION = '0.33.0-alpha.1';
export const RCL_TYPED_BYTECODE_LAYOUT_FORMAT = 'rcl.typed-bytecode-layout.v0.33';

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeValueRef(item) {
  if (!item) return { expressionKind: 'Unknown' };
  const expr = item.value ?? item.expression ?? item;
  return {
    expressionKind: expr?.kind ?? 'Unknown',
    canonicalType: item.canonicalType ?? null,
    literalType: expr?.valueType ?? null,
  };
}

export function buildTypedObjectLayout(program, decodedBytecode = null) {
  const layouts = [];
  const typedFacets = [];
  for (const facet of program.facets ?? []) {
    const expr = facet.value;
    if (expr?.kind === 'RecordConstructExpr') {
      const layout = {
        kind: 'RecordLayout',
        facet: facet.path,
        declaredType: facet.declaredType ?? null,
        canonicalType: expr.canonicalType,
        typeName: expr.typeName,
        objectHeader: ['kindTag', 'canonicalType', 'fieldCount'],
        fieldSlots: expr.fields.map((field, index) => ({
          slot: index,
          name: field.name,
          canonicalType: field.canonicalType ?? null,
          value: normalizeValueRef(field),
        })),
        nativeJsonShape: {
          __rclKind: 'Record',
          __rclType: expr.canonicalType,
          fields: expr.fields.map(field => field.name),
        },
      };
      layout.layoutRoot = sha256Json(layout);
      layouts.push(layout);
      typedFacets.push({ path: facet.path, canonicalType: expr.canonicalType, layoutRoot: layout.layoutRoot });
    }
    if (expr?.kind === 'UnionConstructExpr') {
      const layout = {
        kind: 'UnionLayout',
        facet: facet.path,
        declaredType: facet.declaredType ?? null,
        canonicalType: expr.canonicalType,
        typeName: expr.typeName,
        variant: expr.variant,
        objectHeader: ['kindTag', 'canonicalType', 'variant', 'payloadCount'],
        payloadSlots: expr.payload.map((payload, index) => ({
          slot: index,
          canonicalType: payload.canonicalType ?? null,
          value: normalizeValueRef(payload),
        })),
        nativeJsonShape: {
          __rclKind: 'Union',
          __rclType: expr.canonicalType,
          variant: expr.variant,
          payload: expr.payload.map((_, index) => index),
        },
      };
      layout.layoutRoot = sha256Json(layout);
      layouts.push(layout);
      typedFacets.push({ path: facet.path, canonicalType: expr.canonicalType, layoutRoot: layout.layoutRoot });
    }
  }
  const typedInstructions = (decodedBytecode?.instructions ?? [])
    .filter(instruction => instruction.op === OPCODES.MAKE_TYPED_RECORD || instruction.op === OPCODES.MAKE_TYPED_UNION)
    .map(instruction => ({
      index: instruction.index,
      opcode: instruction.name,
      canonicalType: decodedBytecode.strings[instruction.a],
      auxiliary: decodedBytecode.strings[instruction.b],
      arity: instruction.c,
    }));
  const report = {
    format: RCL_TYPED_BYTECODE_LAYOUT_FORMAT,
    version: RCL_TYPED_BYTECODE_LAYOUT_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    typedFacetCount: typedFacets.length,
    typedInstructionCount: typedInstructions.length,
    typedFacets,
    layouts,
    typedInstructions,
  };
  report.layoutRoot = sha256Json({ layouts: report.layouts, typedInstructions: report.typedInstructions, programRoot: report.programRoot });
  return report;
}

export function compileTypedRealityToBytecodeLayout(source, options = {}) {
  const program = compileReality(source, options);
  const bytecode = compileRealityToBytecode(program);
  const decoded = decodeBytecode(bytecode);
  const layout = buildTypedObjectLayout(program, decoded);
  return { ok: true, program, bytecode, decoded, layout };
}

export function runTypedBytecodeLayoutDemo(options = {}) {
  const typeModuleSources = options.typeModuleSources ?? {
    'core.rcltype': `module core\nexport record User<T> {\n  id: Text\n  payload: T\n}\nexport union LoginResult<T,E> {\n  Ok(T)\n  Err(E)\n}\n`,
  };
  const source = options.source ?? `reality TypedBytecodeDemo {\n  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }\n  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")\n}\n`;
  const result = compileTypedRealityToBytecodeLayout(source, { typeModuleSources });
  const native = runNativeBytecode(result.bytecode, options.nativeRuntime ?? {});
  return {
    ok: true,
    version: RCL_TYPED_BYTECODE_LAYOUT_VERSION,
    program: result.program.name,
    programRoot: result.program.programRoot,
    byteLength: result.bytecode.length,
    instructionCount: result.decoded.instructions.length,
    typedInstructionCount: result.layout.typedInstructionCount,
    layoutRoot: result.layout.layoutRoot,
    typedInstructions: result.layout.typedInstructions,
    layouts: result.layout.layouts,
    nativeState: native.state,
  };
}

export function compileTypedBytecodeFromFiles(sourcePath, typePath, options = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  let typeModuleSources;
  if (fs.statSync(typePath).isDirectory()) typeModuleSources = readTypedModuleSourcesFromDir(typePath);
  else typeModuleSources = { [path.basename(typePath)]: fs.readFileSync(typePath, 'utf8') };
  const result = compileTypedRealityToBytecodeLayout(source, { typeModuleSources });
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-bytecode-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const bytecodePath = path.join(outputDir, `${path.basename(sourcePath, path.extname(sourcePath))}.rbc`);
  const layoutPath = path.join(outputDir, 'typed-object-layout.json');
  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(layoutPath, `${JSON.stringify(result.layout, null, 2)}\n`);
  return {
    ok: true,
    bytecodePath,
    layoutPath,
    byteLength: result.bytecode.length,
    programRoot: result.program.programRoot,
    layoutRoot: result.layout.layoutRoot,
    typedInstructionCount: result.layout.typedInstructionCount,
    layout: result.layout,
  };
}
