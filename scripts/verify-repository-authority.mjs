import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
const checks = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    failures.push(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function assert(name, condition, details) {
  checks.push({ name, ok: Boolean(condition), details });
  if (!condition) failures.push(`${name}: ${details}`);
}

function hasScript(pkg, name) {
  return typeof pkg?.scripts?.[name] === 'string' && pkg.scripts[name].trim().length > 0;
}

const pkg = readJson('package.json');
const contract = readJson('VERSION-CONTRACT.json');
const status = readText('CURRENT-STATUS.md');
const canonicalWorkflow = readText('.github/workflows/rcl-canonical-verification.yml');
const authorityWorkflow = readText('.github/workflows/rcl-authority-contract.yml');
const codeowners = readText('.github/CODEOWNERS');
const pullRequestTemplate = readText('.github/pull_request_template.md');

assert('canonical repository', contract?.repository === 'xingxuling/RCL', `expected xingxuling/RCL, received ${contract?.repository}`);
assert('canonical branch', contract?.canonicalBranch === 'main', `expected main, received ${contract?.canonicalBranch}`);
assert('canonical flag', contract?.canonical === true, 'VERSION-CONTRACT.json must declare canonical=true');
assert('package identity', contract?.package === pkg?.name, `contract=${contract?.package}; package=${pkg?.name}`);
assert('package version', contract?.packageVersion === pkg?.version, `contract=${contract?.packageVersion}; package=${pkg?.version}`);
assert('status version', status.includes(`# Current RCL Status: v${pkg?.version}`), 'CURRENT-STATUS.md heading must match package.json version');

assert('native-core claim', contract?.claims?.nativeCoreSelfHosting === true, 'nativeCoreSelfHosting must remain explicitly true at the verified ceiling');
assert('whole-language boundary', contract?.claims?.wholeLanguageRuntimeSelfHosting === false, 'wholeLanguageRuntimeSelfHosting must remain false until separately proved');
assert('full self-hosting boundary', contract?.boundary?.fullSelfHosting === false, 'boundary.fullSelfHosting must remain false until separately proved');
assert('complete runtime boundary', contract?.boundary?.completeRuntime === false, 'boundary.completeRuntime must remain false until separately proved');
assert('reference runtime boundary', contract?.boundary?.jsReferenceRuntimeStillRequired === true, 'JS reference-runtime dependency must stay explicit');
assert('bridge syntax boundary', contract?.boundary?.declaredFoundationSyntaxNative === false, 'provider bridge must not be relabeled as native syntax');
assert('CI evidence required', contract?.evidence?.ciRequired === true, 'evidence.ciRequired must be true');

for (const script of [
  'verify:version-contract',
  'verify:selfhost-stage40',
  'verify:native-boundary',
  'verify:selfhost-examples',
  'test:foundation-native-batch-a',
  'test:foundation-native-meta-batch-b',
  'test:foundation-native-batch-c',
  'test:foundation-native-batch-d',
  'test:foundation-native-batch-e',
  'conformance:foundation',
  'test',
]) {
  assert(`package script ${script}`, hasScript(pkg, script), `package.json is missing scripts.${script}`);
}

for (const token of ['push:', 'pull_request:', 'branches: [main]', 'npm run verify:version-contract', 'npm test']) {
  assert(`canonical workflow token ${token}`, canonicalWorkflow.includes(token), `.github/workflows/rcl-canonical-verification.yml is missing ${token}`);
}

for (const token of ['name: RCL Authority Contract', 'pull_request:', 'branches: [main]', 'node scripts/verify-repository-authority.mjs']) {
  assert(`authority workflow token ${token}`, authorityWorkflow.includes(token), `.github/workflows/rcl-authority-contract.yml is missing ${token}`);
}

for (const token of ['* @xingxuling', '/VERSION-CONTRACT.json @xingxuling', '/native/ @xingxuling', '/.github/ @xingxuling']) {
  assert(`CODEOWNERS token ${token}`, codeowners.includes(token), `.github/CODEOWNERS is missing ${token}`);
}

for (const token of ['RCL Reality Transaction', 'RCL canonical verification', 'RCL Authority Contract', 'Declared limitations']) {
  assert(`PR template token ${token}`, pullRequestTemplate.includes(token), `.github/pull_request_template.md is missing ${token}`);
}

const report = {
  format: 'rcl.repository-authority-report.v1',
  repository: contract?.repository ?? null,
  canonicalBranch: contract?.canonicalBranch ?? null,
  package: pkg?.name ?? null,
  packageVersion: pkg?.version ?? null,
  ok: failures.length === 0,
  checks,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
