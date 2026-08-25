#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { buildRclAndroidApplication } from '../src/android-application-compiler.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUTPUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'k03-android-emulator-v0.1'));
const EVIDENCE_PATH = path.resolve(process.argv[3] ?? path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k03-android-emulator-v0.1.json'));
const PACKAGE = 'com.taowind.rcl.k03';
const ACTIVITY = `${PACKAGE}/.MainActivity`;
const PERFORMANCE_BUDGET_MS = 5_000;
const STARTUP_BUDGET_MS = 5_000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: options.timeout ?? 60_000,
    maxBuffer: 32 * 1024 * 1024,
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`RCL_K03_COMMAND_FAILED:${path.basename(command)}:${args.join(' ')}:${result.error?.message ?? result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return String(result.stdout ?? '');
}

function findGradle() {
  if (process.env.GRADLE_BIN && fs.existsSync(process.env.GRADLE_BIN)) return process.env.GRADLE_BIN;
  const dists = path.join(os.homedir(), '.gradle', 'wrapper', 'dists', 'gradle-8.10.2-bin');
  if (!fs.existsSync(dists)) throw new Error('RCL_K03_GRADLE_DISTRIBUTION_MISSING');
  for (const id of fs.readdirSync(dists)) {
    const candidate = path.join(dists, id, 'gradle-8.10.2', 'bin', process.platform === 'win32' ? 'gradle.bat' : 'gradle');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('RCL_K03_GRADLE_BINARY_MISSING');
}

function adb(adbPath, serial, args, options = {}) {
  return run(adbPath, ['-s', serial, ...args], options);
}

function decodeXml(value) {
  return value.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}

function nodesFromXml(xml) {
  return [...xml.matchAll(/<node\b([^>]*)\/>/gu)].map((match) => {
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/gu)].map((item) => [item[1], decodeXml(item[2])]));
    const bounds = attrs.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/u)?.slice(1).map(Number) ?? null;
    return { ...attrs, bounds };
  });
}

function dumpUi(adbPath, serial, label) {
  const devicePath = `/sdcard/rcl-k03-${label}.xml`;
  adb(adbPath, serial, ['shell', 'uiautomator', 'dump', devicePath], { timeout: 30_000 });
  return adb(adbPath, serial, ['exec-out', 'cat', devicePath]);
}

function findNode(nodes, text) {
  const node = nodes.find((candidate) => candidate.text === text);
  if (!node?.bounds) throw new Error(`RCL_K03_UI_NODE_MISSING:${text}`);
  return node;
}

function tapNode(adbPath, serial, node) {
  const [left, top, right, bottom] = node.bounds;
  adb(adbPath, serial, ['shell', 'input', 'tap', String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2))]);
}

function assertTexts(nodes, expected, code) {
  const texts = new Set(nodes.map((node) => node.text));
  for (const text of expected) if (!texts.has(text)) throw new Error(`${code}:${text}`);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adbPath = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const javaHome = process.env.JAVA_HOME || (process.platform === 'win32' ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : '');
const gradle = findGradle();
for (const required of [sdk, adbPath, path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), gradle]) {
  if (!fs.existsSync(required)) throw new Error(`RCL_K03_TOOL_MISSING:${required}`);
}

const devices = run(adbPath, ['devices']).split(/\r?\n/u).slice(1).map((line) => line.trim().split(/\s+/u)).filter((parts) => parts[1] === 'device');
const serial = process.env.ANDROID_SERIAL || devices.find(([id]) => id.startsWith('emulator-'))?.[0];
if (!serial) throw new Error('RCL_K03_EMULATOR_DEVICE_MISSING');

const generated = buildRclAndroidApplication({
  rclPath: path.join(ROOT, 'examples', 'universal-stress', 'k03-native-android-app.rcl'),
  specPath: path.join(ROOT, 'examples', 'universal-stress', 'k03-native-android-app.android.json'),
  outputPath: OUTPUT,
});
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: javaHome };
const gradleCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : gradle;
const gradleArgs = process.platform === 'win32' ? ['/d', '/s', '/c', gradle, '--offline', '--no-daemon', 'assembleDebug'] : ['--offline', '--no-daemon', 'assembleDebug'];
const buildOutput = run(gradleCommand, gradleArgs, { cwd: OUTPUT, env, timeout: 180_000 });
const apkPath = path.join(OUTPUT, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(apkPath)) throw new Error('RCL_K03_APK_MISSING');

adb(adbPath, serial, ['install', '-r', apkPath], { timeout: 120_000 });
adb(adbPath, serial, ['shell', 'pm', 'clear', PACKAGE]);
const launch = adb(adbPath, serial, ['shell', 'am', 'start', '-W', '-n', ACTIVITY]);
const startupTotalMs = Number(launch.match(/TotalTime:\s*(\d+)/u)?.[1] ?? Number.NaN);
let nodes = nodesFromXml(dumpUi(adbPath, serial, 'initial'));
assertTexts(nodes, ['RCL K03 原生 Android 应用', '计数：0', '输入一次动作名称', '提交事务', '重置', '最近动作：boot'], 'RCL_K03_INITIAL_UI_MISMATCH');

tapNode(adbPath, serial, findNode(nodes, '提交事务'));
nodes = nodesFromXml(dumpUi(adbPath, serial, 'guard'));
assertTexts(nodes, ['计数：0', '最近动作：boot'], 'RCL_K03_EMPTY_INPUT_GUARD_FAILED');

const interactionMs = [];
const rounds = [];
for (let index = 0; index < 5; index += 1) {
  const token = `trial${index}`;
  tapNode(adbPath, serial, findNode(nodes, '输入一次动作名称'));
  adb(adbPath, serial, ['shell', 'input', 'text', token]);
  const started = performance.now();
  tapNode(adbPath, serial, findNode(nodes, '提交事务'));
  nodes = nodesFromXml(dumpUi(adbPath, serial, `increment-${index}`));
  const elapsedMs = performance.now() - started;
  assertTexts(nodes, ['计数：1', `最近动作：${token}`, '输入一次动作名称'], 'RCL_K03_INCREMENT_UI_MISMATCH');
  interactionMs.push(elapsedMs);
  tapNode(adbPath, serial, findNode(nodes, '重置'));
  nodes = nodesFromXml(dumpUi(adbPath, serial, `reset-${index}`));
  assertTexts(nodes, ['计数：0', '最近动作：reset'], 'RCL_K03_RESET_UI_MISMATCH');
  rounds.push({ token, incrementObservedMs: elapsedMs, incrementPass: true, resetPass: true });
}

tapNode(adbPath, serial, findNode(nodes, '输入一次动作名称'));
adb(adbPath, serial, ['shell', 'input', 'text', 'rotate']);
tapNode(adbPath, serial, findNode(nodes, '提交事务'));
nodes = nodesFromXml(dumpUi(adbPath, serial, 'before-rotation'));
assertTexts(nodes, ['计数：1', '最近动作：rotate'], 'RCL_K03_PRE_ROTATION_MISMATCH');
const rotationBefore = adb(adbPath, serial, ['shell', 'settings', 'get', 'system', 'user_rotation']).trim();
const accelerometerBefore = adb(adbPath, serial, ['shell', 'settings', 'get', 'system', 'accelerometer_rotation']).trim();
let lifecyclePass = false;
try {
  adb(adbPath, serial, ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0']);
  adb(adbPath, serial, ['shell', 'settings', 'put', 'system', 'user_rotation', rotationBefore === '1' ? '0' : '1']);
  nodes = nodesFromXml(dumpUi(adbPath, serial, 'after-rotation'));
  assertTexts(nodes, ['计数：1', '最近动作：rotate'], 'RCL_K03_LIFECYCLE_RESTORE_FAILED');
  lifecyclePass = true;
} finally {
  adb(adbPath, serial, ['shell', 'settings', 'put', 'system', 'user_rotation', rotationBefore || '0']);
  adb(adbPath, serial, ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', accelerometerBefore || '1']);
}

const p50Ms = percentile(interactionMs, 0.5);
const p95Ms = percentile(interactionMs, 0.95);
const performancePass = p95Ms <= PERFORMANCE_BUDGET_MS && startupTotalMs <= STARTUP_BUDGET_MS;
const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'rcl.android-runtime-manifest.json'), 'utf8'));
const payload = {
  format: 'rcl.k03.android-emulator-evidence.v0.1',
  status: performancePass && lifecyclePass ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
  source: {
    rclPath: 'examples/universal-stress/k03-native-android-app.rcl',
    specPath: 'examples/universal-stress/k03-native-android-app.android.json',
    manifestRoot: generated.manifestRoot,
    runtimeManifestRoot: manifest.manifestRoot,
  },
  build: {
    status: 'PASS',
    task: 'assembleDebug',
    offline: true,
    summary: buildOutput.split(/\r?\n/u).filter(Boolean).slice(-8),
    apkBytes: fs.statSync(apkPath).size,
    apkSha256: sha256(fs.readFileSync(apkPath)),
  },
  device: {
    serial,
    avdName: adb(adbPath, serial, ['shell', 'getprop', 'ro.boot.qemu.avd_name']).trim(),
    apiLevel: Number(adb(adbPath, serial, ['shell', 'getprop', 'ro.build.version.sdk']).trim()),
    abi: adb(adbPath, serial, ['shell', 'getprop', 'ro.product.cpu.abi']).trim(),
    model: adb(adbPath, serial, ['shell', 'getprop', 'ro.product.model']).trim(),
  },
  runtime: {
    install: 'PASS',
    coldLaunch: 'PASS',
    startupTotalMs,
    initialState: 'PASS',
    emptyInputGuard: 'PASS',
    transactionRounds: rounds,
    lifecycleRestoreAfterRotation: lifecyclePass ? 'PASS' : 'FAIL',
  },
  performance: {
    profile: 'ADB_UIAUTOMATOR_END_TO_END_OBSERVATION',
    samples: interactionMs,
    p50Ms,
    p95Ms,
    interactionBudgetMs: PERFORMANCE_BUDGET_MS,
    startupBudgetMs: STARTUP_BUDGET_MS,
    status: performancePass ? 'PASS' : 'FAIL',
  },
  gates: {
    EXECUTE: 'PASS',
    CORRECT: lifecyclePass ? 'PASS' : 'FAIL',
    PERFORMANCE: performancePass ? 'PASS' : 'FAIL',
  },
  evidenceBoundary: 'This is real Android emulator evidence for the frozen K03 transaction UI on one local AVD. It is not physical-device, production-fleet, frame-rendering, arbitrary Android-app AI generation or K400 completion evidence.',
};
const report = { ...payload, reportRoot: evidenceRoot({ ...payload, generatedAt: undefined }) };
fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, reportRoot: report.reportRoot, device: report.device, performance: report.performance, evidencePath: EVIDENCE_PATH }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
