import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { facetAst, span, projectAstLiterals } from '../src/compiler-primitives.mjs';
import { runRealityNative, verifyNativeParity } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { createRealitySession } from '../src/runtime.mjs';
import { openDurableRealitySession, verifyDurableRealitySessionBackup, verifyDurableRealitySessionHistoryPages } from '../src/durable-session.mjs';
import { RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE as V3, semanticStateRootForAlgorithm, verifyNativeSemanticStateRoot } from '../src/semantic-state-root.mjs';
import { semanticStateRootV2Stable } from '../src/semantic-state-root-v2.mjs';
import { RCL_SESSION_JOURNAL_V3_CANDIDATE_FORMAT, RCL_SESSION_COMMAND_IDENTITY_V3_CANDIDATE_FORMAT, RCL_SESSION_BACKUP_V3_CANDIDATE_FORMAT, RCL_SESSION_HISTORY_V3_CANDIDATE_FORMAT } from '../src/index.mjs';
import { compileTypedRealityToBytecodeLayout } from '../src/typed-bytecode-layout.mjs';
import { compileReality } from '../src/compiler.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { runReality } from '../src/runtime.mjs';

const ast = raw => `facet_ast("x", "Number", "Number", "${raw}", make_span(0, 1, 1, 1))`;
const source = raw => `reality AstValues { facet node : AstNode = ${ast(raw)} }`;
const options = { stateRootAlgorithm: V3, rejectProjectedAst: true };

test('v3 candidate binds raw AST spelling and projects verifiable public state', async () => {
  const first = await verifyNativeParity(source('1'), { nativeRuntime: options });
  const second = await verifyNativeParity(source('01'), { nativeRuntime: options });
  assert.equal(first.ok, true, JSON.stringify(first.parity));
  assert.equal(second.ok, true, JSON.stringify(second.parity));
  assert.equal(first.native.state.node.literalText, '1');
  assert.equal(second.native.state.node.literalText, '01');
  assert.notEqual(first.native.stateRoot, second.native.stateRoot);
  assert.equal(second.native.stateRoot, semanticStateRootForAlgorithm(JSON.parse(JSON.stringify(second.native.state)), V3));
  const tampered = structuredClone(second.native);
  tampered.state.node.literalText = '1';
  assert.throws(() => verifyNativeSemanticStateRoot(tampered, { expectedAlgorithm: V3 }),
    error => error.code === 'RCL_NATIVE_STATE_ROOT_MISMATCH');
  delete tampered.state.node.literalText;
  assert.throws(() => verifyNativeSemanticStateRoot(tampered, { expectedAlgorithm: V3 }),
    error => error.code === 'RCL_NATIVE_STATE_ROOT_V3_INVALID');
});

