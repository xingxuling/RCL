#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ARCHIVE_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'canonical-sources');
const ARCHIVE_RELATIVE_DIR = 'examples/universal-stress/evidence/canonical-sources';
const SOURCES = Object.freeze({
  'candidate-core.rcl': { sourceCommit: '077141d15c4a999ed758c5b8d050fe5f0664d1dc', sourcePath: 'selfhost/compiler-core.rcl', archiveName: 'k01-k327-v0.2-compiler-core.rcl' },
  'candidate-main.rcl': { sourceCommit: 'b1e4cef490509f88507f29c132797d020a2a6dff', sourcePath: 'selfhost/compiler-main.rcl', archiveName: 'k01-k327-v0.2-compiler-main.rcl' },
});

const CONTRACT_ROOTS = Object.freeze([
  '9d147a87713d4ea962a1de02b01bc381f48d7d0c6a4d8290f093b7b31bcfc8f9',
  'bbb6fb4c7bb29be06024ef4192d9e3d4f3efa0218bd78e19fe20ff34bdc842af',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readBlob(commit, sourcePath) {
  return execFileSync('git', ['cat-file', 'blob', `${commit}:${sourcePath}`]);
}

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
const files = {};
for (const [name, descriptor] of Object.entries(SOURCES)) {
  const bytes = readBlob(descriptor.sourceCommit, descriptor.sourcePath);
  const archivePath = path.join(ARCHIVE_DIR, descriptor.archiveName);
  fs.writeFileSync(archivePath, bytes);
  files[name] = {
    path: `${ARCHIVE_RELATIVE_DIR}/${descriptor.archiveName}`,
    sha256: sha256(bytes),
    sourceCommit: descriptor.sourceCommit,
    sourcePath: descriptor.sourcePath,
  };
}

const manifest = {
  format: 'rcl.canonical-source-archive.v0.1',
  purpose: 'Preserve immutable canonical source bytes for historical evidence receipts after the working compiler advances.',
  records: [{
    id: 'k01-k327-v0.2-historical-canonical',
    contractRoots: [...CONTRACT_ROOTS],
    files,
  }],
};
fs.writeFileSync(path.join(ARCHIVE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));
