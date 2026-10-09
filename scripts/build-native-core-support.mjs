#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(directory, 'src/native-vm-canonical-build-support.mjs');
const current = fs.readFileSync(target, 'utf8');
let generated = current;
for (const [name, file] of [['MAKEFILE', 'native/Makefile'], ['HEADER', 'native/rclvm.h']]) {
  const symbol = 'RCL_NATIVE_VM_CANONICAL_' + name;
  const pattern = new RegExp('export const ' + symbol + ' = (?:`[\\s\\S]*?`|"(?:[^"\\\\]|\\\\.)*");', 'u');
  if (!pattern.test(generated)) throw new Error('RCL_NATIVE_CORE_SUPPORT_SYMBOL_MISSING:' + symbol);
  generated = generated.replace(pattern, () => 'export const ' + symbol + ' = ' + JSON.stringify(fs.readFileSync(path.join(directory, file), 'utf8')) + ';');
}
if (process.argv.includes('--check')) {
  if (generated !== current) throw new Error('RCL_NATIVE_CORE_BUILD_SUPPORT_DRIFT');
} else fs.writeFileSync(target, generated);
