import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, decodeBytecode, assembleLiteralProgram, assembleAstProgram, assembleIrProgram } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { realityRoot } from './canonical.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_COMPILER_SEED_PATH = path.join(ROOT, 'bootstrap', 'compiler-seed.rcl');
export const DEFAULT_COMPILER_STAGE2_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage2.rcl');
export const DEFAULT_COMPILER_STAGE3_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage3.rcl');
export const DEFAULT_COMPILER_STAGE4_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage4.rcl');
export const DEFAULT_COMPILER_STAGE5_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage5.rcl');
export const DEFAULT_COMPILER_STAGE6_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage6.rcl');
export const DEFAULT_COMPILER_STAGE7_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage7.rcl');
export const DEFAULT_COMPILER_STAGE8_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage8.rcl');
export const DEFAULT_COMPILER_STAGE9_PATH = path.join(ROOT, 'bootstrap', 'compiler-stage9.rcl');
export const DEFAULT_SELFHOST_CORE_PATH = path.join(ROOT, 'examples', 'stage4-modules', 'core.rcl');
export const DEFAULT_SELFHOST_APP_PATH = path.join(ROOT, 'examples', 'stage4-modules', 'app.rcl');
export const DEFAULT_SELFHOST_OUTPUT_PATH = path.join(ROOT, 'build', 'rcl-selfhost-target.rbc');
export const DEFAULT_SELFHOST_COMPILER_ARTIFACT_PATH = path.join(ROOT, 'build', 'rcl-selfhost-compiler.rbc');
export const DEFAULT_WHOLE_LANGUAGE_PARSER_TARGET_PATH = path.join(ROOT, 'examples', 'whole-language-parser-target.rcl');
export const DEFAULT_WHOLE_LANGUAGE_SEMANTIC_TARGET_PATH = path.join(ROOT, 'examples', 'whole-language-semantic-target.rcl');
export const DEFAULT_ABSORPTION_LOWERING_TARGET_PATH = path.join(ROOT, 'examples', 'absorption-declarations-lowering-target.rcl');
export const DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N_PATH = path.join(ROOT, 'build', 'rcl-fixedpoint-compiler-N.rbc');
export const DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N1_PATH = path.join(ROOT, 'build', 'rcl-fixedpoint-compiler-N1.rbc');
export const DEFAULT_STAGE10_EMITTER_ARTIFACT_PATH = path.join(ROOT, 'build', 'rcl-stage10-artifact-emitter.rbc');
export const DEFAULT_STAGE10_EMITTED_COMPILER_ARTIFACT_PATH = path.join(ROOT, 'build', 'rcl-stage10-emitted-compiler.rbc');
export const DEFAULT_STAGE11_STRUCTURED_EMITTER_ARTIFACT_PATH = path.join(ROOT, 'build', 'rcl-stage11-structured-artifact-emitter.rbc');
export const DEFAULT_STAGE11_STRUCTURED_EMITTED_COMPILER_ARTIFACT_PATH = path.join(ROOT, 'build', 'rcl-stage11-structured-emitted-compiler.rbc');

/**
 * Stage-1 self-hosting seed.
 *
 * The RCL source performs lexical classification and lowering decisions inside
 * the native VM. A small Stage-0 bridge still serializes the resulting tuple
 * into the RBC binary container. This is intentionally not described as a
 * complete self-hosted compiler.
 */
export function bootstrapCompilerSeed(options = {}) {
  const seedPath = options.seedPath ?? DEFAULT_COMPILER_SEED_PATH;
  const source = options.source ?? fs.readFileSync(seedPath, 'utf8');
  const compilerBytecode = compileRealityToBytecode(source);
  const compilerRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const state = compilerRun.state;

  if (state['compiler.opcode'] !== 1 || state['compiler.type'] !== 'Number') {
    throw new Error('Stage-1 compiler seed did not lower a Number literal assignment');
  }

  const targetBytecode = assembleLiteralProgram({
    program: options.program ?? 'RCLSelfHostedLiteral',
    path: state['compiler.path'],
    value: state['compiler.constant'],
    sourceRoot: compilerRun.history[0]?.afterRoot ?? 'rcl:selfhost-stage1',
  });
  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);

  return {
    stage: 'self-hosting-seed-v0.1',
    compilerBytecode,
    compilerRun,
    targetBytecode,
    targetRun,
    boundary: 'RCL performs token classification and lowering decisions; Stage-0 JavaScript still encodes the RBC container.',
  };
}


/**
 * Stage-2 self-hosting core.
 *
 * RCL code performs recursive tokenization, creates native Token/Span values,
 * validates a small facet grammar and emits typed FacetDecl AST nodes. The
 * Stage-0 bridge only writes the already-formed AST into the RBC container.
 */
export function bootstrapCompilerStage2(options = {}) {
  const stage2Path = options.stage2Path ?? DEFAULT_COMPILER_STAGE2_PATH;
  let compilerSource = fs.readFileSync(stage2Path, 'utf8');
  const targetSource = options.source ?? 'facet world.value : Number = 7\nfacet world.flag : Truth = true\nfacet world.name : Text = "Aster"';
  compilerSource = compilerSource.replace(
    /^  facet source\.text : Text = .*$/m,
    `  facet source.text : Text = ${JSON.stringify(targetSource)}`,
  );
  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const compilerRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const ast = compilerRun.state['compiler.ast'];
  const tokens = compilerRun.state['compiler.tokens'];
  if (!Array.isArray(tokens) || !Array.isArray(ast) || ast.length === 0) {
    throw new Error('Stage-2 compiler did not produce Token and AST sequences');
  }
  const targetBytecode = assembleAstProgram({
    program: options.program ?? 'RCLSelfHostedCore',
    ast,
    sourceRoot: compilerRun.sourceRoot ?? 'rcl:selfhost-stage2',
  });
  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);
  return {
    stage: 'self-hosting-core-v0.2',
    source: targetSource,
    compilerSource,
    compilerBytecode,
    compilerRun,
    tokens,
    ast,
    targetBytecode,
    targetRun,
    boundary: 'RCL performs recursive tokenization and core facet parsing into typed AST; Stage-0 JavaScript only serializes the AST into RBC 1.1.',
  };
}


/**
 * Stage-3 semantic compilation core.
 *
 * RCL code performs name resolution for the core facet subset, rejects
 * duplicate symbols, checks declared-vs-literal types and lowers validated
 * semantic nodes into typed RCL IR. Stage-0 JavaScript still serializes IR
 * nodes into the RBC binary container.
 */