test('v3 candidate is domain separated and cannot infer spelling from v2 AST projections', () => {
  const node = facetAst('x', 'Number', 'Number', '01', span(0, 1, 1, 1));
  const canonical = facetAst('x', 'Number', 'Number', '1', span(0, 1, 1, 1));
  assert.notEqual(semanticStateRootForAlgorithm(node, V3), semanticStateRootForAlgorithm(canonical, V3));
  assert.equal(semanticStateRootForAlgorithm(node, V3), semanticStateRootForAlgorithm(projectAstLiterals(node), V3));
  const lossless = projectAstLiterals({ node });
  assert.equal(lossless.node.literalText, '01');
  assert.throws(() => semanticStateRootForAlgorithm(JSON.parse(JSON.stringify({ node })), V3), /RCL_AST_LITERAL_SPELLING_UNAVAILABLE/);
  assert.notEqual(semanticStateRootForAlgorithm({ x: 1 }, V3), semanticStateRootForAlgorithm({ x: 1 }, 'rcl.semantic-state-root.v2'));
  const unchangedV2 = runRealityNative(source('1'));
  assert.equal(unchangedV2.stateRoot, '312fa2e5adf0c6bb61066cc7e312740ea9e9dda8bf7a2047984fe2b1bd88ace8');
  assert.equal(Object.hasOwn(unchangedV2.state.node, 'literalText'), false);
  let reads = 0;
  const accessor = {}; Object.defineProperty(accessor, 'x', { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => semanticStateRootForAlgorithm(accessor, V3), /ACCESSOR_REJECTED/);
  assert.equal(reads, 0);
  assert.doesNotThrow(() => semanticStateRootForAlgorithm({ kind: 'FacetDecl', value: { kind: 'LiteralExpr', value: 1 } }, V3));
});

test('v3 candidate binds nested AST transition before and after roots', async () => {
  const sourceText = `reality AstTransition {
    facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')})
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values
      alter values <- sequence_append(empty_sequence(), ${ast('01')}) }
    realize update
  }`;
  const result = await verifyNativeParity(sourceText, { nativeRuntime: options });
  assert.equal(result.ok, true, JSON.stringify(result.parity));
  assert.equal(result.native.history.length, 1);
  assert.notEqual(result.native.history[0].beforeRoot, result.native.history[0].afterRoot);
  assert.equal(result.native.history[0].changes[0].before[0].literalText, '1');
  assert.equal(result.native.history[0].changes[0].after[0].literalText, '01');
  assert.equal(result.native.state.values[0].literalText, '01');
});

test('v3 candidate handles nested parse state and Unicode text spelling', async () => {
  const sourceText = `reality AstNested {
    facet parser : ParseState = make_parse_state(0, sequence_append(empty_sequence(), facet_ast("name🦊", "Text", "Text", "海🦊", make_span(0, 1, 1, 1))))
  }`;
  const result = await verifyNativeParity(sourceText, { nativeRuntime: options });
  assert.equal(result.ok, true, JSON.stringify(result.parity));
  assert.equal(result.native.state.parser.nodes[0].literalText, '海🦊');
  assert.equal(semanticStateRootForAlgorithm(result.native.state, V3), result.native.stateRoot);
});

test('v3 preserves typed records whose user fields resemble an AST', async () => {
  const sourceText = 'reality RecordShape { facet thing : probe.Outer = { kind:"FacetDecl", value:{ kind:"LiteralExpr" } } }';
  const compilerOptions = { typeModuleSources: { 'probe.rcltype': 'module probe\nexport record Inner { kind:Text }\nexport record Outer { kind:Text\nvalue:probe.Inner\n}' } };
  const compiled = compileTypedRealityToBytecodeLayout(sourceText, compilerOptions);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const native = runNativeBytecode(compiled.bytecode, options);
  const reference = await runReality(compileReality(sourceText, compilerOptions), { stateRootAlgorithm: V3 });
  assert.equal(native.stateRoot, reference.stateRoot);
  assert.equal(native.state.thing.kind, 'FacetDecl');
  assert.equal(native.state.thing.value.kind, 'LiteralExpr');
  assert.equal(Object.hasOwn(native.state.thing, 'literalText'), false);
});

test('v3 candidate sessions bind projected and committed AST changes', async () => {
  const sourceText = `reality AstSession {
    facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')})
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values
      alter values <- sequence_append(empty_sequence(), ${ast('01')}) }
  }`;
  const native = await createNativeRealitySession(sourceText, options);
  const reference = createRealitySession(sourceText, { stateRootAlgorithm: V3 });
  try {
    const before = native.snapshot().stateRoot;
    assert.equal(before, reference.snapshot().stateRoot);
    const projectedNative = await native.invoke({ rule: 'update', mode: 'foresee' });
    const projectedReference = await reference.invoke({ rule: 'update', mode: 'foresee' });
    assert.deepEqual(projectedReference, projectedNative);
    assert.notEqual(projectedNative.transition.afterRoot, before);
    assert.equal(native.snapshot().stateRoot, before);
    const actual = await native.invoke({ rule: 'update' });
    const expected = await reference.invoke({ rule: 'update' });
    assert.deepEqual(expected, actual);
    assert.notEqual(actual.afterRoot, before);
    assert.equal(actual.state.values[0].literalText, '01');
    assert.equal(actual.afterRoot, native.snapshot().stateRoot);
  } finally { await native.close(); }
});

test('candidate journal commits, replays and rejects an implicit v2 reopen', async () => {
  const target = path.join(os.tmpdir(), `rcl-v3-journal-not-created-${randomUUID()}`);
  const program = `reality Journal {
    facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')})
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values alter values <- sequence_append(empty_sequence(), ${ast('01')}) }
  }`;
  let session;
  try {
    session = await openDurableRealitySession(target, { source: program, native: options, verifyReference: true });
    const genesis = JSON.parse(fs.readFileSync(path.join(target, 'journal.jsonl'), 'utf8').trim());
    assert.equal(genesis.journalFormat, RCL_SESSION_JOURNAL_V3_CANDIDATE_FORMAT);
    assert.equal(RCL_SESSION_COMMAND_IDENTITY_V3_CANDIDATE_FORMAT, 'rcl.session-command-identity.v3-candidate');
    const before = session.snapshot().stateRoot;
    const request = { rule: 'update', requestId: 'one', expectedRevision: 0 };
    const first = await session.invoke(request);
    assert.notEqual(first.result.afterRoot, before);
    await session.invoke({ rule: 'update', mode: 'foresee', requestId: 'two', expectedRevision: 1 });
    const head = session.snapshot().journalRoot;
    const pages = [await session.history({ fromRevision: 1, limit: 1 }), await session.history({ fromRevision: 2, limit: 1 })];
    assert.equal(pages[0].format, RCL_SESSION_HISTORY_V3_CANDIDATE_FORMAT);
    const verified = verifyDurableRealitySessionHistoryPages(pages, { expectedJournalRoot: head });
    assert.equal(verified.completeHistory, true);
    const corrupted = structuredClone(pages);
    corrupted[0].entries[0].result.state.values[0].literalText = '1';
    assert.throws(() => verifyDurableRealitySessionHistoryPages(corrupted, { expectedJournalRoot: head }));
    assert.throws(() => verifyDurableRealitySessionHistoryPages([pages[1], pages[0]], { expectedJournalRoot: head }));
    const downgraded = structuredClone(pages);
    downgraded[0].format = 'rcl.session-history-page.v1';
    const { pageRoot: ignored, ...core } = downgraded[0];
    downgraded[0].pageRoot = semanticStateRootV2Stable(core);
    assert.throws(() => verifyDurableRealitySessionHistoryPages(downgraded, { expectedJournalRoot: head }));
    await session.close(); session = null;
    await assert.rejects(openDurableRealitySession(target), error => error.code === 'RCL_SESSION_GENESIS_BINDING_MISMATCH');
    session = await openDurableRealitySession(target, { native: options, verifyReference: true, expectedJournalRoot: head });
    assert.equal(session.snapshot().state.values[0].literalText, '01');
    assert.equal((await session.invoke(request)).replayed, true);
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(target), os.tmpdir());
    assert.ok(path.basename(target).startsWith('rcl-v3-journal-not-created-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('candidate backup verifies by native replay and restores independent retry', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v3-backup-'));
  const journal = path.join(base, 'live'), backup = path.join(base, 'backup');
  const program = `reality Backup {
    facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')})
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values alter values <- sequence_append(empty_sequence(), ${ast('01')}) }
  }`;
  const request = { rule: 'update', requestId: 'one', expectedRevision: 0 };
  let session, restored;
  try {
    session = await openDurableRealitySession(journal, { source: program, native: options, verifyReference: true });
    await session.invoke(request);
    const saved = await session.backup(backup);
    assert.equal(saved.format, RCL_SESSION_BACKUP_V3_CANDIDATE_FORMAT);
    await assert.rejects(verifyDurableRealitySessionBackup(backup), error => error.code === 'RCL_SESSION_JOURNAL_STATE_ROOT_ALGORITHM_UNSUPPORTED');
    const verified = await verifyDurableRealitySessionBackup(backup, { native: options, verifyReference: true, expectedBackupRoot: saved.backupRoot });
    assert.equal(verified.format, 'rcl.session-backup-verification.v3-candidate');
    assert.equal(verified.nativeReplayVerified, true);
    assert.equal(verified.referenceReplayVerified, true);
    restored = await openDurableRealitySession(backup, { native: options, expectedJournalRoot: saved.journalRoot });
    assert.equal(restored.snapshot().state.values[0].literalText, '01');
    assert.equal((await restored.invoke(request)).replayed, true);
    await restored.close(); restored = null;
    fs.appendFileSync(path.join(backup, 'journal.jsonl'), 'x');
    await assert.rejects(verifyDurableRealitySessionBackup(backup, { native: options }), error => error.code === 'RCL_SESSION_BACKUP_ASSET_MISMATCH');
  } finally {
    if (restored) await restored.close();
    if (session) await session.close();
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('rcl-v3-backup-'));
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('v2 journal cannot be implicitly upgraded and its durable assets remain unchanged', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v3-no-upgrade-'));
  const program = 'reality Legacy { facet n : Number = 0 subject a { warrant world.write on n } emergence update { cause a when true needs world.write on n alter n <- n + 1 } }';
  let session;
  try {
    session = await openDurableRealitySession(base, { source: program });
    await session.invoke({ rule: 'update', requestId: 'one', expectedRevision: 0 });
    const head = session.snapshot().journalRoot;
    await session.close(); session = null;
    const names = ['source.rcl', 'session.rbc', 'journal.jsonl'];
    const before = names.map(name => fs.readFileSync(path.join(base, name)));
    await assert.rejects(openDurableRealitySession(base, { native: options }), error => error.code === 'RCL_SESSION_GENESIS_BINDING_MISMATCH');
    for (const [i, name] of names.entries()) assert.deepEqual(fs.readFileSync(path.join(base, name)), before[i]);
    session = await openDurableRealitySession(base, { expectedJournalRoot: head });
    assert.equal(session.snapshot().state.n, 1);
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('rcl-v3-no-upgrade-'));
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('self-rehashed forged v3 AST state cannot replace native command replay', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v3-forgery-'));
  const program = `reality Forgery {
    facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')})
    subject actor { warrant world.write on values }
    emergence update { cause actor when true needs world.write on values alter values <- sequence_append(empty_sequence(), ${ast('01')}) }
  }`;
  let session;
  try {
    session = await openDurableRealitySession(base, { source: program, native: options });
    await session.invoke({ rule: 'update', requestId: 'one', expectedRevision: 0 });
    await session.close(); session = null;
    const journal = path.join(base, 'journal.jsonl');
    const [genesis, record] = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(JSON.parse);
    record.result.state.values[0].literalText = '1';
    record.result.transition.changes[0].after[0].literalText = '1';
    const forgedRoot = semanticStateRootForAlgorithm(record.result.state, V3);
    record.afterStateRoot = forgedRoot;
    record.result.afterRoot = forgedRoot;
    record.result.transition.afterRoot = forgedRoot;
    record.resultRoot = semanticStateRootV2Stable({ format: 'rcl.session-result-identity.v3-candidate',
      payloadRoot: semanticStateRootV2Stable(record.result), commandRoot: record.commandRoot, stateRoot: forgedRoot });
    const { root: discarded, ...core } = record;
    record.root = semanticStateRootV2Stable(core);
    fs.writeFileSync(journal, `${JSON.stringify(genesis)}\n${JSON.stringify(record)}\n`);
    await assert.rejects(openDurableRealitySession(base, { native: options }), error => error.code === 'RCL_SESSION_REPLAY_MISMATCH');
  } finally {
    if (session) await session.close();
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('rcl-v3-forgery-'));
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('public CLI executes candidate journal, history and backup in separate processes', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v3-cli-'));
  const program = path.join(base, 'source.rcl'), store = path.join(base, 'journal'), backup = path.join(base, 'backup');
  const command = path.join(base, 'command.json'), page = path.join(base, 'page.json');
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  const run = args => {
    const process = spawnSync(processExec, [cli, 'session', ...args], { encoding: 'utf8', windowsHide: true });
    assert.equal(process.status, 0, process.stderr + process.stdout);
    return JSON.parse(process.stdout);
  };
  const processExec = process.execPath;
  try {
    fs.writeFileSync(program, `reality CliV3 { facet values : Sequence = sequence_append(empty_sequence(), ${ast('1')}) subject actor { warrant world.write on values } emergence update { cause actor when true needs world.write on values alter values <- sequence_append(empty_sequence(), ${ast('01')}) } }`);
    fs.writeFileSync(command, JSON.stringify({ rule: 'update', requestId: 'one', expectedRevision: 0 }));
    const flags = ['--state-root-v3-candidate', '--reject-projected-ast'];
    assert.equal(run(['init', program, store, ...flags]).stateRootAlgorithm, V3);
    const result = run(['invoke', store, command, ...flags]);
    assert.equal(result.result.state.values[0].literalText, '01');
    const history = run(['history', store, ...flags]);
    fs.writeFileSync(page, JSON.stringify(history));
    assert.equal(run(['history-verify', page, '--expected-root', result.receipt.root]).completeHistory, true);
    const saved = run(['backup', store, backup, ...flags]);
    assert.equal(run(['backup-verify', backup, '--reject-projected-ast', '--state-root-v3-candidate', '--expected-backup-root', saved.backupRoot]).nativeReplayVerified, true);
  } finally {
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('rcl-v3-cli-'));
    fs.rmSync(base, { recursive: true, force: true });
  }
});
