import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { runReality } from '../src/runtime.mjs';
import { handleRclMcpRequest } from '../src/rcl-mcp-server.mjs';

const compiler = fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-structured-diagnostics-')); });
test.after(() => { if (directory) fs.rmSync(directory, {recursive: true, force: true}); });
const expectedSpan = (source, spelling, offset = source.indexOf(spelling)) => {
  const before = source.slice(0, offset).split('\n');
  return {offset, line: before.length, column: before.at(-1).length + 1, length: spelling.length};
};
function rejected(source, code, expected) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source);
  const retained = Buffer.from('retained-before-structured-error'); fs.writeFileSync(output, retained);
  assert.throws(() => runNativeCompiler(compiler, input, output), error => {
    assert.equal(error.code, 'RCLC_COMPILER_FAILURE');
    assert.deepEqual(error.diagnostic, {format: 'rcl.semantic-diagnostic.v1', code, span: expected});
    assert.deepEqual(error.payload.cause.diagnostic, error.diagnostic);
    assert.ok(error.message.endsWith(` at ${expected.line}:${expected.column}`));
    return true;
  });
  assert.deepEqual(fs.readFileSync(output), retained);
}

test('native compiler diagnostics bind raw spans after Unicode, comments and CRLF', () => {
  for (const newline of ['\n', '\r\n']) {
    for (const [expression, code, spelling] of [
      ['missing.value', 'RCL_SEMANTIC_UNKNOWN_PATH', 'missing'],
      ['missing_call()', 'RCL_SEMANTIC_UNKNOWN_CALL', 'missing_call'],
      ['"😀\\n"', 'RCL_SEMANTIC_TYPE_MISMATCH', '"😀\\n"'],
    ]) {
      const source = ['\ufeffreality Located {', '# 😀𐐀', `facet label : Text = "😀\\n" facet value : Number = ${expression}`, '}'].join(newline);
      const offset = source.indexOf(spelling, source.indexOf('facet value'));
      rejected(source, code, expectedSpan(source, spelling, offset));
    }
  }
});

test('unterminated strings point to their actual raw remainder', () => {
  for (const tail of ['"hello', '"😀\\', '"first\n😀last']) {
    const prefix = '\ufeffreality Incomplete {\r\n facet text : Text = ';
    rejected(prefix + tail, 'RCL_UNTERMINATED_TEXT', expectedSpan(prefix + tail, tail, prefix.length));
  }
});

test('EOF errors have an exact zero-length span after supplementary comments', () => {
  const source = 'reality Incomplete {\r\n # 😀𐐀';
  rejected(source, 'RCL_REALITY_UNCLOSED', expectedSpan(source, '', source.length));
});

test('reference and native semantic_assert preserve code escaping and all Span fields', async () => {
  const code = 'RCL_CUSTOM_"中\\\n';
  const source = `reality Assertion { facet valid : Truth = semantic_assert(false, ${JSON.stringify(code)}, "detail", make_span(17, 3, 9, 6)) }`;
  const expected = {format: 'rcl.semantic-diagnostic.v1', code, span: {offset: 17, line: 3, column: 9, length: 6}};
  assert.throws(() => runNativeBytecode(compileRealityToBytecode(source)), error => {
    assert.deepEqual(error.diagnostic, expected); return true;
  });
  await assert.rejects(() => runReality(source), error => {
    assert.deepEqual(error.details.diagnostic, expected); return true;
  });
});

test('ordinary VM errors do not invent a semantic diagnostic', () => {
  const source = 'reality Failure { facet x : Number = sequence_get(empty_sequence(), 0) }';
  assert.throws(() => runNativeBytecode(compileRealityToBytecode(source)), error => {
    assert.equal(error.diagnostic, null);
    assert.equal(Object.hasOwn(error.payload, 'diagnostic'), false); return true;
  });
});


