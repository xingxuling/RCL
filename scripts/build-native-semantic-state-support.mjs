#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const header = fs.readFileSync(path.join(root, 'native', 'semantic_state_v2.h'), 'utf8');
const target = path.join(root, 'src', 'generated', 'native-semantic-state-v2-support.mjs');
const source = '// Generated from native/semantic_state_v2.h. Rebuild with scripts/build-native-semantic-state-support.mjs.\nexport const RCL_NATIVE_VM_CANONICAL_SEMANTIC_V2_HEADER = ' + JSON.stringify(header) + ';\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== source) throw new Error('RCL_NATIVE_SEMANTIC_V2_BUILD_SUPPORT_DRIFT');
} else fs.writeFileSync(target, source);