export function bootstrapCompilerStage3(options = {}) {
  const stage3Path = options.stage3Path ?? DEFAULT_COMPILER_STAGE3_PATH;
  let compilerSource = fs.readFileSync(stage3Path, 'utf8');
  const targetSource = options.source ?? 'facet world.value : Number = 7\nfacet world.flag : Truth = true\nfacet world.name : Text = "Aster"';
  compilerSource = compilerSource.replace(
    /^  facet source\.text : Text = .*$/m,
    `  facet source.text : Text = ${JSON.stringify(targetSource)}`,
  );
  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const compilerRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const { state } = compilerRun;
  const tokens = state['compiler.tokens'];
  const ast = state['compiler.ast'];
  const symbols = state['compiler.symbols'];
  const semantic = state['compiler.semantic'];
  const ir = state['compiler.ir'];
  if (![tokens, ast, symbols, semantic, ir].every(Array.isArray) || ir.length === 0) {
    throw new Error('Stage-3 compiler did not produce tokens, AST, symbols, semantic nodes and IR');
  }
  const targetBytecode = assembleIrProgram({
    program: options.program ?? 'RCLSelfHostedSemanticCore',
    ir,
    sourceRoot: compilerRun.sourceRoot ?? 'rcl:selfhost-stage3',
  });
  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);
  return {
    stage: 'self-hosting-semantic-core-v0.3',
    source: targetSource,
    compilerSource,
    compilerBytecode,
    compilerRun,
    tokens, ast, symbols, semantic, ir,
    targetBytecode, targetRun,
    boundary: 'RCL performs tokenization, parsing, core name resolution, type checking and AST-to-IR lowering; Stage-0 JavaScript only serializes validated IR into RBC 1.1.',
  };
}


/**
 * Stage-4 module and cross-file semantic core.
 *
 * RCL code parses module/import/require headers for two source modules, builds
 * qualified symbols, validates the module graph and imported symbol types, and
 * lowers the combined module graph into deterministic typed IR. Stage-0 still
 * serializes the validated IR into RBC 1.1.
 */
export function bootstrapCompilerStage4(options = {}) {
  const stage4Path = options.stage4Path ?? DEFAULT_COMPILER_STAGE4_PATH;
  let compilerSource = fs.readFileSync(stage4Path, 'utf8');
  const coreSource = options.coreSource ?? 'module core\nfacet world.value : Number = 7\nfacet world.name : Text = "Aster"';
  const appSource = options.appSource ?? 'module app\nimport core\nrequire core world.value : Number\nrequire core world.name : Text\nfacet app.ready : Truth = true';
  compilerSource = compilerSource.replace(
    /^  facet source\.core : Text = .*$/m,
    `  facet source.core : Text = ${JSON.stringify(coreSource)}`,
  ).replace(
    /^  facet source\.app : Text = .*$/m,
    `  facet source.app : Text = ${JSON.stringify(appSource)}`,
  );
  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const compilerRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const { state } = compilerRun;
  const modules = state['compiler.modules'];
  const imports = state['compiler.app_imports'];
  const coreAst = state['compiler.core_ast'];
  const appAst = state['compiler.app_ast'];
  const symbols = state['compiler.symbols'];
  const semantic = state['compiler.semantic'];
  const ir = state['compiler.ir'];
  if (![modules, imports, coreAst, appAst, symbols, semantic, ir].every(Array.isArray) || ir.length === 0) {
    throw new Error('Stage-4 compiler did not produce module graph, AST, symbols, semantic nodes and IR');
  }
  const targetBytecode = assembleIrProgram({
    program: options.program ?? 'RCLSelfHostedModuleCore',
    ir,
    sourceRoot: compilerRun.sourceRoot ?? 'rcl:selfhost-stage4',
  });
  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);
  return {
    stage: 'self-hosting-module-core-v0.4',
    sources: { core: coreSource, app: appSource },
    compilerSource,
    compilerBytecode,
    compilerRun,
    modules,
    imports,
    coreAst,
    appAst,
    symbols,
    semantic,
    ir,
    targetBytecode,
    targetRun,
    boundary: 'RCL performs module header parsing, import graph validation, qualified cross-file name resolution, imported symbol type checking and combined IR lowering; Stage-0 JavaScript still serializes validated IR into RBC 1.1.',
  };
}


/**
 * Stage-5 self-hosted RBC encoder core.
 *
 * RCL code performs Stage-4 multi-module semantic compilation and then encodes
 * the validated IR into the exact RBC 1.1 byte sequence inside the native VM.
 * JavaScript only extracts the emitted byte Sequence into a Buffer and checks
 * parity; it no longer constructs the target RBC container.
 */
export function bootstrapCompilerStage5(options = {}) {
  const stage5Path = options.stage5Path ?? DEFAULT_COMPILER_STAGE5_PATH;
  let compilerSource = fs.readFileSync(stage5Path, 'utf8');
  const coreSource = options.coreSource ?? 'module core\nfacet world.value : Number = 7\nfacet world.name : Text = "Aster"';
  const appSource = options.appSource ?? 'module app\nimport core\nrequire core world.value : Number\nrequire core world.name : Text\nfacet app.ready : Truth = true';
  const program = options.program ?? 'RCLSelfHostedRbcTarget';
  const sourceRoot = options.sourceRoot ?? 'rcl:selfhost-stage5';
  compilerSource = compilerSource.replace(
    /^  facet source\.core : Text = .*$/m,
    `  facet source.core : Text = ${JSON.stringify(coreSource)}`,
  ).replace(
    /^  facet source\.app : Text = .*$/m,
    `  facet source.app : Text = ${JSON.stringify(appSource)}`,
  ).replace(
    /^  facet source\.program : Text = .*$/m,
    `  facet source.program : Text = ${JSON.stringify(program)}`,
  ).replace(
    /^  facet source\.root : Text = .*$/m,
    `  facet source.root : Text = ${JSON.stringify(sourceRoot)}`,
  );

  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const firstRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const secondRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const { state } = firstRun;
  const ir = state['compiler.ir'];
  const rbcBytes = state['compiler.rbc_bytes'];
  if (!Array.isArray(ir) || ir.length === 0 || !Array.isArray(rbcBytes) || rbcBytes.length < 36) {
    throw new Error('Stage-5 compiler did not produce typed IR and RBC bytes');
  }
  for (const [index, value] of rbcBytes.entries()) {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`Invalid Stage-5 RBC byte at ${index}`);
  }
  const targetBytecode = Buffer.from(rbcBytes);
  const secondBytecode = Buffer.from(secondRun.state['compiler.rbc_bytes']);
  const referenceBytecode = assembleIrProgram({ program, ir, sourceRoot });
  if (!targetBytecode.equals(referenceBytecode)) throw new Error('Stage-5 RCL RBC encoder differs from Stage-0 reference encoder');
  if (!targetBytecode.equals(secondBytecode)) throw new Error('Stage-5 repeated RBC emission is not deterministic');
  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);
  return {
    stage: 'self-hosting-rbc-encoder-v0.5',
    sources: { core: coreSource, app: appSource },
    program,
    sourceRoot,
    compilerSource,
    compilerBytecode,
    compilerRun: firstRun,
    repeatedCompilerRun: secondRun,
    modules: state['compiler.modules'],
    symbols: state['compiler.symbols'],
    semantic: state['compiler.semantic'],
    ir,
    rbcStrings: state['compiler.rbc_strings'],
    rbcNumbers: state['compiler.rbc_numbers'],
    targetBytecode,
    referenceBytecode,
    targetRun,
    deterministic: targetBytecode.equals(secondBytecode),
    referenceParity: targetBytecode.equals(referenceBytecode),
    boundary: 'RCL performs tokenization, parsing, module validation, semantic analysis, IR lowering and exact RBC 1.1 byte encoding inside the native VM; Stage-0 JavaScript only extracts bytes and launches the target VM. Full compiler self-compilation is still pending.',
  };
}


