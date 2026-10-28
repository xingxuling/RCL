import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

let directory, artifact;
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-locations-'));
  artifact = path.join(directory, 'compiler.rbc');
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  fs.writeFileSync(artifact, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

const fixtures = [
  ['multiline facet', 'reality Unsupported {\n\n    facet location : Span = make_span(0, 1, 1, 0)\n}', 'facet location'],
  ['owned input', 'reality Unsupported {\n  subject actor {\n    input values : Sequence = empty_sequence()\n  }\n}', 'input values'],
  ['column after supplementary text', 'reality Unsupported {\n  facet name : Text = "🦊" facet location : Span = make_span(0, 1, 1, 0)\n}', 'facet location'],
];
for (const [label, original, needle] of fixtures) for (const newline of ['LF', 'CRLF']) {
  test(`native session type diagnostic locates ${label} with ${newline}`, () => {
    const source = newline === 'LF' ? original : original.replaceAll('\n', '\r\n');
    const lines = source.split('\n'), line = lines.findIndex(value => value.includes(needle));
    const column = lines[line].indexOf(needle);
    const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-output');
    fs.writeFileSync(input, source); fs.writeFileSync(output, retained);
    assert.throws(() => runNativeCompiler(artifact, input, output, { outputState: 'compiler.output' }), error =>
      error.message.includes('RCL_SESSION_FACET_TYPE_UNSUPPORTED') && error.message.includes(`at ${line + 1}:${column + 1}`));
    assert.deepEqual(fs.readFileSync(output), retained);
  });
}
