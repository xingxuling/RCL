import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const WINDOWS = process.platform === 'win32';

function commandExists(command) {
  if (!command || command.includes('/') || command.includes('\\')) return fs.existsSync(command);
  const searchPath = process.env.Path ?? process.env.PATH ?? '';
  const names = WINDOWS && !command.toLowerCase().endsWith('.exe') ? [command, `${command}.exe`] : [command];
  return searchPath.split(path.delimiter).some(directory => names.some(name => fs.existsSync(path.join(directory, name))));
}

function compilerFamily(command) {
  const name = path.basename(command).toLowerCase();
  return name === 'cl' || name === 'cl.exe' ? 'msvc' : 'gnu';
}

function findVisualStudioCompiler() {
  if (!WINDOWS) return null;
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const vswhereCandidates = [
    process.env.VSWHERE,
    path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
  ].filter(Boolean);
  for (const vswhere of vswhereCandidates) {
    if (!fs.existsSync(vswhere)) continue;
    const result = spawnSync(vswhere, [
      '-latest',
      '-products', '*',
      '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property', 'installationPath',
    ], { encoding: 'utf8' });
    if (result.status !== 0) continue;
    const installationPath = result.stdout.trim().split(/\r?\n/).find(Boolean);
    if (!installationPath) continue;
    const msvcRoot = path.join(installationPath, 'VC', 'Tools', 'MSVC');
    if (!fs.existsSync(msvcRoot)) continue;
    const versions = fs.readdirSync(msvcRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse();
    for (const version of versions) {
      const candidate = path.join(msvcRoot, version, 'bin', 'Hostx64', 'x64', 'cl.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findVcvars64(compiler) {
  if (!WINDOWS || compilerFamily(compiler) !== 'msvc') return null;
  let current = path.dirname(path.resolve(compiler));
  for (let depth = 0; depth < 12; depth++) {
    const candidate = path.join(current, 'Auxiliary', 'Build', 'vcvars64.bat');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function loadMsvcEnvironment(compiler) {
  if (!WINDOWS || compilerFamily(compiler) !== 'msvc') return { ...process.env };
  const vcvars = findVcvars64(compiler);
  if (!vcvars) return { ...process.env };
  const command = `call "${vcvars}" && set`;
  let output;
  try {
    output = execSync(command, {
      shell: process.env.ComSpec ?? 'cmd.exe',
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return { ...process.env };
  }
  const environment = { ...process.env };
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    environment[key] = line.slice(separator + 1);
  }
  return environment;
}

function resolveRequested(requested) {
  if (!requested) return null;
  if (fs.existsSync(requested)) return path.resolve(requested);
  return commandExists(requested) ? requested : null;
}

export function resolveNativeCCompiler(options = {}) {
  const requested = options.compiler ?? process.env.RCL_DOMAIN_CC ?? null;
  let command = resolveRequested(requested);
  if (!command) {
    if (WINDOWS) {
      command = resolveRequested('cl.exe')
        ?? findVisualStudioCompiler()
        ?? resolveRequested('gcc.exe')
        ?? resolveRequested('clang.exe');
    } else {
      command = resolveRequested('cc') ?? resolveRequested('gcc') ?? resolveRequested('clang');
    }
  }
  if (!command) return null;
  const family = compilerFamily(command);
  return Object.freeze({
    command,
    family,
    environment: Object.freeze(loadMsvcEnvironment(command)),
  });
}

export function compileNativeC(compiler, options = {}) {
  const spec = typeof compiler === 'string'
    ? resolveNativeCCompiler({ compiler })
    : compiler;
  if (!spec) {
    return {
      status: null,
      stdout: '',
      stderr: 'No supported C compiler is available',
      error: new Error('No supported C compiler is available'),
    };
  }
  const sources = (options.sources ?? []).map(String);
  const includeDirs = (options.includeDirs ?? []).map(String);
  const linkLibraries = (options.linkLibraries ?? []).map(String);
  const extraArgs = (options.extraArgs ?? []).map(String);
  const output = String(options.output);
  const args = spec.family === 'msvc'
    ? [
      '/nologo', '/std:c11', '/W4',
      ...includeDirs.map(includeDir => `/I${includeDir}`),
      ...sources,
      ...extraArgs,
      `/Fe:${output}`,
      ...(linkLibraries.length > 0 ? ['/link', ...linkLibraries.map(library => library.endsWith('.lib') ? library : `${library}.lib`)] : []),
    ]
    : [
      '-std=c11', '-Wall', '-Wextra', '-pedantic',
      ...includeDirs.map(includeDir => `-I${includeDir}`),
      ...sources,
      ...extraArgs,
      ...linkLibraries.map(library => `-l${library}`),
      '-o', output,
    ];
  const result = spawnSync(spec.command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: spec.environment,
    encoding: 'utf8',
    timeout: options.timeout,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
  });
  return Object.freeze({
    ...result,
    compiler: spec.command,
    family: spec.family,
    args: Object.freeze(args),
  });
}

export function nativeCCompilerVersion(compiler) {
  const spec = typeof compiler === 'string'
    ? resolveNativeCCompiler({ compiler })
    : compiler;
  if (!spec) return null;
  const result = spawnSync(spec.command, spec.family === 'msvc' ? ['/Bv'] : ['--version'], {
    env: spec.environment,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return text.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? spec.command;
}

export function nativeCCompilerAvailable(options = {}) {
  return Boolean(resolveNativeCCompiler(options));
}

export const NATIVE_C_COMPILER_FORMAT = 'rcl.native-c-compiler-resolution.v0.1';
