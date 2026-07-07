import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { compileRealityToBytecode } from './bytecode.mjs';
import { realityRoot, canonicalReality } from './canonical.mjs';
import { packageRclSource, verifyRclPackage, listRclPackageTargets } from './package-compiler.mjs';

export const RCL_PACKAGE_ECOSYSTEM_VERSION = '0.42.0-alpha.1';
export const RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT = 'rcl.package-ecosystem.manifest.v0.42';
export const RCL_PACKAGE_ECOSYSTEM_LOCK_FORMAT = 'rcl.package-ecosystem.lock.v0.42';
export const RCL_CONTENT_ADDRESSED_CACHE_FORMAT = 'rcl.content-addressed-cache.v0.42';
export const RCL_RELEASE_BUNDLE_FORMAT = 'rcl.release-bundle.v0.42';
export const RCL_TARGET_MATRIX_FORMAT = 'rcl.target-matrix.v0.42';
export const RCL_RELEASE_SIGNATURE_FORMAT = 'rcl.release-signature.v0.42';

export const DEFAULT_PACKAGE_ECOSYSTEM_SOURCE = `reality PackageEcosystemDemo {
  facet world.ready : Truth = false
  facet app.name : Text = "FirstLight Package"

  subject founder {
    facet awareness : Number = 0
    warrant world.write on world
  }

  emergence boot {
    cause founder
    when world.ready == false
    needs world.write on world
    alter world.ready <- true
    alter founder.awareness <- founder.awareness + 1
    preserve founder.awareness >= 0
    witness "rcl:package-ecosystem"
  }

  foresee boot
  realize boot
}
`;

export const DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST = Object.freeze({
  package: {
    name: 'rcl.firstlight.package',
    version: '0.42.0-alpha.1',
    entry: 'src/app.rcl',
    license: 'Apache-2.0',
  },
  dependencies: {
    'rcl_core': {
      version: '^0.42.0-alpha.1',
      source: 'local',
      path: 'src/app.rcl',
    },
    'rcl_provider_abi': {
      version: '>=0.25.0 <1.0.0',
      source: 'remote',
      registry: 'https://registry.example.invalid/rcl',
      integrity: 'sha256-demo-provider-abi-seed',
    },
  },
  targets: {
    linux: 'native-rbc',
    windows: 'node-cli',
    android: 'android-debug-apk',
    web: 'web-static',
  },
  release: {
    signing: 'deterministic-dev-seed',
    reproducible: true,
  },
});

const SECRET_PATTERNS = [/\.env($|\.)/i, /id_rsa/i, /id_ed25519/i, /\.pem$/i, /\.p12$/i, /\.jks$/i, /keystore/i, /google-services\.json$/i];
const SUPPORTED_PLATFORMS = Object.freeze(['linux', 'windows', 'android', 'web']);
const DEFAULT_TARGETS = Object.freeze({ linux: 'native-rbc', windows: 'node-cli', android: 'android-debug-apk', web: 'web-static' });

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(file, text, mode) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text);
  if (mode !== undefined) fs.chmodSync(file, mode);
}

function writeJson(file, value) {
  writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'rcl-package';
}

function normalizeRel(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

function resolveInside(root, rel) {
  const absRoot = path.resolve(root);
  const abs = path.resolve(absRoot, rel);
  if (abs !== absRoot && !abs.startsWith(`${absRoot}${path.sep}`)) throw new Error(`Path escapes package root: ${rel}`);
  return abs;
}

function walkFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile()) files.push(abs);
    }
  };
  visit(root);
  return files;
}

