import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { realityRoot } from './canonical.mjs';
import { tryCompileReality } from './compiler.mjs';
import { compileTypedModuleGraph } from './type-module-kernel.mjs';

export const RCL_TYPED_PACKAGE_VERSION = '0.32.0-alpha.1';
export const RCL_TYPED_PACKAGE_MANIFEST_FORMAT = 'rcl.typed-package.manifest.v0.32';
export const RCL_TYPED_PACKAGE_LOCK_FORMAT = 'rcl.typed-package.lock.v0.32';
export const DEFAULT_TYPED_PACKAGE_MANIFEST = 'rcl.package.json';
export const DEFAULT_TYPED_PACKAGE_LOCK = 'rcl.package.lock.json';

export class RCLTypedPackageError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'RCLTypedPackageError';
    this.code = diagnostics[0]?.code ?? 'RCL_TYPED_PACKAGE_ERROR';
    this.diagnostics = diagnostics;
  }
}

function diagnostic(code, message, extra = {}) {
  return { code, message, severity: 'error', ...extra };
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function normalizeRelativePath(input, label = 'path') {
  if (typeof input !== 'string' || !input.trim()) throw new RCLTypedPackageError(`Typed package ${label} must be a non-empty relative path`, [diagnostic('RCL_TYPED_PACKAGE_PATH_INVALID', `Typed package ${label} must be a non-empty relative path`, { path: input })]);
  const normalized = input.replaceAll('\\', '/');
  if (path.isAbsolute(normalized) || normalized.includes('\0')) throw new RCLTypedPackageError(`Typed package ${label} must stay inside package root`, [diagnostic('RCL_TYPED_PACKAGE_PATH_ESCAPE', `Typed package ${label} must stay inside package root`, { path: input })]);
  const collapsed = path.posix.normalize(normalized);
  if (collapsed === '.' || collapsed.startsWith('../') || collapsed === '..') throw new RCLTypedPackageError(`Typed package ${label} must stay inside package root`, [diagnostic('RCL_TYPED_PACKAGE_PATH_ESCAPE', `Typed package ${label} must stay inside package root`, { path: input })]);
  return collapsed;
}

function resolveInside(root, relativePath, label = 'path') {
  const safe = normalizeRelativePath(relativePath, label);
  const full = path.resolve(root, safe);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(`${rootResolved}${path.sep}`)) throw new RCLTypedPackageError(`Typed package ${label} escapes package root`, [diagnostic('RCL_TYPED_PACKAGE_PATH_ESCAPE', `Typed package ${label} escapes package root`, { path: relativePath })]);
  return { safe, full };
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new RCLTypedPackageError(`Failed to read ${label}: ${error.message}`, [diagnostic('RCL_TYPED_PACKAGE_JSON_INVALID', `Failed to read ${label}: ${error.message}`, { filePath })]);
  }
}

function validateManifest(raw, manifestRelativePath) {
  const diagnostics = [];
  const manifest = {
    format: raw.format ?? RCL_TYPED_PACKAGE_MANIFEST_FORMAT,
    name: raw.name,
    version: raw.version,
    entry: raw.entry,
    types: raw.types ?? [],
    dependencies: raw.dependencies ?? [],
    exports: raw.exports ?? {},
    metadata: raw.metadata ?? {},
  };
  if (manifest.format !== RCL_TYPED_PACKAGE_MANIFEST_FORMAT) diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_FORMAT_UNSUPPORTED', `Unsupported typed package manifest format '${manifest.format}'`, { manifestRelativePath }));
  if (!/^[A-Za-z0-9_.-]+$/.test(String(manifest.name ?? ''))) diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_NAME_INVALID', 'Typed package name must use letters, numbers, underscore, dash or dot', { manifestRelativePath }));
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9_.-]+)?$/.test(String(manifest.version ?? ''))) diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_VERSION_INVALID', 'Typed package version must look like semver, for example 0.1.0', { manifestRelativePath }));
  if (typeof manifest.entry !== 'string') diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_ENTRY_MISSING', 'Typed package manifest requires an entry .rcl file', { manifestRelativePath }));
  if (!Array.isArray(manifest.types)) diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_TYPES_INVALID', 'Typed package manifest types must be an array', { manifestRelativePath }));
  if (!Array.isArray(manifest.dependencies)) diagnostics.push(diagnostic('RCL_TYPED_PACKAGE_DEPENDENCIES_INVALID', 'Typed package manifest dependencies must be an array', { manifestRelativePath }));
  if (diagnostics.length > 0) throw new RCLTypedPackageError('Typed package manifest failed validation', diagnostics);
  return Object.freeze(manifest);
}