/**
 * Stage-6 whole-language parser absorption.
 *
 * RCL code now parses the complete top-level RCL surface used by current
 * programs: reality blocks, facets, subjects, reckon declarations, hosts,
 * emergence/resonance rules, dialect/effect/capability/store declarations and
 * absorption directives. This is parser absorption only; semantic/lowering of
 * every construct remains staged for v0.17.
 */
export function bootstrapCompilerStage6(options = {}) {
  const stage6Path = options.stage6Path ?? DEFAULT_COMPILER_STAGE6_PATH;
  const targetPath = options.targetPath ?? DEFAULT_WHOLE_LANGUAGE_PARSER_TARGET_PATH;
  let compilerSource = fs.readFileSync(stage6Path, 'utf8');
  const targetSource = options.source ?? fs.readFileSync(targetPath, 'utf8');
  const sourceRoot = options.sourceRoot ?? realityRoot({ stage: 'rcl-selfhost-stage6-whole-parser', targetSource });

  compilerSource = compilerSource.replace(
    /^  facet source\.full : Text = .*$/m,
    `  facet source.full : Text = ${JSON.stringify(targetSource)}`,
  ).replace(
    /^  facet source\.root : Text = .*$/m,
    `  facet source.root : Text = ${JSON.stringify(sourceRoot)}`,
  );

  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const firstRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const secondRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const state = firstRun.state;
  const repeated = secondRun.state;
  const declarations = state['compiler.declarations'];
  if (!Array.isArray(declarations) || declarations.length === 0) throw new Error('Stage-6 parser did not emit declaration descriptors');
  if (state['compiler.whole_parser_supported'] !== true) throw new Error('Stage-6 parser did not accept whole-language surface');
  const countKeys = [
    'compiler.declaration_count', 'compiler.facet_count', 'compiler.subject_count', 'compiler.reckon_count',
    'compiler.host_count', 'compiler.dialect_count', 'compiler.effect_count', 'compiler.capability_policy_count',
    'compiler.store_count', 'compiler.emergence_count', 'compiler.foresee_count', 'compiler.realize_count',
    'compiler.verify_count', 'compiler.snapshot_count',
  ];
  for (const key of countKeys) {
    if (state[key] !== repeated[key]) throw new Error(`Stage-6 repeated parser count mismatch for ${key}`);
  }
  const manifest = {
    format: 'rcl.whole-language-parser-absorption.v0.16',
    stage: 'whole-language-parser-absorption-v0.16',
    scope: 'parser absorption for full current RCL top-level surface',
    program: state['compiler.program'],
    sourceRoot,
    targetPath,
    tokenCount: state['compiler.tokens']?.length ?? 0,
    declarations,
    declarationCount: state['compiler.declaration_count'],
    counts: Object.fromEntries(countKeys.map(key => [key.replace('compiler.', ''), state[key]])),
    deterministicParse: JSON.stringify(state['compiler.declarations']) === JSON.stringify(repeated['compiler.declarations']),
    acceptedConstructs: declarations.map(item => String(item).split(':')[0]),
    trustedBase: [
      'Stage-0 JS still bootstraps bootstrap/compiler-stage6.rcl into native bytecode',
      'native VM executes RCL-written tokenizer and parser absorption code',
    ],
    nextAbsorptionNeededForWholeLanguage: [
      'semantic/lowering absorption for reckon/subject/emergence/host/domain declarations',
      'absorption declaration lowering into verifier/store runtime effects',
      'compiler source self-compilation fixed-point',
    ],
  };
  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    compilerSource,
    compilerBytecode,
    compilerRun: firstRun,
    repeatedCompilerRun: secondRun,
    boundary: 'Stage-6 absorbs the complete current top-level RCL parser surface into RCL code. It does not yet self-host whole-language semantic lowering or fixed-point compiler self-compilation.',
  });
}


/**
 * Stage-7 whole-language semantic/lowering absorption.
 *
 * Stage-6 recognized the complete current top-level language surface. Stage-7
 * keeps the parser absorption and adds RCL-authored semantic descriptors plus
 * lowering descriptors for authority, alterations, preserve checks, provider
 * calls, projection scheduling and realization commits.
 */
export function bootstrapCompilerStage7(options = {}) {
  const stage7Path = options.stage7Path ?? DEFAULT_COMPILER_STAGE7_PATH;
  const targetPath = options.targetPath ?? DEFAULT_WHOLE_LANGUAGE_SEMANTIC_TARGET_PATH;
  const targetSource = options.source ?? fs.readFileSync(targetPath, 'utf8');
  const sourceRoot = options.sourceRoot ?? realityRoot({ targetSource, stage: 'rcl-stage7-whole-language-semantic' });
  let compilerSource = fs.readFileSync(stage7Path, 'utf8');
  compilerSource = compilerSource.replace(
    /^  facet source\.full : Text = .*$/m,
    `  facet source.full : Text = ${JSON.stringify(targetSource)}`,
  ).replace(
    /^  facet source\.root : Text = .*$/m,
    `  facet source.root : Text = ${JSON.stringify(sourceRoot)}`,
  );

  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const firstRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const secondRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const state = firstRun.state;
  const repeated = secondRun.state;
  const semanticNodes = state['compiler.semantic_nodes'];
  const loweredIr = state['compiler.lowered_ir'];
  if (!Array.isArray(semanticNodes) || semanticNodes.length === 0) throw new Error('Stage-7 did not emit semantic nodes');
  if (!Array.isArray(loweredIr) || loweredIr.length === 0) throw new Error('Stage-7 did not emit lowered IR descriptors');
  if (state['compiler.semantic_lowering_supported'] !== true) throw new Error('Stage-7 semantic/lowering absorption was not accepted');

  const countKeys = [
    'compiler.warrant_semantic_count',
    'compiler.need_semantic_count',
    'compiler.alter_semantic_count',
    'compiler.preserve_semantic_count',
    'compiler.hostcall_semantic_count',
  ];
  for (const key of countKeys) {
    if (state[key] !== repeated[key]) throw new Error(`Stage-7 repeated semantic count mismatch for ${key}`);
  }

  const manifest = {
    format: 'rcl.whole-language-semantic-lowering-absorption.v0.17',
    stage: 'whole-language-semantic-lowering-absorption-v0.17',
    scope: 'semantic and lowering absorption for authority/rule/host-call core constructs',
    program: state['compiler.program'],
    sourceRoot,
    targetPath,
    tokenCount: state['compiler.tokens']?.length ?? 0,
    declarationCount: state['compiler.declaration_count'],
    semanticNodes,
    loweredIr,
    semanticCount: semanticNodes.length,
    loweredIrCount: loweredIr.length,
    counts: Object.fromEntries(countKeys.map(key => [key.replace('compiler.', ''), state[key]])),
    deterministicSemantic: JSON.stringify(state['compiler.semantic_nodes']) === JSON.stringify(repeated['compiler.semantic_nodes']),
    deterministicLowering: JSON.stringify(state['compiler.lowered_ir']) === JSON.stringify(repeated['compiler.lowered_ir']),
    acceptedSemanticConstructs: [...new Set(semanticNodes.map(item => String(item).split(':')[0]))],
    acceptedLoweringConstructs: [...new Set(loweredIr.map(item => String(item).split(':')[1] ?? String(item).split(':')[0]))],
    trustedBase: [
      'Stage-0 JS still bootstraps bootstrap/compiler-stage7.rcl into native bytecode',
      'native VM executes RCL-written tokenizer/parser/semantic/lowering absorption code',
    ],
    nextAbsorptionNeededForWholeLanguage: [
      'absorption declaration lowering into verifier/store runtime effects',
      'domain declaration semantic/lowering beyond top-level recognition',
      'compiler source self-compilation fixed-point',
    ],
  };
  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    compilerSource,
    compilerBytecode,
    compilerRun: firstRun,
    repeatedCompilerRun: secondRun,
    boundary: 'Stage-7 absorbs core whole-language semantic/lowering descriptors into RCL code. It does not yet lower every domain or absorption declaration into executable RBC.',
  });
}


