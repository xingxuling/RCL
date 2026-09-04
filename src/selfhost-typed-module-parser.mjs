import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_TYPED_MODULE_PARSER_PATH = path.join(ROOT, 'selfhost', 'typed-module-parser.rcl');
export const SELFHOST_TYPED_MODULE_PARSER_FORMAT = 'rcl.selfhost.typed-module-parser.v0.1';
const SOURCE_MARKER = 'facet typed.source : Text = ""';

function readTemplate() {
  const template = fs.readFileSync(SELFHOST_TYPED_MODULE_PARSER_PATH, 'utf8');
  if (!template.includes(SOURCE_MARKER)) throw new Error('RCL_SELFHOST_TYPED_MODULE_SOURCE_MARKER_MISSING');
  return template;
}

export function renderSelfHostedTypedModuleParser(source) {
  if (typeof source !== 'string') throw new TypeError('typed module source must be a string');
  return readTemplate().replace(SOURCE_MARKER, `facet typed.source : Text = ${JSON.stringify(source)}`);
}

export function parseTypedModuleSourceSelfHosted(source, options = {}) {
  const parserSource = renderSelfHostedTypedModuleParser(source);
  const bytecode = compileRealityToBytecode(parserSource);
  const native = runNativeBytecode(Buffer.from(bytecode), {
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    vmPath: options.vmPath,
    requireNativeStateRoot: options.requireNativeStateRoot,
  });
  const program = native.state['typed.program'];
  if (!Array.isArray(program) || program.length !== 3) throw new Error('RCL_SELFHOST_TYPED_MODULE_PROGRAM_INVALID');
  return Object.freeze({
    format: SELFHOST_TYPED_MODULE_PARSER_FORMAT,
    module: program[0],
    imports: Object.freeze([...(program[1] ?? [])]),
    declarations: Object.freeze([...(program[2] ?? [])]),
    canonical: native.state['typed.canonical'],
    root: native.state['typed.root'],
    tokenCount: native.state['typed.tokens']?.length ?? 0,
    native: Object.freeze({
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    }),
    boundary: 'RCL_SELFHOST_RAW_RCLTYPE_PARSER_CANDIDATE; JS_LINKER_AND_GENERIC_TYPED_LOWERING_REMAIN_EXTERNAL',
  });
}
