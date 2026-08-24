#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRclAndroidApplication } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sdk = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk';
const javaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const gradle = 'C:\\Users\\User\\.gradle\\wrapper\\dists\\gradle-8.10.2-bin\\a04bxjujx95o3nb99gddekhwo\\gradle-8.10.2\\bin\\gradle.bat';
const sourcePath = path.join(ROOT, 'examples/native-ui/device-adaptation.rcl');
const output = path.join(ROOT, 'output/native-ui-device-adaptation/android');
const apk = path.join(output, 'app/build/outputs/apk/debug/app-debug.apk');
const evidencePath = path.join(ROOT, 'examples/native-ui/evidence/device-adaptation-android-build-result.json');

for (const required of [sdk, path.join(javaHome, 'bin/java.exe'), gradle]) {
  if (!fs.existsSync(required)) throw new Error(`RCL_UI_DEVICE_ADAPTATION_ANDROID_TOOL_MISSING:${required}`);
}
function runGradle(args, options = {}) {
  return process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', gradle, ...args], options)
    : spawnSync(gradle, args, options);
}

const build = buildRclAndroidApplication({ rclPath: sourcePath, specPath: null, outputPath: output });
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: javaHome };
const run = runGradle(['--offline', '--no-daemon', 'assembleDebug'], {
  cwd: output, env, encoding: 'utf8', timeout: 180_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
});
if (run.error) throw run.error;
if (run.status !== 0 || !fs.existsSync(apk)) throw new Error(`RCL_UI_DEVICE_ADAPTATION_ANDROID_BUILD_FAILED:${run.status}\n${run.stdout}\n${run.stderr}`);
const java = fs.readFileSync(build.activitySource, 'utf8');
const structuralChecks = {
  selectsScreenWidthDp: java.includes('getConfiguration().screenWidthDp'),
  selectsExpandedProfile: java.includes('"expanded".equals(currentDeviceProfile)'),
  appliesHorizontalOrientation: java.includes('LinearLayout.HORIZONTAL'),
};
if (Object.values(structuralChecks).some((value) => !value)) throw new Error('RCL_UI_DEVICE_ADAPTATION_ANDROID_STRUCTURE');
const runtimeManifest = JSON.parse(fs.readFileSync(path.join(output, 'rcl.android-runtime-manifest.json'), 'utf8'));
const javaVersion = spawnSync(path.join(javaHome, 'bin/java.exe'), ['-version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
const evidence = {
  format: 'rcl.native-ui.device-adaptation-android-build-evidence.v0.1',
  status: 'BUILD_PASS_DEVICE_RUNTIME_UNVERIFIED',
  buildTask: 'assembleDebug',
  offline: true,
  javaVersion: (javaVersion.stderr || javaVersion.stdout).split(/\r?\n/u)[0],
  source: 'examples/native-ui/device-adaptation.rcl',
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
  uiProgramRoot: runtimeManifest.uiProgramRoot,
  apk: 'output/native-ui-device-adaptation/android/app/build/outputs/apk/debug/app-debug.apk',
  apkBytes: fs.statSync(apk).size,
  apkSha256: crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),
  structuralChecks,
  buildSummary: run.stdout.split(/\r?\n/u).filter(Boolean).slice(-8),
  failedEnvironmentAttempt: 'Default Java 25 was rejected by Gradle 8.10.2 with unsupported class major 69; the declared Android Studio JBR 21 environment passed.',
  deviceVerification: 'NOT_RUN_NO_CONNECTED_DEVICE',
  boundary: 'Generated adaptive Android Java and APK build are verified. Installation, resize/configuration behavior, interaction and timing on an Android device remain unverified.',
};
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
