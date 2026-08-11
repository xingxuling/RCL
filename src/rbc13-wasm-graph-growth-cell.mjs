import { realityRoot } from './canonical.mjs';
import {
  RBC13_WASM_GRAPH_CASES,
  RBC13_WASM_ORGAN_ABI_FORMAT,
  RBC13_WASM_ORGAN_EVIDENCE_TIER,
  RBC13_WASM_ORGAN_OPERATION_KEY,
  buildRbc13NativeCGraphOrgan,
  buildRbc13WasmGraphOrgan,
  findRbc13WasmGraphCase,
  rbc13GraphSemanticRoot,
  runRbc13GraphTraversalReference,
  wasmAbiNegativeControls,
} from './rbc13-wasm-organ-abi.mjs';

export const RBC13_WASM_GRAPH_GROWTH_CELL_FORMAT = 'rcl.rbc13-wasm-graph-traversal-growth-cell.v0.1';

function errorProjection(observation) {
  return observation?.status === 'error' ? {
    class: observation.error?.class ?? null,
    code: observation.error?.code ?? null,
    details: observation.error?.details ?? null,
  } : null;
}

function bodyObservation(observation) {
  return {
    status: observation.status,
    semanticRoot: observation.semanticRoot ?? rbc13GraphSemanticRoot(observation),
    result: observation.status === 'ok' ? observation.result : null,
    error: errorProjection(observation),
  };
}

function compareCase(caseSpec, js, native, wasm) {
  const observations = [bodyObservation(js), bodyObservation(native), bodyObservation(wasm)];
  const roots = observations.map(item => item.semanticRoot);
  const errors = observations.map(item => item.error);
  const successParity = observations.every(item => item.status === 'ok')
    && realityRoot(observations[0].result) === realityRoot(observations[1].result)
    && realityRoot(observations[0].result) === realityRoot(observations[2].result);
  const errorParity = observations.every(item => item.status === 'error')
    && JSON.stringify(errors[0]) === JSON.stringify(errors[1])
    && JSON.stringify(errors[0]) === JSON.stringify(errors[2]);
  return {
    id: caseSpec.id,
    class: caseSpec.class,
    js: observations[0],
    nativeC: observations[1],
    wasm: observations[2],
    semanticRootParity: roots.every(root => root === roots[0]),
    resultOrErrorParity: successParity || errorParity,
    statusParity: observations.every(item => item.status === observations[0].status),
  };
}

function replayRoots(caseSpecs, execute) {
  const first = caseSpecs.map(item => execute(item));
  const second = caseSpecs.map(item => execute(item));
  return {
    first: first.map(item => item.semanticRoot),
    second: second.map(item => item.semanticRoot),
    stable: first.every((item, index) => item.semanticRoot === second[index].semanticRoot),
  };
}

