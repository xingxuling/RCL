import fs from 'node:fs';
import path from 'node:path';
import { realityRoot } from './canonical.mjs';
import { canonicalF64Hex } from './canonical-f64.mjs';

export const RCL_ATOMIC_CHECKPOINT_VERSION = '0.1.0-candidate.1';
export const RCL_ATOMIC_CHECKPOINT_FORMAT = 'rcl.atomic-checkpoint.v0.1';
const SHA256_RE = /^[0-9a-f]{64}$/u;
const F64_RE = /^[0-9a-f]{16}$/u;

function text(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(code);
  return value.trim();
}
function root(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new TypeError(code);
  return value;
}
function normalizeExactBits(map = {}) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new TypeError('RCL_CHECKPOINT_EXACT_BITS_MAP_REQUIRED');
  const out = {};
  for (const key of Object.keys(map).sort()) {
    const values = map[key];
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !F64_RE.test(value))) {
      throw new TypeError(`RCL_CHECKPOINT_EXACT_BITS_INVALID:${key}`);
    }
    out[key] = [...values];
  }
  return out;
}

export function exactF64Bits(values) {
  if (!Array.isArray(values)) throw new TypeError('RCL_CHECKPOINT_F64_ARRAY_REQUIRED');
  return values.map(canonicalF64Hex);
}

export function createAtomicCheckpoint(input = {}) {
  const exactStorageBits = normalizeExactBits(input.exactStorageBits ?? {});
  const core = {
    format: RCL_ATOMIC_CHECKPOINT_FORMAT,
    version: RCL_ATOMIC_CHECKPOINT_VERSION,
    checkpointId: text(input.checkpointId, 'RCL_CHECKPOINT_ID_REQUIRED'),
    parentCheckpointRoot: input.parentCheckpointRoot == null ? null : root(input.parentCheckpointRoot, 'RCL_CHECKPOINT_PARENT_ROOT_INVALID'),
    modelRoot: root(input.modelRoot, 'RCL_CHECKPOINT_MODEL_ROOT_INVALID'),
    optimizerRoot: root(input.optimizerRoot, 'RCL_CHECKPOINT_OPTIMIZER_ROOT_INVALID'),
    tokenizerRoot: input.tokenizerRoot == null ? null : root(input.tokenizerRoot, 'RCL_CHECKPOINT_TOKENIZER_ROOT_INVALID'),
    dataCursorRoot: input.dataCursorRoot == null ? null : root(input.dataCursorRoot, 'RCL_CHECKPOINT_DATA_CURSOR_ROOT_INVALID'),
    rngStateRoot: input.rngStateRoot == null ? null : root(input.rngStateRoot, 'RCL_CHECKPOINT_RNG_ROOT_INVALID'),
    step: Number(input.step),
    exactStorageBits,
    payload: structuredClone(input.payload ?? {}),
    authority: {
      canonicalPromotionPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
    },
  };
  if (!Number.isSafeInteger(core.step) || core.step < 0) throw new TypeError('RCL_CHECKPOINT_STEP_INVALID');
  return Object.freeze({ ...core, checkpointRoot: realityRoot(core) });
}

export function verifyAtomicCheckpoint(checkpoint) {
  if (!checkpoint || checkpoint.format !== RCL_ATOMIC_CHECKPOINT_FORMAT) throw new TypeError('RCL_CHECKPOINT_FORMAT_INVALID');
  const supplied = root(checkpoint.checkpointRoot, 'RCL_CHECKPOINT_ROOT_INVALID');
  const { checkpointRoot, ...core } = checkpoint;
  const computed = realityRoot(core);
  if (supplied !== computed) throw new Error('RCL_CHECKPOINT_ROOT_MISMATCH');
  normalizeExactBits(checkpoint.exactStorageBits);
  return Object.freeze({ status: 'VERIFIED', checkpointRoot: computed, atomicPersistenceProven: false });
}

function fsyncDirectory(directory) {
  let fd;
  try {
    fd = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error?.code)) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function writeAtomicCheckpoint(filePath, checkpoint) {
  verifyAtomicCheckpoint(checkpoint);
  const target = path.resolve(filePath);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  const temp = path.join(directory, `.${path.basename(target)}.${checkpoint.checkpointRoot}.tmp`);
  const bytes = Buffer.from(`${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, target);
    fsyncDirectory(directory);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
  const reloaded = JSON.parse(fs.readFileSync(target, 'utf8'));
  verifyAtomicCheckpoint(reloaded);
  if (reloaded.checkpointRoot !== checkpoint.checkpointRoot) throw new Error('RCL_CHECKPOINT_POST_WRITE_ROOT_MISMATCH');
  return Object.freeze({
    format: 'rcl.atomic-checkpoint-write-receipt.v0.1',
    checkpointRoot: checkpoint.checkpointRoot,
    target,
    bytes: bytes.length,
    tempPathAbsentAfterCommit: !fs.existsSync(temp),
    fileFsyncPerformed: true,
    directoryFsyncAttempted: true,
    atomicRenamePerformed: true,
    canonicalPromotionPerformed: false,
    rclEvidenceCommitPerformed: false,
  });
}
