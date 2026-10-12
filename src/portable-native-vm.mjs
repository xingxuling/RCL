import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileSourceFileSelfHosted } from './selfhost-compiler.mjs';
import { verifyNativeSemanticStateRoot } from './semantic-state-root.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ALGORITHM = 'rcl.semantic-state-root.v2';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const binding = file => ({ path: path.relative(ROOT, file).replaceAll('\\', '/'), sha256: sha(fs.readFileSync(file)) });
function invoke(command, args, options = {}) {
  const started = performance.now();
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: options.timeout ?? 30_000,
    maxBuffer: 64 * 1024 * 1024, windowsHide: true, ...options });
  if (result.error || result.status !== 0) {
    const error = new Error(`RCL_PORTABLE_TARGET_COMMAND_FAILED:${result.stderr || result.stdout || result.error?.message}`);
    error.exitCode = result.status; throw error;
  }
  return { stdout: result.stdout, elapsedMs: performance.now() - started };
}
function decode(text, expectedSourceRoot) {
  const payload = JSON.parse(text);
  if (payload.status !== 'ok') throw new Error('RCL_PORTABLE_VM_REJECTED:' + payload.code);
  const result = verifyNativeSemanticStateRoot(payload, { requireNativeRoot: true, expectedAlgorithm: ALGORITHM });
  if (expectedSourceRoot && result.sourceRoot !== expectedSourceRoot) throw new Error('RCL_PORTABLE_SOURCE_ROOT_MISMATCH');
  return result;
}
export function wslPath(file) {
  const absolute = path.resolve(file).replaceAll('\\', '/');
  if (!/^[A-Za-z]:\//u.test(absolute)) throw new Error('RCL_WSL_LOCAL_DRIVE_PATH_REQUIRED');
  return '/mnt/' + absolute[0].toLowerCase() + absolute.slice(2);
}

/** Explicit target adapters. No fallback to another environment is permitted. */
export function createPortableNativeTarget(environment, options = {}) {
  const compilerArtifact = path.resolve(options.compilerArtifact ?? path.join(ROOT, 'selfhost/compiler.rbc'));
  const compilerBinding = binding(compilerArtifact);
  if (environment === 'windows' || environment === 'wasm-vm') {
    if (process.platform !== 'win32') throw new Error('RCL_WINDOWS_COMPILER_HOST_REQUIRED');
    const isWasi = environment === 'wasm-vm';
    const binary = path.join(ROOT, isWasi ? 'native/wasi/rclvm.wasm' : 'native/rclvm.exe');
    const nativeCompiler = path.join(ROOT, 'native/rclc.exe');
    return {
      environment,
      binding: { execution: isWasi ? 'Node WASI Preview 1, wasm32 native C VM' : 'Windows native C VM',
        os: isWasi ? 'WASI' : process.platform, arch: isWasi ? 'wasm32' : process.arch,
        compilerLocation: 'Windows native host executing RCL compiler RBC',
        binary: binding(binary), compilerBinary: binding(nativeCompiler), compilerArtifact: compilerBinding,
        nodeVersion: isWasi ? process.version : undefined, securitySandboxClaimed: false },
      compile(source, output) {
        const started = performance.now();
        const result = compileSourceFileSelfHosted(source, output, { compilerArtifactPath: compilerArtifact, compilerPath: nativeCompiler });
        return { bytecode: result.bytecode, ms: performance.now() - started };
      },
      execute(file, expectedSourceRoot) {
        const run = isWasi
          ? invoke(process.execPath, [path.join(ROOT, 'scripts/run-native-wasi.mjs'), binary, file])
          : invoke(binary, [file], { env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: ALGORITHM } });
        return { result: decode(run.stdout, expectedSourceRoot), ms: run.elapsedMs };
      }, dispose() {},
    };
  }
  if (environment === 'linux') {
    const binary = path.join(ROOT, 'native/linux/rclvm'), nativeCompiler = path.join(ROOT, 'native/linux/rclc');
    const useWsl = process.platform === 'win32';
    if (!useWsl && process.platform !== 'linux') throw new Error('RCL_LINUX_HOST_REQUIRED');
    const distro = options.wslDistro ?? process.env.RCL_K400_WSL_DISTRO ?? 'RCL-K400-Alpine';
    if (useWsl && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/u.test(distro)) throw new Error('RCL_WSL_DISTRO_NAME_INVALID');
    const toTarget = useWsl ? wslPath : file => path.resolve(file);
    const run = (command, args, extra = {}) => useWsl
      ? invoke('wsl.exe', ['-d', distro, '--', 'env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=' + ALGORITHM, command, ...args], extra)
      : invoke(command, args, { ...extra, env: { ...process.env, RCL_SEMANTIC_STATE_ROOT_ALGORITHM: ALGORITHM } });
    const identity = run('uname', ['-s', '-r', '-m']).stdout.trim();
    if (!/^Linux /u.test(identity) || !identity.endsWith(' x86_64')) throw new Error('RCL_LINUX_TARGET_IDENTITY_MISMATCH');
    for (const file of [binary, nativeCompiler, compilerArtifact]) {
      if (run('sha256sum', [toTarget(file)]).stdout.slice(0, 64) !== sha(fs.readFileSync(file))) throw new Error('RCL_LINUX_TARGET_BINARY_DRIFT');
    }
    return {
      environment, binding: { execution: useWsl ? 'Linux WSL2 native C process' : 'Linux native C process', os: 'Linux', arch: 'x86_64', identity,
        distribution: run('cat', ['/etc/os-release']).stdout.trim(), compilerLocation: 'Linux target executing RCL compiler RBC',
        binary: binding(binary), compilerBinary: binding(nativeCompiler), compilerArtifact: compilerBinding },
      compile(source, output) {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        const execution = run(toTarget(nativeCompiler), [toTarget(compilerArtifact), toTarget(source), toTarget(output)], { timeout: 60_000 });
        return { bytecode: fs.readFileSync(output), ms: execution.elapsedMs };
      },
      execute(file, expectedSourceRoot) {
        const result = run(toTarget(binary), [toTarget(file)]);
        return { result: decode(result.stdout, expectedSourceRoot), ms: result.elapsedMs };
      }, dispose() {},
    };
  }
  if (environment === 'android') {
    const adb = options.adbPath ?? process.env.ADB ?? (process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe') : 'adb');
    const serial = options.serial ?? process.env.RCL_ANDROID_SERIAL ?? 'emulator-5554';
    if (!/^[A-Za-z0-9_.:-]{1,100}$/u.test(serial)) throw new Error('RCL_ANDROID_SERIAL_INVALID');
    const run = args => invoke(adb, ['-s', serial, ...args]);
    if (run(['get-state']).stdout.trim() !== 'device') throw new Error('RCL_ANDROID_DEVICE_UNAVAILABLE');
    const abi = run(['shell', 'getprop', 'ro.product.cpu.abi']).stdout.trim();
    const arch = run(['shell', 'uname', '-m']).stdout.trim();
    if (abi !== 'x86_64' || arch !== 'x86_64') throw new Error('RCL_ANDROID_X86_64_REQUIRED');
    const root = '/data/local/tmp/rcl-k400-' + randomUUID();
    const owned = new Set();
    const remote = name => {
      if (!/^[A-Za-z0-9_.-]+$/u.test(name)) throw new Error('RCL_ANDROID_TRANSFER_NAME_INVALID');
      const file = root + '/' + name; owned.add(file); return file;
    };
    run(['shell', 'mkdir', root]);
    const binary = path.join(ROOT, 'native/linux/rclvm'), nativeCompiler = path.join(ROOT, 'native/linux/rclc');
    const remoteVm = remote('rclvm'), remoteCompiler = remote('rclc'), remoteArtifact = remote('compiler.rbc');
    const push = (local, target) => run(['push', local, target]);
    try {
      for (const [local, target] of [[binary, remoteVm], [nativeCompiler, remoteCompiler], [compilerArtifact, remoteArtifact]]) {
        push(local, target);
        if (run(['shell', 'sha256sum', target]).stdout.slice(0, 64) !== sha(fs.readFileSync(local))) throw new Error('RCL_ANDROID_TARGET_BINARY_DRIFT');
      }
      run(['shell', 'chmod', '755', remoteVm, remoteCompiler]);
    } catch (error) {
      for (const file of owned) { try { run(['shell', 'rm', '-f', file]); } catch {} }
      try { run(['shell', 'rmdir', root]); } catch {}
      throw error;
    }
    const bindingRecord = { execution: 'Android native Linux ABI C process via ADB', os: 'Android', arch, abi,
      apiLevel: run(['shell', 'getprop', 'ro.build.version.sdk']).stdout.trim(), emulator: run(['shell', 'getprop', 'ro.kernel.qemu']).stdout.trim() === '1',
      deviceSerial: serial, physicalDeviceClaimed: false, mobileUiClaimed: false, compilerLocation: 'Android target executing RCL compiler RBC',
      binary: binding(binary), compilerBinary: binding(nativeCompiler), compilerArtifact: compilerBinding };
    return {
      environment, binding: bindingRecord,
      compile(source, output) {
        const started = performance.now();
        const remoteSource = remote(sha(fs.readFileSync(source)) + '.rcl'), remoteOutput = remote(sha(source + output) + '.rbc');
        push(source, remoteSource);
        run(['shell', remoteCompiler, remoteArtifact, remoteSource, remoteOutput]);
        if (fs.existsSync(output)) fs.unlinkSync(output);
        run(['pull', remoteOutput, output]);
        return { bytecode: fs.readFileSync(output), ms: performance.now() - started };
      },
      execute(file, expectedSourceRoot) {
        const started = performance.now(), target = remote(sha(fs.readFileSync(file)) + '.rbc');
        push(file, target);
        const output = run(['shell', 'env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=' + ALGORITHM, remoteVm, target]);
        return { result: decode(output.stdout, expectedSourceRoot), ms: performance.now() - started };
      },
      dispose() {
        // Only individually tracked files in this newly created directory are removed.
        const files = [...owned];
        for (let offset = 0; offset < files.length; offset += 20) {
          try { run(['shell', 'rm', '-f', ...files.slice(offset, offset + 20)]); } catch {}
        }
        try { run(['shell', 'rmdir', root]); } catch {}
      },
    };
  }
  throw new Error('RCL_PORTABLE_TARGET_UNSUPPORTED:' + environment);
}
