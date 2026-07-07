#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'fileized-source');
const capsuleDir = path.join(outputDir, 'capsules');
const ledgerPath = path.join(outputDir, 'rcl-source-fileization-ledger.rcl');
const reportPath = path.join(outputDir, 'rcl-source-fileization-report.json');

const includeDirs = ['src', 'bootstrap', 'examples', 'tests', 'selfhost', 'scripts', 'native'];
const includeRootFiles = ['package.json', 'package-lock.json', 'README.md', 'CONTEXT.md'];
const excludeDirNames = new Set(['output', '_codex_probe', 'node_modules', '.git']);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function escapeRclText(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t');
}

function rclText(value) {
  return `"${escapeRclText(value)}"`;
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (excludeDirNames.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function capsuleName(index) {
  return `file-${String(index).padStart(4, '0')}.rcl`;
}

function capsuleRealityName(index) {
  return `RCLSourceFileCapsule${String(index).padStart(4, '0')}`;
}

function ledgerFacetName(index) {
  return `file_${String(index).padStart(4, '0')}`;
}

const absoluteFiles = [];
for (const dir of includeDirs) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) walk(full, absoluteFiles);
}
for (const file of includeRootFiles) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) absoluteFiles.push(full);
}

const uniqueFiles = [...new Map(absoluteFiles.map(file => [rel(file), file])).entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, file]) => file);

const entries = uniqueFiles.map((file, index) => {
  const bytes = fs.readFileSync(file);
  const capsule = `capsules/${capsuleName(index)}`;
  return {
    index,
    path: rel(file),
    bytes: bytes.length,
    sha256: sha256(bytes),
    capsule,
    contentBase64: bytes.toString('base64'),
  };
});

const ledgerRoot = sha256(Buffer.from(JSON.stringify(entries.map(({ index, path: filePath, bytes, sha256: hash, capsule }) => ({
  index,
  path: filePath,
  bytes,
  sha256: hash,
  capsule,
})))));
const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

fs.mkdirSync(capsuleDir, { recursive: true });

for (const entry of entries) {
  const capsuleSource = `reality ${capsuleRealityName(entry.index)} {
  facet file.index : Number = ${entry.index}
  facet file.path : Text = ${rclText(entry.path)}
  facet file.bytes : Number = ${entry.bytes}
  facet file.sha256 : Text = ${rclText(entry.sha256)}
  facet file.content_encoding : Text = "base64"
  facet file.content_base64 : Text = ${rclText(entry.contentBase64)}
}
`;
  fs.writeFileSync(path.join(outputDir, entry.capsule), capsuleSource);
}

const ledgerLines = [
  'reality RCLSourceFileizationLedger {',
  '  facet fileization.format : Text = "rcl.source-fileization.ledger.v1"',
  '  facet fileization.mode : Text = "base64_per_file_capsules"',
  `  facet fileization.file_count : Number = ${entries.length}`,
  `  facet fileization.total_bytes : Number = ${totalBytes}`,
  `  facet fileization.root : Text = ${rclText(ledgerRoot)}`,
  `  facet fileization.include_roots : Text = ${rclText([...includeDirs, ...includeRootFiles].join('\\n'))}`,
  '  facet fileization.boundary : Text = "hash_and_base64_file_capsules_not_rcl_semantic_rewrite"',
  '',
];

for (const entry of entries) {
  const name = ledgerFacetName(entry.index);
  ledgerLines.push(`  facet ${name}.path : Text = ${rclText(entry.path)}`);
  ledgerLines.push(`  facet ${name}.bytes : Number = ${entry.bytes}`);
  ledgerLines.push(`  facet ${name}.sha256 : Text = ${rclText(entry.sha256)}`);
  ledgerLines.push(`  facet ${name}.capsule : Text = ${rclText(entry.capsule)}`);
}
ledgerLines.push('}');
ledgerLines.push('');
fs.writeFileSync(ledgerPath, ledgerLines.join('\n'));

const ledgerRun = await runReality(compileReality(fs.readFileSync(ledgerPath, 'utf8')));
let verifiedCapsules = 0;
let firstMismatch = null;

for (const entry of entries) {
  const capsuleSource = fs.readFileSync(path.join(outputDir, entry.capsule), 'utf8');
  const capsuleRun = await runReality(compileReality(capsuleSource));
  const state = capsuleRun.state;
  const decoded = Buffer.from(state['file.content_base64'], 'base64');
  const ok = state['file.path'] === entry.path
    && Number(state['file.bytes']) === entry.bytes
    && state['file.sha256'] === entry.sha256
    && decoded.length === entry.bytes
    && sha256(decoded) === entry.sha256;
  if (!ok && !firstMismatch) firstMismatch = entry.path;
  if (ok) verifiedCapsules += 1;
}

const report = {
  ok: ledgerRun.state['fileization.file_count'] === entries.length
    && Number(ledgerRun.state['fileization.total_bytes']) === totalBytes
    && ledgerRun.state['fileization.root'] === ledgerRoot
    && verifiedCapsules === entries.length,
  format: 'rcl.source-fileization.report.v1',
  ledgerFile: rel(ledgerPath),
  capsuleDir: rel(capsuleDir),
  fileCount: entries.length,
  totalBytes,
  ledgerRoot,
  verifiedCapsules,
  firstMismatch,
  mode: 'base64_per_file_capsules',
  boundary: {
    contentIsReversible: true,
    semanticRewrite: false,
    generatedOutputExcluded: true,
  },
  files: entries.map(({ contentBase64, ...entry }) => entry),
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exitCode = 1;
