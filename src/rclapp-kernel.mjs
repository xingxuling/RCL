import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyRclPackage } from './package-compiler.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { realityRoot } from './canonical.mjs';

export const RCL_APP_KERNEL_VERSION = '0.24.0-alpha.1';
export const RCL_APP_KERNEL_FORMAT = 'rcl.mobile-kernel.rclapp.v0.24';
export const RCL_APP_REGISTRY_FORMAT = 'rcl.mobile-kernel.rclapp-registry.v0.24';
export const RCL_APP_VERIFICATION_FORMAT = 'rcl.mobile-kernel.rclapp-verification.v0.24';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_RCLAPP_STORE_DIR = path.join(PROJECT_ROOT, 'output', 'rclapp-store');
const VALID_APP_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const SECRET_PATTERNS = [/\.env($|\.)/i, /id_rsa/i, /id_ed25519/i, /\.pem$/i, /\.p12$/i, /\.jks$/i, /keystore/i, /google-services\.json$/i];

export class RCLAppKernelError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'RCLAppKernelError';
    this.diagnostics = diagnostics;
  }
}

function nowIso() {
  return new Date(0).toISOString();
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function slugify(value) {
  return String(value ?? 'rclapp').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'rclapp';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleepSync(milliseconds) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, milliseconds);
}

function renameDirectoryWithRetry(sourceDir, targetDir) {
  const attempts = process.platform === 'win32' ? 7 : 1;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.renameSync(sourceDir, targetDir);
      return;
    } catch (error) {
      lastError = error;
      const retryable = process.platform === 'win32'
        && ['EACCES', 'EBUSY', 'EPERM'].includes(error?.code);
      if (!retryable || attempt === attempts - 1) throw error;
      sleepSync(25 * (2 ** attempt));
    }
  }
  throw lastError;
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolveStoreDir(storeDir) {
  return path.resolve(storeDir ?? process.env.RCLAPP_HOME ?? DEFAULT_RCLAPP_STORE_DIR);
}

function registryPath(storeDir) {
  return path.join(storeDir, 'rclapp-registry.json');
}

function appsDir(storeDir) {
  return path.join(storeDir, 'apps');
}

function validateAppId(appId) {
  const normalized = String(appId ?? '').trim();
  if (!VALID_APP_ID.test(normalized)) {
    throw new RCLAppKernelError(`Invalid RCL app id: ${appId}`, [{ code: 'RCLAPP_INVALID_APP_ID', appId }]);
  }
  return normalized;
}

function installedAppDir(storeDir, appId) {
  return path.join(appsDir(storeDir), validateAppId(appId));
}

function installedPackageDir(storeDir, appId) {
  return path.join(installedAppDir(storeDir, appId), 'package');
}

function installedManifestPath(storeDir, appId) {
  return path.join(installedAppDir(storeDir, appId), 'rclapp.json');
}

function emptyRegistry(storeDir) {
  const registry = {
    format: RCL_APP_REGISTRY_FORMAT,
    kernelVersion: RCL_APP_KERNEL_VERSION,
    storeDir,
    appCount: 0,
    apps: {},
    updatedAt: nowIso(),
  };
  return { ...registry, root: realityRoot(registry) };
}

function loadRegistry(storeDir) {
  ensureDir(storeDir);
  const file = registryPath(storeDir);
  if (!fs.existsSync(file)) return emptyRegistry(storeDir);
  const parsed = readJson(file);
  return {
    ...emptyRegistry(storeDir),
    ...parsed,
    apps: parsed.apps ?? {},
    appCount: Object.keys(parsed.apps ?? {}).length,
  };
}

function saveRegistry(storeDir, registry) {
  const normalized = {
    format: RCL_APP_REGISTRY_FORMAT,
    kernelVersion: RCL_APP_KERNEL_VERSION,
    storeDir,
    apps: registry.apps ?? {},
    appCount: Object.keys(registry.apps ?? {}).length,
    updatedAt: nowIso(),
  };
  writeJson(registryPath(storeDir), { ...normalized, root: realityRoot(normalized) });
  return normalized;
}

function walkEntries(root) {
  const result = [];
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    result.push({ full, entry });
    if (entry.isDirectory()) result.push(...walkEntries(full));
  }
  return result;
}

