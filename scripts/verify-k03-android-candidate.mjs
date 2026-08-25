#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRclAndroidApplication, emitNativeAndroidActivity, simulateRclAndroidApplication } from '../src/android-application-compiler.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function check(checks, name, condition) {
  checks[name] = { pass: Boolean(condition) };
}

export function verifyK03AndroidCandidate({ sourcePath, specPath }) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const specSource = fs.readFileSync(specPath, 'utf8');
  const checks = {};
  let error = null;
  let manifestRoot = null;
  try {
    const manifest = compileRclAndroidApplication(source, JSON.parse(specSource));
    const java = emitNativeAndroidActivity(manifest);
    manifestRoot = manifest.manifestRoot;
    const input = manifest.screen.children.find((node) => node.id === 'input');
    check(checks, 'program-identity', manifest.program === 'K03NativeAndroidApp');
    check(checks, 'authority-binding', manifest.warrants.some((warrant) => warrant.subject === 'user' && warrant.capability === 'app.write' && warrant.target === 'app'));
    check(checks, 'reactive-input-binding', input?.valueState === 'app.input' && input?.observeState === 'app.input');
    check(checks, 'lifecycle-contract', manifest.lifecycle.restoreState === true && /restoreState\(savedState\);/u.test(java) && /onSaveInstanceState/u.test(java));
    check(checks, 'native-transaction-lowering', /realize_increment/u.test(java) && /requireAuthority\("increment"/u.test(java));
    check(checks, 'integer-number-lowering', /if \(Math\.rint\(result\) == result\) return Long\.valueOf/u.test(java) && !/\? Long\.valueOf\(\(long\) result\) : Double\.valueOf/u.test(java));
    const increment = simulateRclAndroidApplication(manifest, [
      { type: 'observe', path: 'app.input', value: 'candidate' },
      { type: 'realize', name: 'increment' },
    ]);
    check(checks, 'increment-transaction', increment.state['app.count'] === 1 && increment.state['app.last_action'] === 'candidate' && increment.state['app.input'] === '');
    const reset = simulateRclAndroidApplication(manifest, [
      { type: 'observe', path: 'app.input', value: 'candidate' },
      { type: 'realize', name: 'increment' },
      { type: 'realize', name: 'reset' },
    ]);
    check(checks, 'reset-transaction', reset.state['app.count'] === 0 && reset.state['app.last_action'] === 'reset');
  } catch (caught) {
    error = String(caught?.stack ?? caught);
  }
  const pass = error === null && Object.values(checks).length === 8 && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k03.android-candidate-verification.v0.1',
    status: pass ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    specSha256: sha256(specSource),
    manifestRoot,
    checks,
    error,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK03AndroidCandidate({
    sourcePath: path.resolve(process.argv[2] ?? path.join(ROOT, 'examples', 'universal-stress', 'k03-native-android-app.rcl')),
    specPath: path.resolve(process.argv[3] ?? path.join(ROOT, 'examples', 'universal-stress', 'k03-native-android-app.android.json')),
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}
