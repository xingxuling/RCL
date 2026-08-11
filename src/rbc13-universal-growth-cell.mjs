import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode } from './bytecode.mjs';
import { realityRoot } from './canonical.mjs';
import { runNativeBytecode } from './native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKLOAD_PATH = path.join(ROOT, 'examples', 'rbc13-universal-growth-graph-traversal.rcl');

export const RBC13_UNIVERSAL_GROWTH_CELL_FORMAT =
  'rcl.rbc13-first-universal-growth-cell.v0.1';
export const RBC13_UNIVERSAL_GROWTH_WORKLOAD_ID = 'graph-traversal::bounded-reachability';

function sha256(value) {
  return realityRoot({ bytes: Buffer.isBuffer(value) ? value.toString('base64') : String(value) });
}

function hasInstruction(decoded, predicate) {
  return decoded.instructions.some(predicate);
}

function inspectWasmVmSupport(rootPath, decoded) {
  const wasmFiles = [];
  const candidateRoots = [path.join(rootPath, 'src'), path.join(rootPath, 'native'), path.join(rootPath, 'scripts')];
  for (const directory of candidateRoots) {
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.wasm')) wasmFiles.push(path.join(path.relative(rootPath, directory), entry.name));
    }
  }
  const opcode45Present = hasInstruction(decoded, item => item.op === 45 || item.opcode === 45 || item.name === 'DOMAIN_CALL');
  const providerInstructionPresent = hasInstruction(decoded, item => item.name === 'CALL_PROVIDER');
  const wasmAdapterPresent = false;
  return {
    host: {
      nodeWebAssemblyAvailable: typeof WebAssembly === 'object',
      rclWasmVmAdapterPresent: wasmAdapterPresent,
      wasmBinaryCount: wasmFiles.length,
      wasmFiles,
    },
    compile: {
      rclSourceCompiledByJs: true,
      wasmCompileEntryPointPresent: wasmAdapterPresent,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_VM_ADAPTER_MISSING',
    },
    bytecode: {
      sourceBytecodeVersion: `${decoded.version.major}.${decoded.version.minor}`,
      bytecodeRoot: null,
      opcode45Present,
      opcode45WasmDecoderPresent: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_BYTECODE_BRIDGE_MISSING',
    },
    memoryValueAbi: {
      wasmLinearMemoryBinding: false,
      rclValueBridge: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_MEMORY_VALUE_ABI_MISSING',
    },
    errors: {
      wasmErrorMapping: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_ERROR_ABI_MISSING',
    },
    semanticRoot: {
      wasmSemanticStateRoot: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_SEMANTIC_ROOT_BRIDGE_MISSING',
    },
    replay: {
      wasmReplay: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_REPLAY_HARNESS_MISSING',
    },
    hostBoundary: {
      wasmHostBoundary: false,
      providerInstructionPresent,
      noSilentProviderFallbackProven: false,
      status: 'BLOCKED',
      blocker: 'RCL_WASM_HOST_BOUNDARY_MISSING',
    },
  };
}

function runNativeWorkload(source) {
  const bytecode = Buffer.from(compileRealityToBytecode(source));
  const decoded = decodeBytecode(bytecode);
  const first = runNativeBytecode(bytecode, { requireNativeStateRoot: true });
  const replay = runNativeBytecode(bytecode, { requireNativeStateRoot: true });
  const bytecodeRoot = sha256(bytecode);
  const stateRoot = first.semanticStateRoot ?? first.stateRoot;
  const replayStateRoot = replay.semanticStateRoot ?? replay.stateRoot;
  const noProviderFallback = !hasInstruction(decoded, item => item.name === 'CALL_PROVIDER')
    && first.state?.['graph.reachable'] === true
    && first.state?.['graph.unreachable'] === false;
  return {
    bytecode,
    decoded,
    bytecodeRoot,
    first,
    replay,
    stateRoot,
    replayStateRoot,
    replayVerified: first.stateRootVerified === true
      && replay.stateRootVerified === true
      && stateRoot === replayStateRoot,
    noProviderFallback,
  };
}

