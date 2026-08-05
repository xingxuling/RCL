import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function sourceMatch(source, expression, label, errors) {
  const match = source.match(expression);
  if (!match) errors.push(`cannot resolve ${label} from source`);
  return match?.[1] ?? null;
}

function repositoryUrl(packageJson) {
  return typeof packageJson.repository === 'string' ? packageJson.repository : packageJson.repository?.url;
}

const errors = [];
const packageJson = await readJson('package.json');
const contractJson = await readJson('VERSION-CONTRACT.json');
const componentContract = await readJson('COMPONENT-VERSIONS.json');
const downstreamContract = await readJson('DOWNSTREAM-CONSUMERS.json');
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const nativeSource = await readFile(path.join(root, 'native', 'rclvm.c'), 'utf8');
const typedReferenceSource = await readFile(path.join(root, 'src', 'typed-reference-abi.mjs'), 'utf8');
const semanticRootSource = await readFile(path.join(root, 'src', 'semantic-state-root.mjs'), 'utf8');

if (packageJson.name !== contractJson.package) {
  errors.push(`package name ${packageJson.name} does not match VERSION-CONTRACT.json`);
}
if (packageJson.version !== contractJson.packageVersion) {
  errors.push(`package version ${packageJson.version} does not match VERSION-CONTRACT.json`);
}
if (contractJson.repository !== 'xingxuling/RCL' || contractJson.canonicalBranch !== 'main' || contractJson.canonical !== true) {
  errors.push('RCL is not declared as the canonical main-branch source');
}
if (!readme.includes('# RCL v0.94.0-alpha.1') || !readme.includes('Canonical source: `xingxuling/RCL@main`')) {
  errors.push('README does not expose the current version and canonical-source declaration');
}

const expectedDescription = 'RCL (Reality Compiler Language): an evidence-bearing, permission-constrained reality transaction language, compiler, native VM, provider runtime, and verification toolchain.';
if (packageJson.description !== expectedDescription) {
  errors.push('package description must describe the canonical RCL system rather than one feature release');
}
if (repositoryUrl(packageJson) !== 'git+https://github.com/xingxuling/RCL.git') {
  errors.push('package repository URL is not canonical');
}
if (packageJson.homepage !== 'https://github.com/xingxuling/RCL#readme') {
  errors.push('package homepage is missing or non-canonical');
}
if (packageJson.bugs?.url !== 'https://github.com/xingxuling/RCL/issues') {
  errors.push('package issue tracker is missing or non-canonical');
}
if (packageJson.engines?.node !== '>=20') {
  errors.push('package Node engine boundary must remain >=20');
}

for (const command of contractJson.verificationCommands ?? []) {
  if (command === 'npm run verify:version-contract') continue;
  if (command.startsWith('npm run ')) {
    const scriptName = command.slice('npm run '.length);
    if (!packageJson.scripts?.[scriptName]) errors.push(`missing npm script: ${scriptName}`);
  }
}

const ceiling = contractJson.verifiedCeiling ?? {};
if (ceiling.stage !== 'stage40_rcl_owned_dual_need_warrant_lowering_subset') {
  errors.push('verified ceiling is not the explicit Stage40 dual-need subset');
}
if (ceiling.targetSourceRoot !== '71e899db3794f862101f898dbf0549a534db488f4320f30d07585d523a25ce14') {
  errors.push('Stage40 target source root does not match the verified fixture');
}
if (ceiling.targetRbcSha256 !== '4dbfe7408fb24484065b06e7b2d5b421cd2f6773bef28e29cfacd393c724e318') {
  errors.push('Stage40 target RBC hash does not match the verified fixture');
}
if (ceiling.staticInstructions !== 407 || ceiling.executedInstructions !== 367 || ceiling.checkWarrantOperations !== 20) {
  errors.push('Stage40 instruction metrics do not match the verified fixture');
}

if (contractJson.componentVersionContract !== 'COMPONENT-VERSIONS.json') {
  errors.push('VERSION-CONTRACT.json does not bind COMPONENT-VERSIONS.json');
}
if (contractJson.downstreamConsumerContract !== 'DOWNSTREAM-CONSUMERS.json') {
  errors.push('VERSION-CONTRACT.json does not bind DOWNSTREAM-CONSUMERS.json');
}
if (componentContract.format !== 'rcl.component-version-contract.v1') {
  errors.push('component version contract format is invalid');
}
if (componentContract.package?.name !== packageJson.name || componentContract.package?.version !== packageJson.version) {
  errors.push('component contract package identity does not match package.json');
}
if (componentContract.policy?.componentVersionsAreIndependent !== true || componentContract.policy?.packageVersionEqualityRequired !== false) {
  errors.push('component-version independence policy is not explicit');
}