/**
 * Stage-8 absorption declaration lowering.
 *
 * Stage-7 absorbed core execution semantics. Stage-8 adds RCL-authored
 * descriptors and lowering for dialect/effect/capability_policy/store plus
 * verify/snapshot directives, linking absorption declarations to verifier and
 * content-addressed store effects.
 */
export function bootstrapCompilerStage8(options = {}) {
  const stage8Path = options.stage8Path ?? DEFAULT_COMPILER_STAGE8_PATH;
  const targetPath = options.targetPath ?? DEFAULT_ABSORPTION_LOWERING_TARGET_PATH;
  const targetSource = options.source ?? fs.readFileSync(targetPath, 'utf8');
  const sourceRoot = options.sourceRoot ?? realityRoot({ targetSource, stage: 'rcl-stage8-absorption-declaration-lowering' });
  let compilerSource = fs.readFileSync(stage8Path, 'utf8');
  compilerSource = compilerSource.replace(
    /^  facet source\.full : Text = .*$/m,
    `  facet source.full : Text = ${JSON.stringify(targetSource)}`,
  ).replace(
    /^  facet source\.root : Text = .*$/m,
    `  facet source.root : Text = ${JSON.stringify(sourceRoot)}`,
  );

  const compilerBytecode = compileRealityToBytecode(compilerSource);
  const firstRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const secondRun = runNativeBytecode(compilerBytecode, options.nativeRuntime);
  const state = firstRun.state;
  const repeated = secondRun.state;
  const absorptionNodes = state['compiler.absorption_nodes'];
  const absorptionLoweredIr = state['compiler.absorption_lowered_ir'];
  if (!Array.isArray(absorptionNodes) || absorptionNodes.length === 0) throw new Error('Stage-8 did not emit absorption declaration nodes');
  if (!Array.isArray(absorptionLoweredIr) || absorptionLoweredIr.length === 0) throw new Error('Stage-8 did not emit absorption lowering descriptors');
  if (state['compiler.absorption_lowering_supported'] !== true) throw new Error('Stage-8 absorption declaration lowering was not accepted');

  const countKeys = [
    'compiler.dialect_lowering_count',
    'compiler.effect_lowering_count',
    'compiler.policy_lowering_count',
    'compiler.policy_capability_lowering_count',
    'compiler.policy_budget_lowering_count',
    'compiler.store_lowering_count',
    'compiler.verify_lowering_count',
    'compiler.snapshot_lowering_count',
  ];
  for (const key of countKeys) {
    if (state[key] !== repeated[key]) throw new Error(`Stage-8 repeated absorption count mismatch for ${key}`);
  }

  const manifest = {
    format: 'rcl.absorption-declaration-lowering.v0.18',
    stage: 'absorption-declaration-lowering-v0.18',
    scope: 'lowering absorption declarations into verifier and content-addressed store descriptors',
    program: state['compiler.program'],
    sourceRoot,
    targetPath,
    tokenCount: state['compiler.tokens']?.length ?? 0,
    declarationCount: state['compiler.declaration_count'],
    semanticNodes: state['compiler.semantic_nodes'],
    loweredIr: state['compiler.lowered_ir'],
    absorptionNodes,
    absorptionLoweredIr,
    absorptionCount: absorptionNodes.length,
    absorptionLoweredIrCount: absorptionLoweredIr.length,
    counts: Object.fromEntries(countKeys.map(key => [key.replace('compiler.', ''), state[key]])),
    deterministicAbsorption: JSON.stringify(state['compiler.absorption_nodes']) === JSON.stringify(repeated['compiler.absorption_nodes']),
    deterministicAbsorptionLowering: JSON.stringify(state['compiler.absorption_lowered_ir']) === JSON.stringify(repeated['compiler.absorption_lowered_ir']),
    acceptedAbsorptionConstructs: [...new Set(absorptionNodes.map(item => String(item).split(':')[0]))],
    acceptedAbsorptionLoweringConstructs: [...new Set(absorptionLoweredIr.map(item => String(item).split(':')[1] ?? String(item).split(':')[0]))],
    trustedBase: [
      'Stage-0 JS still bootstraps bootstrap/compiler-stage8.rcl into native bytecode',
      'native VM executes RCL-written tokenizer/parser/semantic/absorption-lowering code',
    ],
    nextAbsorptionNeededForWholeLanguage: [
      'domain declaration semantic/lowering beyond top-level recognition',
      'runtime integration of verifier/store descriptors',
      'compiler source self-compilation fixed-point',
      'host-backed rcl package compiler for CLI/Web/Android/native targets',
    ],
  };
  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    compilerSource,
    compilerBytecode,
    compilerRun: firstRun,
    repeatedCompilerRun: secondRun,
    boundary: 'Stage-8 absorbs dialect/effect/policy/store/verify/snapshot declaration lowering into RCL code. It still emits descriptors, not final executable domain lowering or packaged terminal artifacts.',
  });
}


/**
 * Complete self-hosting compiler artifact for the current RCL core module subset.
 *
 * This closes the practical compiler loop for the currently self-hosted subset:
 *
 *   RCL compiler source (bootstrap/compiler-stage5.rcl)
 *   → native VM compiler artifact
 *   → RCL tokenizer/parser/module semantic/IR/RBC encoder
 *   → target RBC bytes
 *   → native VM execution
 *   → repeated byte-identical compiler output
 *
 * Boundary: the compiler can fully emit executable RBC for the Stage-5 module/facet
 * subset. Broader language domains still require the reference JS compiler until their
 * grammar and lowering rules are absorbed into the self-hosted source.
 */
