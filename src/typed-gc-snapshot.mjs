import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { tryCompileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';

export const RCL_TYPED_GC_SNAPSHOT_VERSION = '0.37.0-alpha.1';
export const RCL_TYPED_GC_SNAPSHOT_FORMAT = 'rcl.typed-gc-snapshot.v0.37';
export const RCL_TYPED_HEAP_SNAPSHOT_FORMAT = 'rcl.typed-heap-snapshot.v0.37';

export const DEFAULT_TYPED_GC_TYPE_MODULES = Object.freeze({
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

export const DEFAULT_TYPED_GC_SOURCE = `reality TypedGcSnapshotDemo {
  facet app.session : core.Session = { user: { id: "u-4", payload: "persisted" }, login: Ok("accepted") }
  facet app.login : core.LoginResult<Text, Text> = Err("denied")
  facet app.sessionRef : TypedRef = typed_ref(app.session)
  facet app.loginRef : TypedRef = typed_ref(app.login)
  facet app.sessionAgain : core.Session = typed_deref(app.sessionRef)
  facet app.payloadViaRef : Text = app.sessionAgain.user.payload
}
`;

function stableJson(value) {
  return JSON.stringify(sortJson(value));
}

function sha256Json(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function compactTypedObject(value) {
  if (!isTypedObject(value)) return null;
  const base = {
    objectId: value.__rclObjectId,
    kind: value.__rclKind,
    canonicalType: value.__rclType,
    fieldOffsets: value.__rclFieldOffsets ?? null,
    payloadOffsets: value.__rclPayloadOffsets ?? null,
  };
  if (value.__rclKind === 'Record') {
    base.fields = Object.fromEntries(Object.entries(value.__rclFieldOffsets ?? {}).sort(([, a], [, b]) => a - b).map(([field]) => [field, cloneJson(value[field])]));
  } else {
    base.variant = value.variant;
    base.payload = cloneJson(value.payload ?? []);
  }
  return base;
}

function collectTypedHeapSnapshot(nativeState, nativeTypedHeap = {}) {
  const objects = new Map();
  const references = [];
  const objectEdges = [];
  const referenceEdges = [];
  const roots = [];

  const registerReference = (value, pathLabel, parentObjectId = null, slot = null) => {
    const reference = {
      path: pathLabel,
      objectId: value.__rclRefObjectId,
      targetKind: value.__rclRefKind,
      targetType: value.__rclRefType,
      parentObjectId,
      slot,
    };
    references.push(reference);
    referenceEdges.push({
      fromPath: pathLabel,
      fromObjectId: parentObjectId,
      slot,
      toObjectId: value.__rclRefObjectId,
      targetKind: value.__rclRefKind,
      targetType: value.__rclRefType,
      resolved: false,
    });
  };

  const visit = (value, pathLabel, parentObjectId = null, slot = null) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pathLabel}[${index}]`, parentObjectId, slot == null ? index : `${slot}.${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (isTypedRef(value)) {
      registerReference(value, pathLabel, parentObjectId, slot);
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
        value: compactTypedObject(value),
        slots: [],
      };
      object.paths.push(pathLabel);
      objects.set(objectId, object);
      if (parentObjectId != null && parentObjectId !== objectId) objectEdges.push({ fromObjectId: parentObjectId, toObjectId: objectId, slot, path: pathLabel });

      if (value.__rclKind === 'Record') {
        for (const [field, offset] of Object.entries(value.__rclFieldOffsets ?? {})) {
          const child = value[field];
          const childObjectId = isTypedObject(child) ? child.__rclObjectId : null;
          const childRefObjectId = isTypedRef(child) ? child.__rclRefObjectId : null;
          object.slots.push({ slotKind: 'field', field, offset, path: `${pathLabel}.${field}`, childObjectId, childRefObjectId });
          visit(child, `${pathLabel}.${field}`, objectId, field);
        }
      } else {
        (value.payload ?? []).forEach((payload, index) => {
          const childObjectId = isTypedObject(payload) ? payload.__rclObjectId : null;
          const childRefObjectId = isTypedRef(payload) ? payload.__rclRefObjectId : null;
          object.slots.push({ slotKind: 'payload', variant: value.variant, offset: index, path: `${pathLabel}.payload[${index}]`, childObjectId, childRefObjectId });
          visit(payload, `${pathLabel}.payload[${index}]`, objectId, index);
        });
      }
      return;
    }

    for (const [key, child] of Object.entries(value)) visit(child, `${pathLabel}.${key}`, parentObjectId, key);
  };

  for (const [pathKey, value] of Object.entries(nativeState ?? {})) {
    if (isTypedObject(value)) roots.push({ rootKind: 'object', rootPath: pathKey, objectId: value.__rclObjectId, kind: value.__rclKind, canonicalType: value.__rclType });
    if (isTypedRef(value)) roots.push({ rootKind: 'reference', rootPath: pathKey, objectId: value.__rclRefObjectId, targetKind: value.__rclRefKind, targetType: value.__rclRefType });
    visit(value, pathKey);
  }

  const objectList = [...objects.values()].sort((a, b) => a.objectId - b.objectId).map(object => ({
    ...object,
    paths: [...new Set(object.paths)].sort(),
    slots: object.slots.sort((a, b) => String(a.path).localeCompare(String(b.path))),
  }));
  const objectIds = new Set(objectList.map(item => item.objectId));
  const refList = references.sort((a, b) => (a.objectId - b.objectId) || a.path.localeCompare(b.path));
  const refEdges = referenceEdges.map(edge => ({ ...edge, resolved: objectIds.has(edge.toObjectId) }))
    .sort((a, b) => (a.toObjectId - b.toObjectId) || a.fromPath.localeCompare(b.fromPath));
  const objEdges = objectEdges.sort((a, b) => (a.fromObjectId - b.fromObjectId) || (a.toObjectId - b.toObjectId) || String(a.slot).localeCompare(String(b.slot)));

  const snapshot = {
    format: RCL_TYPED_HEAP_SNAPSHOT_FORMAT,
    version: RCL_TYPED_GC_SNAPSHOT_VERSION,
    nativeTypedHeap,
    registeredObjectCount: nativeTypedHeap?.registered ?? objectList.length,
    listedObjectCount: objectList.length,
    unlistedRegisteredObjectCount: Math.max(0, Number(nativeTypedHeap?.registered ?? objectList.length) - objectList.length),
    nextObjectId: nativeTypedHeap?.nextObjectId ?? null,
    roots: roots.sort((a, b) => a.rootPath.localeCompare(b.rootPath)),
    objects: objectList,
    references: refList,
    objectEdges: objEdges,
    referenceEdges: refEdges,
    state: cloneJson(nativeState ?? {}),
  };
  snapshot.snapshotRoot = sha256Json({
    format: snapshot.format,
    version: snapshot.version,
    roots: snapshot.roots,
    objects: snapshot.objects,
    references: snapshot.references,
    objectEdges: snapshot.objectEdges,
    referenceEdges: snapshot.referenceEdges,
    state: snapshot.state,
  });
  return snapshot;
}

function computeMarkSweepPlan(snapshot) {
  const objectIds = new Set(snapshot.objects.map(item => item.objectId));
  const objectEdgesBySource = new Map();
  const refEdgesBySourceObject = new Map();
  for (const edge of snapshot.objectEdges) {
    if (!objectEdgesBySource.has(edge.fromObjectId)) objectEdgesBySource.set(edge.fromObjectId, []);
    objectEdgesBySource.get(edge.fromObjectId).push(edge.toObjectId);
  }
  for (const edge of snapshot.referenceEdges) {
    if (edge.fromObjectId == null) continue;
    if (!refEdgesBySourceObject.has(edge.fromObjectId)) refEdgesBySourceObject.set(edge.fromObjectId, []);
    refEdgesBySourceObject.get(edge.fromObjectId).push(edge.toObjectId);
  }

  const marked = new Set();
  const mark = objectId => {
    if (!objectIds.has(objectId) || marked.has(objectId)) return;
    marked.add(objectId);
    for (const next of objectEdgesBySource.get(objectId) ?? []) mark(next);
    for (const next of refEdgesBySourceObject.get(objectId) ?? []) mark(next);
  };

  for (const root of snapshot.roots) mark(root.objectId);

  const registeredObjectIds = [...objectIds].sort((a, b) => a - b);
  const markedObjectIds = [...marked].sort((a, b) => a - b);
  const reclaimableObjectIds = registeredObjectIds.filter(id => !marked.has(id));
  const unlistedRegisteredObjectCount = snapshot.unlistedRegisteredObjectCount ?? 0;
  const plan = {
    kind: 'TypedHeapMarkSweepSeed',
    sweepMode: 'plan-only-seed',
    rootCount: snapshot.roots.length,
    registeredObjectCount: snapshot.registeredObjectCount,
    listedObjectCount: snapshot.listedObjectCount,
    unlistedRegisteredObjectCount,
    markedObjectIds,
    retainedObjectIds: markedObjectIds,
    reclaimableObjectIds,
    retainedCount: markedObjectIds.length,
    reclaimableCount: reclaimableObjectIds.length,
    sweepCandidateCount: reclaimableObjectIds.length + unlistedRegisteredObjectCount,
    unresolvedReferenceEdges: snapshot.referenceEdges.filter(edge => !edge.resolved),
  };
  plan.planRoot = sha256Json(plan);
  return plan;
}

function buildPersistenceReport(snapshot) {
  const objectIds = new Set(snapshot.objects.map(item => item.objectId));
  const persistentReferenceTable = snapshot.references.map(ref => ({
    path: ref.path,
    objectId: ref.objectId,
    targetType: ref.targetType,
    targetKind: ref.targetKind,
    resolved: objectIds.has(ref.objectId),
  }));
  const stateRoot = sha256Json(snapshot.state);
  const objectTableRoot = sha256Json(snapshot.objects.map(item => ({ objectId: item.objectId, kind: item.kind, canonicalType: item.canonicalType, value: item.value })));
  const referenceTableRoot = sha256Json(persistentReferenceTable);
  return {
    kind: 'TypedObjectReferencePersistence',
    stateRoot,
    objectTableRoot,
    referenceTableRoot,
    persistentReferenceTable,
    restoredStateRoot: stateRoot,
    restoredObjectCount: snapshot.objects.length,
    restoredReferenceCount: snapshot.references.length,
    allReferencesResolved: persistentReferenceTable.every(item => item.resolved),
  };
}

function pickGcInstructions(decoded) {
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

export function buildTypedGcSnapshotReport({ program, typeModuleReport, decoded, native }) {
  const heapSnapshot = collectTypedHeapSnapshot(native.state, native.typedHeap ?? {});
  const markSweep = computeMarkSweepPlan(heapSnapshot);
  const persistence = buildPersistenceReport(heapSnapshot);
  const report = {
    format: RCL_TYPED_GC_SNAPSHOT_FORMAT,
    version: RCL_TYPED_GC_SNAPSHOT_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    typeModuleRoot: typeModuleReport?.irRoot ?? null,
    nativeVm: native.vm ?? null,
    nativeTypedHeap: native.typedHeap ?? null,
    objectCount: heapSnapshot.objects.length,
    referenceCount: heapSnapshot.references.length,
    rootCount: heapSnapshot.roots.length,
    heapSnapshot,
    markSweep,
    persistence,
    gcInstructions: pickGcInstructions(decoded),
  };
  report.gcSnapshotRoot = sha256Json({
    programRoot: report.programRoot,
    typeModuleRoot: report.typeModuleRoot,
    heapSnapshot: report.heapSnapshot,
    markSweep: report.markSweep,
    persistence: report.persistence,
    gcInstructions: report.gcInstructions,
  });
  return report;
}

export function verifyTypedHeapSnapshot(snapshot) {
  const objectIds = new Set((snapshot.objects ?? []).map(item => item.objectId));
  const duplicateObjectIds = (snapshot.objects ?? [])
    .map(item => item.objectId)
    .filter((id, index, list) => list.indexOf(id) !== index);
  const unresolvedReferenceEdges = (snapshot.referenceEdges ?? []).filter(edge => !objectIds.has(edge.toObjectId));
  const recomputedRoot = sha256Json({
    format: snapshot.format,
    version: snapshot.version,
    roots: snapshot.roots ?? [],
    objects: snapshot.objects ?? [],
    references: snapshot.references ?? [],
    objectEdges: snapshot.objectEdges ?? [],
    referenceEdges: snapshot.referenceEdges ?? [],
    state: snapshot.state ?? {},
  });
  return {
    ok: duplicateObjectIds.length === 0 && unresolvedReferenceEdges.length === 0 && (!snapshot.snapshotRoot || snapshot.snapshotRoot === recomputedRoot),
    format: snapshot.format,
    version: snapshot.version,
    snapshotRoot: snapshot.snapshotRoot ?? null,
    recomputedRoot,
    objectCount: (snapshot.objects ?? []).length,
    referenceCount: (snapshot.references ?? []).length,
    duplicateObjectIds: [...new Set(duplicateObjectIds)],
    unresolvedReferenceEdges,
  };
}

export function loadTypedHeapSnapshot(snapshotPath) {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  return { snapshot, verification: verifyTypedHeapSnapshot(snapshot), markSweep: computeMarkSweepPlan(snapshot), persistence: buildPersistenceReport(snapshot) };
}

export function compileTypedGcSnapshot(source = DEFAULT_TYPED_GC_SOURCE, options = {}) {
  const typeModuleSources = options.typeModuleSources ?? DEFAULT_TYPED_GC_TYPE_MODULES;
  const compiled = tryCompileReality(source, { typeModuleSources });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics, program: null, report: null };
  const bytecode = compileRealityToBytecode(compiled.program);
  const decoded = decodeBytecode(bytecode);
  const native = runNativeBytecode(bytecode, options.nativeRuntime ?? {});
  const report = buildTypedGcSnapshotReport({
    program: compiled.program,
    typeModuleReport: compiled.typeModuleReport,
    decoded,
    native,
  });
  return { ok: true, diagnostics: [], program: compiled.program, typeModuleReport: compiled.typeModuleReport, bytecode, decoded, native, report };
}

export function runTypedGcSnapshotDemo(options = {}) {
  const result = compileTypedGcSnapshot(options.source ?? DEFAULT_TYPED_GC_SOURCE, {
    typeModuleSources: options.typeModuleSources ?? DEFAULT_TYPED_GC_TYPE_MODULES,
    nativeRuntime: options.nativeRuntime ?? {},
  });
  if (!result.ok) return { ok: false, version: RCL_TYPED_GC_SNAPSHOT_VERSION, diagnostics: result.diagnostics };
  return {
    ok: true,
    version: RCL_TYPED_GC_SNAPSHOT_VERSION,
    program: result.program.name,
    programRoot: result.program.programRoot,
    typeModuleRoot: result.typeModuleReport.irRoot,
    gcSnapshotRoot: result.report.gcSnapshotRoot,
    snapshotRoot: result.report.heapSnapshot.snapshotRoot,
    objectCount: result.report.objectCount,
    referenceCount: result.report.referenceCount,
    retainedCount: result.report.markSweep.retainedCount,
    reclaimableCount: result.report.markSweep.reclaimableCount,
    sweepCandidateCount: result.report.markSweep.sweepCandidateCount,
    allReferencesResolved: result.report.persistence.allReferencesResolved,
    boundary: 'P3 final typed GC seed: native typed heap state can be persisted as a snapshot, verified, marked and converted into a deterministic sweep plan.',
  };
}

export function compileTypedGcSnapshotFromFiles(sourcePath, typePath, options = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const typeModuleSources = readTypeSources(typePath);
  const result = compileTypedGcSnapshot(source, { typeModuleSources });
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-gc-snapshot-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const bytecodePath = path.join(outputDir, `${path.basename(sourcePath, path.extname(sourcePath))}.rbc`);
  const reportPath = path.join(outputDir, 'typed-gc-snapshot-report.json');
  const snapshotPath = path.join(outputDir, 'typed-heap-snapshot.json');
  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  fs.writeFileSync(snapshotPath, `${JSON.stringify(result.report.heapSnapshot, null, 2)}\n`);
  const loaded = loadTypedHeapSnapshot(snapshotPath);
  return {
    ok: true,
    bytecodePath,
    reportPath,
    snapshotPath,
    byteLength: result.bytecode.length,
    programRoot: result.program.programRoot,
    gcSnapshotRoot: result.report.gcSnapshotRoot,
    snapshotRoot: result.report.heapSnapshot.snapshotRoot,
    objectCount: result.report.objectCount,
    referenceCount: result.report.referenceCount,
    retainedCount: result.report.markSweep.retainedCount,
    reclaimableCount: result.report.markSweep.reclaimableCount,
    sweepCandidateCount: result.report.markSweep.sweepCandidateCount,
    loadedSnapshotOk: loaded.verification.ok,
    restoredStateRoot: loaded.persistence.restoredStateRoot,
    report: result.report,
  };
}