function fileInventory(root, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map(normalizeRel));
  return walkFiles(root)
    .map(file => ({ file, path: normalizeRel(path.relative(root, file)) }))
    .filter(item => !excluded.has(item.path))
    .map(item => ({ path: item.path, bytes: fs.statSync(item.file).size, sha256: sha256File(item.file) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function hasSecretPath(rel) {
  return SECRET_PATTERNS.some(pattern => pattern.test(rel));
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function tomlValue(value) {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return tomlString(value);
}

export function renderRclToml(manifest = DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST) {
  const lines = [];
  lines.push(`# Generated by RCL Package Ecosystem Runtime v${RCL_PACKAGE_ECOSYSTEM_VERSION}`);
  lines.push(`format = ${tomlString(RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT)}`);
  lines.push('');
  lines.push('[package]');
  for (const [key, value] of Object.entries(manifest.package ?? {})) lines.push(`${key} = ${tomlValue(value)}`);
  lines.push('');
  for (const [name, dep] of Object.entries(manifest.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`[dependencies.${tomlString(name).slice(1, -1)}]`);
    for (const [key, value] of Object.entries(dep)) lines.push(`${key} = ${tomlValue(value)}`);
    lines.push('');
  }
  lines.push('[targets]');
  for (const [key, value] of Object.entries(manifest.targets ?? DEFAULT_TARGETS)) lines.push(`${key} = ${tomlValue(value)}`);
  lines.push('');
  lines.push('[release]');
  for (const [key, value] of Object.entries(manifest.release ?? {})) lines.push(`${key} = ${tomlValue(value)}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function parseTomlValue(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    const parts = [];
    let current = '';
    let inString = false;
    for (let i = 0; i < inner.length; i += 1) {
      const ch = inner[i];
      if (ch === '"' && inner[i - 1] !== '\\') inString = !inString;
      if (ch === ',' && !inString) {
        parts.push(current.trim());
        current = '';
      } else current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.map(parseTomlValue);
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function setNested(target, section, key, value) {
  let node = target;
  for (const part of section) {
    if (!node[part] || typeof node[part] !== 'object') node[part] = {};
    node = node[part];
  }
  node[key] = value;
}

export function parseRclToml(text) {
  const result = {};
  let section = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].split('.').map(item => item.trim()).filter(Boolean);
      continue;
    }
    const equal = line.indexOf('=');
    if (equal < 0) throw new Error(`Invalid rcl.toml line: ${rawLine}`);
    const key = line.slice(0, equal).trim();
    const value = parseTomlValue(line.slice(equal + 1));
    setNested(result, section, key, value);
  }
  return result;
}

export function readRclPackageManifest(projectDir) {
  const root = path.resolve(projectDir);
  const manifestPath = path.join(root, 'rcl.toml');
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing rcl.toml in ${root}`);
  const text = fs.readFileSync(manifestPath, 'utf8');
  const parsed = parseRclToml(text);
  return Object.freeze({ root, manifestPath, text, manifest: normalizeManifest(parsed) });
}

function normalizeManifest(parsed) {
  const manifest = {
    format: parsed.format ?? RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT,
    package: { ...(parsed.package ?? {}) },
    dependencies: { ...(parsed.dependencies ?? {}) },
    targets: { ...DEFAULT_TARGETS, ...(parsed.targets ?? {}) },
    release: { signing: 'deterministic-dev-seed', reproducible: true, ...(parsed.release ?? {}) },
  };
  if (!manifest.package.name) manifest.package.name = DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST.package.name;
  if (!manifest.package.version) manifest.package.version = DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST.package.version;
  if (!manifest.package.entry) manifest.package.entry = DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST.package.entry;
  return manifest;
}

function parseSemver(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? '' };
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`Invalid semantic version compare: ${a} / ${b}`);
  for (const key of ['major', 'minor', 'patch']) if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  if (pa.prerelease === pb.prerelease) return 0;
  if (!pa.prerelease) return 1;
  if (!pb.prerelease) return -1;
  return pa.prerelease.localeCompare(pb.prerelease);
}

export function satisfiesSemanticVersion(version, range) {
  if (!range || range === '*') return true;
  const parsed = parseSemver(version);
  if (!parsed) return false;
  const text = String(range).trim();
  if (parseSemver(text)) return compareSemver(version, text) === 0;
  if (text.startsWith('^')) {
    const base = text.slice(1);
    const baseParsed = parseSemver(base);
    if (!baseParsed) return false;
    if (compareSemver(version, base) < 0) return false;
    if (baseParsed.major === 0) return parsed.major === 0 && parsed.minor === baseParsed.minor;
    return parsed.major === baseParsed.major;
  }
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.every(part => {
    const m = part.match(/^(>=|>|<=|<|=)(.+)$/);
    if (!m) return false;
    const cmp = compareSemver(version, m[2]);
    if (m[1] === '>=') return cmp >= 0;
    if (m[1] === '>') return cmp > 0;
    if (m[1] === '<=') return cmp <= 0;
    if (m[1] === '<') return cmp < 0;
    return cmp === 0;
  });
}

function dependencyEntries(dependencies) {
  return Object.entries(dependencies ?? {}).map(([name, dep]) => ({ name, ...dep })).sort((a, b) => a.name.localeCompare(b.name));
}

function packageDiagnostics(manifest) {
  const diagnostics = [];
  if (manifest.format !== RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT) diagnostics.push({ code: 'RCL_PACKAGE_ECOSYSTEM_FORMAT_UNKNOWN', message: `Expected ${RCL_PACKAGE_ECOSYSTEM_MANIFEST_FORMAT}`, value: manifest.format });
  if (!/^[a-zA-Z0-9_.-]+$/.test(manifest.package.name ?? '')) diagnostics.push({ code: 'RCL_PACKAGE_NAME_INVALID', message: 'Package name must contain only letters, digits, _, . or -.' });
  if (!parseSemver(manifest.package.version)) diagnostics.push({ code: 'RCL_PACKAGE_VERSION_INVALID', message: 'Package version must be semantic version.' });
  if (!manifest.package.entry || path.isAbsolute(manifest.package.entry) || manifest.package.entry.includes('..')) diagnostics.push({ code: 'RCL_PACKAGE_ENTRY_INVALID', message: 'Package entry must be a relative path inside the package.' });
  for (const platform of SUPPORTED_PLATFORMS) {
    if (!manifest.targets[platform]) diagnostics.push({ code: 'RCL_PACKAGE_TARGET_MISSING', platform, message: `Missing ${platform} target.` });
  }
  for (const [name, dep] of Object.entries(manifest.dependencies ?? {})) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) diagnostics.push({ code: 'RCL_PACKAGE_DEP_NAME_INVALID', dependency: name });
    if (!dep.version) diagnostics.push({ code: 'RCL_PACKAGE_DEP_VERSION_MISSING', dependency: name });
    if (!['local', 'remote'].includes(dep.source)) diagnostics.push({ code: 'RCL_PACKAGE_DEP_SOURCE_INVALID', dependency: name, source: dep.source });
    if (dep.source === 'local' && (!dep.path || path.isAbsolute(dep.path) || dep.path.includes('..'))) diagnostics.push({ code: 'RCL_PACKAGE_LOCAL_DEP_PATH_INVALID', dependency: name, path: dep.path });
    if (dep.source === 'remote' && (!dep.registry || !dep.integrity)) diagnostics.push({ code: 'RCL_PACKAGE_REMOTE_DEP_UNPINNED', dependency: name, message: 'Remote dependencies must include registry and integrity seed.' });
  }
  return diagnostics;
}