export function buildRbc13UniversalGrowthCell(options = {}) {
  const rootPath = path.resolve(options.root ?? ROOT);
  const workloadPath = options.workloadPath ?? path.join(rootPath, path.relative(ROOT, WORKLOAD_PATH));
  const source = fs.readFileSync(workloadPath, 'utf8');
  let native = null;
  let compileError = null;
  try {
    native = runNativeWorkload(source);
  } catch (error) {
    compileError = {
      code: error.code ?? null,
      message: String(error.message ?? error),
    };
  }
  const decoded = native?.decoded ?? { version: { major: null, minor: null }, instructions: [] };
  const wasm = inspectWasmVmSupport(rootPath, decoded);
  wasm.bytecode.bytecodeRoot = native?.bytecodeRoot ?? null;
  const nativeVerified = Boolean(native)
    && native.first.status === 'ok'
    && native.replay.status === 'ok'
    && native.replayVerified
    && native.noProviderFallback;
  const growthProof = {
    status: nativeVerified ? 'CANDIDATE' : 'BLOCKED',
    workload: RBC13_UNIVERSAL_GROWTH_WORKLOAD_ID,
    newAbility: 'bounded graph reachability over an adjacency matrix',
    sourceMechanisms: ['reckon recursion', 'choose control flow', 'sequence_get', 'Truth conjunction'],
    sourceRoot: sha256(source),
    nativeBytecodeRoot: native?.bytecodeRoot ?? null,
    nativeSemanticRoot: native?.stateRoot ?? null,
    mainSuccessIsExistingFourOperation: false,
    proofBoundary: 'Native RCL primitive/control-flow execution proves a bounded growth candidate only; it does not prove a wasm-vm universal cell.',
  };
  const supportBlockers = [
    wasm.compile.blocker,
    wasm.bytecode.blocker,
    wasm.memoryValueAbi.blocker,
    wasm.errors.blocker,
    wasm.semanticRoot.blocker,
    wasm.replay.blocker,
    wasm.hostBoundary.blocker,
  ];
  const cellStatus = nativeVerified && supportBlockers.length === 0 ? 'VERIFIED' : 'BLOCKED';
  const body = {
    format: RBC13_UNIVERSAL_GROWTH_CELL_FORMAT,
    version: '0.1.0',
    status: cellStatus,
    cellId: 'wasm-vm::algorithm::graph-traversal',
    environment: 'wasm-vm',
    programFamily: 'algorithm',
    workload: {
      id: RBC13_UNIVERSAL_GROWTH_WORKLOAD_ID,
      sourcePath: path.relative(rootPath, workloadPath).replaceAll('\\', '/'),
      sourceRoot: growthProof.sourceRoot,
      expected: { reachable: true, unreachable: false },
    },
    growthProof,
    executionClassification: nativeVerified ? 'experimental-native-semantic' : 'blocked',
    native: native ? {
      status: nativeVerified ? 'VERIFIED' : 'BLOCKED',
      bytecodeVersion: `${native.decoded.version.major}.${native.decoded.version.minor}`,
      bytecodeRoot: native.bytecodeRoot,
      instructionCount: native.decoded.instructions.length,
      stateRoot: native.stateRoot,
      replayStateRoot: native.replayStateRoot,
      replayVerified: native.replayVerified,
      stateRootAlgorithm: native.first.stateRootAlgorithm,
      runtimeVersion: native.first.vm,
      noProviderFallback: native.noProviderFallback,
      result: {
        reachable: native.first.state?.['graph.reachable'] ?? null,
        unreachable: native.first.state?.['graph.unreachable'] ?? null,
      },
    } : { status: 'BLOCKED', error: compileError },
    wasmVmSupport: wasm,
    blockerClass: supportBlockers.length > 0 ? 'wasm-vm-runtime-and-abi-unsupported' : null,
    blocker: supportBlockers.length > 0
      ? 'No repository wasm-vm adapter, wasm artifact, opcode45 decoder, linear-memory/value ABI, error bridge, semantic-root bridge, replay harness, or host-boundary witness is present.'
      : null,
    universalGrowthEligible: cellStatus === 'VERIFIED',
    authoritativeStateMutated: false,
    growthCellReceipt: null,
    reproductionCommand: 'npm run verify:rbc13-universal-growth-cell',
    boundary: 'This report deliberately separates a native RCL graph-traversal growth candidate from the requested wasm-vm admission cell. No wasm support is inferred from Node WebAssembly availability or from the native VM result.',
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function renderRbc13UniversalGrowthCellMarkdown(report) {
  const supportRows = [
    ['compile', report.wasmVmSupport.compile.status, report.wasmVmSupport.compile.blocker],
    ['bytecode/opcode45', report.wasmVmSupport.bytecode.status, report.wasmVmSupport.bytecode.blocker],
    ['memory/value ABI', report.wasmVmSupport.memoryValueAbi.status, report.wasmVmSupport.memoryValueAbi.blocker],
    ['error ABI', report.wasmVmSupport.errors.status, report.wasmVmSupport.errors.blocker],
    ['semantic root', report.wasmVmSupport.semanticRoot.status, report.wasmVmSupport.semanticRoot.blocker],
    ['replay', report.wasmVmSupport.replay.status, report.wasmVmSupport.replay.blocker],
    ['host boundary', report.wasmVmSupport.hostBoundary.status, report.wasmVmSupport.hostBoundary.blocker],
  ].map(row => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
  return `# RBC13 First Universal Growth Cell v0.1\n\n- Status: **${report.status}**\n- Cell: \`${report.cellId}\`\n- Workload: \`${report.workload.id}\`\n- Evidence root: \`${report.root}\`\n- Execution classification: **${report.executionClassification}**\n- Universal growth eligible: **${report.universalGrowthEligible}**\n\n## Workload and growth proof\n\nThe first non-existing-four-operation workload is bounded graph reachability over an adjacency matrix. The RCL source uses ${report.growthProof.sourceMechanisms.join(', ')}. The native result is ${report.native.status}; reachable=${report.native.result?.reachable}; unreachable=${report.native.result?.unreachable}; replay=${report.native.replayVerified}.\n\n- Source root: \`${report.workload.sourceRoot}\`\n- Native bytecode root: \`${report.native.bytecodeRoot ?? 'none'}\`\n- Native semantic root: \`${report.native.stateRoot ?? 'none'}\`\n- Native runtime: \`${report.native.runtimeVersion ?? 'none'}\`\n- Native no-provider-fallback observation: **${report.native.noProviderFallback ?? false}**\n\n## wasm-vm support audit\n\n| Surface | Status | Blocker |\n|---|---|---|\n${supportRows}\n\nNode's WebAssembly object availability is not treated as an RCL wasm-vm implementation. The repository currently has no wasm adapter or wasm artifact for this workload, so no wasm compile, opcode45, memory/value ABI, error, semantic-root, replay, or host-boundary claim is made.\n\n## Blocker\n\n${report.blocker ?? 'none'}\n\n## Boundary\n\n${report.boundary}\n`;
}
