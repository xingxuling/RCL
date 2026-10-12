import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WASI } from 'node:wasi';

const [modulePath, bytecodePath] = process.argv.slice(2);
if (!modulePath || !bytecodePath) throw new Error('Usage: run-native-wasi <rclvm.wasm> <program.rbc>');
const directory = path.dirname(path.resolve(bytecodePath));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-wasi-'));
const wasi = new WASI({ version: 'preview1', args: ['rclvm', '/work/' + path.basename(bytecodePath)],
  env: { RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'rcl.semantic-state-root.v2', TMPDIR: '/work' },
  preopens: { '/work': directory, '/tmp': temporary }, returnOnExit: true });
try {
  const wasm = await WebAssembly.compile(fs.readFileSync(path.resolve(modulePath)));
  const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject());
  process.exitCode = wasi.start(instance);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