function readManifest(packageDir, manifestPath = DEFAULT_TYPED_PACKAGE_MANIFEST) {
  const { safe, full } = resolveInside(packageDir, manifestPath, 'manifestPath');
  if (!fs.existsSync(full)) throw new RCLTypedPackageError(`Typed package manifest '${safe}' does not exist`, [diagnostic('RCL_TYPED_PACKAGE_MANIFEST_MISSING', `Typed package manifest '${safe}' does not exist`, { manifestPath: safe })]);
  return { manifest: validateManifest(readJsonFile(full, 'typed package manifest'), safe), manifestPath: safe, manifestFullPath: full };
}

function collectTypePaths(packageDir, manifest) {
  const explicit = manifest.types ?? [];
  if (explicit.length > 0) return explicit.map(item => normalizeRelativePath(item, 'types[]'));
  const result = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue;
        walk(full);
      } else if (name.endsWith('.rcltype')) {
        result.push(path.relative(packageDir, full).replaceAll(path.sep, '/'));
      }
    }
  };
  walk(packageDir);
  return result.sort();
}

function buildFileEntry(packageDir, relativePath, role) {
  const { safe, full } = resolveInside(packageDir, relativePath, role);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new RCLTypedPackageError(`Typed package ${role} '${safe}' does not exist`, [diagnostic('RCL_TYPED_PACKAGE_FILE_MISSING', `Typed package ${role} '${safe}' does not exist`, { path: safe, role })]);
  const content = fs.readFileSync(full);
  return {
    path: safe,
    role,
    bytes: content.byteLength,
    sha256: sha256Buffer(content),
  };
}

function dependencySummary(dependencies) {
  return (dependencies ?? []).map((item, index) => ({
    name: item.name ?? null,
    version: item.version ?? null,
    source: item.source ?? item.path ?? null,
    index,
  })).sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.index - b.index);
}

