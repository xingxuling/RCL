#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_NATIVE_VM_PATH, runRealityNative } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'native-windows-boundary.json');
const nativeDir = path.join(root, 'native');
const nativeExePath = path.join(nativeDir, 'rclvm.exe');
const posixNativePath = path.join(nativeDir, 'rclvm');

function sha256File(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null;
}

function executableFormat(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, bytes: 0, mz: false, pe: false, peOffset: null };
  const buffer = fs.readFileSync(filePath);
  const peOffset = buffer.length >= 0x40 ? buffer.readUInt32LE(0x3c) : -1;
  const signature = peOffset >= 0 && peOffset + 4 <= buffer.length
    ? buffer.toString('ascii', peOffset, peOffset + 4)
    : '';
  return {
    exists: true,
    bytes: buffer.length,
    mz: buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'MZ',
    pe: signature === 'PE\u0000\u0000',
    peOffset,
  };
}

function commandExists(command) {
  const result = process.platform === 'win32'
    ? spawnSync('where.exe', [command], { encoding: 'utf8' })
    : spawnSync('sh', ['-lc', 'command -v -- "$1"', 'rcl-command-probe', command], { encoding: 'utf8' });
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  return {
    command,
    probe: process.platform === 'win32' ? 'where.exe' : 'command -v',
    exists: result.status === 0,
    stdout: stdout.trim().split(/\r?\n/).filter(Boolean),
    stderr: stderr.trim(),
    exitCode: Number.isInteger(result.status) ? result.status : null,
    error: result.error ? {
      code: result.error.code ?? result.error.name,
      message: result.error.message,
    } : null,
  };
}

function testPath(filePath) {
  return { path: filePath, exists: fs.existsSync(filePath) };
}

function decodeWindowsToolOutput(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? '');
  const utf8 = raw.toString('utf8').replace(/\0/g, '').trim();
  const utf16 = raw.toString('utf16le').trim();
  return utf16.length > utf8.length ? utf16 : utf8;
}

function runWslProbe(args) {
  const result = spawnSync('wsl.exe', args, { encoding: 'buffer', timeout: 10_000 });
  return {
    args,
    exitCode: result.status,
    signal: result.signal,
    stdout: decodeWindowsToolOutput(result.stdout),
    stderr: decodeWindowsToolOutput(result.stderr),
    usable: result.status === 0,
  };
}

let defaultNativeRun = null;
try {
  defaultNativeRun = {
    ok: true,
    result: runRealityNative('reality NativeBoundaryProbe { facet world.ready : Truth = true }'),
  };
} catch (error) {
  defaultNativeRun = {
    ok: false,
    code: error.code ?? error.name,
    message: error.message,
  };
}

const compilerCommands = ['cl', 'gcc', 'clang'].map(commandExists);
const commonCompilerPaths = [
  'C:\\msys64\\mingw64\\bin\\gcc.exe',
  'C:\\msys64\\ucrt64\\bin\\gcc.exe',
  'C:\\Program Files\\LLVM\\bin\\clang.exe',
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC',
].map(testPath);
const wslCommand = commandExists('wsl');
const wslList = wslCommand.exists ? runWslProbe(['--list', '--quiet']) : null;
const wslUname = wslCommand.exists ? runWslProbe(['uname', '-a']) : null;
const compilerAvailable = compilerCommands.some(item => item.exists) || commonCompilerPaths.some(item => item.exists);
const wslUsable = Boolean(wslList?.usable && wslUname?.usable);
const nativeExeExists = fs.existsSync(nativeExePath);
const nativeExeFormat = executableFormat(nativeExePath);
const nativeExeIsPe = nativeExeFormat.mz === true && nativeExeFormat.pe === true;
const nativeExeLooksReal = nativeExeIsPe;
const nativeExeRuns = defaultNativeRun?.ok === true;
const nativeArtifactVerified = nativeExeExists && nativeExeIsPe;
const windowsExecutionVerified = process.platform === 'win32' && nativeExeRuns && nativeArtifactVerified;
const hostNativeExecutionVerified = process.platform !== 'win32' && nativeExeRuns;
const nativeWindowsBlocked = process.platform === 'win32' && !windowsExecutionVerified && !nativeExeExists && !compilerAvailable && !wslUsable;
const status = windowsExecutionVerified
  ? 'NATIVE_WINDOWS_VERIFIED'
  : (nativeWindowsBlocked
    ? 'NATIVE_WINDOWS_BLOCKED'
    : (hostNativeExecutionVerified ? 'HOST_NATIVE_VERIFIED' : (nativeArtifactVerified ? 'NATIVE_WINDOWS_ARTIFACT_ONLY' : 'NATIVE_WINDOWS_RECHECK_REQUIRED')));
const reason = windowsExecutionVerified
  ? 'The current Windows host selected native/rclvm.exe, confirmed its PE header, and completed the default native VM smoke run.'
  : (hostNativeExecutionVerified
    ? 'The current host completed the native VM smoke run, but this is POSIX host-native execution; it is not Windows execution evidence.'
    : (nativeArtifactVerified
      ? 'The Windows PE artifact is present and structurally valid, but Windows execution was not observed in this run.'
      : (nativeWindowsBlocked
        ? 'No runnable native/rclvm.exe, C compiler, or usable WSL execution bridge was available on this Windows host.'
        : 'The Windows native boundary should be rechecked because at least one build or execution precondition is present but the smoke run did not prove success.')));

const payload = {
  ok: true,
  format: 'rcl.native-windows-boundary.v1',
  status,
  platform: process.platform,
  defaultNativeVmPath: DEFAULT_NATIVE_VM_PATH,
  artifacts: {
    nativeExe: {
      path: path.relative(root, nativeExePath).replaceAll(path.sep, '/'),
      exists: nativeExeExists,
      sha256: sha256File(nativeExePath),
      executableFormat: nativeExeFormat,
    },
    posixNativeBinary: {
      path: path.relative(root, posixNativePath).replaceAll(path.sep, '/'),
      exists: fs.existsSync(posixNativePath),
      sha256: sha256File(posixNativePath),
    },
  },
  probes: {
    defaultNativeRun,
    compilerCommands,
    commonCompilerPaths,
    wsl: {
      command: wslCommand,
      list: wslList,
      uname: wslUname,
      usable: wslUsable,
    },
  },
  boundary: {
    nativeArtifactVerified,
    windowsPeHeaderVerified: nativeExeIsPe,
    windowsExecutionVerified,
    hostNativeExecutionVerified,
    nativeWindowsStillBlocked: !windowsExecutionVerified,
    nativeExeLooksReal,
    reason,
    notAClaim: 'This verifier records the current Windows native execution boundary; it does not prove the C VM source is invalid.',
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
