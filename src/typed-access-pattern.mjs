import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { tryCompileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';

export const RCL_TYPED_ACCESS_PATTERN_VERSION = '0.34.0-alpha.1';
export const RCL_TYPED_ACCESS_PATTERN_FORMAT = 'rcl.typed-access-pattern.v0.34';

export const DEFAULT_TYPED_ACCESS_TYPE_MODULES = Object.freeze({
  'core.rcltype': `module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}
`,
});

export const DEFAULT_TYPED_ACCESS_SOURCE = `reality TypedAccessPatternDemo {
  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }
  facet app.userPayload : Text = app.user.payload
  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")
  facet app.message : Text = match app.login {
    Ok(value) -> value
    Err(reason) -> reason
  }
}
`;

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function readTypeSources(typePath) {
  if (fs.statSync(typePath).isDirectory()) return readTypedModuleSourcesFromDir(typePath);
  return { [path.basename(typePath)]: fs.readFileSync(typePath, 'utf8') };
}

function pickAccessInstructions(decoded) {
  const interesting = new Set([OPCODES.GET_TYPED_FIELD, OPCODES.IS_UNION_VARIANT, OPCODES.GET_UNION_PAYLOAD]);
  return (decoded.instructions ?? [])
    .filter(instruction => interesting.has(instruction.op))
    .map(instruction => ({
      index: instruction.index,
      opcode: instruction.name,
      argument: instruction.op === OPCODES.GET_UNION_PAYLOAD ? instruction.a : decoded.strings[instruction.a],
    }));
}

export function buildTypedAccessPatternReport({ program, semanticMap, decoded, nativeState }) {
  const fieldAccessFacets = Object.values(semanticMap?.facets ?? {})
    .filter(item => item.fieldAccesses?.length)
    .map(item => ({ path: item.path, fieldAccesses: item.fieldAccesses }));
  const matchFacets = Object.values(semanticMap?.facets ?? {})
    .filter(item => item.matches?.length)
    .map(item => ({ path: item.path, matches: item.matches }));
  const accessInstructions = pickAccessInstructions(decoded);
  const report = {
    format: RCL_TYPED_ACCESS_PATTERN_FORMAT,
    version: RCL_TYPED_ACCESS_PATTERN_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    fieldAccessCount: semanticMap?.fieldAccessCount ?? 0,
    matchCount: semanticMap?.matchCount ?? 0,
    fieldAccessFacets,
    matchFacets,
    accessInstructionCount: accessInstructions.length,
    accessInstructions,
    nativeState,
  };
  report.reportRoot = sha256Json({
    programRoot: report.programRoot,
    fieldAccessFacets: report.fieldAccessFacets,
    matchFacets: report.matchFacets,
    accessInstructions: report.accessInstructions,
  });
  return report;
}

export function compileTypedAccessPattern(source = DEFAULT_TYPED_ACCESS_SOURCE, options = {}) {
  const typeModuleSources = options.typeModuleSources ?? DEFAULT_TYPED_ACCESS_TYPE_MODULES;
  const compiled = tryCompileReality(source, { typeModuleSources });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics, program: null, report: null };
  const bytecode = compileRealityToBytecode(compiled.program);
  const decoded = decodeBytecode(bytecode);
  const native = runNativeBytecode(bytecode, options.nativeRuntime ?? {});
  const report = buildTypedAccessPatternReport({
    program: compiled.program,
    semanticMap: compiled.semanticMap,
    decoded,
    nativeState: native.state,
  });
  return {
    ok: true,
    diagnostics: [],
    program: compiled.program,
    semanticMap: compiled.semanticMap,
    typeModuleReport: compiled.typeModuleReport,
    bytecode,
    decoded,
    native,
    report,
  };
}

export function runTypedAccessPatternDemo(options = {}) {
  const result = compileTypedAccessPattern(options.source ?? DEFAULT_TYPED_ACCESS_SOURCE, {
    typeModuleSources: options.typeModuleSources ?? DEFAULT_TYPED_ACCESS_TYPE_MODULES,
    nativeRuntime: options.nativeRuntime ?? {},
  });
  if (!result.ok) return { ok: false, version: RCL_TYPED_ACCESS_PATTERN_VERSION, diagnostics: result.diagnostics };
  return {
    ok: true,
    version: RCL_TYPED_ACCESS_PATTERN_VERSION,
    program: result.program.name,
    programRoot: result.program.programRoot,
    typeModuleRoot: result.typeModuleReport.irRoot,
    fieldAccessCount: result.report.fieldAccessCount,
    matchCount: result.report.matchCount,
    accessInstructionCount: result.report.accessInstructionCount,
    accessInstructions: result.report.accessInstructions,
    reportRoot: result.report.reportRoot,
    nativeState: result.native.state,
    boundary: 'P3 typed access/pattern slice: record field projection and tagged union matching lower into native bytecode access instructions.',
  };
}

export function compileTypedAccessPatternFromFiles(sourcePath, typePath, options = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const typeModuleSources = readTypeSources(typePath);
  const result = compileTypedAccessPattern(source, { typeModuleSources });
  if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
  const outputDir = options.outputDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-access-pattern-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const bytecodePath = path.join(outputDir, `${path.basename(sourcePath, path.extname(sourcePath))}.rbc`);
  const reportPath = path.join(outputDir, 'typed-access-pattern-report.json');
  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  return {
    ok: true,
    bytecodePath,
    reportPath,
    byteLength: result.bytecode.length,
    programRoot: result.program.programRoot,
    reportRoot: result.report.reportRoot,
    fieldAccessCount: result.report.fieldAccessCount,
    matchCount: result.report.matchCount,
    accessInstructionCount: result.report.accessInstructionCount,
    report: result.report,
  };
}
