import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runRealityNative, verifyNativeParity } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { createRealitySession } from '../src/runtime.mjs';
import { openDurableRealitySession } from '../src/durable-session.mjs';
import { verifyNativeSemanticStateRoot } from '../src/semantic-state-root.mjs';
import { runSessionCli } from '../src/session-cli.mjs';
import { facetAst, span, cloneRuntimeValue } from '../src/compiler-primitives.mjs';
import { applyBinary } from '../src/quantity.mjs';

const at = 'make_span(0, 1, 1, 1)';
const ast = text => `facet_ast("x", "Number", "Number", "${text}", ${at})`;
const sequence = text => `sequence_append(empty_sequence(), ${ast(text)})`;

test('reference and native retain AstNode literal text and equality through sequence copies', async () => {
  const source = `reality AstValues {
    facet a : AstNode = ${ast('01')}
    facet b : AstNode = ${ast('01')}
    facet other : AstNode = ${ast('1')}
    facet nested : Sequence = ${sequence('01')}
    facet text : Text = ast_literal_text(sequence_get(nested, 0))
    facet equal : Truth = a == b
    facet unequal : Truth = a != other
    facet equalNested : Truth = nested == ${sequence('01')}
    facet unequalNested : Truth = nested != ${sequence('1')}
  }`;
  const result = await verifyNativeParity(source, { nativeRuntime: { stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(result.ok, true, JSON.stringify(result.parity));
  assert.equal(result.reference.state.text, '01');
  for (const field of ['equal', 'unequal', 'equalNested', 'unequalNested']) assert.equal(result.reference.state[field], true);
});

test('AST spelling survives private copies without changing the v2 public projection', () => {
  const location = span(0, 1, 1, 1), original = facetAst('x', 'Number', 'Number', '01', location);
  const copied = cloneRuntimeValue([original, [original]]);
  assert.equal(applyBinary('==', copied[0], original), true);
  assert.equal(applyBinary('==', copied[1][0], original), true);
  assert.equal(applyBinary('!=', copied[0], facetAst('x', 'Number', 'Number', '1', location)), true);
  assert.deepEqual(JSON.parse(JSON.stringify(copied[0])), JSON.parse(JSON.stringify(facetAst('x', 'Number', 'Number', '1', location))));
  const lossy = structuredClone(original);
  assert.equal(applyBinary('==', lossy, original), false);
  assert.equal(applyBinary('==', lossy, lossy), true);
  const map = new Map(); map.extra = original;
  assert.doesNotThrow(() => cloneRuntimeValue(map));
});

test('native and reference compare each AstNode field and nodes inside ParseState', async () => {
  const base = ast('01');
  const variants = [
    `facet_ast("other", "Number", "Number", "01", ${at})`,
    `facet_ast("x", "Text", "Number", "01", ${at})`,
    `facet_ast("x", "Number", "Text", "01", ${at})`,
    `facet_ast("x", "Number", "Number", "01", make_span(0, 1, 2, 1))`,
  ];
  const sequenceWith = expr => `sequence_append(empty_sequence(), ${expr})`;
  for (const other of variants) {
    const result = await verifyNativeParity(`reality AstComparison {
      facet different : Truth = ${base} != ${other}
      facet states : Truth = make_parse_state(0, ${sequenceWith(base)}) != make_parse_state(0, ${sequenceWith(other)})
    }`);
    assert.equal(result.ok, true, JSON.stringify(result.parity));
    assert.equal(result.reference.state.different, true);
    assert.equal(result.reference.state.states, true);
  }
});

const sessionSource = `reality NestedAst {
    facet values : Sequence = ${sequence('1')}
    facet seen : Text = ""
    subject actor { warrant world.write on values warrant world.write on seen }
    emergence update { cause actor when true needs world.write on values alter values <- ${sequence('01')} }
    emergence inspect { cause actor when true needs world.write on seen alter seen <- ast_literal_text(sequence_get(values, 0)) }
  }`;

test('native and reference sessions observe exact spelling after a committed sequence update', async () => {
  const native = await createNativeRealitySession(sessionSource), reference = createRealitySession(sessionSource);
  try {
    const before = native.snapshot().stateRoot;
    const n1 = await native.invoke({ rule: 'update' }), r1 = await reference.invoke({ rule: 'update' });
    assert.deepEqual(r1, n1);
    // This is a known v2 projection limitation: raw text is not root-bound.
    assert.equal(n1.afterRoot, before);
    const n2 = await native.invoke({ rule: 'inspect' }), r2 = await reference.invoke({ rule: 'inspect' });
    assert.deepEqual(r2, n2);
    assert.equal(n2.state.seen, '01');
  } finally { await native.close(); }
});

test('durable native and reference replay retain spelling across reopen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ast-spelling-'));
  let session;
  try {
    session = await openDurableRealitySession(dir, { source: sessionSource, verifyReference: true });
    const request = { requestId: 'update', expectedRevision: 0, rule: 'update' };
    await session.invoke(request);
    const head = session.snapshot().journalRoot;
    await session.close(); session = null;
    session = await openDurableRealitySession(dir, { expectedJournalRoot: head, verifyReference: true });
    assert.equal((await session.invoke(request)).replayed, true);
    const result = await session.invoke({ requestId: 'inspect', expectedRevision: 1, rule: 'inspect' });
    assert.equal(result.result.state.seen, '01');
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('rcl-ast-spelling-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('opt-in projection guard rejects nested AST state and later transitions', async () => {
  await assert.rejects(createNativeRealitySession(sessionSource, { rejectProjectedAst: true }),
    error => error.code === 'RCL_SESSION_NATIVE_EVIDENCE_INVALID' && error.details?.cause === 'RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY');
  const source = `reality LaterAst {
    facet values : Sequence = empty_sequence()
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values alter values <- ${sequence('01')} }
  }`;
  const session = await createNativeRealitySession(source, { rejectProjectedAst: true });
  try {
    await assert.rejects(session.invoke({ rule: 'update' }),
      error => error.code === 'RCL_SESSION_NATIVE_EVIDENCE_INVALID' && error.details?.cause === 'RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY');
    await assert.rejects(session.invoke({ rule: 'update' }), error => error.code === 'RCL_SESSION_NATIVE_CLOSED');
  } finally { await session.close(); }
});

test('durable opt-in guard poisons the writer before appending a lossy transition', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ast-guard-'));
  const source = `reality GuardedJournal {
    facet values : Sequence = empty_sequence()
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values alter values <- ${sequence('01')} }
  }`;
  let session;
  try {
    session = await openDurableRealitySession(dir, { source, native: { rejectProjectedAst: true } });
    const head = session.snapshot().journalRoot;
    await assert.rejects(session.invoke({ requestId: 'update', expectedRevision: 0, rule: 'update' }),
      error => error.code === 'RCL_SESSION_DURABILITY_UNCERTAIN');
    await session.close(); session = null;
    session = await openDurableRealitySession(dir, { expectedJournalRoot: head, native: { rejectProjectedAst: true } });
    assert.equal(session.snapshot().revision, 0);
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('rcl-ast-guard-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('projection guard also covers transient records and preserves ordinary state acceptance', () => {
  const projected = JSON.parse(JSON.stringify(facetAst('x', 'Number', 'Number', '01', span(0, 1, 1, 1))));
  const payload = { state: { values: [] }, history: [{ changes: [{ after: [projected] }] }] };
  assert.throws(() => verifyNativeSemanticStateRoot(payload, { rejectProjectedAst: true }),
    error => error.code === 'RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY');
  assert.doesNotThrow(() => verifyNativeSemanticStateRoot({ state: { values: [1, '01'] } }, { rejectProjectedAst: true }));
  assert.doesNotThrow(() => verifyNativeSemanticStateRoot(payload));
  assert.throws(() => runRealityNative(`reality Guarded { facet items : Sequence = ${sequence('01')} }`, { rejectProjectedAst: true }),
    error => error.code === 'RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY');
  assert.equal(runRealityNative('reality Safe { facet value : Number = 1 }', { rejectProjectedAst: true }).state.value, 1);
});

test('session CLI exposes the opt-in guard without accepting it for offline history verification', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ast-cli-'));
  try {
    const source = path.join(dir, 'source.rcl'), store = path.join(dir, 'session'), command = path.join(dir, 'command.json');
    fs.writeFileSync(source, `reality CliGuard {
      facet values : Sequence = empty_sequence()
      subject actor { warrant world.write on values }
      emergence update { cause actor when true needs world.write on values alter values <- ${sequence('01')} }
    }`);
    fs.writeFileSync(command, JSON.stringify({ requestId: 'update', expectedRevision: 0, rule: 'update' }));
    assert.equal((await runSessionCli(['init', source, store, '--reject-projected-ast'])).ok, true);
    const rejected = await runSessionCli(['invoke', store, command, '--reject-projected-ast']);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, 'RCL_SESSION_DURABILITY_UNCERTAIN');
    assert.equal((await runSessionCli(['inspect', store, '--reject-projected-ast'])).revision, 0);
    const offline = await runSessionCli(['history-verify', path.join(dir, 'missing'), '--reject-projected-ast']);
    assert.equal(offline.code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
  } finally {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('rcl-ast-cli-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
