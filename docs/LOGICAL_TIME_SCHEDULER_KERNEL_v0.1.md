# RCL Logical-Time Scheduler Kernel v0.1

**Status:** `CANDIDATE / local focused test evidence`  
**Layer:** Temporal control primitive  
**Purpose:** provide deterministic logical instants, same-instant ordering, replayable snapshots, event budgets, acceleration projection and explicitly-authorized external-time commits.

## Why this comes before K04

K04 (2D game) must not be satisfied by a static scene or a random event feed. A living world, a candidate reality branch, a replay debugger and an accelerated civilization simulation all need one answer to:

```text
What happened first, at what logical instant, under which causal input,
and can the exact next state be replayed?
```

This module supplies that shared control-plane seam. It is deliberately independent of rendering, physics and game-engine APIs.

## Public API

```js
const scheduler = new LogicalTimeScheduler({ replicaId: 'world-a', timeScale: 20 });

scheduler.scheduleAt({ id: 'drought', at: 12, priority: 0, kind: 'world-crisis' });
scheduler.scheduleAfter({ id: 'npc-plan', after: 2, kind: 'npc-think' });
scheduler.cancel('npc-plan', { reason: 'subject unavailable' });

const receipt = scheduler.advanceTo(12);
const snapshot = scheduler.snapshot();
const replay = restoreLogicalTimeScheduler(snapshot);
```

Equal-time schedules use this total order:

```text
logical instant → priority (lower first) → stable schedule id (Unicode code-unit order)
```

Insertion order, host locale and wall-clock timing therefore cannot decide a same-instant outcome.

## Included guarantees

- logical time cannot move backward;
- a declared `maxEvents` budget fails before any due event is committed;
- scheduled data must be canonical JSON-like data, preventing non-replayable task payloads;
- snapshots carry a content root and reject accidental/tampered changes against that root, plus re-rooted state that the public scheduler API could not produce (for example duplicate pending effects, non-canonical task data or impossible receipt sequences);
- external wall-clock observations are non-authoritative proposals;
- committing external time requires an explicit `temporal.commit` capability;
- time acceleration changes only finite wall-time projection, not logical event order;
- all persisted identifier order uses a fixed Unicode code-unit comparison, rather than a host-locale collation rule.

## Evidence boundary

This is a deterministic in-process scheduler, not yet a distributed consensus protocol, persistent WAL, or physical-clock synchronization service. A snapshot root is an integrity handle; authority/signature binding belongs to the RCL Evidence / Reality Store layers.

It does not itself prove K04, a game runtime, an open-world simulation, or real-time performance. K04 remains `BLOCKED` until a game target executes and passes the nine Universal Program Stress gates with rooted evidence.

## Focused acceptance

```bash
node --test --test-concurrency=1 tests/logical-time-scheduler.test.mjs
node examples/logical-time-scheduler-demo.mjs
```

The focused suite verifies deterministic same-instant order (including locale-sensitive IDs), relative scheduling/cancellation, monotonicity, finite projection, acceleration invariance, event-budget atomicity, canonical-data rejection, rooted snapshot restore (including re-rooted invariant violations) and explicit external-time authority.
