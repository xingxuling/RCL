import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RCL_LINUX_BUILD_FORMAT = 'rcl.native-linux-build.v1';
export const RCL_LINUX_BUILD_TARGET = 'x86_64-linux-musl';
export const RCL_LINUX_BUILD_SOURCES = Object.freeze([
  'native/rclvm.c',
  'native/rclvm.h',
  'native/rclc.c',
  'native/rclvmd.c',
  'native/semantic_state_v2.h',
  'native/identifier_profile.h',
  'native/number_format_ryu.h',
  'native/wasi-sha256.zig',
  'native/wasi-compat/openssl/sha.h',
  'scripts/build-native-linux.mjs',
  'src/native-linux-build-contract.mjs',
]);

const artifacts = Object.freeze({
  binary: 'native/linux/rclvm',
  compiler: 'native/linux/rclc',
  daemon: 'native/linux/rclvmd',
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const bindingError = code => Object.assign(new Error(code), { code });

export function nativeLinuxArtifactBinding(root, role) {
  if (!Object.hasOwn(artifacts, role)) throw new TypeError('Unknown Linux native artifact role');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, 'native/linux/build-manifest.json'), 'utf8')); }
  catch { throw bindingError('RCL_NATIVE_LINUX_MANIFEST_INVALID'); }
  const sources = manifest?.sources;
  if (manifest?.format !== RCL_LINUX_BUILD_FORMAT || manifest.target !== RCL_LINUX_BUILD_TARGET || manifest.staticLibc !== true
      || !Array.isArray(sources) || sources.length !== RCL_LINUX_BUILD_SOURCES.length
      || !RCL_LINUX_BUILD_SOURCES.every((name, index) => sources[index]?.path === name)) {
    throw bindingError('RCL_NATIVE_LINUX_MANIFEST_INVALID');
  }
  const hash = createHash('sha256');
  const sourceMismatch = () => bindingError('RCL_NATIVE_LINUX_SOURCE_BINDING_MISMATCH');
  for (const source of sources) {
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, source.path)); }
    catch { throw sourceMismatch(); }
    if (sha256(bytes) !== source.sha256) throw sourceMismatch();
    hash.update(source.path).update('\0').update(bytes).update('\0');
  }
  const relative = artifacts[role], artifact = manifest[role];
  let bytes;
  try { bytes = fs.readFileSync(path.join(root, relative)); }
  catch { throw sourceMismatch(); }
  const binarySha256 = sha256(bytes);
  if (artifact?.path !== relative || artifact.sha256 !== binarySha256 || artifact.bytes !== bytes.length) throw sourceMismatch();
  return { relativePath: relative, binarySha256, sourceRoot: hash.digest('hex'), sourceBound: true };
}