function summarizeTypeModules(typeModuleReport) {
  return (typeModuleReport?.ir?.modules ?? []).map(module => ({
    name: module.name,
    modulePath: module.modulePath,
    exports: module.exports ?? [],
    declarationCount: module.declarations?.length ?? 0,
    declarations: (module.declarations ?? []).map(decl => ({
      name: decl.name,
      qualifiedName: decl.qualifiedName,
      kind: decl.kind,
      typeParams: decl.typeParams ?? [],
      exported: Boolean(decl.exported),
    })),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function buildLock({ manifest, manifestPath, fileEntries, typeModuleReport, compileResult }) {
  const semanticMap = compileResult.program.semanticMap;
  const typeBindings = compileResult.program.typeBindings;
  const sourceMap = compileResult.program.sourceMap;
  const base = {
    format: RCL_TYPED_PACKAGE_LOCK_FORMAT,
    version: RCL_TYPED_PACKAGE_VERSION,
    package: {
      name: manifest.name,
      version: manifest.version,
      manifestPath,
      entry: normalizeRelativePath(manifest.entry, 'entry'),
    },
    dependencies: dependencySummary(manifest.dependencies),
    files: fileEntries.slice().sort((a, b) => a.path.localeCompare(b.path)),
    roots: {
      typeModuleRoot: typeModuleReport?.irRoot ?? null,
      typeCompileRoot: typeModuleReport?.root ?? null,
      semanticMapRoot: realityRoot(semanticMap),
      typeBindingsRoot: realityRoot(typeBindings),
      sourceMapRoot: realityRoot(sourceMap),
      programRoot: compileResult.program.programRoot,
    },
    typeModules: summarizeTypeModules(typeModuleReport),
    semantic: {
      reality: semanticMap.reality,
      facetCount: semanticMap.facetCount,
      typedFacetCount: semanticMap.typedFacetCount,
      constructorCount: semanticMap.constructorCount,
    },
    boundary: 'P3 package slice: typed manifest and lockfile pin entry source, .rcltype graph roots, semantic maps and program root for reproducible typed builds. Full remote dependency resolution remains staged.',
  };
  return Object.freeze({ ...base, lockRoot: realityRoot(base) });
}

function buildSources(packageDir, manifest, manifestPath) {
  const entry = buildFileEntry(packageDir, manifest.entry, 'entry');
  if (!entry.path.endsWith('.rcl')) throw new RCLTypedPackageError(`Typed package entry '${entry.path}' must end with .rcl`, [diagnostic('RCL_TYPED_PACKAGE_ENTRY_KIND', `Typed package entry '${entry.path}' must end with .rcl`, { path: entry.path })]);
  const typePaths = collectTypePaths(packageDir, manifest);
  const typeEntries = typePaths.map(typePath => {
    const entry = buildFileEntry(packageDir, typePath, 'type');
    if (!entry.path.endsWith('.rcltype')) throw new RCLTypedPackageError(`Typed package type source '${entry.path}' must end with .rcltype`, [diagnostic('RCL_TYPED_PACKAGE_TYPE_KIND', `Typed package type source '${entry.path}' must end with .rcltype`, { path: entry.path })]);
    return entry;
  });
  const manifestEntry = buildFileEntry(packageDir, manifestPath, 'manifest');
  const source = fs.readFileSync(path.join(packageDir, entry.path), 'utf8');
  const typeModuleSources = Object.fromEntries(typeEntries.map(item => [item.path, fs.readFileSync(path.join(packageDir, item.path), 'utf8')]));
  return {
    source,
    typeModuleSources,
    fileEntries: [manifestEntry, entry, ...typeEntries],
  };
}

export function compileTypedPackage(packageDir, options = {}) {
  const manifestPath = options.manifestPath ?? DEFAULT_TYPED_PACKAGE_MANIFEST;
  const lockPath = options.lockPath ?? DEFAULT_TYPED_PACKAGE_LOCK;
  try {
    const root = path.resolve(packageDir);
    const { manifest, manifestPath: safeManifestPath } = readManifest(root, manifestPath);
    const { source, typeModuleSources, fileEntries } = buildSources(root, manifest, safeManifestPath);
    const typeModuleReport = compileTypedModuleGraph(typeModuleSources);
    if (!typeModuleReport.ok) return { ok: false, diagnostics: typeModuleReport.diagnostics, manifest, packageDir: root, lock: null };
    const compileResult = tryCompileReality(source, { typeModuleReport });
    if (!compileResult.ok) return { ok: false, diagnostics: compileResult.diagnostics, manifest, packageDir: root, typeModuleReport, lock: null };
    const lock = buildLock({ manifest, manifestPath: safeManifestPath, fileEntries, typeModuleReport, compileResult });
    const payload = {
      ok: true,
      format: 'rcl.typed-package.build-report.v0.32',
      version: RCL_TYPED_PACKAGE_VERSION,
      packageDir: root,
      manifest,
      manifestPath: safeManifestPath,
      lock,
      diagnostics: [],
      programRoot: compileResult.program.programRoot,
      semanticMap: compileResult.program.semanticMap,
      typeBindings: compileResult.program.typeBindings,
      typeModuleRoot: typeModuleReport.irRoot,
    };
    if (options.writeLock !== false) {
      const { full } = resolveInside(root, lockPath, 'lockPath');
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, `${JSON.stringify(lock, null, 2)}\n`);
      payload.lockPath = normalizeRelativePath(lockPath, 'lockPath');
    }
    return payload;
  } catch (error) {
    const diagnostics = error.diagnostics?.length ? error.diagnostics : [diagnostic(error.code ?? 'RCL_TYPED_PACKAGE_FAILURE', error.message)];
    if (options.throwOnError) throw error;
    return { ok: false, diagnostics, packageDir: path.resolve(packageDir), lock: null };
  }
}

export function verifyTypedPackageLock(packageDir, options = {}) {
  const lockPath = options.lockPath ?? DEFAULT_TYPED_PACKAGE_LOCK;
  try {
    const root = path.resolve(packageDir);
    const { safe, full } = resolveInside(root, lockPath, 'lockPath');
    if (!fs.existsSync(full)) return { ok: false, diagnostics: [diagnostic('RCL_TYPED_PACKAGE_LOCK_MISSING', `Typed package lock '${safe}' does not exist`, { lockPath: safe })] };
    const existing = readJsonFile(full, 'typed package lock');
    const built = compileTypedPackage(root, { ...options, writeLock: false });
    if (!built.ok) return { ok: false, diagnostics: built.diagnostics, existingLock: existing, rebuiltLock: built.lock };
    const sameRoot = existing.lockRoot === built.lock.lockRoot;
    const sameCanonical = realityRoot({ ...existing, lockRoot: undefined }) === built.lock.lockRoot;
    const ok = sameRoot && sameCanonical;
    return {
      ok,
      format: 'rcl.typed-package.verify-report.v0.32',
      version: RCL_TYPED_PACKAGE_VERSION,
      lockPath: safe,
      expectedLockRoot: existing.lockRoot ?? null,
      rebuiltLockRoot: built.lock.lockRoot,
      diagnostics: ok ? [] : [diagnostic('RCL_TYPED_PACKAGE_LOCK_MISMATCH', 'Typed package lock does not match current manifest, sources or type graph', { lockPath: safe })],
      package: built.lock.package,
      roots: built.lock.roots,
    };
  } catch (error) {
    const diagnostics = error.diagnostics?.length ? error.diagnostics : [diagnostic(error.code ?? 'RCL_TYPED_PACKAGE_VERIFY_FAILURE', error.message)];
    return { ok: false, diagnostics };
  }
}

export function runTypedPackageDemo(options = {}) {
  const baseDir = options.baseDir ?? fs.mkdtempSync(path.join(process.cwd(), 'output', 'v0.32-typed-package-demo-'));
  fs.mkdirSync(path.join(baseDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'rcl.package.json'), `${JSON.stringify({
    format: RCL_TYPED_PACKAGE_MANIFEST_FORMAT,
    name: 'firstlight.typed',
    version: '0.1.0',
    entry: 'src/app.rcl',
    types: ['types/core.rcltype'],
    exports: { reality: 'src/app.rcl', types: ['types/core.rcltype'] },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(baseDir, 'types', 'core.rcltype'), `module core\nexport record User<T> {\n  id: Text\n  payload: T\n}\nexport union LoginResult<T,E> {\n  Ok(T)\n  Err(E)\n}\n`);
  fs.writeFileSync(path.join(baseDir, 'src', 'app.rcl'), `reality TypedPackageDemo {\n  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }\n  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")\n}\n`);
  const build = compileTypedPackage(baseDir);
  const verify = verifyTypedPackageLock(baseDir);
  return {
    stage: 'typed-package-kernel-v0.32',
    ok: build.ok && verify.ok,
    packageDir: baseDir,
    package: build.lock?.package ?? null,
    lockRoot: build.lock?.lockRoot ?? null,
    programRoot: build.programRoot ?? null,
    typeModuleRoot: build.typeModuleRoot ?? null,
    typedFacetCount: build.semanticMap?.typedFacetCount ?? 0,
    constructorCount: build.semanticMap?.constructorCount ?? 0,
    verifyOk: verify.ok,
    diagnostics: [...(build.diagnostics ?? []), ...(verify.diagnostics ?? [])],
    boundary: build.lock?.boundary ?? 'typed package demo failed before lock generation',
  };
}
