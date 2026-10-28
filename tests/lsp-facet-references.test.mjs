import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLspIndex, queryLspIndex, parseLspQueryArg } from '../src/lsp-dap-bridge-runtime.mjs';
import { parseReality, parseRealityWithLocations } from '../src/parser.mjs';
import { buildFacetOccurrences } from '../src/lsp-facet-occurrences.mjs';

const source = `reality References {
  facet x : Number = 1
  facet marker : Text = "🦊 x" facet y : Number = ((x)) + x
  # x inside a comment is not a reference
  reckon local(x : Number) -> Number = x
  reckon global(dummy : Number) -> Number = x
  subject worker {
    facet score : Number = 0
    warrant state.write on x
  }
  emergence increment {
    cause worker when x > 0 needs state.write on x
    alter x <- x + 1
    preserve x > 0
    witness "x"
  }
}`;
const build = text => {
  const result = buildLspIndex({ source: text, typeModuleSources: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.lspIndex;
};
const slice = (text, range) => {
  const lines = text.split('\n');
  assert.equal(range.start.line, range.end.line);
  return lines[range.start.line].slice(range.start.character, range.end.character);
};

test('facet declarations and semantic tokens select actual source identifiers and types', () => {
  const index = build(source);
  assert.equal(slice(source, index.definitionIndex.x.range), 'x');
  assert.equal(slice(source, index.definitionIndex['worker.score'].range), 'score');
  for (const token of index.semanticTokens.tokens) {
    const actual = source.split('\n')[token.line].slice(token.character, token.character + token.length);
    assert.ok(token.tokenType === 'type' ? ['Number', 'Text'].includes(actual) : ['x', 'y', 'marker', 'score'].includes(actual), actual);
  }
});

test('references include reads/writes and exclude comments, strings, authority scopes and shadowed parameters', () => {
  const index = build(source);
  const references = queryLspIndex(index, { kind: 'references', facet: 'x' });
  assert.equal(references.ok, true);
  assert.equal(references.result.length, 7);
  assert.ok(references.result.every(item => slice(source, item.range) === 'x'));
  const withDeclaration = queryLspIndex(index, { kind: 'references', facet: 'x', context: { includeDeclaration: true } });
  assert.equal(withDeclaration.result.length, 8);
  assert.equal(index.capabilities.referencesProvider, true);
});

test('definition, hover and references resolve a usage after non-BMP text with UTF-16 coordinates', () => {
  for (const text of [source, source.replaceAll('\n', '\r\n')]) {
    const index = build(text);
    const line = text.split('\n')[2], character = line.indexOf('((x))') + 2;
    const position = { line: 2, character };
    assert.deepEqual(queryLspIndex(index, { kind: 'definition', position }).result, index.definitionIndex.x);
    assert.equal(queryLspIndex(index, { kind: 'hover', position }).result.contents.value.includes('### x'), true);
    assert.equal(queryLspIndex(index, { kind: 'references', position }).result.length, 7);
    assert.equal(queryLspIndex(index, { kind: 'definition', position: { line: 2, character: character + 1 } }).ok, false);
  }
});

test('location sidecars leave the canonical AST unchanged', () => {
  const sidecar = parseRealityWithLocations(source);
  assert.deepEqual(sidecar.ast, parseReality(source));
  assert.equal(Object.hasOwn(sidecar.ast.body[0], 'range'), false);
});

test('match bindings and qualified record fields obey the existing facet/local resolution order', () => {
  const text = `reality Scoped {
    facet x : Number = 1
    facet x.value : Number = 2
    facet record : core.Record = { value: 1 }
    reckon f(x : Number, item : core.Option) -> Number = match item {
      Some(record) -> x.value
      None -> record.value + x
    }
  }`;
  const { occurrences } = buildFacetOccurrences(text, [{ path: 'x' }, { path: 'x.value' }, { path: 'record' }], 'rcl://scope');
  const refs = occurrences.filter(item => item.kind !== 'declaration');
  assert.deepEqual(refs.map(item => item.facet), ['x.value', 'record']);
});

test('UI-local state does not become a canonical facet reference', () => {
  const text = `reality Local { facet x : Number = 1 ui Screen { state x : Number = 2 view Root { text Label { bind value <- "" + x } } } }`;
  const { occurrences } = buildFacetOccurrences(text, [{ path: 'x' }], 'rcl://local');
  assert.equal(occurrences.filter(item => item.kind !== 'declaration').length, 0);
});

test('serialized indexes and CLI query syntax retain references and deterministic query roots', () => {
  const index = build(source), query = parseLspQueryArg('references:x');
  assert.deepEqual(query, { kind: 'references', facet: 'x' });
  assert.deepEqual(queryLspIndex(index, query), queryLspIndex(JSON.parse(JSON.stringify(index)), query));
  assert.equal(queryLspIndex(index, { kind: 'definition', position: { line: NaN, character: 0 } }).ok, false);
  const invalid = buildLspIndex({ source: 'reality Bad { facet x : Missing = 1 }', typeModuleSources: {} }).lspIndex;
  assert.equal(invalid.capabilities.referencesProvider, false);
  assert.equal(queryLspIndex(invalid, query).ok, false);
});
