#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'native-windows-build.json');
const sourcePath = path.join(root, 'native', 'rclvm.c');
const exePath = path.join(root, 'native', 'rclvm.exe');
const daemonPath = path.join(root, 'native', 'rclvmd.exe');
const providerDemoPath = path.join(root, 'native', 'provider_demo.exe');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function candidateZigs() {
  return [
    process.env.ZIG,
    path.join(root, '_tools', 'zig-x86_64-windows-0.16.0', 'zig.exe'),
    path.join(root, '_tools', 'zig', 'zig.exe'),
    'zig',
  ].filter(Boolean);
}

function findZig() {
  for (const candidate of candidateZigs()) {
    const result = spawnSync(candidate, ['version'], { encoding: 'utf8' });
    if (result.status === 0) return { path: candidate, version: result.stdout.trim() };
  }
  return null;
}

const zig = findZig();
if (!zig) {
  const payload = {
    ok: false,
    format: 'rcl.native-windows-build.v1',
    status: 'ZIG_COMPILER_MISSING',
    message: 'Set ZIG to a Zig compiler path or place zig.exe under _tools/zig-x86_64-windows-0.16.0/zig.exe.',
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const env = {
  ...process.env,
  ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(root, '_tools', 'zig-global-cache'),
  ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(root, '_tools', 'zig-local-cache'),
};
const commonArgs = [
  'cc',
  '-target', 'x86_64-windows-gnu',
  '-O2',
  '-std=c11',
  '-Wall',
  '-Wextra',
  '-Wpedantic',
];

const targets = [
  {
    id: 'rclvm',
    path: exePath,
    args: [...commonArgs, '-o', exePath, sourcePath, '-lbcrypt', '-lm'],
  },
  {
    id: 'rclvmd',
    path: daemonPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-o', daemonPath,
      path.join(root, 'native', 'rclvmd.c'),
      sourcePath,
      '-lbcrypt',
      '-lm',
    ],
  },
  {
    id: 'provider_demo',
    path: providerDemoPath,
    args: [
      ...commonArgs,
      '-DRCLVM_EMBEDDED_ONLY',
      '-o', providerDemoPath,
      path.join(root, 'native', 'provider_demo.c'),
      sourcePath,
      '-lbcrypt',
      '-lm',
    ],
  },
];

function runBuild(target) {
  const build = spawnSync(zig.path, target.args, {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    id: target.id,
    command: [zig.path, ...target.args],
    exitCode: build.status,
    stdout: build.stdout.trim(),
    stderr: build.stderr.trim(),
    artifact: fs.existsSync(target.path) ? {
      path: path.relative(root, target.path).replaceAll(path.sep, '/'),
      bytes: fs.statSync(target.path).size,
      sha256: sha256File(target.path),
    } : null,
  };
}

const builds = targets.map(runBuild);

const payload = {
  ok: builds.every(build => build.exitCode === 0 && build.artifact),
  format: 'rcl.native-windows-build.v1',
  zig,
  builds,
  artifact: fs.existsSync(exePath) ? {
    path: path.relative(root, exePath).replaceAll(path.sep, '/'),
    bytes: fs.statSync(exePath).size,
    sha256: sha256File(exePath),
  } : null,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
