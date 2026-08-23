import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRclAndroidApplication } from '../src/android-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sdk = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk';
const javaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const gradle = 'C:\\Users\\User\\.gradle\\wrapper\\dists\\gradle-8.10.2-bin\\a04bxjujx95o3nb99gddekhwo\\gradle-8.10.2\\bin\\gradle.bat';
const output = path.join(ROOT, 'output/native-ui-genome-v0.1/android');
const apk = path.join(output, 'app/build/outputs/apk/debug/app-debug.apk');
const evidencePath = path.join(ROOT, 'examples/native-ui/evidence/android-build-result.json');
for (const required of [sdk, path.join(javaHome, 'bin/java.exe'), gradle]) if (!fs.existsSync(required)) throw new Error(`RCL_UI_ANDROID_TOOL_MISSING:${required}`);

function runGradle(args, options = {}) {
  if (process.platform !== 'win32') return spawnSync(gradle, args, options);
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', gradle, ...args], options);
}

buildRclAndroidApplication({
  rclPath: path.join(ROOT, 'examples/native-ui/counter.rcl'),
  specPath: path.join(ROOT, 'examples/native-ui/counter.android-target.json'),
  outputPath: output,
});
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: javaHome };
const run = runGradle(['--offline', '--no-daemon', 'assembleDebug'], {
  cwd: output, env, encoding: 'utf8', timeout: 180000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
});
if (run.error) throw run.error;
if (run.status !== 0 || !fs.existsSync(apk)) throw new Error(`RCL_UI_ANDROID_BUILD_FAILED:${run.status}\n${run.stdout}\n${run.stderr}`);
const gradleVersion = runGradle(['--version'], { cwd: output, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
const javaVersion = spawnSync(path.join(javaHome, 'bin/java.exe'), ['-version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
const evidence = {
  format: 'rcl.native-ui.android-build-evidence.v0.1',
  status: 'PASS',
  buildTask: 'assembleDebug',
  offline: true,
  androidPlugin: '8.7.3',
  compileSdk: 35,
  buildTools: '35.0.0',
  gradleVersion: gradleVersion.stdout.match(/Gradle ([^\r\n]+)/u)?.[1] ?? 'UNKNOWN',
  javaVersion: (javaVersion.stderr || javaVersion.stdout).split(/\r?\n/u)[0],
  apk: 'output/native-ui-genome-v0.1/android/app/build/outputs/apk/debug/app-debug.apk',
  apkBytes: fs.statSync(apk).size,
  apkSha256: crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),
  uiProgramRoot: JSON.parse(fs.readFileSync(path.join(output, 'rcl.android-runtime-manifest.json'), 'utf8')).uiProgramRoot,
  buildSummary: run.stdout.split(/\r?\n/u).filter(Boolean).slice(-8),
  deviceVerification: 'NOT_RUN_BY_BUILD_GATE',
};
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
