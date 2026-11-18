import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lexReality } from '../src/lexer.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { runReality } from '../src/runtime.mjs';

const core = fs.readFileSync(new URL('../selfhost/compiler-core.rcl', import.meta.url), 'utf8');
const fixtures = [
  '\ufeffreality 示例 {\r\n # 😀𐐀\r\n facet text : Text = "😀\\n中" facet value : Number = .5\r\n}',
  'reality Multi { facet text : Text = "first\n😀last" // end 😀\n facet x : Number = 1. }',
  'reality Escapes { facet text : Text = "\\\"\\\\\\t\\n" } # 😀𐐀',
  '# 😀\nreality Paths { facet a.b : Number = 1 reckon f(x : Number) -> Truth = x <= 2 }',
];

function expectedTokens(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  return lexReality(source).map(token => {
    const offset = starts[token.line - 1] + token.column - 1;
    let length = token.type === 'EOF' ? 0 : token.value.length;
    if (token.type === 'STRING') {
      let end = offset + 1;
      while (end < source.length) {
        if (source[end] === '\\') { end += 2; continue; }
        if (source[end++] === '"') break;
      }
      length = end - offset;
    }
    return [token.type, token.value, token.line, token.column, offset, length];
  });
}

for (const [i, target] of fixtures.entries()) {
  test(`native/reference token ranges retain raw UTF-16 offsets and lengths: ${i}`, async () => {
    const source = core + `\n facet inspected : Sequence = tokenize(${JSON.stringify(target)}) }`;
    const expected = expectedTokens(target);
    const actual = runNativeBytecode(compileRealityToBytecode(source));
    assert.deepEqual(actual.state.inspected, expected);
    assert.deepEqual((await runReality(source)).state.inspected, expected);
    for (const token of actual.state.inspected) {
      assert.ok(token[4] + token[5] <= target.length);
      if (token[0] === 'STRING') assert.equal(target.slice(token[4], token[4] + token[5]).at(-1), '"');
    }
  });
}