const nativeVmVersion = sourceMatch(nativeSource, /#define\s+RCL_VM_VERSION\s+"([^"]+)"/, 'RCL_VM_VERSION', errors);
const typedReferenceVersion = sourceMatch(typedReferenceSource, /RCL_TYPED_REFERENCE_ABI_VERSION\s*=\s*'([^']+)'/, 'RCL_TYPED_REFERENCE_ABI_VERSION', errors);
const typedReferenceFormat = sourceMatch(typedReferenceSource, /RCL_TYPED_REFERENCE_ABI_FORMAT\s*=\s*'([^']+)'/, 'RCL_TYPED_REFERENCE_ABI_FORMAT', errors);
const semanticRootAlgorithm = sourceMatch(semanticRootSource, /RCL_NATIVE_STATE_ROOT_ALGORITHM\s*=\s*'([^']+)'/, 'RCL_NATIVE_STATE_ROOT_ALGORITHM', errors);

if (componentContract.components?.nativeVm?.version !== nativeVmVersion) {
  errors.push(`native VM component contract drift: contract=${componentContract.components?.nativeVm?.version}; source=${nativeVmVersion}`);
}
if (componentContract.components?.typedReferenceAbi?.version !== typedReferenceVersion
    || componentContract.components?.typedReferenceAbi?.format !== typedReferenceFormat) {
  errors.push('typed-reference ABI component contract drift');
}
if (componentContract.components?.semanticStateRoot?.algorithm !== semanticRootAlgorithm
    || contractJson.claims?.nativeSemanticAuthorityRoot?.algorithm !== semanticRootAlgorithm
    || !nativeSource.includes(semanticRootAlgorithm ?? '__missing__')) {
  errors.push('semantic state-root algorithm is not aligned across source and contracts');
}

if (downstreamContract.format !== 'rcl.downstream-consumer-contract.v1') {
  errors.push('downstream consumer contract format is invalid');
}
if (downstreamContract.canonical?.repository !== contractJson.repository || downstreamContract.canonical?.branch !== contractJson.canonicalBranch) {
  errors.push('downstream contract canonical source does not match VERSION-CONTRACT.json');
}
if (downstreamContract.policy?.implicitByteIdentityForbidden !== true
    || downstreamContract.policy?.consumerDriftMustBeExplicit !== true
    || downstreamContract.policy?.nativeArtifactsRequireIndependentRebuildEvidence !== true) {
  errors.push('downstream authority policy is incomplete');
}

const consumers = Array.isArray(downstreamContract.consumers) ? downstreamContract.consumers : [];
const copies = Array.isArray(contractJson.downstreamCopies) ? contractJson.downstreamCopies : [];
if (consumers.length !== copies.length) errors.push('downstream consumer count does not match VERSION-CONTRACT.json');
for (const copy of copies) {
  const consumer = consumers.find(item => item.repository === copy.repository && item.path === copy.path);
  if (!consumer) {
    errors.push(`missing downstream contract for ${copy.repository}:${copy.path}`);
    continue;
  }
  if (consumer.relation !== copy.relation) errors.push(`downstream relation drift for ${copy.repository}`);
  if (consumer.byteIdentityAllowed !== false) errors.push(`implicit byte identity is not forbidden for ${copy.repository}`);
  if (typeof consumer.status !== 'string' || consumer.status.length === 0) errors.push(`downstream status is missing for ${copy.repository}`);
  if (consumer.syncRequired !== true) errors.push(`downstream synchronization gate is not active for ${copy.repository}`);
  if (typeof consumer.contractPath !== 'string' || consumer.contractPath.length === 0) errors.push(`downstream contract path is missing for ${copy.repository}`);
}
const zhinao = consumers.find(item => item.repository === 'xingxuling/zhinao');
if (zhinao?.status !== 'stale' || zhinao?.observedCeiling !== 'stage39') {
  errors.push('Zhinao vendor drift is not explicitly recorded');
}
const rncs = consumers.find(item => item.repository === 'xingxuling/RNCS-Unified-Platform-');
if (rncs?.status !== 'contract-missing') {
  errors.push('RNCS upstream provenance debt is not explicitly recorded');
}

for (const relativePath of [
  'package-lock.json',
  'native/Makefile',
  'native/native-windows-manifest.json',
  'selfhost/rcl-dual-need-stage40.rcl',
  'tests/stage40-dual-need.test.mjs',
  'selfhost',
  'COMPONENT-VERSIONS.json',
  'DOWNSTREAM-CONSUMERS.json',
  'docs/governance/RCL_TECHNICAL_DEBT_REGISTER_v0.1.md',
]) {
  await access(path.join(root, relativePath)).catch(() => errors.push(`${relativePath} is missing`));
}

const report = {
  ok: errors.length === 0,
  repository: contractJson.repository,
  canonicalBranch: contractJson.canonicalBranch,
  packageVersion: packageJson.version,
  verifiedCeiling: contractJson.verifiedCeiling,
  components: {
    nativeVmVersion,
    typedReferenceVersion,
    typedReferenceFormat,
    semanticRootAlgorithm,
  },
  downstream: consumers.map(item => ({
    repository: item.repository,
    relation: item.relation,
    status: item.status,
    syncRequired: item.syncRequired,
    byteIdentityAllowed: item.byteIdentityAllowed,
  })),
  windowsExecutionVerified: contractJson.boundary?.windowsExecutionVerified ?? false,
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
