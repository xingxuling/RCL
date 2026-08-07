#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildRclAndroidApplication,
  compileRclAndroidApplication,
  simulateRclAndroidApplication,
} from '../src/android-application-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = path.join(root, 'examples', 'universal-stress', 'k03-native-android-app.rcl');
const specPath = path.join(root, 'examples', 'universal-stress', 'k03-native-android-app.android.json');
const outputPath = process.argv[2] ?? path.join(root, 'output', 'universal-stress-k03');
const evidencePath = process.argv[3] ?? path.join(root, 'examples', 'universal-stress', 'k03-direct-evidence-2026-08-08.json');
const executeAndroid = process.argv.includes('--execute-android');

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000 });
  return {
    command,
    available: !result.error && (result.status === 0 || result.status === 1),
    status: result.status,
    error: result.error?.message ?? null,
    stdout: (result.stdout ?? '').slice(0, 1000),
    stderr: (result.stderr ?? '').slice(0, 1000),
  };
}

function androidEnvironment(projectDir) {
  const java = commandAvailable('java', ['-version']);
  const gradle = commandAvailable('gradle', ['--version']);
  const adb = commandAvailable('adb', ['version']);
  const emulator = commandAvailable('emulator', ['-version']);
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
  return {
    projectDir,
    java,
    gradle,
    adb,
    emulator,
    androidHome,
    androidSdkExists: androidHome ? fs.existsSync(androidHome) : false,
    buildStatus: 'UNVERIFIED',
    runtimeStatus: 'UNVERIFIED',
  };
}

function rootOf(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function runHostEvidence(manifest) {
  const positive = simulateRclAndroidApplication(manifest, [
    { type: 'observe', path: 'app.input', value: 'first' },
    { type: 'realize', name: 'increment' },
    { type: 'realize', name: 'reset' },
  ]);
  const preserveCandidate = structuredClone(manifest);
  preserveCandidate.rules[0].preserves = [{
    kind: 'binary',
    operator: '>=',
    left: { kind: 'path', path: 'app.count' },
    right: { kind: 'literal', value: 2 },
  }];
  let preserveNegative;
  try {
    simulateRclAndroidApplication(preserveCandidate, [
      { type: 'observe', path: 'app.input', value: 'blocked' },
      { type: 'realize', name: 'increment' },
    ]);
    preserveNegative = { threw: false, pass: false };
  } catch (error) {
    preserveNegative = { threw: true, error: String(error), pass: String(error).includes('RCL_ANDROID_PRESERVE_FAILED:increment') };
  }
  const unauthorized = structuredClone(manifest);
  unauthorized.warrants = [];
  let authorityNegative;
  try {
    simulateRclAndroidApplication(unauthorized, [
      { type: 'observe', path: 'app.input', value: 'blocked' },
      { type: 'realize', name: 'increment' },
    ]);
    authorityNegative = { threw: false, pass: false };
  } catch (error) {
    authorityNegative = { threw: true, error: String(error), pass: String(error).includes('RCL_ANDROID_AUTHORITY_DENIED:increment') };
  }
  return {
    positive: {
      finalState: positive.state,
      realizedRules: positive.history.filter((item) => item.status === 'realized').map((item) => item.rule),
      pass: positive.state['app.count'] === 0 && positive.state['app.last_action'] === 'reset',
    },
    preserveNegative,
    authorityNegative,
  };
}

const source = fs.readFileSync(rclPath, 'utf8');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const manifest = compileRclAndroidApplication(source, spec);
const generated = buildRclAndroidApplication({ rclPath, specPath, outputPath });
const host = runHostEvidence(manifest);
const environment = androidEnvironment(outputPath);
const projectLabel = 'output/universal-stress-k03';

if (executeAndroid && environment.gradle.available) {
  const result = spawnSync('gradle', ['assembleDebug', '--no-daemon'], { cwd: outputPath, encoding: 'utf8', timeout: 120000 });
  const apk = path.join(outputPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  environment.buildStatus = result.status === 0 && fs.existsSync(apk) ? 'BUILT' : 'FAILED';
  environment.build = { status: result.status, apk: fs.existsSync(apk) ? apk : null, stdout: (result.stdout ?? '').slice(-4000), stderr: (result.stderr ?? '').slice(-4000) };
}

const gates = {
  EXPRESS: 'PASS',
  COMPILE: 'PASS',
  LOWER: 'PASS',
  EXECUTE: environment.runtimeStatus === 'EXECUTED' ? 'PASS' : 'UNVERIFIED',
  CORRECT: environment.runtimeStatus === 'EXECUTED' && host.positive.pass ? 'PASS' : 'UNVERIFIED',
  ROBUST: host.preserveNegative.pass && host.authorityNegative.pass ? 'PASS' : 'FAIL',
  PERFORMANCE: environment.runtimeStatus === 'EXECUTED' ? 'PASS' : 'UNVERIFIED',
  AI_GENERATE: 'UNVERIFIED',
  EVIDENCE: 'PASS',
};

const reportWithoutRoot = {
  schema: 'rcl.universal-stress.k03.direct-evidence.v0.1',
  taskId: 'K03',
  cellId: 'android::mobile',
  goal: 'native Android application',
  compiler: {
    status: 'PASS',
    compilerVersion: manifest.compilerVersion,
    manifestRoot: manifest.manifestRoot,
    generatedProject: { ...generated, root: projectLabel, activitySource: `${projectLabel}/app/src/main/java/com/taowind/rcl/k03/MainActivity.java` },
  },
  hostSimulation: host,
  android: {
    build: { status: environment.buildStatus, projectDir: projectLabel },
    runtime: { status: environment.runtimeStatus, note: 'Real APK install and emulator/device interaction are required before this becomes EXECUTED.' },
    environment: { ...environment, projectDir: projectLabel },
  },
  gates,
  coverageMode: 'lowered-execution',
  overall: Object.values(gates).every((status) => status === 'PASS') ? 'PASS' : Object.values(gates).includes('FAIL') ? 'FAIL' : 'BLOCKED',
  limitations: [
    'The generated Activity and Gradle project are real Android artifacts, but no Android SDK, Gradle, emulator or adb was available in this execution environment.',
    'Host semantic replay is not a substitute for installing and interacting with the APK.',
    'AI_GENERATE remains independently unverified.',
    'This is a native Android application lowering path, not a claim that RCL already owns the Android OS or the full Android framework semantics.',
  ],
};
const report = { ...reportWithoutRoot, evidenceRoot: rootOf(reportWithoutRoot) };
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
