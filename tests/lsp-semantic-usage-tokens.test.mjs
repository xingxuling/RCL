import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLspIndex, queryLspIndex } from '../src/lsp-dap-bridge-runtime.mjs';
import { parseReality, parseRealityWithLocations } from '../src/parser.mjs';

const build = source => {
  const result = buildLspIndex({ source, typeModuleSources: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.lspIndex;
};
const text = (source, token) => source.split('\n')[token.line].slice(token.character, token.character + token.length);
const has = (index, line, character, modifier) => index.semanticTokens.tokens.some(token => token.line === line && token.character === character && token.tokenModifiers === modifier);

test('facet usage tokens distinguish declaration, reads and writes and encode a valid protocol packet', () => {
  const source = `reality Tokens {
  facet x : Number = 1
  subject actor { warrant state.write on x }
  emergence increment {
    cause actor when x > 0 needs state.write on x
    alter x <- x + 1
    preserve x > 0
  }
}`;
  const index = build(source), tokens = index.semanticTokens;
  assert.deepEqual(tokens.legend.tokenModifiers, ['declaration', 'modification']);
  assert.equal(tokens.tokens.filter(token => token.tokenModifiers === 1).length, 1);
  assert.equal(tokens.tokens.filter(token => token.tokenModifiers === 2).length, 1);
  assert.equal(tokens.tokens.filter(token => token.tokenType === 'property' && token.tokenModifiers === 0).length, 3);
  let line = 0, character = 0;
  for (let offset = 0; offset < tokens.data.length; offset += 5) {
    const [deltaLine, deltaCharacter, length, type, modifier] = tokens.data.slice(offset, offset + 5);
    assert.ok(deltaLine >= 0 && deltaCharacter >= 0 && length > 0);
    character = deltaLine ? deltaCharacter : character + deltaCharacter; line += deltaLine;
    const token = tokens.tokens.find(item => item.line === line && item.character === character);
    assert.ok(token); assert.equal(length, token.length); assert.equal(type, token.tokenTypeIndex); assert.equal(modifier, token.tokenModifiers);
  }
  const query = queryLspIndex(JSON.parse(JSON.stringify(index)), { kind: 'semanticTokens' });
  assert.equal(query.ok, true); assert.deepEqual(query.result, tokens);
});

test('qualified paths split into actual lexical identifiers across lines, spaces and comments', () => {
  const source = `reality Fragmented {
  facet app
    . count : Number = 1
  facet result : Number = app
    # count is only a comment here
    . count + 1
}`;
  const index = build(source), propertyTokens = index.semanticTokens.tokens.filter(token => token.tokenType === 'property');
  assert.deepEqual(propertyTokens.map(token => text(source, token)), ['app', 'count', 'result', 'app', 'count']);
  assert.deepEqual(propertyTokens.filter(token => token.tokenModifiers === 1).map(token => text(source, token)), ['app', 'count', 'result']);
  assert.equal(index.semanticTokens.tokens.some(token => token.line === 4), false);
  assert.ok(index.semanticTokens.tokens.every(token => !/[.\s]/u.test(text(source, token))));
});

test('usage coloring excludes local parameters, UI locals and authority paths after supplementary text', () => {
  const original = `reality Scopes {
  facet x : Number = 1
  facet text : Text = "🦊 x" facet y : Number = x + 1
  reckon local(x : Number) -> Number = x
  subject actor { warrant state.write on x }
  ui App { state x : Number = 2 view Root { text Label { bind value <- "" + x } } }
}`;
  for (const source of [original, original.replaceAll('\n', '\r\n')]) {
    const index = build(source), line = source.split('\n')[2];
    assert.equal(has(index, 2, line.lastIndexOf('x'), 0), true);
    assert.equal(index.semanticTokens.tokens.some(token => [3, 4, 5].includes(token.line)), false);
    assert.deepEqual(parseRealityWithLocations(source).ast, parseReality(source));
    const sorted = [...index.semanticTokens.tokens].sort((a, b) => a.line - b.line || a.character - b.character);
    for (let offset = 1; offset < sorted.length; offset++) if (sorted[offset].line === sorted[offset - 1].line) {
      assert.ok(sorted[offset].character >= sorted[offset - 1].character + sorted[offset - 1].length);
    }
  }
});

test('nested declarations retain local spelling while qualified writes retain each path component', () => {
  const source = `reality Nested {
    subject actor { facet score : Number = 0 warrant state.write on actor.score }
    emergence update { cause actor when true needs state.write on actor.score alter actor.score <- actor.score + 1 }
  }`;
  const tokens = build(source).semanticTokens.tokens;
  assert.deepEqual(tokens.filter(token => token.tokenModifiers === 1).map(token => text(source, token)), ['score']);
  assert.deepEqual(tokens.filter(token => token.tokenModifiers === 2).map(token => text(source, token)), ['actor', 'score']);
  assert.deepEqual(tokens.filter(token => token.tokenType === 'property' && token.tokenModifiers === 0).map(token => text(source, token)), ['actor', 'score']);
});
