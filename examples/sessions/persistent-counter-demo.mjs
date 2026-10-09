import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDurableRealitySession, verifyDurableRealitySession } from '../../src/durable-session.mjs';

const directory = path.resolve(process.argv[2] ?? `output/session-counter-${randomUUID()}`);
const source = fs.readFileSync(new URL('./governed-counter.rcl', import.meta.url), 'utf8');
let session = await openDurableRealitySession(directory, { source, verifyReference: true });
const first = { requestId: 'increment-one', expectedRevision: 0, rule: 'increment', inputs: { 'event.delta': 3, 'event.label': 'persistent first event' } };
try {
  const committed = await session.invoke(first);
  const projected = await session.invoke({ requestId: 'preview', expectedRevision: 1, rule: 'increment', mode: 'foresee', inputs: { 'event.delta': 10 } });
  const beforeRestart = session.snapshot();
  await session.close();
  session = await openDurableRealitySession(directory, { verifyReference: true, expectedJournalRoot: beforeRestart.journalRoot });
  const retry = await session.invoke(first);
  await session.invoke({ requestId: 'revoke', expectedRevision: 2, rule: 'revoke' });
  let denied;
  try { await session.invoke({ requestId: 'denied', expectedRevision: 3, rule: 'increment', inputs: { 'event.delta': 1 } }); }
  catch (error) { denied = error.code; }
  const afterRestart = session.snapshot();
  await session.close();
  const verified = await verifyDurableRealitySession(directory, { verifyReference: true });
  console.log(JSON.stringify({
    directory, committedValue: committed.result.state['counter.value'],
    projectedStateUnchanged: projected.result.beforeRoot === projected.result.afterRoot,
    recoveredSameState: retry.result.afterRoot === committed.result.afterRoot,
    distinctProcessAfterRestart: beforeRestart.native.processId !== afterRestart.native.processId,
    retryReplayed: retry.replayed, authorityDenied: denied, finalRevision: afterRestart.revision,
    finalValue: afterRestart.state['counter.value'], verified,
  }, null, 2));
} finally { await session.close(); }
