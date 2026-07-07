import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { tryCompileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';

export const RCL_TYPED_HEAP_LAYOUT_VERSION = '0.35.0-alpha.1';
export const RCL_TYPED_HEAP_LAYOUT_FORMAT = 'rcl.typed-heap-layout.v0.35';

export const DEFAULT_TYPED_HEAP_TYPE_MODULES = Object.freeze({
  'core.rcltype': `module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}
export record Session {
  user: User<Text>
  login: LoginResult<Text,Text>
}
`,
});

export const DEFAULT_TYPED_HEAP_SOURCE = `reality TypedHeapLayoutDemo {
  facet app.session : core.Session = { user: { id: "u-2", payload: "nested" }, login: Ok("accepted") }
  facet app.login : core.LoginResult<Text, Text> = Err("denied")
}
`;

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function readTypeSources(typePath) {
  if (fs.statSync(typePath).isDirectory()) return readTypedModuleSourcesFromDir(typePath);
  return { [path.basename(typePath)]: fs.readFileSync(typePath, 'utf8') };
}

function isTypedObject(value) {
  return value && typeof value === 'object' && typeof value.__rclObjectId === 'number' && (value.__rclKind === 'Record' || value.__rclKind === 'Union');
}

function isTraceableStaticType(typeText) {
  const text = String(typeText ?? '');
  if (!text) return false;
  if (['Number', 'Text', 'Truth', 'Span', 'Token', 'AstNode', 'ParseState', 'Symbol', 'SemanticNode', 'IrNode', 'Sequence'].includes(text)) return false;
  return /::|<|Option|Result|Array|Map/.test(text);
}

function collectStaticLayoutTables(typeModuleReport) {
  const records = [];
  const unions = [];
  for (const module of typeModuleReport?.ir?.modules ?? []) {
    for (const decl of module.declarations ?? []) {
      if (decl.kind === 'Record') {
        const fields = (decl.fields ?? []).map((field, index) => ({
          offset: index,
          name: field.name,
          canonicalType: field.canonicalType,
          traceable: isTraceableStaticType(field.canonicalType),
        }));
        const table = {
          kind: 'RecordFieldOffsetTable',
          module: module.name,
          type: decl.qualifiedName,
          typeParams: decl.typeParams ?? [],
          headerSlots: ['kindTag', 'objectId', 'canonicalType', 'fieldCount'],
          fields,
        };
        table.tableRoot = sha256Json(table);
        records.push(table);
      }
      if (decl.kind === 'Union') {
        const variants = (decl.variants ?? []).map((variant, variantOffset) => ({
          variantOffset,
          name: variant.name,
          payload: (variant.payload ?? []).map((payload, index) => ({
            offset: index,
            canonicalType: payload.canonicalType,
            traceable: isTraceableStaticType(payload.canonicalType),
          })),
        }));
        const table = {
          kind: 'UnionVariantOffsetTable',
          module: module.name,
          type: decl.qualifiedName,
          typeParams: decl.typeParams ?? [],
          headerSlots: ['kindTag', 'objectId', 'canonicalType', 'variantTag', 'payloadCount'],
          variants,
        };
        table.tableRoot = sha256Json(table);
        unions.push(table);
      }
    }
  }
  return { records, unions };
}

function collectTypedHeapObjects(nativeState) {
  const objects = new Map();
  const edges = [];
  const roots = [];

  const visit = (value, pathLabel, parent = null, slot = null) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pathLabel}[${index}]`, parent, slot == null ? index : `${slot}.${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (isTypedObject(value)) {
      const objectId = value.__rclObjectId;
      const object = objects.get(objectId) ?? {
        objectId,
        kind: value.__rclKind,
        canonicalType: value.__rclType,
        firstPath: pathLabel,
        paths: [],
        fieldOffsets: value.__rclFieldOffsets ?? null,
        payloadOffsets: value.__rclPayloadOffsets ?? null,
        traceSlots: [],
      };
      object.paths.push(pathLabel);
      objects.set(objectId, object);
      if (parent) edges.push({ fromObjectId: parent.objectId, toObjectId: objectId, slot, path: pathLabel });

      if (value.__rclKind === 'Record') {
        for (const [field, offset] of Object.entries(value.__rclFieldOffsets ?? {})) {
          const child = value[field];
          const traceSlot = { slotKind: 'field', field, offset, path: `${pathLabel}.${field}`, childObjectId: isTypedObject(child) ? child.__rclObjectId : null };
          object.traceSlots.push(traceSlot);
          visit(child, traceSlot.path, object, field);
        }
      } else if (value.__rclKind === 'Union') {
        (value.payload ?? []).forEach((payload, index) => {
          const traceSlot = { slotKind: 'payload', variant: value.variant, offset: index, path: `${pathLabel}.payload[${index}]`, childObjectId: isTypedObject(payload) ? payload.__rclObjectId : null };
          object.traceSlots.push(traceSlot);
          visit(payload, traceSlot.path, object, index);
        });
      }
      return;
    }

    for (const [key, child] of Object.entries(value)) visit(child, `${pathLabel}.${key}`, parent, key);
  };

  for (const [pathKey, value] of Object.entries(nativeState ?? {})) {
    if (isTypedObject(value)) roots.push({ rootPath: pathKey, objectId: value.__rclObjectId, kind: value.__rclKind, canonicalType: value.__rclType });
    visit(value, pathKey);
  }

  return {
    roots,
    objects: [...objects.values()].sort((a, b) => a.objectId - b.objectId).map(object => ({
      ...object,
      paths: [...new Set(object.paths)].sort(),
      traceSlots: object.traceSlots.sort((a, b) => String(a.path).localeCompare(String(b.path))),
    })),
    edges: edges.sort((a, b) => (a.fromObjectId - b.fromObjectId) || (a.toObjectId - b.toObjectId) || String(a.slot).localeCompare(String(b.slot))),
  };
}

