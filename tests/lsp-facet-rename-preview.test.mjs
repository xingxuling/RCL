import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildFacetRenamePreview, writeFacetRenamePreview } from '../src/index.mjs';
import { verifyNativeParity } from '../src/native-vm.mjs';
import { DEFAULT_TYPED_REFERENCE_TYPE_MODULES } from '../src/typed-reference-abi.mjs';

const source = `reality Rename {
  facet world.count : Number = 1
  facet copy : Number = world.count
  facet label : Text = "world.count 🦊"
  # world.count stays in this comment
  reckon local(count : Number) -> Number = count
  subject actor { warrant world.write on world }
  emergence increment { cause actor when world.count > 0
    needs world.write on world
    alter world.count <- world.count + 1
    preserve world.count > 0
    witness "world.count"
  }
  ui App { state count : Text = "local" view Root { text Count { bind value <- count } } }
  realize increment
}`;
const request = text => ({ source: text, facet: 'world.count', newName: 'total', version: 7 });
const good = input => {
  const result = buildFacetRenamePreview(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.preview;
};
const bad = (input, code) => {
  const result = buildFacetRenamePreview(input);
  assert.equal(result.ok, false); assert.equal(result.code, code); assert.equal(result.preview, null);
};
const applyWorkspaceEdit = (text, preview) => {
  const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const edits = preview.workspaceEdit.documentChanges[0].edits.map(edit => ({ ...edit,
    start: starts[edit.range.start.line] + edit.range.start.character,
    end: starts[edit.range.end.line] + edit.range.end.character }));
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.newText + text.slice(edit.end);
  return text;
};

test('namespace leaf preview changes parsed declarations/reads/writes and preserves strings, comments, parameters and UI locals', async () => {
  const preview = good(request(source));
  assert.equal(preview.status, 'CANDIDATE'); assert.equal(preview.newFacet, 'world.total');
  assert.equal(preview.workspaceEdit.documentChanges[0].textDocument.version, 7);
  assert.equal(preview.workspaceEdit.documentChanges[0].edits.length, 6);
  assert.equal(applyWorkspaceEdit(source, preview), preview.previewSource);
  for (const text of ['"world.count 🦊"', '# world.count stays', 'witness "world.count"', 'local(count : Number) -> Number = count', 'state count : Text = "local"']) assert.ok(preview.previewSource.includes(text));
  assert.ok(preview.previewSource.includes('needs world.write on world'));
  const runtime = await verifyNativeParity(preview.previewSource, { nativeRuntime: { stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(runtime.ok, true, JSON.stringify(runtime.parity));
  assert.equal(runtime.native.state['world.total'], 2); assert.equal(runtime.native.state.copy, 1);
  assert.equal(Object.hasOwn(runtime.native.state, 'world.count'), false);
});

test('owned declaration spelling, qualified uses and CRLF Unicode positions remain executable edits', () => {
  for (const newline of ['\n', '\r\n']) {
    const original = `reality Owned {
      subject worker { facet count : Number = 1 }
      facet label : Text = "🦊" facet copy : Number = worker.count
    }`.replaceAll('\n', newline);
    const preview = good({ source: original, facet: 'worker.count', newName: '积分' });
    assert.ok(preview.previewSource.includes('subject worker { facet 积分 : Number'));
    assert.ok(preview.previewSource.includes('worker.积分'));
    assert.equal(applyWorkspaceEdit(original, preview), preview.previewSource);
    assert.equal(preview.previewSource.includes('\r\n'), newline === '\r\n');
  }
});

test('record field suffixes retain their own identifiers while the facet leaf changes', () => {
  const preview = good({ source: `reality TypedRename {
    facet app.user : core.User<Text> = { id: "u", payload: "kept" }
    facet message : Text = app.user.payload
  }`, facet: 'app.user', newName: 'profile', typeModuleSources: DEFAULT_TYPED_REFERENCE_TYPE_MODULES });
  assert.ok(preview.previewSource.includes('app.profile.payload'));
  assert.ok(preview.previewSource.includes('id: "u", payload: "kept"'));
});

test('preview construction compiles provider expressions without executing them', () => {
  const preview = good({ source: 'reality CompileOnly { facet reply : Text = provider_call("not-registered", "read", "{}") facet copy : Text = reply }', facet: 'reply', newName: 'message' });
  assert.ok(preview.previewSource.includes('provider_call("not-registered", "read", "{}")'));
  assert.ok(preview.previewSource.includes('facet copy : Text = message'));
});

test('a renamed value cannot be captured by a parameter or literal syntax', () => {
  bad({ source: 'reality Capture { facet counter : Number = 1 reckon read(total : Number) -> Number = counter + total }', facet: 'counter', newName: 'total' }, 'RCL_LSP_RENAME_BINDING_CHANGE');
  bad({ source: 'reality Capture { facet enabled : Truth = true facet next : Truth = enabled }', facet: 'enabled', newName: 'true' }, 'RCL_LSP_RENAME_BINDING_CHANGE');
});

test('collisions, unknown facets, no-ops and stale source pins return no partial preview', () => {
  const original = 'reality Names { facet first : Number = 1 facet second : Number = 2 }';
  bad({ source: original, facet: 'first', newName: 'second' }, 'RCL_LSP_RENAME_COLLISION');
  bad({ source: original, facet: 'absent', newName: 'other' }, 'RCL_LSP_RENAME_FACET_UNKNOWN');
  bad({ source: original, facet: 'first', newName: 'first' }, 'RCL_LSP_RENAME_NO_CHANGE');
  bad({ source: original, facet: 'first', newName: 'other', expectedTextRoot: '0'.repeat(64) }, 'RCL_LSP_RENAME_SOURCE_ROOT_MISMATCH');
});

test('exact and descendant authority scopes stay outside automated value renaming', () => {
  for (const scope of ['world.count', 'world.count.child', 'world.total']) {
    bad(request(`reality Authority { facet world.count : Number = 1 subject actor { warrant world.write on ${scope} } }`), 'RCL_LSP_RENAME_AUTHORITY_DEPENDENCY');
  }
});

test('new names are exactly one identifier, with no path, whitespace, comment or source injection', () => {
  for (const newName of ['', '9', 'x.y', 'x y', 'x\n', 'x#comment', '"x"', 'x }']) bad({ ...request(source), newName }, 'RCL_LSP_RENAME_NAME_INVALID');
  bad({ ...request(source), version: -1 }, 'RCL_LSP_RENAME_INPUT_INVALID');
  bad({ ...request(source), extra: true }, 'RCL_LSP_RENAME_INPUT_INVALID');
  bad({ ...request(source), sourceFile: {} }, 'RCL_LSP_RENAME_INPUT_INVALID');
  bad({ ...request(source), typeModuleSources: [] }, 'RCL_LSP_RENAME_INPUT_INVALID');
  bad({ ...request(source), source: 'realty Broken {}' }, 'RCL_LSP_RENAME_SOURCE_INVALID');
});

test('preview hashes and standard WorkspaceEdit data reproduce after JSON serialization', () => {
  for (const newName of ['total', 'constructor', '__proto__']) {
    const input = { source: 'reality RoundTrip { facet counter : Number = 1 facet next : Number = counter + 1 }', facet: 'counter', newName };
    const preview = good(input);
    assert.deepEqual(good(input), preview); assert.deepEqual(JSON.parse(JSON.stringify(preview)), preview);
    const { previewRoot, ...core } = preview;
    const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
    assert.equal(createHash('sha256').update(JSON.stringify(sorted(core))).digest('hex'), previewRoot);
  }
});

test('public CLI exports a fresh review directory, preserves the original and rejects existing outputs or unknown flags', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rename-preview-'));
  try {
    const file = path.join(directory, 'source.rcl'), output = path.join(directory, 'preview'); fs.writeFileSync(file, source);
    const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
    const run = args => spawnSync(process.execPath, [cli, 'lsp-rename-preview', ...args], { encoding: 'utf8', windowsHide: true });
    const result = run([file, 'world.count', 'total', output]);
    assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true); assert.equal(fs.readFileSync(file, 'utf8'), source);
    assert.equal(fs.readFileSync(report.previewPath, 'utf8'), good({ ...request(source), sourceFile: file }).previewSource);
    const second = run([file, 'world.count', 'total', output]);
    assert.equal(second.status, 1); assert.equal(JSON.parse(second.stdout).code, 'RCL_LSP_RENAME_OUTPUT_EXISTS');
    const unknown = path.join(directory, 'unknown');
    const invalid = run([file, 'world.count', 'total', unknown, '--force']);
    assert.equal(invalid.status, 1); assert.equal(fs.existsSync(unknown), false);
    const rejected = path.join(directory, 'rejected');
    assert.equal(writeFacetRenamePreview(file, 'absent', 'x', rejected).ok, false); assert.equal(fs.existsSync(rejected), false);
    const typeDirectory = path.join(directory, '类型 modules'); fs.mkdirSync(typeDirectory);
    for (const [name, text] of Object.entries(DEFAULT_TYPED_REFERENCE_TYPE_MODULES)) fs.writeFileSync(path.join(typeDirectory, name), text);
    const typedFile = path.join(directory, '类型 source.rcl'), typedOutput = path.join(directory, 'typed preview');
    const typedSource = '\ufeffreality Typed { facet app.user : core.User<Text> = { id: "u", payload: "kept" } facet label : Text = app.user.payload }';
    fs.writeFileSync(typedFile, typedSource); const typedBytes = fs.readFileSync(typedFile);
    const typedRun = run([typedFile, 'app.user', 'profile', typedOutput, '--types', typeDirectory]);
    assert.equal(typedRun.status, 0, typedRun.stderr + typedRun.stdout);
    const typedResult = JSON.parse(typedRun.stdout);
    assert.equal(typedResult.sourceTextRoot, createHash('sha256').update(typedBytes).digest('hex'));
    assert.deepEqual(fs.readFileSync(typedFile), typedBytes);
    assert.equal(fs.readFileSync(typedResult.previewPath, 'utf8').startsWith('\ufeff'), true);
    assert.ok(fs.readFileSync(typedResult.previewPath, 'utf8').includes('app.profile.payload'));
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir()); assert.ok(path.basename(directory).startsWith('rcl-rename-preview-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