export function initPackageEcosystem(sourcePath, outputDir, options = {}) {
  const out = path.resolve(outputDir ?? path.join(process.cwd(), 'rcl-package-ecosystem'));
  fs.rmSync(out, { recursive: true, force: true });
  ensureDir(path.join(out, 'src'));
  const source = sourcePath ? fs.readFileSync(path.resolve(sourcePath), 'utf8') : DEFAULT_PACKAGE_ECOSYSTEM_SOURCE;
  writeText(path.join(out, 'src', 'app.rcl'), source);
  const base = structuredClone(DEFAULT_PACKAGE_ECOSYSTEM_MANIFEST);
  base.package.name = options.name ?? `rcl.${slugify(path.basename(sourcePath ?? 'firstlight', path.extname(sourcePath ?? '')) || 'firstlight')}`;
  base.package.version = options.version ?? RCL_PACKAGE_ECOSYSTEM_VERSION;
  base.package.entry = 'src/app.rcl';
  writeText(path.join(out, 'rcl.toml'), renderRclToml(base));
  writeText(path.join(out, 'README.md'), `# ${base.package.name}\n\nRCL package ecosystem seed generated by v${RCL_PACKAGE_ECOSYSTEM_VERSION}.\n\nCommands:\n\n\`\`\`bash\nrcl package-lock .\nrcl package-release . output/release\n\`\`\`\n`);
  const report = {
    format: 'rcl.package-ecosystem-init-report.v0.42',
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    packageDir: out,
    manifestPath: path.join(out, 'rcl.toml'),
    entry: 'src/app.rcl',
    sourceSha256: sha256Bytes(source),
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

function buildDependencyLock(root, manifest) {
  return dependencyEntries(manifest.dependencies).map(dep => {
    if (dep.source === 'local') {
      const file = resolveInside(root, dep.path);
      return {
        name: dep.name,
        source: 'local',
        requested: dep.version,
        path: normalizeRel(dep.path),
        sha256: fs.existsSync(file) ? sha256File(file) : null,
        bytes: fs.existsSync(file) ? fs.statSync(file).size : null,
        resolvedVersion: manifest.package.version,
        compatibility: satisfiesSemanticVersion(manifest.package.version, dep.version),
      };
    }
    return {
      name: dep.name,
      source: 'remote',
      requested: dep.version,
      registry: dep.registry,
      integrity: dep.integrity,
      networkAccess: false,
      offlinePinned: Boolean(dep.registry && dep.integrity),
      resolvedVersion: dep.resolvedVersion ?? (dep.version.replace(/^[^0-9]*/, '').split(/\s+/)[0] || '0.0.0'),
      compatibility: true,
    };
  });
}

export function buildPackageLock(projectDir, options = {}) {
  const { root, manifest } = readRclPackageManifest(projectDir);
  const diagnostics = packageDiagnostics(manifest);
  const entryPath = diagnostics.some(item => item.code === 'RCL_PACKAGE_ENTRY_INVALID') ? null : resolveInside(root, manifest.package.entry);
  if (entryPath && !fs.existsSync(entryPath)) diagnostics.push({ code: 'RCL_PACKAGE_ENTRY_MISSING', path: manifest.package.entry });
  const files = fileInventory(root, { exclude: ['rcl.lock.json'] }).filter(item => !item.path.startsWith('release') && !item.path.startsWith('.rcl-cache/') && !item.path.startsWith('cache/'));
  for (const item of files) if (hasSecretPath(item.path)) diagnostics.push({ code: 'RCL_PACKAGE_SECRET_PATTERN', path: item.path });

  let program = null;
  let bytecodeSha256 = null;
  let programRoot = null;
  if (entryPath && fs.existsSync(entryPath) && !diagnostics.some(item => item.code.startsWith('RCL_PACKAGE_ENTRY'))) {
    const source = fs.readFileSync(entryPath, 'utf8');
    try {
      program = compileReality(source);
      programRoot = program.programRoot;
      bytecodeSha256 = sha256Bytes(compileRealityToBytecode(source));
    } catch (error) {
      diagnostics.push({ code: 'RCL_PACKAGE_COMPILE_FAILED', message: error.message });
    }
  }
  const dependencies = buildDependencyLock(root, manifest);
  for (const dep of dependencies) if (dep.source === 'local' && !dep.sha256) diagnostics.push({ code: 'RCL_PACKAGE_LOCAL_DEP_MISSING', dependency: dep.name, path: dep.path });
  const compatibility = buildCompatibilityReportFromManifest(manifest, dependencies);
  const lockBase = {
    format: RCL_PACKAGE_ECOSYSTEM_LOCK_FORMAT,
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    package: manifest.package,
    targets: manifest.targets,
    dependencies,
    files,
    roots: {
      manifestRoot: realityRoot(manifest),
      sourceRoot: entryPath && fs.existsSync(entryPath) ? sha256File(entryPath) : null,
      programRoot,
      bytecodeSha256,
      fileSetRoot: realityRoot(files),
      dependencyRoot: realityRoot(dependencies),
      compatibilityRoot: compatibility.root,
    },
    diagnostics,
  };
  const lock = { ...lockBase, ok: diagnostics.length === 0, lockRoot: realityRoot(lockBase) };
  if (options.write !== false) writeJson(path.join(root, 'rcl.lock.json'), lock);
  return Object.freeze({ ok: lock.ok, projectDir: root, lock, diagnostics, lockPath: path.join(root, 'rcl.lock.json'), root: lock.lockRoot });
}

export function verifyPackageLock(projectDir, lockPath = null) {
  const root = path.resolve(projectDir);
  const expectedPath = lockPath ? path.resolve(lockPath) : path.join(root, 'rcl.lock.json');
  if (!fs.existsSync(expectedPath)) return Object.freeze({ ok: false, format: 'rcl.package-lock-verification.v0.42', diagnostics: [{ code: 'RCL_PACKAGE_LOCK_MISSING', path: expectedPath }], root: realityRoot({ path: expectedPath }) });
  const expected = readJson(expectedPath);
  const actual = buildPackageLock(root, { write: false }).lock;
  const diagnostics = [];
  if (expected.lockRoot !== actual.lockRoot) diagnostics.push({ code: 'RCL_PACKAGE_LOCK_MISMATCH', expectedLockRoot: expected.lockRoot, actualLockRoot: actual.lockRoot });
  for (const item of actual.diagnostics ?? []) diagnostics.push(item);
  const report = { format: 'rcl.package-lock-verification.v0.42', ok: diagnostics.length === 0, packageDir: root, expectedLockRoot: expected.lockRoot, actualLockRoot: actual.lockRoot, diagnostics };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

function cacheObjectPath(cacheDir, sha256) {
  return path.join(cacheDir, 'objects', 'sha256', sha256.slice(0, 2), sha256);
}

export function populateContentAddressedCache(projectDir, cacheDir = null) {
  const root = path.resolve(projectDir);
  const cacheRoot = path.resolve(cacheDir ?? path.join(root, '.rcl-cache'));
  const lockResult = buildPackageLock(root);
  const objects = [];
  for (const file of lockResult.lock.files) {
    const source = path.join(root, file.path);
    if (!fs.existsSync(source)) continue;
    const objectPath = cacheObjectPath(cacheRoot, file.sha256);
    ensureDir(path.dirname(objectPath));
    fs.copyFileSync(source, objectPath);
    objects.push({ path: file.path, sha256: file.sha256, bytes: file.bytes, object: normalizeRel(path.relative(cacheRoot, objectPath)) });
  }
  const indexBase = { format: RCL_CONTENT_ADDRESSED_CACHE_FORMAT, version: RCL_PACKAGE_ECOSYSTEM_VERSION, package: lockResult.lock.package, lockRoot: lockResult.lock.lockRoot, objectCount: objects.length, objects: objects.sort((a, b) => a.path.localeCompare(b.path)) };
  const index = { ...indexBase, cacheRoot: realityRoot(indexBase) };
  writeJson(path.join(cacheRoot, 'cache-index.json'), index);
  return Object.freeze({ ok: true, cacheDir: cacheRoot, indexPath: path.join(cacheRoot, 'cache-index.json'), index, root: index.cacheRoot });
}

function isVolatileGeneratedPath(rel) {
  return rel === 'rcl-package.json'
    || rel === 'rcl-package-report.json'
    || rel === 'build/android-debug-build-report.json'
    || rel.endsWith('/rcl-package.json')
    || rel.endsWith('/rcl-package-report.json')
    || rel.endsWith('/build/android-debug-build-report.json');
}

function targetDirectoryRoot(targetDir) {
  const files = fileInventory(targetDir).filter(item => !hasSecretPath(item.path) && !isVolatileGeneratedPath(item.path));
  return { fileCount: files.length, fileSetRoot: realityRoot(files), files };
}

export async function buildTargetMatrix(projectDir, outputDir = null) {
  const root = path.resolve(projectDir);
  const out = path.resolve(outputDir ?? path.join(root, 'release', 'targets'));
  const lockResult = buildPackageLock(root);
  if (!lockResult.ok) {
    const report = { format: RCL_TARGET_MATRIX_FORMAT, ok: false, packageDir: root, outputDir: out, diagnostics: lockResult.diagnostics };
    writeJson(path.join(out, 'target-matrix.json'), { ...report, root: realityRoot(report) });
    return Object.freeze({ ...report, root: realityRoot(report) });
  }
  fs.rmSync(out, { recursive: true, force: true });
  ensureDir(out);
  const entry = path.join(root, lockResult.lock.package.entry);
  const packageReport = await packageRclSource(entry, { target: 'all', outputDir: out });
  const targetMap = lockResult.lock.targets;
  const platforms = SUPPORTED_PLATFORMS.map(platform => {
    const target = targetMap[platform];
    const targetDir = path.join(out, target);
    const verification = fs.existsSync(targetDir) ? verifyRclPackage(targetDir) : { status: 'missing', diagnostics: [{ code: 'RCL_TARGET_PACKAGE_MISSING' }] };
    const inventory = fs.existsSync(targetDir) ? targetDirectoryRoot(targetDir) : { fileCount: 0, fileSetRoot: null, files: [] };
    return {
      platform,
      target,
      status: verification.status,
      packageRoot: inventory.fileSetRoot,
      fileCount: inventory.fileCount,
      entrypoints: packageReport.packages.find(item => item.target === target)?.entrypoints ?? [],
      diagnostics: verification.diagnostics ?? [],
    };
  });
  const matrixBase = {
    format: RCL_TARGET_MATRIX_FORMAT,
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    ok: platforms.every(item => item.status === 'verified'),
    package: lockResult.lock.package,
    lockRoot: lockResult.lock.lockRoot,
    platforms,
    allTargets: listRclPackageTargets(),
    legacyPackageCompiler: { format: packageReport.format, packageCount: packageReport.packageCount, verifiedPackageCount: packageReport.verifiedPackageCount },
  };
  const matrix = { ...matrixBase, targetMatrixRoot: realityRoot(matrixBase) };
  writeJson(path.join(out, 'target-matrix.json'), matrix);
  return Object.freeze({ ok: matrix.ok, outputDir: out, matrix, packageReport, root: matrix.targetMatrixRoot });
}

export function buildCompatibilityReportFromManifest(manifest, dependencies = null) {
  const deps = dependencies ?? buildDependencyLock(process.cwd(), manifest);
  const packageVersionOk = Boolean(parseSemver(manifest.package.version));
  const dependencyCompatibility = deps.map(dep => ({ name: dep.name, requested: dep.requested, resolvedVersion: dep.resolvedVersion, source: dep.source, compatible: dep.compatibility !== false }));
  const targetCompatibility = SUPPORTED_PLATFORMS.map(platform => ({ platform, target: manifest.targets[platform] ?? null, supported: Boolean(manifest.targets[platform]) }));
  const reportBase = {
    format: 'rcl.package-compatibility-report.v0.42',
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    package: manifest.package,
    packageVersionOk,
    dependencyCompatibility,
    targetCompatibility,
    providerAbiLocked: dependencyCompatibility.some(item => item.name.includes('provider') && item.compatible),
    ok: packageVersionOk && dependencyCompatibility.every(item => item.compatible) && targetCompatibility.every(item => item.supported),
  };
  return Object.freeze({ ...reportBase, root: realityRoot(reportBase) });
}

function buildSbom(releaseDir, lock, matrix) {
  const files = fileInventory(releaseDir, { exclude: ['release-manifest.json', 'release-signature.json'] }).filter(item => !isVolatileGeneratedPath(item.path));
  const components = [
    { type: 'rcl-package', name: lock.package.name, version: lock.package.version, root: lock.lockRoot },
    ...lock.dependencies.map(dep => ({ type: dep.source === 'remote' ? 'remote-dependency' : 'local-dependency', name: dep.name, version: dep.resolvedVersion ?? dep.requested, source: dep.source, integrity: dep.integrity ?? dep.sha256 ?? null })),
    ...matrix.platforms.map(platform => ({ type: 'target-package', name: platform.target, platform: platform.platform, root: platform.packageRoot })),
  ];
  const sbomBase = { format: 'rcl.sbom.v0.42', version: RCL_PACKAGE_ECOSYSTEM_VERSION, components, fileCount: files.length, files };
  return { ...sbomBase, sbomRoot: realityRoot(sbomBase) };
}

function signRelease(releaseManifest, signing = 'deterministic-dev-seed') {
  const payloadRoot = releaseManifest.releaseRoot;
  const keyId = `rcl-${signing}`;
  const signatureBase = { format: RCL_RELEASE_SIGNATURE_FORMAT, algorithm: 'sha256(canonical-release-root + key-id)', keyId, seedOnly: signing === 'deterministic-dev-seed', payloadRoot };
  const signature = sha256Bytes(`${canonicalReality(signatureBase)}:${payloadRoot}:${keyId}`);
  return Object.freeze({ ...signatureBase, signature, signatureRoot: realityRoot({ ...signatureBase, signature }) });
}

export async function buildReleaseBundle(projectDir, outputDir = null, options = {}) {
  const root = path.resolve(projectDir);
  const out = path.resolve(outputDir ?? path.join(root, 'release', 'bundle'));
  fs.rmSync(out, { recursive: true, force: true });
  ensureDir(out);
  const manifestInfo = readRclPackageManifest(root);
  const lockResult = buildPackageLock(root);
  if (!lockResult.ok) {
    const report = { format: RCL_RELEASE_BUNDLE_FORMAT, ok: false, packageDir: root, outputDir: out, diagnostics: lockResult.diagnostics };
    writeJson(path.join(out, 'release-manifest.json'), { ...report, root: realityRoot(report) });
    return Object.freeze({ ...report, root: realityRoot(report) });
  }
  writeText(path.join(out, 'rcl.toml'), manifestInfo.text);
  writeJson(path.join(out, 'rcl.lock.json'), lockResult.lock);
  const cacheResult = populateContentAddressedCache(root, path.join(out, '.rcl-cache'));
  const matrixResult = await buildTargetMatrix(root, path.join(out, 'targets'));
  const compatibility = buildCompatibilityReportFromManifest(manifestInfo.manifest, lockResult.lock.dependencies);
  writeJson(path.join(out, 'compatibility-report.json'), compatibility);
  const sbom = buildSbom(out, lockResult.lock, matrixResult.matrix);
  writeJson(path.join(out, 'sbom.json'), sbom);
  const releaseBase = {
    format: RCL_RELEASE_BUNDLE_FORMAT,
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    ok: matrixResult.ok && compatibility.ok,
    package: lockResult.lock.package,
    lockRoot: lockResult.lock.lockRoot,
    cacheRoot: cacheResult.root,
    targetMatrixRoot: matrixResult.root,
    compatibilityRoot: compatibility.root,
    sbomRoot: sbom.sbomRoot,
    platforms: matrixResult.matrix.platforms.map(({ platform, target, status, packageRoot }) => ({ platform, target, status, packageRoot })),
    reproducible: true,
    generatedAt: new Date(0).toISOString(),
    boundary: 'v0.42 release bundle is deterministic and locally verifiable. Remote package fetching and production key signing are represented as pinned/offline seeds.',
  };
  const releaseManifest = { ...releaseBase, releaseRoot: realityRoot(releaseBase) };
  const signature = signRelease(releaseManifest, options.signing ?? manifestInfo.manifest.release.signing);
  writeJson(path.join(out, 'release-manifest.json'), releaseManifest);
  writeJson(path.join(out, 'release-signature.json'), signature);
  return Object.freeze({ ok: releaseManifest.ok, outputDir: out, releaseManifest, signature, root: releaseManifest.releaseRoot });
}

export function verifyReleaseBundle(releaseDir) {
  const root = path.resolve(releaseDir);
  const manifestPath = path.join(root, 'release-manifest.json');
  const signaturePath = path.join(root, 'release-signature.json');
  const diagnostics = [];
  if (!fs.existsSync(manifestPath)) diagnostics.push({ code: 'RCL_RELEASE_MANIFEST_MISSING', path: 'release-manifest.json' });
  if (!fs.existsSync(signaturePath)) diagnostics.push({ code: 'RCL_RELEASE_SIGNATURE_MISSING', path: 'release-signature.json' });
  if (diagnostics.length) {
    const report = { format: 'rcl.release-verification.v0.42', ok: false, releaseDir: root, diagnostics };
    return Object.freeze({ ...report, root: realityRoot(report) });
  }
  const manifest = readJson(manifestPath);
  const signature = readJson(signaturePath);
  const rebuiltBase = { ...manifest };
  delete rebuiltBase.releaseRoot;
  const actualReleaseRoot = realityRoot(rebuiltBase);
  if (actualReleaseRoot !== manifest.releaseRoot) diagnostics.push({ code: 'RCL_RELEASE_ROOT_MISMATCH', expected: manifest.releaseRoot, actual: actualReleaseRoot });
  const expectedSignature = signRelease(manifest, signature.keyId?.replace(/^rcl-/, '') ?? 'deterministic-dev-seed');
  if (signature.signature !== expectedSignature.signature) diagnostics.push({ code: 'RCL_RELEASE_SIGNATURE_MISMATCH' });
  if (!fs.existsSync(path.join(root, 'rcl.lock.json'))) diagnostics.push({ code: 'RCL_RELEASE_LOCK_MISSING' });
  if (!fs.existsSync(path.join(root, '.rcl-cache', 'cache-index.json'))) diagnostics.push({ code: 'RCL_RELEASE_CACHE_INDEX_MISSING' });
  if (!fs.existsSync(path.join(root, 'targets', 'target-matrix.json'))) diagnostics.push({ code: 'RCL_RELEASE_TARGET_MATRIX_MISSING' });
  for (const platform of manifest.platforms ?? []) {
    const targetDir = path.join(root, 'targets', platform.target);
    if (!fs.existsSync(targetDir)) diagnostics.push({ code: 'RCL_RELEASE_TARGET_MISSING', platform: platform.platform, target: platform.target });
    else if (verifyRclPackage(targetDir).status !== 'verified') diagnostics.push({ code: 'RCL_RELEASE_TARGET_VERIFY_FAILED', platform: platform.platform, target: platform.target });
  }
  const report = { format: 'rcl.release-verification.v0.42', ok: diagnostics.length === 0, releaseDir: root, releaseRoot: manifest.releaseRoot, signatureRoot: signature.signatureRoot, diagnostics };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export async function runPackageEcosystemDemo() {
  const demoDir = path.join(process.cwd(), 'output', 'v0.42', 'ecosystem-demo-project');
  const releaseDir = path.join(process.cwd(), 'output', 'v0.42', 'ecosystem-demo-release');
  const init = initPackageEcosystem(null, demoDir, { name: 'rcl.firstlight.package' });
  const lock = buildPackageLock(demoDir);
  const cache = populateContentAddressedCache(demoDir);
  const release = await buildReleaseBundle(demoDir, releaseDir);
  const verify = verifyReleaseBundle(releaseDir);
  return Object.freeze({
    format: 'rcl.package-ecosystem-demo.v0.42',
    version: RCL_PACKAGE_ECOSYSTEM_VERSION,
    ok: init.root && lock.ok && cache.ok && release.ok && verify.ok,
    init,
    lockRoot: lock.lock.lockRoot,
    cacheRoot: cache.root,
    releaseRoot: release.root,
    signatureRoot: release.signature.signatureRoot,
    verificationRoot: verify.root,
    platforms: release.releaseManifest.platforms,
  });
}