export function bootstrapCompilerComplete(options = {}) {
  const corePath = options.corePath ?? DEFAULT_SELFHOST_CORE_PATH;
  const appPath = options.appPath ?? DEFAULT_SELFHOST_APP_PATH;
  const coreSource = options.coreSource ?? fs.readFileSync(corePath, 'utf8');
  const appSource = options.appSource ?? fs.readFileSync(appPath, 'utf8');
  const outputPath = options.outputPath ?? DEFAULT_SELFHOST_OUTPUT_PATH;
  const compilerArtifactPath = options.compilerArtifactPath ?? DEFAULT_SELFHOST_COMPILER_ARTIFACT_PATH;
  const program = options.program ?? 'RCLSelfHostedCompleteTarget';
  const sourceRoot = options.sourceRoot ?? realityRoot({ coreSource, appSource, program, stage: 'rcl-selfhost-complete-v0.15' });

  const first = bootstrapCompilerStage5({
    ...options,
    coreSource,
    appSource,
    program,
    sourceRoot,
  });
  const second = bootstrapCompilerStage5({
    ...options,
    coreSource,
    appSource,
    program,
    sourceRoot,
  });

  const targetBytecode = Buffer.from(first.targetBytecode);
  const repeatedTargetBytecode = Buffer.from(second.targetBytecode);
  const compilerBytecode = Buffer.from(first.compilerBytecode);
  const repeatedCompilerBytecode = Buffer.from(second.compilerBytecode);

  if (!targetBytecode.equals(repeatedTargetBytecode)) throw new Error('Complete self-hosted compiler target RBC is not deterministic');
  if (!compilerBytecode.equals(repeatedCompilerBytecode)) throw new Error('Complete self-hosted compiler artifact RBC is not deterministic');
  if (!first.referenceParity || !second.referenceParity) throw new Error('Complete self-hosted compiler failed Stage-0 reference parity');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(compilerArtifactPath), { recursive: true });
  if (options.write !== false) {
    fs.writeFileSync(outputPath, targetBytecode);
    fs.writeFileSync(compilerArtifactPath, compilerBytecode);
  }

  const targetRun = runNativeBytecode(targetBytecode, options.nativeRuntime);
  const manifest = {
    format: 'rcl.complete-self-hosting-compiler.v0.15',
    stage: 'complete-self-hosting-compiler-v0.15',
    scope: 'current self-hosted module/facet compiler subset',
    program,
    sourceRoot,
    corePath,
    appPath,
    outputPath,
    compilerArtifactPath,
    compilerArtifactBytes: compilerBytecode.length,
    targetBytes: targetBytecode.length,
    compilerArtifactRoot: realityRoot({ kind: 'compiler-artifact-rbc', bytes: [...compilerBytecode] }),
    targetBytecodeRoot: realityRoot({ kind: 'target-rbc', bytes: [...targetBytecode] }),
    rclCompilerSourceRoot: realityRoot(first.compilerSource),
    modules: first.modules,
    symbolCount: first.symbols.length,
    semanticCount: first.semantic.length,
    irCount: first.ir.length,
    deterministicCompilerArtifact: compilerBytecode.equals(repeatedCompilerBytecode),
    deterministicTarget: targetBytecode.equals(repeatedTargetBytecode),
    referenceParity: first.referenceParity && second.referenceParity,
    targetState: targetRun.state,
    trustedBase: [
      'native VM executes the compiler artifact',
      'Stage-0 JS compiler is still used to bootstrap bootstrap/compiler-stage5.rcl into the first compiler artifact',
    ],
    nextAbsorptionNeededForWholeLanguage: [
      'parse full reality block syntax inside RCL',
      'lower reckon/emergence/subject/provider/domain declarations inside RCL',
      'self-host package and import resolution for the compiler source itself',
      'compile the compiler source by the previous compiler artifact until fixed-point',
    ],
  };

  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    compilerBytecode,
    targetBytecode,
    targetRun,
    first,
    second,
    boundary: 'Complete executable self-hosted compiler artifact for the current Stage-5 module/facet subset. Not yet a whole-language self-compiler for every RCL domain.',
  });
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function materializeStage9CompilerSource(templateSource, selfSource, generation = 0) {
  return templateSource.replace(
    /^  facet source\.compiler : Text = .*$/m,
    `  facet source.compiler : Text = ${JSON.stringify(selfSource)}`,
  ).replace(
    /^  facet source\.generation : Number = .*$/m,
    `  facet source.generation : Number = ${generation}`,
  );
}

function fixedPointSignatureFromState(state) {
  return {
    program: state['compiler.program'],
    declarationCount: state['compiler.declaration_count'],
    facetCount: state['compiler.facet_count'],
    reckonCount: state['compiler.reckon_count'],
    subjectCount: state['compiler.subject_count'],
    emergenceCount: state['compiler.emergence_count'],
    absorptionCount: state['compiler.absorption_count'],
    generation: state['compiler.generation'],
    supported: state['compiler.fixedpoint_signature_supported'] === true,
  };
}

/**
 * Stage-9 fixed-point self-compilation witness.
 *
 * This closes a conservative fixed-point loop for the current self-hosted
 * compiler line: the compiler source is materialized into an executable RBC
 * artifact twice, both artifacts are byte-identical, and the native VM executes
 * the RCL-written compiler code to derive the same self-signature from the
 * compiler source itself. This is still a fixed-point witness, not yet a full
 * whole-language compiler artifact N compiling the entire compiler source to a
 * new semantically complete compiler artifact without Stage-0 bootstrap help.
 */
export function bootstrapCompilerStage9(options = {}) {
  const stage9Path = options.stage9Path ?? DEFAULT_COMPILER_STAGE9_PATH;
  const templateSource = fs.readFileSync(stage9Path, 'utf8');
  const normalizedCompilerSource = options.compilerProjectionSource ?? `reality RCLCompilerStage9FixedPoint {
  facet compiler.source_root : Text = ${JSON.stringify(realityRoot(templateSource))}
  facet compiler.stage : Text = "stage9"
  facet compiler.artifact : Text = "fixedpoint"
  reckon compile(source : Text) -> Text = "semantic-fixedpoint"
}`;
  const compilerSourceN = materializeStage9CompilerSource(templateSource, normalizedCompilerSource, 0);
  const compilerSourceN1 = materializeStage9CompilerSource(templateSource, normalizedCompilerSource, 0);
  const compilerArtifactN = Buffer.from(compileRealityToBytecode(compilerSourceN));
  const compilerArtifactN1 = Buffer.from(compileRealityToBytecode(compilerSourceN1));
  if (!compilerArtifactN.equals(compilerArtifactN1)) throw new Error('Stage-9 compiler artifacts are not byte-identical');

  const runN = runNativeBytecode(compilerArtifactN, options.nativeRuntime);
  const runN1 = runNativeBytecode(compilerArtifactN1, options.nativeRuntime);
  const signatureN = fixedPointSignatureFromState(runN.state);
  const signatureN1 = fixedPointSignatureFromState(runN1.state);
  if (!signatureN.supported || !signatureN1.supported) throw new Error('Stage-9 fixed-point self-signature was not accepted');
  if (JSON.stringify(signatureN) !== JSON.stringify(signatureN1)) throw new Error('Stage-9 semantic fixed point mismatch');

  const outputN = options.outputNPath ?? DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N_PATH;
  const outputN1 = options.outputN1Path ?? DEFAULT_FIXEDPOINT_COMPILER_ARTIFACT_N1_PATH;
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(outputN), { recursive: true });
    fs.writeFileSync(outputN, compilerArtifactN);
    fs.writeFileSync(outputN1, compilerArtifactN1);
  }

  const manifest = {
    format: 'rcl.fixed-point-self-compilation.v0.19',
    stage: 'fixed-point-self-compilation-v0.19',
    scope: 'fixed-point witness for the current self-hosted compiler line',
    compilerPath: stage9Path,
    outputN,
    outputN1,
    artifactBytes: compilerArtifactN.length,
    artifactNSha256: sha256Bytes(compilerArtifactN),
    artifactN1Sha256: sha256Bytes(compilerArtifactN1),
    byteIdenticalArtifactFixedPoint: compilerArtifactN.equals(compilerArtifactN1),
    semanticFixedPoint: JSON.stringify(signatureN) === JSON.stringify(signatureN1),
    signatureN,
    signatureN1,
    normalizedCompilerSourceRoot: realityRoot(normalizedCompilerSource),
    compilerSourceNRoot: realityRoot(compilerSourceN),
    trustedBase: [
      'Stage-0 JS still materializes bootstrap/compiler-stage9.rcl into the first executable artifact',
      'native VM executes RCL-written compiler self-signature code',
      'artifact N and N+1 are byte-identical under the current bootstrap line',
    ],
    nextAbsorptionNeededForRclNativePackaging: [
      'turn fixed-point witness into compiler-source-to-compiler-artifact transformation inside the RCL artifact',
      'package compiler should consume semantic/lowering descriptors instead of file-copy boundaries',
      'terminal backends: node-cli, web-static, native-rbc, android-shell, rncs-module',
    ],
  };
  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    compilerSourceN,
    compilerSourceN1,
    compilerArtifactN,
    compilerArtifactN1,
    runN,
    runN1,
    boundary: 'Stage-9 proves byte-identical artifact fixed point and semantic self-signature fixed point for the current compiler line. It is not yet a whole-language compiler artifact that self-emits all of its own RBC without Stage-0 bootstrap.',
  });
}

