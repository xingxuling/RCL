import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class ForgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ForgeError';
    this.code = code;
    this.details = details;
  }
}

export function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ForgeError('FORGE_INVALID_OBJECT', `${label} must be an object`);
  }
  return value;
}

export function assertArray(value, label, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min) {
    throw new ForgeError('FORGE_INVALID_ARRAY', `${label} must be an array with at least ${min} item(s)`);
  }
  return value;
}

export function assertText(value, label, { min = 1, max = 4096 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new ForgeError('FORGE_INVALID_TEXT', `${label} must be text between ${min} and ${max} characters`);
  }
  return value.trim();
}

export function assertFiniteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ForgeError('FORGE_INVALID_NUMBER', `${label} must be a finite number in [${min}, ${max}]`, { value });
  }
  return value;
}

export function slugify(value, fallback = 'artifact') {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

export function identifier(value, fallback = 'artifact') {
  const id = slugify(value, fallback).replace(/-/g, '_').replace(/^[^a-zA-Z_]+/, '');
  return id || fallback;
}

export function safeJoin(root, ...parts) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new ForgeError('FORGE_PATH_ESCAPE', 'Artifact path escaped output root', { root: base, target });
  }
  return target;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeText(root, relativePath, content) {
  const target = safeJoin(root, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

export function writeJson(root, relativePath, value) {
  return writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeBuffer(root, relativePath, buffer) {
  const target = safeJoin(root, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, buffer);
  return target;
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

export function listFiles(root, { exclude = [] } = {}) {
  const base = path.resolve(root);
  const excluded = new Set(exclude.map(item => item.replaceAll('\\', '/')));
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(base, absolute).replaceAll('\\', '/');
      if (excluded.has(relative)) continue;
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) results.push(relative);
    }
  }
  if (fs.existsSync(base)) walk(base);
  return results.sort();
}

export function artifactManifest(root, { framework, version, status = 'verified', metadata = {}, exclude = ['manifest.json'] } = {}) {
  const files = listFiles(root, { exclude }).map(relativePath => {
    const absolute = safeJoin(root, relativePath);
    const stat = fs.statSync(absolute);
    return {
      path: relativePath,
      bytes: stat.size,
      sha256: sha256File(absolute),
    };
  });
  const manifest = {
    format: 'rcl.reality-forge.manifest.v0.1',
    framework,
    version,
    status,
    createdAt: new Date().toISOString(),
    artifactCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    metadata,
    files,
  };
  manifest.root = sha256Buffer(Buffer.from(JSON.stringify({ ...manifest, createdAt: null }), 'utf8'));
  return manifest;
}

export async function atomicDirectory(targetDir, build) {
  const target = path.resolve(targetDir);
  ensureDir(path.dirname(target));
  const temp = `${target}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(temp, { recursive: true });
  try {
    const result = await build(temp);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(temp, target);
    return result;
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ForgeError('FORGE_JSON_READ', `Failed to read JSON: ${file}`, { cause: error.message });
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function receipt({ framework, capability, outputDir, manifest, details = {} }) {
  return {
    format: 'rcl.reality-forge.receipt.v0.1',
    framework,
    capability,
    status: manifest.status,
    outputDir: path.resolve(outputDir),
    manifestRoot: manifest.root,
    artifactCount: manifest.artifactCount,
    totalBytes: manifest.totalBytes,
    details,
  };
}
