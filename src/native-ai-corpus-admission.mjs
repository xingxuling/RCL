import { createHash } from 'node:crypto';

export const RCL10M_CORPUS_MANIFEST_FORMAT = 'rcl.rcl10m.corpus-admission-manifest.v0.1';
export const RCL10M_CORPUS_MANIFEST_STATUS = 'CANDIDATE_SCHEMA_ONLY_BLOCKED_USER_CORPUS';
export const RCL10M_REQUIRED_MIXTURE = Object.freeze(['zh', 'en', 'ja', 'code']);
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function corpusManifestRoot(manifest) {
  const { manifestRoot: _manifestRoot, ...body } = manifest ?? {};
  return `sha256:${sha256(canonicalJson(body))}`;
}

function error(code, path, message) {
  return { code, path, message };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(errors, value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(error('RCL10M_FIELD_REQUIRED', path, `${path} must be a non-empty string`));
}

function requiredHash(errors, value, path) {
  if (typeof value !== 'string' || !SHA256.test(value)) errors.push(error('RCL10M_HASH_REQUIRED', path, `${path} must be sha256:<64 lowercase hex digits>`));
}

function requiredPositiveInteger(errors, value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) errors.push(error('RCL10M_INTEGER_REQUIRED', path, `${path} must be a positive safe integer`));
}

