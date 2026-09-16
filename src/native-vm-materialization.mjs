import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const RCL_NATIVE_VM_MATERIALIZATION_FORMAT = 'taowind.rcl-native-vm-materialization.v0.1';
export const RCL_NATIVE_VM_MATERIALIZATION_VERSION = '0.1.0';

function errorWith(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'RCLNativeVMMaterializationError';
  error.code = code;
  error.details = details;
  return error;
}

export function defaultNativeVmPath(root, platform = process.platform) {
  return path.join(root, 'native', platform === 'win32' ? 'rclvm.exe' : 'rclvm');
}

export function materializeNativeVm(root, options = {}) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('root must be a non-empty path');

  const platform = options.platform ?? process.platform;
  const explicitVmPath = options.vmPath ?? null;
  const vmPath = explicitVmPath ?? defaultNativeVmPath(root, platform);
  if (fs.existsSync(vmPath)) {
    return {
      format: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
      version: RCL_NATIVE_VM_MATERIALIZATION_VERSION,
      vmPath,
      built: false,
      provenance: explicitVmPath ? 'explicit-binary' : 'bundled-or-prebuilt-binary',
    };
  }

  if (explicitVmPath) {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}`, {
      vmPath,
      explicitPath: true,
      buildAttempted: false,
    });
  }
  if (options.buildIfMissing === false) {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}`, {
      vmPath,
      explicitPath: false,
      buildAttempted: false,
    });
  }
  if (platform === 'win32') {
    throw errorWith('RCL_NATIVE_VM_MISSING', `Native VM binary is missing at ${vmPath}; automatic source materialization is currently limited to Makefile platforms`, {
      vmPath,
      platform,
      buildAttempted: false,
    });
  }

  const nativeDir = path.join(root, 'native');
  const makefilePath = path.join(nativeDir, 'Makefile');
  const sourcePath = path.join(nativeDir, 'rclvm.c');
  const headerPath = path.join(nativeDir, 'rclvm.h');
  const required = [makefilePath, sourcePath, headerPath];
  const missing = required.filter(item => !fs.existsSync(item));
  if (missing.length > 0) {
    throw errorWith('RCL_NATIVE_VM_SOURCE_MISSING', 'Native VM source materialization inputs are incomplete', {
      vmPath,
      missing,
      buildAttempted: false,
    });
  }

  const makePath = options.makePath ?? options.env?.MAKE ?? process.env.MAKE ?? 'make';
  const spawn = options.spawnSyncImpl ?? spawnSync;
  const run = spawn(makePath, ['-C', nativeDir, 'rclvm'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    timeout: options.buildTimeout ?? 120_000,
  });

  if (run.error) {
    throw errorWith('RCL_NATIVE_VM_BUILD_TOOL', `Unable to invoke native VM build tool '${makePath}': ${run.error.message}`, {
      vmPath,
      makePath,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }
  if (run.status !== 0) {
    throw errorWith('RCL_NATIVE_VM_BUILD_FAILED', `Native VM source materialization failed with status ${run.status}`, {
      vmPath,
      makePath,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }
  if (!fs.existsSync(vmPath)) {
    throw errorWith('RCL_NATIVE_VM_BUILD_OUTPUT_MISSING', `Native VM build completed without creating ${vmPath}`, {
      vmPath,
      makePath,
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      buildAttempted: true,
    });
  }

  return {
    format: RCL_NATIVE_VM_MATERIALIZATION_FORMAT,
    version: RCL_NATIVE_VM_MATERIALIZATION_VERSION,
    vmPath,
    built: true,
    provenance: 'repository-source-makefile',
    build: {
      tool: makePath,
      target: 'rclvm',
      nativeDir,
    },
  };
}
