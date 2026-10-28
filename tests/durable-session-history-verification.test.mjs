import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDurableRealitySession, verifyDurableRealitySessionHistoryPage as verifyPage,
  verifyDurableRealitySessionHistoryPages as verifyPages } from '../src/index.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';
import { runSessionCli } from '../src/session-cli.mjs';
import { commandIdentityForRecord, resultIdentityForRecord } from './fixtures/durable-history-identities.mjs';

let directory, session, empty, pages, whole, emptyTail, lastOnly, head;
const copy = value => structuredClone(value);
const reroot = value => { const { root: omitted, ...core } = value; value.root = root(core); return value; };
const repage = page => { const { pageRoot: omitted, ...core } = page; page.pageRoot = root(core); return page; };
function rechain(page, updateHead = false) {
  let previousRoot = page.previousRoot;
  for (const entry of page.entries) {
    entry.previousRoot = previousRoot;
    entry.commandRoot = commandIdentityForRecord(entry);
    entry.resultRoot = resultIdentityForRecord(entry); reroot(entry); previousRoot = entry.root;
  }
  if (updateHead) page.journalRoot = previousRoot;
  return repage(page);
}
test.before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-history-verification-'));
  session = await openDurableRealitySession(directory, { source: fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8'), verifyReference: true });
  empty = await session.history();
  for (const [revision, delta, mode] of [[0, 2, 'realize'], [1, 3, 'foresee'], [2, 0, 'realize'], [3, 1, 'realize']]) {
    await session.invoke({ requestId: `verify-${revision}`, expectedRevision: revision, rule: 'increment', mode, inputs: { 'event.delta': delta, 'event.label': 'history' } });
  }
  head = session.snapshot();
  pages = [await session.history({ limit: 2 }), await session.history({ fromRevision: 3, limit: 2 })];
  whole = await session.history(); emptyTail = await session.history({ fromRevision: 5 }); lastOnly = await session.history({ fromRevision: 4, limit: 1 });
});
test.after(async () => {
  await session?.close();
  assert.equal(path.dirname(directory), os.tmpdir()); assert.ok(path.basename(directory).startsWith('rcl-history-verification-'));
  fs.rmSync(directory, { recursive: true, force: true });
});

test('genuine realized/projected/not-triggered receipts verify as a pinned complete page and page chain', () => {
  assert.deepEqual(whole.entries.map(entry => entry.result.status), ['realized', 'projected', 'not-triggered', 'realized']);
  for (const report of [verifyPage(whole, { expectedJournalRoot: head.journalRoot }), verifyPages(pages, { expectedJournalRoot: head.journalRoot, expectedPreviousRoot: empty.journalRoot, minimumRevision: 4 })]) {
    assert.equal(report.status, 'VERIFIED_AGAINST_PIN'); assert.equal(report.contentAnchored, true); assert.equal(report.completeHistory, true);
    assert.equal(report.verifiedEntries, 4); assert.equal(report.stateRoot, head.stateRoot);
    assert.equal(report.commandReplay, false); assert.equal(report.sourceExecution, false); assert.equal(report.publisherAuthenticated, false);
    const { verificationRoot, ...core } = report; assert.equal(verificationRoot, root(core));
  }
});

test('a copied head pin on an interior page is not content anchoring, while an actual page pin is', () => {
  const interior = verifyPage(pages[0], { expectedJournalRoot: head.journalRoot });
  assert.equal(interior.status, 'CONSISTENT_UNANCHORED'); assert.equal(interior.contentAnchored, false);
  assert.equal(verifyPage(pages[0], { expectedPageRoot: pages[0].pageRoot }).pagePinned, true);
  assert.equal(verifyPage(whole).contentAnchored, false);
  assert.equal(verifyPage(pages[1], { expectedJournalRoot: head.journalRoot }).headAnchored, true);
});

test('empty genesis and after-head pages cannot manufacture head-bound state evidence', () => {
  for (const page of [empty, emptyTail]) {
    const report = verifyPage(page, { expectedJournalRoot: page.journalRoot });
    assert.equal(report.verifiedEntries, 0); assert.equal(report.contentAnchored, false);
    assert.equal(verifyPage(page, { expectedPageRoot: page.pageRoot }).contentAnchored, true);
  }
});

test('a self-rehashed forged interior receipt stays unanchored and cannot join the genuine suffix', () => {
  const forged = copy(pages[0]); forged.entries[0].result.transition.witnesses.push('forged'); rechain(forged);
  assert.equal(verifyPage(forged, { expectedJournalRoot: head.journalRoot }).contentAnchored, false);
  assert.throws(() => verifyPage(forged, { expectedPageRoot: pages[0].pageRoot }), { code: 'RCL_SESSION_HISTORY_PIN_MISMATCH' });
  assert.throws(() => verifyPages([forged, pages[1]], { expectedJournalRoot: head.journalRoot }), { code: 'RCL_SESSION_HISTORY_PAGES_CONTINUITY_MISMATCH' });
});

test('missing, reordered, gapped, mixed-head or repeated pages fail', () => {
  assert.throws(() => verifyPages([pages[0]]), { code: 'RCL_SESSION_HISTORY_PAGES_INCOMPLETE' });
  for (const sequence of [[pages[1], pages[0]], [pages[0], pages[0]], [pages[0], lastOnly]]) assert.throws(() => verifyPages(sequence), { code: 'RCL_SESSION_HISTORY_PAGES_CONTINUITY_MISMATCH' });
  const mixed = copy(pages[0]); mixed.journalRoot = '1'.repeat(64); repage(mixed);
  assert.throws(() => verifyPages([mixed, pages[1]]), { code: 'RCL_SESSION_HISTORY_PAGES_CONTINUITY_MISMATCH' });
});