export function validateRcl10mCorpusManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return { valid: false, ready: false, status: 'FAIL_CLOSED_INVALID_MANIFEST', errors: [error('RCL10M_MANIFEST_OBJECT', '$', 'manifest must be an object')] };
  if (manifest.format !== RCL10M_CORPUS_MANIFEST_FORMAT) errors.push(error('RCL10M_FORMAT', 'format', 'unsupported RCL-10M corpus manifest format'));
  if (manifest.canonicalOwner !== 'RCL') errors.push(error('RCL10M_CANONICAL_OWNER', 'canonicalOwner', 'RCL must remain the canonical owner'));
  requiredString(errors, manifest.manifestId, 'manifestId');
  requiredPositiveInteger(errors, manifest.targetTokens, 'targetTokens');
  if (manifest.targetTokens !== 10_000_000) errors.push(error('RCL10M_TARGET', 'targetTokens', 'this gate is frozen to the RCL-10M rehearsal target of 10,000,000 tokens'));

  const tokenizer = manifest.tokenizer;
  if (!isObject(tokenizer)) {
    errors.push(error('RCL10M_TOKENIZER_REQUIRED', 'tokenizer', 'tokenizer identity and artifact root are required'));
  } else {
    requiredString(errors, tokenizer.id, 'tokenizer.id');
    requiredHash(errors, tokenizer.artifactRoot, 'tokenizer.artifactRoot');
    if (tokenizer.byteFallback !== true) errors.push(error('RCL10M_TOKENIZER_FALLBACK', 'tokenizer.byteFallback', 'lossless byte fallback must be explicit'));
  }
  const tokenizerRoot = tokenizer?.artifactRoot;

  const sources = manifest.sources;
  const sourceIds = new Set();
  const mixture = new Set();
  let proportionPpm = 0;
  if (!Array.isArray(sources) || sources.length === 0) {
    errors.push(error('RCL10M_SOURCES_REQUIRED', 'sources', 'at least one provenance-bearing source is required'));
  } else {
    for (const [index, source] of sources.entries()) {
      const prefix = `sources[${index}]`;
      if (!isObject(source)) {
        errors.push(error('RCL10M_SOURCE_OBJECT', prefix, 'source entry must be an object'));
        continue;
      }
      requiredString(errors, source.id, `${prefix}.id`);
      if (sourceIds.has(source.id)) errors.push(error('RCL10M_SOURCE_DUPLICATE', `${prefix}.id`, `duplicate source id ${source.id}`));
      sourceIds.add(source.id);
      if (!RCL10M_REQUIRED_MIXTURE.includes(source.language)) errors.push(error('RCL10M_LANGUAGE', `${prefix}.language`, `language must be one of ${RCL10M_REQUIRED_MIXTURE.join(', ')}`));
      mixture.add(source.language);
      requiredString(errors, source.domain, `${prefix}.domain`);
      requiredString(errors, source.sourceUri, `${prefix}.sourceUri`);
      requiredHash(errors, source.sourceSha256, `${prefix}.sourceSha256`);
      requiredPositiveInteger(errors, source.byteCount, `${prefix}.byteCount`);
      if (!Number.isSafeInteger(source.proportionPpm) || source.proportionPpm <= 0) errors.push(error('RCL10M_MIXTURE_PROPORTION', `${prefix}.proportionPpm`, 'proportionPpm must be a positive integer'));
      else proportionPpm += source.proportionPpm;
      for (const review of ['licenseReviewRef', 'privacyReviewRef', 'poisonReviewRef']) requiredString(errors, source[review], `${prefix}.${review}`);
    }
  }
  if (proportionPpm !== 1_000_000) errors.push(error('RCL10M_MIXTURE_SUM', 'sources', `source proportions must sum to 1,000,000 ppm, received ${proportionPpm}`));
  for (const required of RCL10M_REQUIRED_MIXTURE) if (!mixture.has(required)) errors.push(error('RCL10M_MIXTURE_COVERAGE', 'sources', `required mixture member ${required} is missing`));

  const filtering = manifest.filtering;
  if (!isObject(filtering)) {
    errors.push(error('RCL10M_FILTERING_REQUIRED', 'filtering', 'filtering policy and root are required'));
  } else {
    requiredString(errors, filtering.policyId, 'filtering.policyId');
    requiredHash(errors, filtering.policyRoot, 'filtering.policyRoot');
    if (!Array.isArray(filtering.decisions) || filtering.decisions.length === 0) errors.push(error('RCL10M_FILTERING_DECISIONS', 'filtering.decisions', 'filter decisions must be enumerated'));
  }

  const deduplication = manifest.deduplication;
  if (!isObject(deduplication)) {
    errors.push(error('RCL10M_DEDUP_REQUIRED', 'deduplication', 'deduplication identity is required'));
  } else {
    requiredString(errors, deduplication.algorithm, 'deduplication.algorithm');
    requiredString(errors, deduplication.version, 'deduplication.version');
    requiredHash(errors, deduplication.root, 'deduplication.root');
  }

  const shards = manifest.shards;
  if (!Array.isArray(shards) || shards.length === 0) {
    errors.push(error('RCL10M_SHARDS_REQUIRED', 'shards', 'deterministic shard manifest is required'));
  } else {
    const shardIndexes = new Set();
    for (const [index, shard] of shards.entries()) {
      const prefix = `shards[${index}]`;
      if (!isObject(shard)) {
        errors.push(error('RCL10M_SHARD_OBJECT', prefix, 'shard entry must be an object'));
        continue;
      }
      requiredString(errors, shard.id, `${prefix}.id`);
      if (!Number.isSafeInteger(shard.index) || shard.index < 0) errors.push(error('RCL10M_SHARD_INDEX', `${prefix}.index`, 'shard index must be a non-negative safe integer'));
      if (shardIndexes.has(shard.index)) errors.push(error('RCL10M_SHARD_DUPLICATE', `${prefix}.index`, `duplicate shard index ${shard.index}`));
      shardIndexes.add(shard.index);
      if (!Array.isArray(shard.sourceIds) || shard.sourceIds.length === 0) errors.push(error('RCL10M_SHARD_SOURCES', `${prefix}.sourceIds`, 'each shard must bind to source ids'));
      else for (const sourceId of shard.sourceIds) if (!sourceIds.has(sourceId)) errors.push(error('RCL10M_SHARD_SOURCE_UNKNOWN', `${prefix}.sourceIds`, `unknown source id ${sourceId}`));
      if (tokenizerRoot !== undefined && shard.tokenizerRoot !== tokenizerRoot) errors.push(error('RCL10M_SHARD_TOKENIZER', `${prefix}.tokenizerRoot`, 'shard tokenizer root must equal the manifest tokenizer artifact root'));
      requiredPositiveInteger(errors, shard.byteCount, `${prefix}.byteCount`);
      requiredPositiveInteger(errors, shard.tokenCount, `${prefix}.tokenCount`);
      requiredHash(errors, shard.tokenStreamSha256, `${prefix}.tokenStreamSha256`);
      requiredHash(errors, shard.root, `${prefix}.root`);
    }
    for (let index = 0; index < shards.length; index += 1) if (!shardIndexes.has(index)) errors.push(error('RCL10M_SHARD_CONTIGUITY', 'shards', `missing shard index ${index}`));
  }

  const admission = manifest.admission;
  if (!isObject(admission)) {
    errors.push(error('RCL10M_ADMISSION_REQUIRED', 'admission', 'license, privacy, poison, byte and token verification decisions are required'));
  } else {
    for (const field of ['license', 'privacy', 'poison']) if (!['PENDING_USER_REVIEW', 'PASS'].includes(admission[field])) errors.push(error('RCL10M_ADMISSION_REVIEW', `admission.${field}`, `${field} must be PENDING_USER_REVIEW or PASS`));
    for (const field of ['sourceBytesVerified', 'tokenStreamVerified']) if (typeof admission[field] !== 'boolean') errors.push(error('RCL10M_ADMISSION_VERIFICATION', `admission.${field}`, `${field} must be boolean`));
  }

  const expectedRoot = corpusManifestRoot(manifest);
  if (manifest.manifestRoot !== expectedRoot) errors.push(error('RCL10M_MANIFEST_ROOT', 'manifestRoot', `manifest root mismatch; expected ${expectedRoot}`));
  const ready = errors.length === 0
    && admission?.license === 'PASS'
    && admission?.privacy === 'PASS'
    && admission?.poison === 'PASS'
    && admission?.sourceBytesVerified === true
    && admission?.tokenStreamVerified === true;
  if (manifest.status === 'ADMITTED' && !ready) errors.push(error('RCL10M_ADMISSION_NOT_READY', 'status', 'ADMITTED is forbidden until all corpus review and artifact verification gates pass'));
  return {
    valid: errors.length === 0,
    ready: ready && errors.length === 0,
    status: errors.length > 0 ? 'FAIL_CLOSED_INVALID_MANIFEST' : (ready ? 'ADMITTED_CANDIDATE' : RCL10M_CORPUS_MANIFEST_STATUS),
    expectedRoot,
    errors,
  };
}
