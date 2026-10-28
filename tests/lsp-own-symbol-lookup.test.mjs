import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLspIndex, queryLspIndex } from '../src/lsp-dap-bridge-runtime.mjs';

const build = source => {
  const result = buildLspIndex({ source, typeModuleSources: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.lspIndex;
};
for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
  test(`LSP unknown ${name} is not an inherited facet or semantic node`, () => {
    const index = build('reality OwnLookup { facet value : Number = 1 }');
    for (const kind of ['hover', 'definition', 'references']) {
      const report = queryLspIndex(index, { kind, facet: name });
      assert.equal(report.ok, false);
      assert.deepEqual(report.result, kind === 'references' ? [] : null);
      assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
    }
    for (const kind of ['hover', 'definition']) assert.equal(queryLspIndex(index, { kind, semanticNodeId: name }).ok, false);
  });
  test(`LSP explicitly declared ${name} remains queryable after serialization`, () => {
    const index = build(`reality OwnLookup { facet ${name} : Number = 1 facet next : Number = ${name} + 1 }`);
    for (const value of [index, JSON.parse(JSON.stringify(index))]) {
      for (const kind of ['hover', 'definition', 'references']) {
        const report = queryLspIndex(value, { kind, facet: name });
        assert.equal(report.ok, true);
        assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
      }
      assert.equal(queryLspIndex(value, { kind: 'references', facet: name }).result.length, 1);
    }
  });
}