function walkFiles(root) {
  const result = [];
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(full));
    else result.push(full);
  }
  return result.sort();
}

function copyTreeNoSymlinks(sourceDir, targetDir) {
  const diagnostics = [];
  for (const { full } of walkEntries(sourceDir)) {
    if (fs.lstatSync(full).isSymbolicLink()) {
      diagnostics.push({ code: 'RCLAPP_SYMLINK_REJECTED', path: path.relative(sourceDir, full).replaceAll(path.sep, '/') });
    }
  }
  if (diagnostics.length) throw new RCLAppKernelError('RCL app package contains symlinks and cannot be installed safely.', diagnostics);
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyTreeNoSymlinks(from, to);
    else if (entry.isFile()) {
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
      fs.chmodSync(to, fs.statSync(from).mode & 0o777);
    } else {
      throw new RCLAppKernelError('RCL app package contains unsupported filesystem entry.', [{ code: 'RCLAPP_UNSUPPORTED_ENTRY', path: path.relative(sourceDir, from).replaceAll(path.sep, '/') }]);
    }
  }
}

function scanInstallSafety(packageDir) {
  const diagnostics = [];
  for (const file of walkFiles(packageDir)) {
    const rel = path.relative(packageDir, file).replaceAll(path.sep, '/');
    if (SECRET_PATTERNS.some(pattern => pattern.test(rel))) diagnostics.push({ code: 'RCLAPP_SECRET_PATTERN', path: rel });
    if (fs.lstatSync(file).isSymbolicLink()) diagnostics.push({ code: 'RCLAPP_SYMLINK_REJECTED', path: rel });
  }
  return diagnostics;
}

function readPackageManifest(packageDir) {
  const manifestFile = path.join(packageDir, 'rcl-package.json');
  if (!fs.existsSync(manifestFile)) {
    throw new RCLAppKernelError('Missing rcl-package.json.', [{ code: 'RCLAPP_PACKAGE_MANIFEST_MISSING', packageDir }]);
  }
  return readJson(manifestFile);
}

