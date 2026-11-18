import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {compileRealityToBytecode, decodeBytecode} from '../src/bytecode.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';
import {wslPath} from '../src/portable-native-vm.mjs';

const [rawArgument, portableArgument, reportArgument] = process.argv.slice(2);
assert.ok(rawArgument && portableArgument && reportArgument, 'Usage: verify-candidate-linux-execution <raw.tgz> <portable.tgz> <report.json>');
assert.equal(process.platform, 'win32', 'This verifier explicitly targets a Windows host and WSL Linux filesystem');
const raw = path.resolve(rawArgument), portable = path.resolve(portableArgument), reportPath = path.resolve(reportArgument);
assert.ok(!fs.existsSync(reportPath), 'Preserve an existing acceptance report');
const root = path.resolve(import.meta.dirname, '..');
const distro = process.env.RCL_K400_WSL_DISTRO ?? 'RCL-K400-Alpine';
assert.match(distro, /^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const execute = args => spawnSync('wsl.exe', ['-d', distro, '--', ...args], {encoding: 'utf8', timeout: 120000, windowsHide: true});
const good = args => {
  const result = execute(args);
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return result.stdout.trim();
};
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-linux-archive-'));
const input = path.join(temporary, 'source.rcl'), referenceFile = path.join(temporary, 'reference.rbc');
const source = 'reality PackageLinux { reckon inc(x : Number) -> Number = x + 1 facet value : Number = inc(.5) }';
const reference = compileRealityToBytecode(source);
fs.writeFileSync(input, source); fs.writeFileSync(referenceFile, reference);
const members = ['native/linux/rclvm', 'native/linux/rclc', 'selfhost/compiler.rbc'];
let targetRoot;
let report;
try {
  const identity = good(['uname', '-s', '-r', '-m']);
  targetRoot = good(['mktemp', '-d', '/tmp/rcl-candidate-exec-XXXXXX']);
  assert.match(targetRoot, /^\/tmp\/rcl-candidate-exec-[A-Za-z0-9]+$/);
  const rawRoot = `${targetRoot}/raw`, portableRoot = `${targetRoot}/portable`;
  good(['mkdir', rawRoot, portableRoot]);
  for (const [archive, destination] of [[raw, rawRoot], [portable, portableRoot]]) {
    good(['tar', '-xzf', wslPath(archive), '-C', destination, ...members.map(name => 'package/' + name)]);
    for (const member of members) {
      assert.equal(good(['sha256sum', `${destination}/package/${member}`]).slice(0, 64), sha(fs.readFileSync(path.join(root, member))));
    }
  }
  const rawVm = `${rawRoot}/package/native/linux/rclvm`;
  const rawMode = good(['stat', '-c', '%a', rawVm]);
  const rawExecutable = execute(['test', '-x', rawVm]).status === 0;
  let rawExecutionExitCode = null;
  if (!rawExecutable) {
    rawExecutionExitCode = execute(['env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2', rawVm, wslPath(referenceFile)]).status;
    assert.equal(rawExecutionExitCode, 126, 'Missing mode must cause a real Linux execution denial');
  }
  const vm = `${portableRoot}/package/native/linux/rclvm`, compiler = `${portableRoot}/package/native/linux/rclc`;
  good(['test', '-x', vm]); good(['test', '-x', compiler]);
  const output = `${portableRoot}/program.rbc`;
  good(['env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2', compiler, `${portableRoot}/package/selfhost/compiler.rbc`, wslPath(input), output]);
  assert.equal(good(['sha256sum', output]).slice(0, 64), sha(reference));
  const actual = verifyNativeSemanticStateRoot(JSON.parse(good(['env', 'RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2', vm, output])), {requireNativeRoot: true, expectedAlgorithm: 'rcl.semantic-state-root.v2'});
  assert.equal(actual.sourceRoot, decodeBytecode(reference).sourceRoot);
  assert.deepEqual(actual.state, {value: 1.5});
  report = {format: 'rcl.local-candidate-linux-filesystem.v1', ok: true, distro, identity,
    rawArchiveSha256: sha(fs.readFileSync(raw)), archiveSha256: sha(fs.readFileSync(portable)),
    rawMode, rawExecutable, rawExecutionExitCode, portableMode: good(['stat', '-c', '%a', vm]),
    compilationByteIdentical: true, stateRoot: actual.stateRoot, state: actual.state,
    compilerArtifactSha256: sha(fs.readFileSync(path.join(root, 'selfhost/compiler.rbc'))),
    binaryHashesVerified: true, vmSha256: good(['sha256sum', vm]).slice(0, 64), compilerSha256: good(['sha256sum', compiler]).slice(0, 64), executionLocation: 'Linux /tmp filesystem after tar extraction; no chmod at runtime',
    physicalDeviceClaimed: false, published: false};
} finally {
  if (targetRoot) {
    assert.match(targetRoot, /^\/tmp\/rcl-candidate-exec-[A-Za-z0-9]+$/);
    for (const variant of ['raw', 'portable']) {
      const base = `${targetRoot}/${variant}`;
      execute(['rm', '-f', ...members.map(member => `${base}/package/${member}`), `${base}/program.rbc`]);
      for (const directory of ['package/native/linux', 'package/native', 'package/selfhost', 'package', '']) execute(['rmdir', directory ? `${base}/${directory}` : base]);
    }
    execute(['rmdir', targetRoot]);
  }
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('rcl-linux-archive-'));
  fs.unlinkSync(input); fs.unlinkSync(referenceFile); fs.rmdirSync(temporary);
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(report, null, 2));
