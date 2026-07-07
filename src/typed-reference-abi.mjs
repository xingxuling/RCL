import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { tryCompileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';

export const RCL_TYPED_REFERENCE_ABI_VERSION = '0.36.0-alpha.1';
export const RCL_TYPED_REFERENCE_ABI_FORMAT = 'rcl.typed-reference-abi.v0.36';

export const DEFAULT_TYPED_REFERENCE_TYPE_MODULES = Object.freeze({
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

export const DEFAULT_TYPED_REFERENCE_SOURCE = `reality TypedReferenceAbiDemo {
  facet app.session : core.Session = { user: { id: "u-3", payload: "referenced" }, login: Ok("accepted") }
  facet app.login : core.LoginResult<Text, Text> = Err("denied")
  facet app.sessionRef : TypedRef = typed_ref(app.session)
  facet app.loginRef : TypedRef = typed_ref(app.login)
  facet app.sessionRefId : Number = typed_ref_id(app.sessionRef)
  facet app.sessionAgain : core.Session = typed_deref(app.sessionRef)
  facet app.payloadViaRef : Text = app.sessionAgain.user.payload
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

function isTypedRef(value) {
  return value && typeof value === 'object' && value.__rclKind === 'Ref' && typeof value.__rclRefObjectId === 'number';
}

function collectTypedObjectsAndReferences(nativeState) {
  const objects = new Map();
  const references = [];
  const objectEdges = [];
  const rootObjects = [];
  const rootReferences = [];

  const visit = (value, pathLabel, parent = null, slot = null) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pathLabel}[${index}]`, parent, slot == null ? index : `${slot}.${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (isTypedRef(value)) {
      const ref = {
        path: pathLabel,
        objectId: value.__rclRefObjectId,
        targetType: value.__rclRefType,
        targetKind: value.__rclRefKind,
        parentObjectId: parent?.objectId ?? null,
        slot,
      };
      references.push(ref);
      return;
    }

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
      if (parent) objectEdges.push({ fromObjectId: parent.objectId, toObjectId: objectId, slot, path: pathLabel });

      if (value.__rclKind === 'Record') {
        for (const [field, offset] of Object.entries(value.__rclFieldOffsets ?? {})) {
          const child = value[field];
          const traceSlot = { slotKind: 'field', field, offset, path: `${pathLabel}.${field}`, childObjectId: isTypedObject(child) ? child.__rclObjectId : null, childRefObjectId: isTypedRef(child) ? child.__rclRefObjectId : null };
          object.traceSlots.push(traceSlot);
          visit(child, traceSlot.path, object, field);
        }
      } else if (value.__rclKind === 'Union') {
        (value.payload ?? []).forEach((payload, index) => {
          const traceSlot = { slotKind: 'payload', variant: value.variant, offset: index, path: `${pathLabel}.payload[${index}]`, childObjectId: isTypedObject(payload) ? payload.__rclObjectId : null, childRefObjectId: isTypedRef(payload) ? payload.__rclRefObjectId : null };
          object.traceSlots.push(traceSlot);
          visit(payload, traceSlot.path, object, index);
        });
      }
      return;
    }

    for (const [key, child] of Object.entries(value)) visit(child, `${pathLabel}.${key}`, parent, key);
  };

  for (const [pathKey, value] of Object.entries(nativeState ?? {})) {
    if (isTypedObject(value)) rootObjects.push({ rootPath: pathKey, objectId: value.__rclObjectId, kind: value.__rclKind, canonicalType: value.__rclType });
    if (isTypedRef(value)) rootReferences.push({ rootPath: pathKey, objectId: value.__rclRefObjectId, targetKind: value.__rclRefKind, targetType: value.__rclRefType });
    visit(value, pathKey);
  }

  const objectList = [...objects.values()].sort((a, b) => a.objectId - b.objectId).map(object => ({
    ...object,
    paths: [...new Set(object.paths)].sort(),
    traceSlots: object.traceSlots.sort((a, b) => String(a.path).localeCompare(String(b.path))),
  }));
  const objectIds = new Set(objectList.map(item => item.objectId));
  const referenceList = references
    .map(ref => ({ ...ref, resolved: objectIds.has(ref.objectId) }))
    .sort((a, b) => (a.objectId - b.objectId) || a.path.localeCompare(b.path));

  return {
    rootObjects: rootObjects.sort((a, b) => a.rootPath.localeCompare(b.rootPath)),
    rootReferences: rootReferences.sort((a, b) => a.rootPath.localeCompare(b.rootPath)),
    objects: objectList,
    references: referenceList,
    objectEdges: objectEdges.sort((a, b) => (a.fromObjectId - b.fromObjectId) || (a.toObjectId - b.toObjectId) || String(a.slot).localeCompare(String(b.slot))),
    referenceEdges: referenceList.map(ref => ({ fromPath: ref.path, toObjectId: ref.objectId, resolved: ref.resolved, targetKind: ref.targetKind, targetType: ref.targetType })),
  };
}

function pickReferenceInstructions(decoded) {
  const interesting = new Set([
    OPCODES.MAKE_TYPED_RECORD,
    OPCODES.MAKE_TYPED_UNION,
    OPCODES.GET_TYPED_FIELD,
    OPCODES.IS_UNION_VARIANT,
    OPCODES.GET_UNION_PAYLOAD,
    OPCODES.MAKE_TYPED_REF,
    OPCODES.DEREF_TYPED_REF,
    OPCODES.GET_TYPED_REF_ID,
  ]);
  return (decoded.instructions ?? [])
    .filter(instruction => interesting.has(instruction.op))
    .map(instruction => ({
      index: instruction.index,
      opcode: instruction.name,
      a: instruction.op === OPCODES.GET_UNION_PAYLOAD ? instruction.a : decoded.strings[instruction.a] ?? instruction.a,
      b: decoded.strings[instruction.b] ?? instruction.b,
      c: instruction.c,
    }));
}

export function buildTypedReferenceAbiReport({ program, typeModuleReport, decoded, native }) {
  const graph = collectTypedObjectsAndReferences(native.state);
  const referenceAbi = {
    kind: 'TypedObjectReferenceABI',
    headerSlots: ['kindTag', 'refObjectId', 'targetKind', 'targetType'],
    valueKind: 'Ref',
    constructors: ['typed_ref(value)'],
    accessors: ['typed_deref(ref)', 'typed_ref_id(ref)'],
    opcodes: ['MAKE_TYPED_REF', 'DEREF_TYPED_REF', 'GET_TYPED_REF_ID'],
  };
  const gcMarkPhase = {
    kind: 'TypedHeapMarkPhaseSeed',
    nativeMarked: native.typedHeap?.marked ?? null,
    nativeRegistered: native.typedHeap?.registered ?? null,
    nativeReferences: native.typedHeap?.references ?? null,
    roots: [...graph.rootObjects.map(item => ({ rootKind: 'object', ...item })), ...graph.rootReferences.map(item => ({ rootKind: 'reference', ...item }))],
    objects: graph.objects.map(item => ({ objectId: item.objectId, kind: item.kind, canonicalType: item.canonicalType, paths: item.paths })),
    referenceEdges: graph.referenceEdges,
    objectEdges: graph.objectEdges,
  };
  const report = {
    format: RCL_TYPED_REFERENCE_ABI_FORMAT,
    version: RCL_TYPED_REFERENCE_ABI_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    typeModuleRoot: typeModuleReport?.irRoot ?? null,
    nativeVm: native.vm ?? null,
    nativeTypedHeap: native.typedHeap ?? null,
    objectCount: graph.objects.length,
    referenceCount: graph.references.length,
    rootObjectCount: graph.rootObjects.length,
    rootReferenceCount: graph.rootReferences.length,
    referenceAbi,
    typedHeapGraph: graph,
    gcMarkPhase,
    referenceInstructions: pickReferenceInstructions(decoded),
  };
  report.referenceAbiRoot = sha256Json({
    programRoot: report.programRoot,
    typeModuleRoot: report.typeModuleRoot,
    referenceAbi: report.referenceAbi,
    typedHeapGraph: report.typedHeapGraph,
    gcMarkPhase: report.gcMarkPhase,
    referenceInstructions: report.referenceInstructions,
  });
  return report;
}

export function compileTypedReferenceAbi(source = DEFAULT_TYPED_REFERENCE_SOURCE, options = {}) {
  const typeModuleSources = options.typeModuleSources ?? DEFAULT_TYPED_REFERENCE_TYPE_MODULES;
  const compiled = tryCompileReality(source, { typeModuleSources });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics, program: null, report: null };
  const bytecode = compileRealityToBytecode(compiled.program);
  const decoded = decodeBytecode(bytecode);
  const native = runNativeBytecode(bytecode, options.nativeRuntime ?? {});
  const report = buildTypedReferenceAbiReport({
    program: compiled.program,
    typeModuleReport: compiled.typeModuleReport,
    decoded,
    native,
  });
  return { ok: true, diagnostics: [], program: compiled.program, typeModuleReport: compiled.typeModuleReport, bytecode, decoded, native, report };
}

export function runTypedReferenceAbiDemo(options = {}) {
  const result = compileTypedReferenceAbi(options.source ?? DEFAULT_TYPED_REFERENCE_SOURCE, {
    typeModuleSources: options.typeModuleSources ?? DEFAULT_TYPED_REFERENCE_TYPE_MODULES,
    nativeRuntime: options.nativeRuntime ?? {},
  });
  if (!result.ok) return { ok: false, version: RCL_TYPED_REFERENCE_ABI_VERSION, diagnostics: result.diagnostics };
  return {
    ok: true,
    version: RCL_TYPED_REFERENCE_ABI_VERSION,
    program: result.program.name,
    programRoot: result.program.programRoot,
    typeModuleRoot: result.typeModuleReport.irRoot,
    referenceAbiRoot: result.report.referenceAbiRoot,
    nativeTypedHeap: result.report.nativeTypedHeap,
    objectCount: result.report.objectCount,
    referenceCount: result.report.referenceCount,
    rootReferenceCount: result.report.rootReferenceCount,
    marked: result.report.gcMarkPhase.nativeMarked,
    referenceEdges: result.report.typedHeapGraph.referenceEdges,
    boundary: 'P3 typed reference ABI seed: typed objects can be referenced, dereferenced and marked from state roots through native VM object reference opcodes.',
  };
}

export function compileTypedReferenceAbiFromFiles(sourcePath, typePath, options = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const typeModuleSources = readTypeSources(typePath);
  const result = compileTypedReferenceAbi(source, { typeModuleSources });
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-reference-abi-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const bytecodePath = path.join(outputDir, `${path.basename(sourcePath, path.extname(sourcePath))}.rbc`);
  const reportPath = path.join(outputDir, 'typed-reference-abi-report.json');
  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  return {
    ok: true,
    bytecodePath,
    reportPath,
    byteLength: result.bytecode.length,
    programRoot: result.program.programRoot,
    referenceAbiRoot: result.report.referenceAbiRoot,
    objectCount: result.report.objectCount,
    referenceCount: result.report.referenceCount,
    rootReferenceCount: result.report.rootReferenceCount,
    marked: result.report.gcMarkPhase.nativeMarked,
    report: result.report,
  };
}
