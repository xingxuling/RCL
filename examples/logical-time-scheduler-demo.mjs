import { LogicalTimeScheduler } from '../src/logical-time-scheduler.mjs';

const scheduler = new LogicalTimeScheduler({ replicaId: 'worldseed-demo', timeScale: 20 });

scheduler.scheduleAt({
  id: 'drought-warning',
  at: 3,
  priority: 0,
  kind: 'world-crisis',
  payload: { cause: 'reservoir-below-safe-level' },
  causalParents: ['world:reservoir'],
  source: 'gamebrain',
});
scheduler.scheduleAt({
  id: 'npc-mara-plan',
  at: 3,
  priority: 2,
  kind: 'npc-think',
  payload: { subject: 'mara', goal: 'protect-granary' },
  causalParents: ['drought-warning'],
  source: 'gamebrain',
});

const advance = scheduler.advanceTo(3);
const externalProposal = scheduler.proposeExternalTime({
  id: 'host-heartbeat-4',
  source: 'host-clock',
  observedAtMs: 1_700_000_000_000,
  proposedLogicalTime: 4,
});
const externalCommit = scheduler.commitExternalTime(externalProposal.id, {
  subject: 'world-authority',
  capabilities: ['temporal.commit'],
});

console.log(JSON.stringify({
  advance,
  externalCommit,
  snapshot: scheduler.snapshot(),
  projectedWallDurationFor100LogicalTicks: scheduler.projectWallDuration(100),
}, null, 2));
