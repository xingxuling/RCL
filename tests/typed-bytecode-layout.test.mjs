import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  OPCODES,
  compileTypedRealityToBytecodeLayout,
  runTypedBytecodeLayoutDemo,
  compileTypedBytecodeFromFiles,
  runNativeBytecode,
} from '../src/index.mjs';

const typeModuleSources = {
  'core.rcltype': `module core
export record User<T> {
  id: Text
  payload: T
}
export union LoginResult<T,E> {
  Ok(T)
  Err(E)
}
`,
};

const source = `reality TypedBytecodeDemo {
  facet app.user : core.User<Text> = { id: "u-1", payload: "seed" }
  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")
}`;

function writeTypedFiles(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), source);
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), typeModuleSources['core.rcltype']);
}

test('P3 typed bytecode lowering emits dedicated RBC object opcodes', () => {
  const result = compileTypedRealityToBytecodeLayout(source, { typeModuleSources });
  assert.equal(result.ok, true);
  assert.equal(result.layout.format, 'rcl.typed-bytecode-layout.v0.33');
  assert.equal(result.layout.typedInstructionCount, 2);
  assert.deepEqual(
    result.layout.typedInstructions.map(item => item.opcode),
    ['MAKE_TYPED_RECORD', 'MAKE_TYPED_UNION'],
  );
  const opcodes = result.decoded.instructions.map(item => item.op);
  assert.ok(opcodes.includes(OPCODES.MAKE_TYPED_RECORD));
  assert.ok(opcodes.includes(OPCODES.MAKE_TYPED_UNION));
  assert.equal(result.layout.layouts[0].fieldSlots[0].name, 'id');
  assert.match(result.layout.layoutRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed bytecode runs through native VM with typed record and union state values', () => {
  const result = compileTypedRealityToBytecodeLayout(source, { typeModuleSources });
  const native = runNativeBytecode(result.bytecode);
  assert.equal(native.state['app.user'].__rclKind, 'Record');
  assert.equal(native.state['app.user'].__rclType, 'core::User<Text>');
  assert.equal(native.state['app.user'].id, 'u-1');
  assert.equal(native.state['app.user'].payload, 'seed');
  assert.equal(native.state['app.login'].__rclKind, 'Union');
  assert.equal(native.state['app.login'].variant, 'Ok');
  assert.deepEqual(native.state['app.login'].payload, ['accepted']);
});

test('P3 typed bytecode file build writes RBC and layout report', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-bytecode-'));
  writeTypedFiles(dir);
  const outDir = path.join(dir, 'out');
  const result = compileTypedBytecodeFromFiles(path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), { outputDir: outDir });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(result.bytecodePath), true);
  assert.equal(fs.existsSync(result.layoutPath), true);
  const layout = JSON.parse(fs.readFileSync(result.layoutPath, 'utf8'));
  assert.equal(layout.typedInstructionCount, 2);
  assert.equal(result.layoutRoot, layout.layoutRoot);
});

test('P3 typed bytecode demo and CLI expose native typed layout evidence', () => {
  const demo = runTypedBytecodeLayoutDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.typedInstructionCount, 2);
  assert.equal(demo.nativeState['app.user'].__rclKind, 'Record');

  const cwd = new URL('..', import.meta.url);
  const cliDemo = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-bytecode-demo'], { cwd, encoding: 'utf8' }));
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.nativeState['app.login'].__rclKind, 'Union');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-bytecode-cli-'));
  writeTypedFiles(dir);
  const cliBuild = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-bytecode-build', path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), path.join(dir, 'out')], { cwd, encoding: 'utf8' }));
  assert.equal(cliBuild.ok, true);
  assert.equal(cliBuild.typedInstructionCount, 2);
});
