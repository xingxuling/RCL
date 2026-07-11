#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

if (process.platform === 'win32') {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-native-windows.mjs')], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  process.exit(run.status ?? 1);
}

const run = spawnSync('make', ['-C', path.join(root, 'native'), 'all'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (run.error) {
  console.error(JSON.stringify({
    ok: false,
    status: 'NATIVE_BUILD_TOOL_MISSING',
    message: run.error.message,
  }, null, 2));
}
process.exit(run.status ?? 1);
