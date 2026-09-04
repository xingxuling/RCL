import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const RCL_CANONICAL_SOURCE_ARCHIVE_FORMAT = 'rcl.canonical-source-archive.v0.1';
export const DEFAULT_CANONICAL_SOURCE_ARCHIVE_PATH = path.join(
  ROOT,
  'examples',
  'universal-stress',
  'evidence',
  'canonical-sources',
  'manifest.json',
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveRooted(relativePath, code) {
  const resolved = path.resolve(ROOT, relativePath);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(code);
  return resolved;
}

function readTextIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function readBytesIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function expectedCanonical(contract) {
  if (!contract?.canonical?.corePath || !contract?.canonical?.mainPath
    || !/^[0-9a-f]{64}$/u.test(contract.canonical.coreSha256)
    || !/^[0-9a-f]{64}$/u.test(contract.canonical.mainSha256)) {
    throw new Error('RCL_CANONICAL_SOURCE_CONTRACT_INVALID');
  }
  return {
    'candidate-core.rcl': {
      path: resolveRooted(contract.canonical.corePath, 'RCL_CANONICAL_SOURCE_PATH_INVALID'),
      sha256: contract.canonical.coreSha256,
    },
    'candidate-main.rcl': {
      path: resolveRooted(contract.canonical.mainPath, 'RCL_CANONICAL_SOURCE_PATH_INVALID'),
      sha256: contract.canonical.mainSha256,
    },
  };
}

function liveCanonical(expected) {
  const files = Object.fromEntries(Object.entries(expected).map(([name, entry]) => [name, readTextIfPresent(entry.path)]));
  const matches = Object.entries(expected).every(([name, entry]) => files[name] !== null && sha256(files[name]) === entry.sha256);
  return matches ? files : null;
}

function readArchive(archivePath) {
  if (!fs.existsSync(archivePath)) throw new Error('RCL_CANONICAL_SOURCE_ARCHIVE_MISSING');
  const manifest = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  if (manifest.format !== RCL_CANONICAL_SOURCE_ARCHIVE_FORMAT || !Array.isArray(manifest.records)) {
    throw new Error('RCL_CANONICAL_SOURCE_ARCHIVE_INVALID');
  }
  return manifest;
}

function expectedCompilerArtifact(contract) {
  if (!contract?.canonical?.compilerRbcPath
    || !/^[0-9a-f]{64}$/u.test(contract.canonical.compilerRbcSha256)) {
    throw new Error('RCL_CANONICAL_COMPILER_ARTIFACT_CONTRACT_INVALID');
  }
  return {
    path: resolveRooted(contract.canonical.compilerRbcPath, 'RCL_CANONICAL_COMPILER_ARTIFACT_PATH_INVALID'),
    sha256: contract.canonical.compilerRbcSha256,
  };
}

export function readCanonicalCompilerArtifact(contract, options = {}) {
  const expected = expectedCompilerArtifact(contract);
  const live = readBytesIfPresent(expected.path);
  if (live && sha256(live) === expected.sha256) {
    return Object.freeze({
      sourceMode: 'live',
      path: expected.path,
      sha256: expected.sha256,
      archiveId: null,
    });
  }

  const archivePath = path.resolve(options.archivePath ?? DEFAULT_CANONICAL_SOURCE_ARCHIVE_PATH);
  const manifest = readArchive(archivePath);
  const contractRoot = options.contractRoot ?? evidenceRoot(contract);
  const record = (manifest.artifacts ?? []).find((candidate) => candidate.contractRoots?.includes(contractRoot)
    && candidate.path
    && candidate.sha256 === expected.sha256);
  if (!record) throw new Error('RCL_CANONICAL_COMPILER_ARTIFACT_ARCHIVE_MISSING');

  const archiveFile = resolveRooted(record.path, 'RCL_CANONICAL_COMPILER_ARTIFACT_ARCHIVE_PATH_INVALID');
  const bytes = readBytesIfPresent(archiveFile);
  if (bytes === null || sha256(bytes) !== record.sha256) throw new Error('RCL_CANONICAL_COMPILER_ARTIFACT_HASH_MISMATCH');
  return Object.freeze({
    sourceMode: 'archive',
    path: archiveFile,
    sha256: record.sha256,
    archiveId: record.id ?? null,
    sourceCommit: record.sourceCommit ?? null,
  });
}

export function readCanonicalCompilerSourcePair(contract, options = {}) {
  const expected = expectedCanonical(contract);
  const live = liveCanonical(expected);
  if (live) return Object.freeze({ sourceMode: 'live', files: Object.freeze(live), archiveId: null });

  const archivePath = path.resolve(options.archivePath ?? DEFAULT_CANONICAL_SOURCE_ARCHIVE_PATH);
  const manifest = readArchive(archivePath);
  const contractRoot = options.contractRoot ?? evidenceRoot(contract);
  const record = manifest.records.find((candidate) => candidate.contractRoots?.includes(contractRoot)
    && candidate.files?.['candidate-core.rcl']?.sha256 === expected['candidate-core.rcl'].sha256
    && candidate.files?.['candidate-main.rcl']?.sha256 === expected['candidate-main.rcl'].sha256);
  if (!record) throw new Error('RCL_CANONICAL_INPUT_DRIFT');

  const files = {};
  for (const name of ['candidate-core.rcl', 'candidate-main.rcl']) {
    const descriptor = record.files[name];
    if (!descriptor?.path || descriptor.sha256 !== expected[name].sha256) throw new Error('RCL_CANONICAL_SOURCE_ARCHIVE_INVALID');
    const archiveFile = resolveRooted(descriptor.path, 'RCL_CANONICAL_SOURCE_ARCHIVE_PATH_INVALID');
    const value = readTextIfPresent(archiveFile);
    if (value === null || sha256(value) !== descriptor.sha256) throw new Error('RCL_CANONICAL_SOURCE_ARCHIVE_HASH_MISMATCH');
    files[name] = value;
  }
  return Object.freeze({ sourceMode: 'archive', files: Object.freeze(files), archiveId: record.id ?? null });
}