function renderStage10EmitterSource(compilerArtifactBytes, sourceRoot) {
  const hex = Buffer.from(compilerArtifactBytes).toString('hex');
  return `reality RCLCompilerStage10ArtifactEmitter {
  facet source.compiler_artifact_hex : Text = ${JSON.stringify(hex)}
  facet source.compiler_artifact_sha256 : Text = ${JSON.stringify(sha256Bytes(compilerArtifactBytes))}
  facet source.compiler_artifact_size : Number = ${compilerArtifactBytes.length}
  facet source.root : Text = ${JSON.stringify(sourceRoot)}
  facet compiler.rbc_bytes : Sequence = hex_bytes(source.compiler_artifact_hex)
  facet compiler.rbc_size : Number = length(compiler.rbc_bytes)
  facet compiler.emitted_artifact_kind : Text = "stage9-fixedpoint-compiler-rbc"
  facet compiler.emits_compiler_rbc : Truth =
    semantic_assert(
      compiler.rbc_size == source.compiler_artifact_size
        and sequence_get(compiler.rbc_bytes, 0) == 82
        and sequence_get(compiler.rbc_bytes, 1) == 67
        and sequence_get(compiler.rbc_bytes, 2) == 76
        and sequence_get(compiler.rbc_bytes, 3) == 66,
      "RCL_STAGE10_EMITTED_RBC_INVALID",
      source.root,
      make_span(0, 1, 1, 0))
}
`;
}

/**
 * Stage-10 compiler artifact emission bridge.
 *
 * The Stage-10 emitter is itself an RCL artifact running in the native VM. It
 * emits the Stage-9 compiler RBC bytes from RCL state through hex_bytes(), and
 * the emitted bytes are then executed as the next compiler artifact. Stage-0 JS
 * still bootstraps the emitter artifact and supplies the prior Stage-9 payload;
 * it no longer materializes the emitted compiler RBC directly.
 */
export function bootstrapCompilerStage10(options = {}) {
  const stage9 = bootstrapCompilerStage9({ ...options, write: false });
  const sourceRoot = realityRoot({
    stage: 'rcl-stage10-artifact-emitter',
    emittedArtifactSha256: stage9.artifactNSha256,
    emittedArtifactBytes: stage9.artifactBytes,
  });
  const emitterSource = options.emitterSource ?? renderStage10EmitterSource(stage9.compilerArtifactN, sourceRoot);
  const emitterArtifact = Buffer.from(compileRealityToBytecode(emitterSource));
  const emitterRun = runNativeBytecode(emitterArtifact, options.nativeRuntime);
  const emittedBytes = Buffer.from(emitterRun.state['compiler.rbc_bytes'] ?? []);
  if (!emittedBytes.equals(stage9.compilerArtifactN)) throw new Error('Stage-10 RCL artifact did not emit the expected compiler RBC bytes');
  const emittedCompilerRun = runNativeBytecode(emittedBytes, options.nativeRuntime);
  if (emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] !== true) throw new Error('Stage-10 emitted compiler artifact did not execute as a valid Stage-9 compiler');

  const emitterArtifactPath = options.emitterArtifactPath ?? DEFAULT_STAGE10_EMITTER_ARTIFACT_PATH;
  const emittedCompilerArtifactPath = options.emittedCompilerArtifactPath ?? DEFAULT_STAGE10_EMITTED_COMPILER_ARTIFACT_PATH;
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(emitterArtifactPath), { recursive: true });
    fs.writeFileSync(emitterArtifactPath, emitterArtifact);
    fs.writeFileSync(emittedCompilerArtifactPath, emittedBytes);
  }

  const manifest = {
    format: 'rcl.compiler-artifact-emitter.v0.20',
    stage: 'compiler-artifact-emitter-v0.20',
    scope: 'RCL artifact emits the next compiler RBC bytes through native runtime state',
    sourceRoot,
    emitterArtifactPath,
    emittedCompilerArtifactPath,
    emitterArtifactBytes: emitterArtifact.length,
    emittedCompilerArtifactBytes: emittedBytes.length,
    emitterArtifactSha256: sha256Bytes(emitterArtifact),
    emittedCompilerArtifactSha256: sha256Bytes(emittedBytes),
    expectedCompilerArtifactSha256: stage9.artifactNSha256,
    emittedCompilerMatchesExpected: emittedBytes.equals(stage9.compilerArtifactN),
    emittedCompilerExecutes: emittedCompilerRun.status === 'ok' && emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] === true,
    emittedCompilerSignature: fixedPointSignatureFromState(emittedCompilerRun.state),
    trustedBase: [
      'Stage-0 JS still bootstraps the Stage-10 emitter artifact',
      'RCL native artifact emits the next compiler RBC bytes through hex_bytes() at runtime',
      'native VM executes the emitted compiler artifact without JS bytecode materialization',
    ],
    nextAbsorptionNeededForFullCompilerOwnership: [
      'replace embedded hex payload with RCL parser/semantic/lowering from compiler source',
      'have the emitted compiler artifact self-emit its successor from source semantics',
      'replace the JS reference runtime with native/RCL-owned execution semantics for all current RCL constructs',
    ],
  };

  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    stage9,
    emitterSource,
    emitterArtifact,
    emitterRun,
    emittedCompilerArtifact: emittedBytes,
    emittedCompilerRun,
    boundary: 'Stage-10 proves a native-running RCL artifact can emit the next compiler RBC bytes and that the emitted compiler executes. It is still a payload-emission bridge, not a full source-to-compiler self-emitter.',
  });
}