export function buildRbc13WasmGraphGrowthCell(options = {}) {
  let native = null;
  let wasm = null;
  let nativeError = null;
  let wasmError = null;
  try { native = buildRbc13NativeCGraphOrgan(options); } catch (error) { nativeError = { code: error.code ?? null, message: String(error.message ?? error), details: error.details ?? null }; }
  try { wasm = buildRbc13WasmGraphOrgan(options); } catch (error) { wasmError = { code: error.code ?? null, message: String(error.message ?? error), details: error.details ?? null }; }
  const rows = [];
  let referenceError = null;
  if (native && wasm) {
    try {
      for (const caseSpec of RBC13_WASM_GRAPH_CASES) {
        const js = runRbc13GraphTraversalReference(caseSpec);
        const c = native.execute(caseSpec);
        const w = wasm.execute(caseSpec);
        rows.push(compareCase(caseSpec, js, c, w));
      }
    } catch (error) {
      referenceError = { code: error.code ?? null, message: String(error.message ?? error), details: error.details ?? null };
    }
  }
  let replay = { status: 'BLOCKED', reason: 'body-not-built' };
  if (native && wasm && !referenceError) {
    const nativeReplay = replayRoots(RBC13_WASM_GRAPH_CASES, item => native.execute(item));
    const wasmReplay = replayRoots(RBC13_WASM_GRAPH_CASES, item => wasm.execute(item));
    const jsReplay = replayRoots(RBC13_WASM_GRAPH_CASES, item => ({ semanticRoot: rbc13GraphSemanticRoot(runRbc13GraphTraversalReference(item)) }));
    replay = {
      status: nativeReplay.stable && wasmReplay.stable && jsReplay.stable ? 'VERIFIED' : 'BLOCKED',
      js: jsReplay,
      nativeC: nativeReplay,
      wasm: wasmReplay,
      crossBodyFirstReplayParity: nativeReplay.first.every((root, index) => root === jsReplay.first[index] && root === wasmReplay.first[index]),
    };
  }
  const abiControls = wasm ? wasmAbiNegativeControls() : [];
  const allCasePass = rows.length === RBC13_WASM_GRAPH_CASES.length
    && rows.every(row => row.semanticRootParity && row.resultOrErrorParity && row.statusParity);
  const positiveCasePass = rows.filter(row => row.class === 'positive').every(row => row.semanticRootParity && row.resultOrErrorParity);
  const negativeCasePass = rows.filter(row => ['empty', 'invalid-node', 'malformed'].includes(row.class)).every(row => row.semanticRootParity && row.resultOrErrorParity);
  const cycleCasePass = rows.some(row => row.class === 'cycle' && row.resultOrErrorParity);
  const budgetCasePass = rows.some(row => row.class === 'budget-exhaustion' && row.resultOrErrorParity);
  const abiPass = abiControls.length === 5 && abiControls.every(item => item.detected);
  const bodyPass = Boolean(native && wasm && allCasePass && positiveCasePass && negativeCasePass && cycleCasePass && budgetCasePass && abiPass && replay.status === 'VERIFIED' && replay.crossBodyFirstReplayParity);
  const body = {
    format: RBC13_WASM_GRAPH_GROWTH_CELL_FORMAT,
    version: '0.1.0',
    status: bodyPass ? 'VERIFIED' : 'BLOCKED',
    cellId: RBC13_WASM_GRAPH_GROWTH_CELL_FORMAT,
    operationKey: RBC13_WASM_ORGAN_OPERATION_KEY,
    workload: {
      id: 'graph-traversal::bounded-reachability',
      environment: 'wasm-vm',
      programFamily: 'algorithm',
      fixedInputs: true,
      caseIds: RBC13_WASM_GRAPH_CASES.map(item => item.id),
      semantics: 'bounded breadth-first traversal with deterministic neighbor order, visited discovery order, visited set, step budget, and termination class',
    },
    nativeC: native ? { status: 'VERIFIED', hostRoot: native.hostRoot, implementationRoot: native.implementationRoot, compiler: native.compiler, compilerVersion: native.compilerVersion, evidenceTier: RBC13_WASM_ORGAN_EVIDENCE_TIER, canonicalPermission: false } : { status: 'BLOCKED', error: nativeError },
    wasm: wasm ? { status: 'VERIFIED', moduleRoot: wasm.moduleRoot, moduleBytes: wasm.moduleBytes.length, evidenceTier: RBC13_WASM_ORGAN_EVIDENCE_TIER, canonicalPermission: wasm.registration.canonicalPermission } : { status: 'BLOCKED', error: wasmError },
    reference: { status: referenceError ? 'BLOCKED' : 'VERIFIED', implementation: 'RCL JavaScript semantic reference', semanticRootAlgorithm: 'realityRoot over operation identity, evidence tier, result or projected error' },
    cases: rows,
    coverage: {
      positive: positiveCasePass,
      cycle: cycleCasePass,
      disconnected: rows.some(row => row.class === 'disconnected' && row.resultOrErrorParity),
      empty: rows.some(row => row.class === 'empty' && row.resultOrErrorParity),
      budgetExhaustion: budgetCasePass,
      invalidNode: rows.some(row => row.class === 'invalid-node' && row.resultOrErrorParity),
      malformedGraph: rows.some(row => row.class === 'malformed' && row.resultOrErrorParity),
    },
    wasmAbi: {
      format: RBC13_WASM_ORGAN_ABI_FORMAT,
      valueTags: { Null: 0, Truth: 1, Number: 2, Text: 3, Sequence: 4, Record: 5, TypedRecord: 6 },
      graphInputTypedRecord: { tag: 5, typeId: 1, headerBytes: 28, fields: ['nodeCount', 'start', 'target', 'budget', 'adjacencyMatrixBytes'] },
      graphOutputTypedRecord: { tag: 6, typeId: 2, fixedHeaderBytes: 32, visitedOrderOffset: 32 },
      memory: { initialPages: 1, byteLength: 65536, inputPointer: 1024, outputPointer: 4096, queuePointer: 5000, visitedPointer: 5500, alignment: 'u32 fields little-endian; byte matrix and flags are byte-aligned' },
      bounds: { maxNodes: 32, maxDepth: 8, invalidPointer: 'RCL_WASM_ABI_INVALID_POINTER', malformed: 'RCL_WASM_VALUE_ABI_MALFORMED', nonfinite: 'RCL_WASM_VALUE_ABI_NONFINITE', duplicateFields: 'RCL_WASM_VALUE_ABI_DUPLICATE_FIELD', unsupportedType: 'RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE' },
      negativeControls: abiControls,
      failClosed: abiPass,
    },
    hostAbi: {
      register: 'descriptor identity, implementation, artifact root, evidence tier, deterministic flag',
      load: 'validate WebAssembly.Module exports memory and invoke; no native heap pointer accepted',
      invoke: 'copy bounded tagged typed-record bytes into linear memory and invoke(ptr,len)',
      readArgs: 'host owns and bounds-checks the linear-memory input record',
      returnResult: 'read fixed output typed-record header and bounded visited order',
      structuredError: 'class/code/details projection with fail-closed ABI errors',
      evidenceReceipt: 'operation identity, semantic identity, artifact root, tier, pointers, duration, canonicalPermission=false',
      canonicalPermission: false,
      experimentalTier: true,
    },
    replay,
    universalStress: {
      status: bodyPass ? 'VERIFIED' : 'BLOCKED',
      coverageMode: 'experimental-cross-body-semantic',
      generalization: 'one bounded reusable graph workload only; no universal maturity or canonical language claim',
    },
    universalGrowthEligible: bodyPass,
    authoritativeStateMutated: false,
    canonicalAdmission: false,
    blocker: bodyPass ? null : (nativeError?.code ?? wasmError?.code ?? referenceError?.code ?? 'cross-body-parity-or-replay-failed'),
    boundary: 'C and WASM bodies are replaceable implementations of one logical Organ contract. This VERIFIED result is an experimental cross-body parity witness, not canonical permission, universal capability, or proof that organ identity is tied to C.',
    strategicQuestion: 'Organ identity is the logical contract plus semantic/evidence identity; C, WASM, or Rust bodies are replaceable only after the same ABI, semantic root, error, receipt, and replay gates pass.',
    reproductionCommand: 'npm run verify:rbc13-wasm-graph-growth-cell',
  };
  native?.close();
  wasm?.close();
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function renderRbc13WasmGraphGrowthCellMarkdown(report) {
  const rows = report.cases.map(item => `| ${item.id} | ${item.class} | ${item.js.status} | ${item.semanticRootParity} | ${item.resultOrErrorParity} | ${item.js.semanticRoot} |`).join('\n');
  return `# RBC 1.3 WASM Graph Traversal Growth Cell v0.1\n\n- Status: **${report.status}**\n- Cell: \`${report.operationKey}\`\n- Evidence root: \`${report.root}\`\n- Native C body: **${report.nativeC.status}**; WASM body: **${report.wasm.status}**; JS reference: **${report.reference.status}**\n- Evidence tier: **${RBC13_WASM_ORGAN_EVIDENCE_TIER}**; canonical permission: **${report.hostAbi.canonicalPermission}**\n\n## Fixed workload\n\n${report.workload.semantics}. Cases: ${report.workload.caseIds.join(', ')}.\n\n| Case | Class | JS status | Root parity | Result/error parity | JS semantic root |\n|---|---|---|---|---|---|\n${rows}\n\n## Cross-body and replay gates\n\n- Positive: **${report.coverage.positive}**; cycle: **${report.coverage.cycle}**; disconnected: **${report.coverage.disconnected}**; empty: **${report.coverage.empty}**; budget exhaustion: **${report.coverage.budgetExhaustion}**; invalid node: **${report.coverage.invalidNode}**; malformed graph: **${report.coverage.malformedGraph}**\n- Replay: **${report.replay.status}**; cross-body replay-root parity: **${report.replay.crossBodyFirstReplayParity ?? false}**\n- Universal Stress cell: **${report.universalStress.status}**, coverage mode \`${report.universalStress.coverageMode}\`\n\n## WASM value and host ABI\n\n- Tags: ${Object.entries(report.wasmAbi.valueTags).map(([key, value]) => `${key}=${value}`).join(', ')}\n- Memory: ${report.wasmAbi.memory.byteLength} bytes, input=${report.wasmAbi.memory.inputPointer}, output=${report.wasmAbi.memory.outputPointer}\n- Bounds: max nodes=${report.wasmAbi.bounds.maxNodes}; recursion=${report.wasmAbi.bounds.maxDepth}; nonfinite, malformed, duplicate fields, unsupported types, and invalid pointers fail closed.\n- Negative controls: ${report.wasmAbi.negativeControls.map(item => `${item.id}=${item.detected}`).join(', ')}\n\n## Strategic ruling\n\n${report.strategicQuestion}\n\n${report.boundary}\n\nBlocker: **${report.blocker ?? 'none'}**\n\nReproduction: \`${report.reproductionCommand}\`\n`;
}
