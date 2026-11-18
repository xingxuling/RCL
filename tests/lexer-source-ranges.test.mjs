import test from 'node:test';
import assert from 'node:assert/strict';
import { lexReality, getTokenSourceRange } from '../src/lexer.mjs';
import { parseReality, parseRealityWithLocations } from '../src/parser.mjs';

function point(source, offset) {
  const lines = source.slice(0, offset).split('\n');
  return {line: lines.length - 1, character: lines.at(-1).length};
}

for (const [name, spelling] of [
  ['escaped Unicode text', JSON.stringify('😀\n"\t\\')],
  ['actual multiline text', '"first\n😀last"'],
  ['actual CRLF text', '"first\r\n😀last"'],
  ['empty text', '""'],
  ['leading decimal', '.050'],
]) {
  test(`raw tooling ranges retain exact source spelling: ${name}`, () => {
    const source = `\ufeffreality Range {\r\n # 😀 comment\r\n facet value : ${spelling.startsWith('"') ? 'Text' : 'Number'} = ${spelling}\r\n}`;
    const offset = source.indexOf(spelling, source.indexOf(' = ') + 3), end = offset + spelling.length;
    const tokens = lexReality(source, {sourceRanges: true}), token = tokens.find(item => item.type === (spelling.startsWith('"') ? 'STRING' : 'NUMBER'));
    const expected = {start: point(source, offset), end: point(source, end), offset, length: spelling.length};
    assert.deepEqual(getTokenSourceRange(token), expected);
    assert.equal(source.slice(expected.offset, expected.offset + expected.length), spelling);
    assert.deepEqual(Object.keys(token), ['type', 'value', 'line', 'column']);
    assert.equal(getTokenSourceRange(JSON.parse(JSON.stringify(token))), null);
    assert.throws(() => { getTokenSourceRange(token).end.character = 999; }, TypeError);
    const parsed = parseRealityWithLocations(source);
    assert.deepEqual(parsed.ast, parseReality(source));
    const expression = parsed.ast.body.find(item => item.kind === 'FacetDecl').value;
    assert.deepEqual(parsed.locations.get(expression), {start: expected.start, end: expected.end});
    const eof = tokens.at(-1);
    assert.deepEqual(getTokenSourceRange(eof), {start: point(source, source.length), end: point(source, source.length), offset: source.length, length: 0});
  });
}

test('tooling metadata covers exact identifier and symbol spans around comments', () => {
  const source = 'reality Names { facet app # 😀\n . count : Number = 1 <= 2 }';
  for (const token of lexReality(source, {sourceRanges: true})) {
    const raw = getTokenSourceRange(token);
    assert.deepEqual(raw.start, {line: token.line - 1, character: token.column - 1});
    assert.equal(source.slice(raw.offset, raw.offset + raw.length), token.type === 'EOF' ? '' : token.value);
  }
});


test('ordinary lexing leaves optional raw-range metadata unallocated', () => {
  for (const token of lexReality('reality A { facet x : Number = 1 }')) assert.equal(getTokenSourceRange(token), null);
});


test('call and binary expression ranges include multiline raw literals and closing syntax', () => {
  const spelling = 'trim("first\n😀last") + "end"';
  const source = 'reality Range { facet value : Text = ' + spelling + ' }';
  const parsed = parseRealityWithLocations(source), expression = parsed.ast.body[0].value;
  const start = source.indexOf(spelling);
  assert.deepEqual(parsed.locations.get(expression), {start: point(source, start), end: point(source, start + spelling.length)});
  const callEnd = source.indexOf(')') + 1;
  assert.deepEqual(parsed.locations.get(expression.left), {start: point(source, start), end: point(source, callEnd)});
  assert.deepEqual(parsed.ast, parseReality(source));
});
