import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  OPCODES,
  tryCompileReality,
  compileTypedAccessPattern,
  runTypedAccessPatternDemo,
  compileTypedAccessPatternFromFiles,
  DEFAULT_TYPED_ACCESS_SOURCE,
  DEFAULT_TYPED_ACCESS_TYPE_MODULES,
} from '../src/index.mjs';

function writeAccessFiles(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), DEFAULT_TYPED_ACCESS_SOURCE);
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), DEFAULT_TYPED_ACCESS_TYPE_MODULES['core.rcltype']);
}

test('P3 typed field projection and union match appear in semantic map', () => {
  const result = tryCompileReality(DEFAULT_TYPED_ACCESS_SOURCE, { typeModuleSources: DEFAULT_TYPED_ACCESS_TYPE_MODULES });
  assert.equal(result.ok, true);
  assert.equal(result.semanticMap.format, 'rcl.typed-compiler.semantic-map.v0.34');
  assert.equal(result.semanticMap.fieldAccessCount, 1);
  assert.equal(result.semanticMap.matchCount, 1);
  assert.deepEqual(result.semanticMap.facets['app.userPayload'].fieldAccesses[0], {
    basePath: 'app.user',
    field: 'payload',
    canonicalType: 'Text',
  });
  assert.equal(result.semanticMap.facets['app.message'].matches[0].cases[0].variant, 'Ok');
});

test('P3 typed access/pattern runtime computes projected field and matched union payload', () => {
  const result = compileTypedAccessPattern();
  assert.equal(result.ok, true);
  assert.equal(result.native.state['app.userPayload'], 'seed');
  assert.equal(result.native.state['app.message'], 'accepted');
  assert.equal(result.report.fieldAccessCount, 1);
  assert.equal(result.report.matchCount, 1);
});

test('P3 typed access/pattern bytecode emits native access instructions', () => {
  const result = compileTypedAccessPattern();
  const opcodes = result.decoded.instructions.map(item => item.op);
  assert.ok(opcodes.includes(OPCODES.GET_TYPED_FIELD));
  assert.ok(opcodes.includes(OPCODES.IS_UNION_VARIANT));
  assert.ok(opcodes.includes(OPCODES.GET_UNION_PAYLOAD));
  assert.deepEqual(
    result.report.accessInstructions.map(item => item.opcode),
    ['GET_TYPED_FIELD', 'IS_UNION_VARIANT', 'GET_UNION_PAYLOAD', 'IS_UNION_VARIANT', 'GET_UNION_PAYLOAD'],
  );
});

test('P3 union match rejects non-exhaustive cases at compile time', () => {
  const source = `reality NonExhaustiveMatch {
  facet app.login : core.LoginResult<Text, Text> = Ok("accepted")
  facet app.message : Text = match app.login {
    Ok(value) -> value
  }
}`;
  const result = tryCompileReality(source, { typeModuleSources: DEFAULT_TYPED_ACCESS_TYPE_MODULES });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_MATCH_NON_EXHAUSTIVE'));
});

test('P3 typed access/pattern demo and CLI write evidence files', () => {
  const demo = runTypedAccessPatternDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.nativeState['app.message'], 'accepted');

  const cwd = new URL('..', import.meta.url);
  const cliDemo = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-access-demo'], { cwd, encoding: 'utf8' }));
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.accessInstructionCount, 5);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-access-cli-'));
  writeAccessFiles(dir);
  const build = compileTypedAccessPatternFromFiles(path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), { outputDir: path.join(dir, 'out') });
  assert.equal(build.ok, true);
  assert.equal(fs.existsSync(build.bytecodePath), true);
  assert.equal(fs.existsSync(build.reportPath), true);

  const cliBuild = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-access-build', path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), path.join(dir, 'out-cli')], { cwd, encoding: 'utf8' }));
  assert.equal(cliBuild.ok, true);
  assert.equal(cliBuild.matchCount, 1);
});