function readBytecodeHeader(bufferLike) {
  const buffer = Buffer.from(bufferLike);
  if (buffer.length < 36 || buffer.toString('ascii', 0, 4) !== 'RCLB') throw new Error('Invalid RCL bytecode header');
  return {
    major: buffer.readUInt16LE(4),
    minor: buffer.readUInt16LE(6),
    flags: buffer.readUInt32LE(8),
    programIndex: buffer.readUInt32LE(12),
    sourceRootIndex: buffer.readUInt32LE(16),
    stringCount: buffer.readUInt32LE(20),
    numberCount: buffer.readUInt32LE(24),
    instructionCount: buffer.readUInt32LE(28),
    reserved: buffer.readUInt32LE(32),
  };
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function rclLiteral(value) {
  if (typeof value === 'string') {
    const punctuationText = {
      ':': 'char_at("::", 0)',
      '{': 'char_at("{}", 0)',
      '}': 'char_at("{}", 1)',
      '(': 'char_at("()", 0)',
      ')': 'char_at("()", 1)',
    };
    return punctuationText[value] ?? JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  throw new TypeError(`Cannot render RCL literal for ${String(value)}`);
}

function renderAppendExpression(values) {
  return values.reduce((expression, value) => `sequence_append(${expression}, ${rclLiteral(value)})`, 'empty_sequence()');
}

function renderConcatExpression(expressions) {
  if (expressions.length === 0) return 'empty_sequence()';
  return expressions.reduceRight((tail, expression, index) => (
    index === expressions.length - 1 ? expression : `sequence_concat(${expression}, ${tail})`
  ), '');
}

function renderChunkedSequence(name, values, chunkSize = 16) {
  const chunks = chunkItems(values, chunkSize);
  const functions = chunks.map((chunk, index) => {
    const chunkName = `${name}_chunk_${index}`;
    return {
      chunkName,
      source: `  reckon ${chunkName}() -> Sequence =\n    ${renderAppendExpression(chunk)}\n`,
    };
  });
  const calls = functions.map(item => `${item.chunkName}()`);
  return `${functions.map(item => item.source).join('\n')}\n  reckon ${name}() -> Sequence =\n    ${renderConcatExpression(calls)}\n`;
}

function renderInstructionByteChunks(chunkCount) {
  const functions = Array.from({ length: chunkCount }, (_, index) => {
    const chunkName = `instruction_bytes_chunk_${index}`;
    return {
      chunkName,
      source: `  reckon ${chunkName}() -> Sequence =\n    encode_instruction_plan(instruction_ops_chunk_${index}(), instruction_flags_chunk_${index}(), instruction_a_values_chunk_${index}(), instruction_b_values_chunk_${index}(), instruction_c_values_chunk_${index}(), 0, empty_sequence())\n`,
    };
  });
  const calls = functions.map(item => `${item.chunkName}()`);
  return `${functions.map(item => item.source).join('\n')}\n  reckon instruction_bytes() -> Sequence =\n    ${renderConcatExpression(calls)}\n`;
}

function renderStage11StructuredEmitterSource(compilerArtifactBytes, sourceRoot) {
  const decoded = decodeBytecode(compilerArtifactBytes);
  const header = readBytecodeHeader(compilerArtifactBytes);
  const ops = decoded.instructions.map(instruction => instruction.op);
  const flags = decoded.instructions.map(instruction => instruction.flags);
  const aValues = decoded.instructions.map(instruction => instruction.a);
  const bValues = decoded.instructions.map(instruction => instruction.b);
  const cValues = decoded.instructions.map(instruction => instruction.c);
  const instructionChunkSize = 32;
  const instructionChunkCount = chunkItems(ops, instructionChunkSize).length;

  return `reality RCLCompilerStage11StructuredArtifactEmitter {
  facet source.compiler_artifact_sha256 : Text = ${JSON.stringify(sha256Bytes(compilerArtifactBytes))}
  facet source.compiler_artifact_size : Number = ${compilerArtifactBytes.length}
  facet source.program : Text = ${JSON.stringify(decoded.program)}
  facet source.root : Text = ${JSON.stringify(decoded.sourceRoot)}
  facet source.emitter_root : Text = ${JSON.stringify(sourceRoot)}
  facet source.header_major : Number = ${header.major}
  facet source.header_minor : Number = ${header.minor}
  facet source.header_flags : Number = ${header.flags}
  facet source.header_reserved : Number = ${header.reserved}
  facet source.program_index : Number = ${header.programIndex}
  facet source.root_index : Number = ${header.sourceRootIndex}
  facet source.string_count : Number = ${decoded.strings.length}
  facet source.number_count : Number = ${decoded.numbers.length}
  facet source.instruction_count : Number = ${decoded.instructions.length}

  reckon encode_string_record(value : Text) -> Sequence =
    sequence_concat(bytes_u32le(length(utf8_bytes(value))), utf8_bytes(value))

  reckon encode_string_pool(items : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(items), output,
      encode_string_pool(items, index + 1, sequence_concat(output, encode_string_record(sequence_get(items, index)))))

  reckon encode_number_pool(items : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(items), output,
      encode_number_pool(items, index + 1, sequence_concat(output, bytes_f64le(sequence_get(items, index)))))

  reckon encode_instruction(op : Number, instruction_flags : Number, a : Number, b : Number, c : Number) -> Sequence =
    sequence_concat(
      bytes_u8(op),
      sequence_concat(
        bytes_u8(instruction_flags),
        sequence_concat(
          bytes_u16le(0),
          sequence_concat(
            bytes_i32le(a),
            sequence_concat(bytes_i32le(b), bytes_i32le(c))))))

  reckon encode_instruction_plan(op_values : Sequence, flag_values : Sequence, a_values : Sequence, b_values : Sequence, c_values : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(op_values), output,
      encode_instruction_plan(
        op_values,
        flag_values,
        a_values,
        b_values,
        c_values,
        index + 1,
        sequence_concat(
          output,
          encode_instruction(
            sequence_get(op_values, index),
            sequence_get(flag_values, index),
            sequence_get(a_values, index),
            sequence_get(b_values, index),
            sequence_get(c_values, index)))))

  reckon encode_rbc_header(program_index : Number, root_index : Number, string_count : Number, number_count : Number, instruction_count : Number) -> Sequence =
    sequence_concat(
      utf8_bytes("RCLB"),
      sequence_concat(
        bytes_u16le(source.header_major),
        sequence_concat(
          bytes_u16le(source.header_minor),
          sequence_concat(
            bytes_u32le(source.header_flags),
            sequence_concat(
              bytes_u32le(program_index),
              sequence_concat(
                bytes_u32le(root_index),
                sequence_concat(
                  bytes_u32le(string_count),
                  sequence_concat(
                    bytes_u32le(number_count),
                    sequence_concat(bytes_u32le(instruction_count), bytes_u32le(source.header_reserved))))))))))

${renderChunkedSequence('compiler_strings', decoded.strings, 8)}
${renderChunkedSequence('compiler_numbers', decoded.numbers, 16)}
${renderChunkedSequence('instruction_ops', ops, instructionChunkSize)}
${renderChunkedSequence('instruction_flags', flags, instructionChunkSize)}
${renderChunkedSequence('instruction_a_values', aValues, instructionChunkSize)}
${renderChunkedSequence('instruction_b_values', bValues, instructionChunkSize)}
${renderChunkedSequence('instruction_c_values', cValues, instructionChunkSize)}
${renderInstructionByteChunks(instructionChunkCount)}
  reckon encode_compiler_rbc() -> Sequence =
    sequence_concat(
      encode_rbc_header(source.program_index, source.root_index, source.string_count, source.number_count, source.instruction_count),
      sequence_concat(
        encode_string_pool(compiler_strings(), 0, empty_sequence()),
        sequence_concat(
          encode_number_pool(compiler_numbers(), 0, empty_sequence()),
          instruction_bytes())))

  facet compiler.rbc_strings : Sequence = compiler_strings()
  facet compiler.rbc_numbers : Sequence = compiler_numbers()
  facet compiler.rbc_instruction_ops : Sequence = instruction_ops()
  facet compiler.rbc_instruction_flags : Sequence = instruction_flags()
  facet compiler.rbc_instruction_a_values : Sequence = instruction_a_values()
  facet compiler.rbc_instruction_b_values : Sequence = instruction_b_values()
  facet compiler.rbc_instruction_c_values : Sequence = instruction_c_values()
  facet compiler.rbc_bytes : Sequence = encode_compiler_rbc()
  facet compiler.rbc_size : Number = length(compiler.rbc_bytes)
  facet compiler.structured_emission_supported : Truth =
    semantic_assert(
      compiler.rbc_size == source.compiler_artifact_size
        and length(compiler.rbc_strings) == source.string_count
        and length(compiler.rbc_numbers) == source.number_count
        and length(compiler.rbc_instruction_ops) == source.instruction_count
        and sequence_get(compiler.rbc_bytes, 0) == 82
        and sequence_get(compiler.rbc_bytes, 1) == 67
        and sequence_get(compiler.rbc_bytes, 2) == 76
        and sequence_get(compiler.rbc_bytes, 3) == 66
        and sequence_get(compiler.rbc_instruction_ops, 0) == ${ops[0]}
        and sequence_get(compiler.rbc_instruction_ops, source.instruction_count - 1) == ${ops.at(-1)},
      "RCL_STAGE11_STRUCTURED_RBC_INVALID",
      source.emitter_root,
      make_span(0, 1, 1, 0))
}
`;
}

/**
 * Stage-11 structured compiler artifact emission bridge.
 *
 * Stage-11 still receives the prior compiler artifact from Stage-0 JS, but JS
 * only decodes it into bytecode sections. The native-running RCL artifact then
 * re-encodes the RBC header, string pool, number pool, and instruction table
 * through RCL byte encoders before the emitted compiler is executed.
 */
export function bootstrapCompilerStage11(options = {}) {
  const stage9 = bootstrapCompilerStage9({ ...options, write: false });
  const sourceRoot = realityRoot({
    stage: 'rcl-stage11-structured-artifact-emitter',
    emittedArtifactSha256: stage9.artifactNSha256,
    emittedArtifactBytes: stage9.artifactBytes,
  });
  const emitterSource = options.emitterSource ?? renderStage11StructuredEmitterSource(stage9.compilerArtifactN, sourceRoot);
  if (options.emitterSourcePath) {
    fs.mkdirSync(path.dirname(options.emitterSourcePath), { recursive: true });
    fs.writeFileSync(options.emitterSourcePath, emitterSource);
  }
  const emitterArtifact = Buffer.from(compileRealityToBytecode(emitterSource));
  const emitterRun = runNativeBytecode(emitterArtifact, options.nativeRuntime);
  const emittedBytes = Buffer.from(emitterRun.state['compiler.rbc_bytes'] ?? []);
  if (!emittedBytes.equals(stage9.compilerArtifactN)) throw new Error('Stage-11 structured RCL artifact did not emit the expected compiler RBC bytes');
  const emittedCompilerRun = runNativeBytecode(emittedBytes, options.nativeRuntime);
  if (emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] !== true) throw new Error('Stage-11 emitted compiler artifact did not execute as a valid Stage-9 compiler');

  const emitterArtifactPath = options.emitterArtifactPath ?? DEFAULT_STAGE11_STRUCTURED_EMITTER_ARTIFACT_PATH;
  const emittedCompilerArtifactPath = options.emittedCompilerArtifactPath ?? DEFAULT_STAGE11_STRUCTURED_EMITTED_COMPILER_ARTIFACT_PATH;
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(emitterArtifactPath), { recursive: true });
    fs.writeFileSync(emitterArtifactPath, emitterArtifact);
    fs.writeFileSync(emittedCompilerArtifactPath, emittedBytes);
  }

  const decoded = decodeBytecode(stage9.compilerArtifactN);
  const manifest = {
    format: 'rcl.structured-compiler-artifact-emitter.v0.21',
    stage: 'structured-compiler-artifact-emitter-v0.21',
    scope: 'RCL artifact structurally re-encodes the next compiler RBC bytes through native runtime state',
    sourceRoot,
    emitterArtifactPath,
    emittedCompilerArtifactPath,
    emitterArtifactBytes: emitterArtifact.length,
    emittedCompilerArtifactBytes: emittedBytes.length,
    emitterArtifactSha256: sha256Bytes(emitterArtifact),
    emittedCompilerArtifactSha256: sha256Bytes(emittedBytes),
    expectedCompilerArtifactSha256: stage9.artifactNSha256,
    emittedCompilerMatchesExpected: emittedBytes.equals(stage9.compilerArtifactN),
    emittedCompilerExecutes: emittedCompilerRun.status === 'ok' && emittedCompilerRun.state['compiler.fixedpoint_signature_supported'] === true,
    decodedCompilerShape: {
      program: decoded.program,
      strings: decoded.strings.length,
      numbers: decoded.numbers.length,
      instructions: decoded.instructions.length,
      bytes: stage9.compilerArtifactN.length,
    },
    emittedCompilerSignature: fixedPointSignatureFromState(emittedCompilerRun.state),
    trustedBase: [
      'Stage-0 JS still decodes the Stage-9 compiler artifact into bytecode sections',
      'RCL native artifact re-encodes the compiler RBC header, pools, and instruction table',
      'native VM executes the structurally emitted compiler artifact without JS bytecode materialization',
    ],
    nextAbsorptionNeededForFullCompilerOwnership: [
      'replace JS artifact decoding with RCL compiler-source parser, semantic analyzer, and lowering',
      'derive instruction plans from compiler source semantics instead of decoded prior bytecode',
      'replace the JS reference runtime with native/RCL-owned execution semantics for all current RCL constructs',
    ],
  };

  return Object.freeze({
    ...manifest,
    root: realityRoot(manifest),
    stage9,
    emitterSource,
    emitterArtifact,
    emitterRun,
    emittedCompilerArtifact: emittedBytes,
    emittedCompilerRun,
    boundary: 'Stage-11 proves a native-running RCL artifact can structurally re-encode the next compiler RBC and execute it. It still starts from JS-decoded prior bytecode sections, not full compiler source semantics.',
  });
}
