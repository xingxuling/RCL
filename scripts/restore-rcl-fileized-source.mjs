#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { runReality } from '../src/runtime.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'fileized-source');
const reportPath = path.join(outputDir, 'rcl-source-fileization-report.json');
const restoredRoot = path.join(outputDir, 'restored-source');
const restoreReportPath = path.join(outputDir, 'rcl-source-fileization-restore-report.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assertInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Refusing to write outside restore root: ${resolvedTarget}`);
  }
}

function slashPath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

const fileization = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (!fileization.ok) throw new Error('Cannot restore from a failed fileization report');

assertInside(outputDir, restoredRoot);
fs.rmSync(restoredRoot, { recursive: true, force: true });
fs.mkdirSync(restoredRoot, { recursive: true });

const restored = [];
let firstMismatch = null;

for (const entry of fileization.files) {
  const capsulePath = path.join(outputDir, entry.capsule);
  const capsuleSource = fs.readFileSync(capsulePath, 'utf8');
  const capsuleRun = await runReality(compileReality(capsuleSource));
  const state = capsuleRun.state;
  const decoded = Buffer.from(state['file.content_base64'], 'base64');
  const outputPath = path.join(restoredRoot, entry.path);
  assertInside(restoredRoot, outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, decoded);

  const originalPath = path.join(root, entry.path);
  const restoredBytes = fs.readFileSync(outputPath);
  const originalBytes = fs.readFileSync(originalPath);
  const record = {
    path: entry.path,
    capsule: entry.capsule,
    bytes: restoredBytes.length,
    sha256: sha256(restoredBytes),
    originalSha256: sha256(originalBytes),
    matchesCapsule: state['file.path'] === entry.path
      && Number(state['file.bytes']) === entry.bytes
      && state['file.sha256'] === entry.sha256
      && restoredBytes.length === entry.bytes
      && sha256(restoredBytes) === entry.sha256,
    matchesOriginal: Buffer.compare(restoredBytes, originalBytes) === 0,
  };
  if ((!record.matchesCapsule || !record.matchesOriginal) && !firstMismatch) firstMismatch = entry.path;
  restored.push(record);
}

const restoredTotalBytes = restored.reduce((sum, entry) => sum + entry.bytes, 0);
const restoredRootHash = sha256(Buffer.from(JSON.stringify(restored.map(entry => ({
  path: entry.path,
  bytes: entry.bytes,
  sha256: entry.sha256,
})))));

const report = {
  ok: restored.length === fileization.fileCount
    && restoredTotalBytes === fileization.totalBytes
    && restored.every(entry => entry.matchesCapsule && entry.matchesOriginal),
  format: 'rcl.source-fileization.restore-report.v1',
  sourceReport: slashPath(reportPath),
  restoredRoot: slashPath(restoredRoot),
  fileCount: restored.length,
  totalBytes: restoredTotalBytes,
  restoredRootHash,
  sourceLedgerRoot: fileization.ledgerRoot,
  firstMismatch,
  restored,
};

fs.writeFileSync(restoreReportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exitCode = 1;