test('raw tampering and self-rehashed result/state/transition contradictions reject', () => {
  const raw = copy(whole); raw.entries[0].result.state['counter.value'] = 999;
  assert.throws(() => verifyPage(raw), { code: 'RCL_SESSION_HISTORY_PAGE_ROOT_MISMATCH' });
  for (const mutate of [
    page => { page.entries[0].result.state['counter.value'] = 999; },
    page => { page.entries[0].result.transition.changes[0].after = 999; },
    page => { page.entries[1].result.transition.afterRoot = '0'.repeat(64); },
    page => { page.entries[2].result.status = 'realized'; },
    page => { page.entries[0].result.command.mode = 'foresee'; },
  ]) {
    const forged = copy(whole); mutate(forged); rechain(forged, true);
    assert.throws(() => verifyPage(forged), { code: 'RCL_SESSION_HISTORY_RESULT_INVALID' });
  }
});

test('duplicate request IDs reject both within a page and across otherwise continuous pages', () => {
  const forged = copy(pages[0]); forged.entries[1].requestId = forged.entries[0].requestId; rechain(forged);
  assert.throws(() => verifyPage(forged), { code: 'RCL_SESSION_HISTORY_DUPLICATE_REQUEST' });
  const pair = copy(pages); pair[1].entries[0].requestId = pair[0].entries[0].requestId; rechain(pair[1], true);
  pair[0].journalRoot = pair[1].journalRoot; repage(pair[0]);
  assert.throws(() => verifyPages(pair), { code: 'RCL_SESSION_HISTORY_DUPLICATE_REQUEST' });
});

test('command normalization, exact record shape and page range contracts remain enforced after rehashing', () => {
  for (const mutate of [
    page => { page.entries[0].command.inputs['event.delta'] = []; },
    page => { page.entries[0].command.extra = true; },
  ]) {
    const forged = copy(pages[0]); mutate(forged); forged.entries[0].result.command = copy(forged.entries[0].command); rechain(forged);
    assert.throws(() => verifyPage(forged), { code: 'RCL_SESSION_HISTORY_COMMAND_INVALID' });
  }
  const extra = copy(pages[0]); extra.entries[0].unknown = true; rechain(extra);
  assert.throws(() => verifyPage(extra), { code: 'RCL_SESSION_HISTORY_PAGE_INVALID' });
  const missing = copy(pages[0]); missing.entries.pop(); repage(missing);
  assert.throws(() => verifyPage(missing), { code: 'RCL_SESSION_HISTORY_PAGE_INVALID' });
});

test('bad pins and rollback floors fail before reports, and optional undefined pins are ignored explicitly', () => {
  for (const options of [{ expectedJournalRoot: '0'.repeat(64) }, { expectedPageRoot: '0'.repeat(64) }, { expectedPreviousRoot: '0'.repeat(64) }, { expectedSessionId: 'other' }, { expectedProgramRoot: '0'.repeat(64) }]) assert.throws(() => verifyPage(whole, options), { code: 'RCL_SESSION_HISTORY_PIN_MISMATCH' });
  assert.throws(() => verifyPage(whole, { minimumRevision: 5 }), { code: 'RCL_SESSION_REVISION_ROLLBACK' });
  for (const options of [null, [], { bad: true }, { expectedPageRoot: 'bad' }, { minimumRevision: -1 }]) assert.throws(() => verifyPage(whole, options), { code: 'RCL_SESSION_HISTORY_OPTIONS_INVALID' });
  let reads = 0;
  assert.throws(() => verifyPage(whole, { get expectedJournalRoot() { reads++; return head.journalRoot; } }), { code: 'RCL_SESSION_HISTORY_OPTIONS_INVALID' });
  assert.equal(reads, 0);
  assert.deepEqual(verifyPage(whole, { expectedPageRoot: undefined }), verifyPage(whole));
});

test('CLI acknowledges actual exported pages and chains without opening the locked session or changing files', async () => {
  const file = path.join(directory, 'page.json'), chain = path.join(directory, 'pages.json');
  fs.writeFileSync(file, JSON.stringify({ ok: true, ...whole })); fs.writeFileSync(chain, JSON.stringify(pages));
  const before = session.snapshot(), bytes = fs.readFileSync(path.join(directory, 'journal.jsonl'));
  const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [cli, 'session', 'history-verify', chain, '--expected-root', head.journalRoot], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), verifyPages(pages, { expectedJournalRoot: head.journalRoot }));
  assert.deepEqual(await runSessionCli(['history-verify', file, '--expected-page-root', whole.pageRoot]), verifyPage(whole, { expectedPageRoot: whole.pageRoot }));
  assert.deepEqual(session.snapshot(), before); assert.deepEqual(fs.readFileSync(path.join(directory, 'journal.jsonl')), bytes);
  for (const flags of [['--reference'], ['--expected-page-root', 'bad'], ['--limit', '1'], ['--expected-root'], ['--expected-root', head.journalRoot, '--expected-root', head.journalRoot]]) {
    assert.equal((await runSessionCli(['history-verify', file, ...flags])).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
  }
  const result = await session.invoke({ requestId: 'still-usable', expectedRevision: 4, rule: 'increment', inputs: { 'event.delta': 1, 'event.label': 'after-verification' } });
  assert.equal(result.result.status, 'realized'); assert.equal(session.snapshot().revision, 5);
});