function ensureRunnablePackage(packageDir, packageVerification = verifyRclPackage(packageDir)) {
  const diagnostics = [...(packageVerification.diagnostics ?? [])];
  const bytecodePath = path.join(packageDir, 'program.rbc');
  const manifestPath = path.join(packageDir, 'rcl-package.json');
  if (!fs.existsSync(manifestPath)) diagnostics.push({ code: 'RCLAPP_PACKAGE_MANIFEST_MISSING', path: 'rcl-package.json' });
  if (!fs.existsSync(bytecodePath)) diagnostics.push({ code: 'RCLAPP_BYTECODE_MISSING', path: 'program.rbc' });
  diagnostics.push(...scanInstallSafety(packageDir));
  const status = packageVerification.status === 'verified' && diagnostics.length === 0 ? 'verified' : 'rejected';
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const report = {
    format: RCL_APP_VERIFICATION_FORMAT,
    kernelVersion: RCL_APP_KERNEL_VERSION,
    mode: 'package',
    status,
    installable: status === 'verified',
    packageDir: path.resolve(packageDir),
    manifestTarget: manifest?.target ?? null,
    program: manifest?.program ?? null,
    bytecodeSha256: manifest?.bytecodeSha256 ?? null,
    diagnostics,
    packageVerification,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

function deriveAppId(manifest, explicitAppId = undefined) {
  if (explicitAppId) return validateAppId(explicitAppId);
  const program = slugify(manifest.program ?? 'rclapp');
  const hash = String(manifest.bytecodeSha256 ?? manifest.sourceSha256 ?? sha256Bytes(JSON.stringify(manifest))).slice(0, 12);
  return validateAppId(`rcl.${program}.${hash}`);
}

function installedVerification(appId, storeDir) {
  const diagnostics = [];
  let manifest = null;
  let record = null;
  const registry = loadRegistry(storeDir);
  const appDir = installedAppDir(storeDir, appId);
  const packageDir = installedPackageDir(storeDir, appId);
  const manifestFile = installedManifestPath(storeDir, appId);
  if (!fs.existsSync(appDir)) diagnostics.push({ code: 'RCLAPP_NOT_INSTALLED', appId });
  if (!fs.existsSync(manifestFile)) diagnostics.push({ code: 'RCLAPP_INSTALL_MANIFEST_MISSING', path: path.relative(storeDir, manifestFile).replaceAll(path.sep, '/') });
  else manifest = readJson(manifestFile);
  if (!registry.apps[appId]) diagnostics.push({ code: 'RCLAPP_REGISTRY_RECORD_MISSING', appId });
  else record = registry.apps[appId];
  const packageVerification = fs.existsSync(packageDir) ? ensureRunnablePackage(packageDir) : null;
  if (!fs.existsSync(packageDir)) diagnostics.push({ code: 'RCLAPP_INSTALLED_PACKAGE_MISSING', path: path.relative(storeDir, packageDir).replaceAll(path.sep, '/') });
  if (packageVerification && packageVerification.status !== 'verified') diagnostics.push(...packageVerification.diagnostics.map(item => ({ ...item, installedPackage: true })));
  if (manifest?.appId && manifest.appId !== appId) diagnostics.push({ code: 'RCLAPP_APP_ID_MISMATCH', expected: appId, actual: manifest.appId });
  if (record?.bytecodeSha256 && manifest?.bytecodeSha256 && record.bytecodeSha256 !== manifest.bytecodeSha256) diagnostics.push({ code: 'RCLAPP_REGISTRY_SHA_MISMATCH', registry: record.bytecodeSha256, manifest: manifest.bytecodeSha256 });
  const status = diagnostics.length === 0 ? 'verified' : 'rejected';
  const report = {
    format: RCL_APP_VERIFICATION_FORMAT,
    kernelVersion: RCL_APP_KERNEL_VERSION,
    mode: 'installed',
    status,
    appId,
    storeDir,
    appDir,
    packageDir,
    manifest,
    record,
    diagnostics,
    packageVerification,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function defaultRclAppStoreDir() {
  return resolveStoreDir();
}

export function verifyRclApp(target, options = {}) {
  const storeDir = resolveStoreDir(options.storeDir);
  const candidatePath = path.resolve(String(target ?? ''));
  if (target && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    return ensureRunnablePackage(candidatePath, verifyRclPackage(candidatePath));
  }
  return installedVerification(validateAppId(target), storeDir);
}

export function installRclApp(packageDir, options = {}) {
  const sourceDir = path.resolve(packageDir);
  const storeDir = resolveStoreDir(options.storeDir);
  const packageVerification = ensureRunnablePackage(sourceDir, verifyRclPackage(sourceDir));
  if (packageVerification.status !== 'verified') {
    throw new RCLAppKernelError('RCL app package verification failed; install aborted.', packageVerification.diagnostics);
  }
  const packageManifest = readPackageManifest(sourceDir);
  const appId = deriveAppId(packageManifest, options.appId);
  const appDir = installedAppDir(storeDir, appId);
  const packageTargetDir = installedPackageDir(storeDir, appId);
  const registry = loadRegistry(storeDir);
  if (fs.existsSync(appDir) && !options.force) {
    throw new RCLAppKernelError(`RCL app already installed: ${appId}`, [{ code: 'RCLAPP_ALREADY_INSTALLED', appId }]);
  }
  const tmpDir = path.join(appsDir(storeDir), `.${appId}.tmp`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  ensureDir(tmpDir);
  copyTreeNoSymlinks(sourceDir, path.join(tmpDir, 'package'));
  const installedManifest = {
    format: RCL_APP_KERNEL_FORMAT,
    kernelVersion: RCL_APP_KERNEL_VERSION,
    appId,
    program: packageManifest.program,
    target: packageManifest.target,
    sourceSha256: packageManifest.sourceSha256,
    bytecodeSha256: packageManifest.bytecodeSha256,
    installedAt: nowIso(),
    packageManifestRoot: packageManifest.root ?? null,
    packageDir: 'package',
    entrypoint: 'program.rbc',
    authority: {
      source: 'rcl-package.json',
      verification: packageVerification.root,
      installMode: 'copy-verified-package',
    },
  };
  writeJson(path.join(tmpDir, 'rclapp.json'), { ...installedManifest, root: realityRoot(installedManifest) });
  fs.rmSync(appDir, { recursive: true, force: true });
  renameDirectoryWithRetry(tmpDir, appDir);
  const record = {
    appId,
    program: packageManifest.program,
    target: packageManifest.target,
    sourceSha256: packageManifest.sourceSha256,
    bytecodeSha256: packageManifest.bytecodeSha256,
    installedAt: installedManifest.installedAt,
    installDir: path.relative(storeDir, appDir).replaceAll(path.sep, '/'),
    packageDir: path.relative(storeDir, packageTargetDir).replaceAll(path.sep, '/'),
    runCount: registry.apps[appId]?.runCount ?? 0,
    lastRunAt: registry.apps[appId]?.lastRunAt ?? null,
    status: 'installed',
  };
  registry.apps[appId] = record;
  const savedRegistry = saveRegistry(storeDir, registry);
  const verification = installedVerification(appId, storeDir);
  const report = {
    format: 'rcl.mobile-kernel.rclapp-install.v0.24',
    kernelVersion: RCL_APP_KERNEL_VERSION,
    status: verification.status === 'verified' ? 'installed' : 'installed-with-diagnostics',
    appId,
    storeDir,
    appDir,
    packageDir: packageTargetDir,
    record,
    verification,
    registryRoot: savedRegistry.root,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function listRclApps(options = {}) {
  const storeDir = resolveStoreDir(options.storeDir);
  const registry = loadRegistry(storeDir);
  const apps = Object.values(registry.apps ?? {}).sort((a, b) => a.appId.localeCompare(b.appId));
  const report = {
    format: 'rcl.mobile-kernel.rclapp-list.v0.24',
    kernelVersion: RCL_APP_KERNEL_VERSION,
    status: 'ok',
    storeDir,
    appCount: apps.length,
    apps,
    registryRoot: registry.root ?? null,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function runRclApp(appId, options = {}) {
  const storeDir = resolveStoreDir(options.storeDir);
  const normalizedAppId = validateAppId(appId);
  const verification = installedVerification(normalizedAppId, storeDir);
  if (verification.status !== 'verified') {
    throw new RCLAppKernelError(`RCL app is not verified and cannot be run: ${normalizedAppId}`, verification.diagnostics);
  }
  const bytecodePath = path.join(verification.packageDir, 'program.rbc');
  const execution = runNativeBytecode(bytecodePath, options.runOptions ?? {});
  const registry = loadRegistry(storeDir);
  const record = registry.apps[normalizedAppId];
  registry.apps[normalizedAppId] = {
    ...record,
    runCount: (record?.runCount ?? 0) + 1,
    lastRunAt: nowIso(),
    status: 'installed',
    lastRunRoot: execution.root ?? realityRoot(execution),
  };
  const savedRegistry = saveRegistry(storeDir, registry);
  const report = {
    format: 'rcl.mobile-kernel.rclapp-run.v0.24',
    kernelVersion: RCL_APP_KERNEL_VERSION,
    status: 'ran',
    appId: normalizedAppId,
    storeDir,
    bytecodePath,
    execution,
    registryRoot: savedRegistry.root,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}

export function uninstallRclApp(appId, options = {}) {
  const storeDir = resolveStoreDir(options.storeDir);
  const normalizedAppId = validateAppId(appId);
  const registry = loadRegistry(storeDir);
  const appDir = installedAppDir(storeDir, normalizedAppId);
  const existed = fs.existsSync(appDir) || Boolean(registry.apps[normalizedAppId]);
  fs.rmSync(appDir, { recursive: true, force: true });
  delete registry.apps[normalizedAppId];
  const savedRegistry = saveRegistry(storeDir, registry);
  const report = {
    format: 'rcl.mobile-kernel.rclapp-uninstall.v0.24',
    kernelVersion: RCL_APP_KERNEL_VERSION,
    status: existed ? 'uninstalled' : 'not-installed',
    appId: normalizedAppId,
    storeDir,
    removedDir: appDir,
    registryRoot: savedRegistry.root,
  };
  return Object.freeze({ ...report, root: realityRoot(report) });
}
