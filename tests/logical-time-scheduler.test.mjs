import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LogicalTimeScheduler,
  LogicalTimeSchedulerError,
  restoreLogicalTimeScheduler,
} from '../src/logical-time-scheduler.mjs';

function scheduledIds(result) {
  return result.events.filter((event) => event.type === 'scheduled-event-fired').map((event) => event.scheduleId);
}

function makeSameInstantScheduler(order) {
  const scheduler = new LogicalTimeScheduler({ replicaId: 'test-replica' });
  const plans = {
    ordinary: { id: 'ordinary', at: 5, priority: 2, kind: 'npc-think', payload: { npc: 'mara' } },
    urgent: { id: 'urgent', at: 5, priority: 0, kind: 'world-crisis', payload: { crisis: 'food-shortage' } },
    second: { id: 'second', at: 5, priority: 2, kind: 'npc-think', payload: { npc: 'ori' } },
  };
  for (const name of order) scheduler.scheduleAt(plans[name]);
  return scheduler;
}

test('same logical instant is repeatable and uses priority then stable id, not host timing or insertion order', () => {
  const first = makeSameInstantScheduler(['ordinary', 'urgent', 'second']);
  const second = makeSameInstantScheduler(['second', 'ordinary', 'urgent']);

  const firstRun = first.advanceTo(5);
  const secondRun = second.advanceTo(5);

  assert.deepEqual(scheduledIds(firstRun), ['urgent', 'ordinary', 'second']);
  assert.deepEqual(scheduledIds(secondRun), ['urgent', 'ordinary', 'second']);
  assert.equal(first.snapshot().root, second.snapshot().root);
});

test('stable ids use code-unit ordering instead of the host locale', () => {
  const scheduler = new LogicalTimeScheduler();
  scheduler.scheduleAt({ id: 'a', at: 1, kind: 'world-tick' });
  scheduler.scheduleAt({ id: 'Z', at: 1, kind: 'world-tick' });

  assert.deepEqual(scheduledIds(scheduler.advanceTo(1)), ['Z', 'a']);
});

test('external proposal snapshots also use code-unit ordering', () => {
  const scheduler = new LogicalTimeScheduler();
  scheduler.proposeExternalTime({ id: 'a', source: 'host-clock', observedAtMs: 1, proposedLogicalTime: 1 });
  scheduler.proposeExternalTime({ id: 'Z', source: 'host-clock', observedAtMs: 2, proposedLogicalTime: 1 });

  assert.deepEqual(scheduler.snapshot().externalProposals.map((proposal) => proposal.id), ['Z', 'a']);
});

test('relative scheduling and cancellation are explicit logical operations', () => {
  const scheduler = new LogicalTimeScheduler();
  scheduler.advanceTo(3);
  scheduler.scheduleAfter({ id: 'later', after: 4, kind: 'harvest', payload: { field: 'north' } });
  scheduler.scheduleAfter({ id: 'cancelled', after: 4, kind: 'harvest', payload: { field: 'south' } });
  scheduler.cancel('cancelled', { reason: 'field quarantined' });

  const result = scheduler.advanceTo(7);
  assert.deepEqual(scheduledIds(result), ['later']);
  assert.equal(scheduler.snapshot().eventLog.some((event) => event.type === 'schedule-cancelled' && event.scheduleId === 'cancelled'), true);
  assert.equal(scheduler.snapshot().queue.length, 0);
});

test('logical time is monotonic and a time scale changes projection speed, not event semantics', () => {
  const normal = new LogicalTimeScheduler({ timeScale: 1 });
  const accelerated = new LogicalTimeScheduler({ timeScale: 100 });
  for (const scheduler of [normal, accelerated]) {
    scheduler.scheduleAt({ id: 'a', at: 2, kind: 'world-tick' });
    scheduler.scheduleAt({ id: 'b', at: 3, kind: 'world-tick' });
  }

  assert.deepEqual(scheduledIds(normal.advanceTo(3)), scheduledIds(accelerated.advanceTo(3)));
  assert.equal(accelerated.projectWallDuration(500), 5);
  assert.throws(() => normal.advanceTo(2), (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_NON_MONOTONIC');
});

test('event budgets fail before any due event is committed', () => {
  const scheduler = new LogicalTimeScheduler();
  scheduler.scheduleAt({ id: 'one', at: 2, kind: 'world-tick' });
  scheduler.scheduleAt({ id: 'two', at: 2, kind: 'world-tick' });
  const before = scheduler.snapshot();

  assert.throws(
    () => scheduler.advanceTo(2, { maxEvents: 1 }),
    (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_MAX_EVENTS_EXCEEDED',
  );
  assert.equal(scheduler.snapshot().root, before.root);
});

test('non-canonical task data is rejected before it can contaminate a future replay', () => {
  const scheduler = new LogicalTimeScheduler();
  const before = scheduler.snapshot();

  assert.throws(
    () => scheduler.scheduleAt({ id: 'bad', at: 1, payload: { unsupported: 1n } }),
    (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_DATA_INVALID',
  );
  assert.equal(scheduler.snapshot().root, before.root);
});

test('snapshots restore into the same future and tampered rooted state is rejected', () => {
  const original = new LogicalTimeScheduler({ replicaId: 'world-a' });
  original.scheduleAt({ id: 'day-3', at: 3, kind: 'world-tick', payload: { day: 3 } });
  original.advanceTo(1);
  const snapshot = original.snapshot();
  const restored = restoreLogicalTimeScheduler(snapshot);

  const originalRun = original.advanceTo(3);
  const restoredRun = restored.advanceTo(3);
  assert.deepEqual(originalRun.events, restoredRun.events);
  assert.equal(original.snapshot().root, restored.snapshot().root);

  const tampered = structuredClone(snapshot);
  tampered.queue[0].payload.day = 99;
  assert.throws(
    () => restoreLogicalTimeScheduler(tampered),
    (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_SNAPSHOT_ROOT_MISMATCH',
  );
});

test('external time is only an observation until an authorized explicit logical commit', () => {
  const scheduler = new LogicalTimeScheduler();
  const proposal = scheduler.proposeExternalTime({
    id: 'wall-clock-observation',
    source: 'host-clock',
    observedAtMs: 1_700_000_000_000,
    proposedLogicalTime: 9,
  });

  assert.equal(scheduler.currentTime, 0);
  assert.equal(proposal.authoritative, false);
  assert.throws(
    () => scheduler.commitExternalTime(proposal.id, { subject: 'observer', capabilities: [] }),
    (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_AUTHORITY_DENIED',
  );

  const beforeInvalidAuthority = scheduler.snapshot().root;
  assert.throws(
    () => scheduler.commitExternalTime(proposal.id, { subject: { not: 'a subject id' }, capabilities: ['temporal.commit'] }),
    (error) => error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_TEXT_INVALID',
  );
  assert.equal(scheduler.snapshot().root, beforeInvalidAuthority);

  const receipt = scheduler.commitExternalTime(proposal.id, {
    subject: 'timekeeper',
    capabilities: ['temporal.commit'],
  });
  assert.equal(receipt.type, 'external-time-committed');
  assert.equal(scheduler.currentTime, 9);
  assert.equal(scheduler.snapshot().externalProposals[0].status, 'committed');
});