function pickHeapInstructions(decoded) {
  const interesting = new Set([OPCODES.MAKE_TYPED_RECORD, OPCODES.MAKE_TYPED_UNION, OPCODES.GET_TYPED_FIELD, OPCODES.IS_UNION_VARIANT, OPCODES.GET_UNION_PAYLOAD]);
  return (decoded.instructions ?? [])
    .filter(instruction => interesting.has(instruction.op))
    .map(instruction => ({
      index: instruction.index,
      opcode: instruction.name,
      a: instruction.op === OPCODES.GET_UNION_PAYLOAD ? instruction.a : decoded.strings[instruction.a],
      b: decoded.strings[instruction.b] ?? instruction.b,
      c: instruction.c,
    }));
}

export function buildTypedHeapLayoutReport({ program, typeModuleReport, decoded, native }) {
  const staticTables = collectStaticLayoutTables(typeModuleReport);
  const heapObjects = collectTypedHeapObjects(native.state);
  const report = {
    format: RCL_TYPED_HEAP_LAYOUT_FORMAT,
    version: RCL_TYPED_HEAP_LAYOUT_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    typeModuleRoot: typeModuleReport?.irRoot ?? null,
    nativeVm: native.vm ?? null,
    nativeTypedHeap: native.typedHeap ?? null,
    objectIdentityCount: heapObjects.objects.length,
    rootCount: heapObjects.roots.length,
    edgeCount: heapObjects.edges.length,
    stableFieldOffsetTables: staticTables.records,
    stableUnionOffsetTables: staticTables.unions,
    gcTraceTable: heapObjects,
    heapInstructions: pickHeapInstructions(decoded),
  };
  report.heapLayoutRoot = sha256Json({
    programRoot: report.programRoot,
    typeModuleRoot: report.typeModuleRoot,
    stableFieldOffsetTables: report.stableFieldOffsetTables,
    stableUnionOffsetTables: report.stableUnionOffsetTables,
    gcTraceTable: report.gcTraceTable,
    heapInstructions: report.heapInstructions,
  });
  return report;
}

export function compileTypedHeapLayout(source = DEFAULT_TYPED_HEAP_SOURCE, options = {}) {
  const typeModuleSources = options.typeModuleSources ?? DEFAULT_TYPED_HEAP_TYPE_MODULES;
  const compiled = tryCompileReality(source, { typeModuleSources });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics, program: null, report: null };
  const bytecode = compileRealityToBytecode(compiled.program);
  const decoded = decodeBytecode(bytecode);
  const native = runNativeBytecode(bytecode, options.nativeRuntime ?? {});
  const report = buildTypedHeapLayoutReport({
    program: compiled.program,
    typeModuleReport: compiled.typeModuleReport,
    decoded,
    native,
  });
  return { ok: true, diagnostics: [], program: compiled.program, typeModuleReport: compiled.typeModuleReport, bytecode, decoded, native, report };
}

export function runTypedHeapLayoutDemo(options = {}) {
  const result = compileTypedHeapLayout(options.source ?? DEFAULT_TYPED_HEAP_SOURCE, {
    typeModuleSources: options.typeModuleSources ?? DEFAULT_TYPED_HEAP_TYPE_MODULES,
    nativeRuntime: options.nativeRuntime ?? {},
  });
  if (!result.ok) return { ok: false, version: RCL_TYPED_HEAP_LAYOUT_VERSION, diagnostics: result.diagnostics };
  return {
    ok: true,
    version: RCL_TYPED_HEAP_LAYOUT_VERSION,
    program: result.program.name,
    programRoot: result.program.programRoot,
    typeModuleRoot: result.typeModuleReport.irRoot,
    heapLayoutRoot: result.report.heapLayoutRoot,
    nativeTypedHeap: result.report.nativeTypedHeap,
    objectIdentityCount: result.report.objectIdentityCount,
    rootCount: result.report.rootCount,
    edgeCount: result.report.edgeCount,
    stableRecordTableCount: result.report.stableFieldOffsetTables.length,
    stableUnionTableCount: result.report.stableUnionOffsetTables.length,
    gcTraceTable: result.report.gcTraceTable,
    boundary: 'P3 typed heap seed: native typed objects now carry object identity; layout reports expose stable field offsets and GC trace roots/edges.',
  };
}

export function compileTypedHeapLayoutFromFiles(sourcePath, typePath, options = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const typeModuleSources = readTypeSources(typePath);
  const result = compileTypedHeapLayout(source, { typeModuleSources });
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-heap-layout-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const bytecodePath = path.join(outputDir, `${path.basename(sourcePath, path.extname(sourcePath))}.rbc`);
  const reportPath = path.join(outputDir, 'typed-heap-layout-report.json');
  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  return {
    ok: true,
    bytecodePath,
    reportPath,
    byteLength: result.bytecode.length,
    programRoot: result.program.programRoot,
    heapLayoutRoot: result.report.heapLayoutRoot,
    objectIdentityCount: result.report.objectIdentityCount,
    rootCount: result.report.rootCount,
    edgeCount: result.report.edgeCount,
    report: result.report,
  };
}