test('public native and bytecode CLI commands retain structured compile diagnostics', () => {
  const source = 'reality Invalid { facet value : Number = 1 + true }';
  const input = path.join(directory, 'cli-invalid.rcl'), output = path.join(directory, 'cli-output.rbc'); fs.writeFileSync(input, source);
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  for (const command of ['native', 'bytecode']) {
    const retained = Buffer.from('retained-cli-diagnostic'); fs.writeFileSync(output, retained);
    const result = spawnSync(process.execPath, [cli, command, input, ...(command === 'bytecode' ? [output] : [])], {encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 1, result.stdout);
    const payload = JSON.parse(result.stderr);
    assert.equal(payload.ok, false); assert.equal(payload.code, 'RCLC_COMPILER_FAILURE');
    assert.deepEqual(payload.diagnostic, {format: 'rcl.semantic-diagnostic.v1', code: 'RCL_TYPE_BINARY', span: expectedSpan(source, '+')});
    assert.deepEqual(fs.readFileSync(output), retained);
  }
});

test('public reference and native-run CLI commands expose semantic assertion spans', () => {
  const source = 'reality Assertion { facet valid : Truth = semantic_assert(false, "RCL_CLI_ASSERT", "detail", make_span(17, 3, 9, 6)) }';
  const input = path.join(directory, 'cli-assert.rcl'), bytecode = path.join(directory, 'cli-assert.rbc'); fs.writeFileSync(input, source); fs.writeFileSync(bytecode, compileRealityToBytecode(source));
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  for (const [command, file] of [['run', input], ['native-run', bytecode]]) {
    const result = spawnSync(process.execPath, [cli, command, file], {encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 1, result.stdout);
    const payload = JSON.parse(result.stderr);
    assert.deepEqual(payload.diagnostic, {format: 'rcl.semantic-diagnostic.v1', code: 'RCL_CLI_ASSERT', span: {offset: 17, line: 3, column: 9, length: 6}});
  }
});


test('MCP native execution errors retain the optional semantic diagnostic', async () => {
  const source = 'reality Assertion { facet valid : Truth = semantic_assert(false, "RCL_MCP_ASSERT", "detail", make_span(17, 3, 9, 6)) }';
  const response = await handleRclMcpRequest({jsonrpc: '2.0', id: 'diagnostic', method: 'tools/call', params: {name: 'rcl_run_native_source', arguments: {source}}});
  assert.equal(response.id, 'diagnostic'); assert.equal(response.error.code, -32000);
  assert.equal(response.error.data.code, 'RCL_SEMANTIC_ASSERT');
  assert.deepEqual(response.error.data.diagnostic, {format: 'rcl.semantic-diagnostic.v1', code: 'RCL_MCP_ASSERT', span: {offset: 17, line: 3, column: 9, length: 6}});
});


test('ordinary MCP runtime errors keep their previous error-data shape', async () => {
  const source = 'reality Failure { facet value : Number = sequence_get(empty_sequence(), 0) }';
  const response = await handleRclMcpRequest({jsonrpc: '2.0', id: 'ordinary', method: 'tools/call', params: {name: 'rcl_run_native_source', arguments: {source}}});
  assert.equal(response.error.code, -32000);
  assert.deepEqual(response.error.data, {name: 'RCLNativeVMError'});
});


test('long Unicode assertion messages remain strict UTF-8 JSON with complete diagnostics', () => {
  const source = 'reality UnicodeError { facet valid : Truth = semantic_assert(false, "RCL_LONG_MESSAGE", "' + '😀'.repeat(200) + '", make_span(17, 3, 9, 6)) }';
  const bytecode = path.join(directory, 'long-unicode-error.rbc'); fs.writeFileSync(bytecode, compileRealityToBytecode(source));
  const vm = fileURLToPath(new URL('../native/' + (process.platform === 'win32' ? 'rclvm.exe' : 'rclvm'), import.meta.url));
  const result = spawnSync(vm, [bytecode], {windowsHide: true});
  assert.equal(result.status, 1);
  const text = new TextDecoder('utf-8', {fatal: true}).decode(result.stderr), payload = JSON.parse(text);
  assert.equal(text.includes('\ufffd'), false);
  assert.deepEqual(payload.diagnostic, {format: 'rcl.semantic-diagnostic.v1', code: 'RCL_LONG_MESSAGE', span: {offset: 17, line: 3, column: 9, length: 6}});
});
