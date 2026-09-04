# RCL Relational Transaction Protocol v0.1

**Status:** `CANDIDATE_LOCAL`  
**Purpose:** close the RCL-owned semantic part of the K326 durable/concurrent relational-runtime gap without claiming to implement a database engine.

## What RCL now owns

The candidate gives RCL a reusable, rooted contract for:

- schema identity, relation identity, declared columns and primary/foreign-key constraints;
- immutable relation snapshots with monotonic revisions and content roots;
- declarative selection, inner join, projection, ordering and scalar aggregation;
- transaction base-snapshot binding and read-set roots;
- serializable optimistic conflict detection;
- atomic insert, replace and delete write sets;
- provider-durable commit intent and exact Provider receipt binding;
- recovery request and Provider replay receipt admission.

The semantic API is in `src/relational-transaction-protocol.mjs` and is exported by the package entrypoint. The transaction protocol is candidate-only: its commit receipt says that RCL applied the semantic write set, while the Provider receipt says whether a Provider performed durable I/O.

## Example

```js
const schema = createRelationalSchema({
  schemaId: 'todo.v1',
  relations: [{
    name: 'todos',
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'title', type: 'text' },
      { name: 'done', type: 'boolean' },
    ],
    primaryKey: ['id'],
  }],
});

const base = createRelationalSnapshot(schema, {
  relations: { todos: [{ id: 1, title: 'audit', done: false }] },
});

let tx = beginRelationalTransaction(schema, base, {
  transactionId: 'todo-write-1',
  durabilityIntent: 'provider-durable',
  providerId: 'sqlite-provider',
});
tx = stageRelationalWrite(schema, tx, {
  relation: 'todos',
  operation: 'insert',
  row: { id: 2, title: 'ship', done: false },
});

const expected = previewRelationalTransaction(schema, tx, base);
const providerReceipt = createRelationalProviderCommitReceipt({
  providerId: 'sqlite-provider',
  transactionId: tx.transactionId,
  transactionRoot: tx.transactionRoot,
  idempotencyKey: tx.idempotencyKey,
  baseSnapshotRoot: base.snapshotRoot,
  committedSnapshotRoot: expected.snapshotRoot,
  durableCommitPerformed: true,
});
const committed = commitRelationalTransaction(schema, tx, base, { providerReceipt });
```

Two transactions that begin at the same snapshot cannot both commit: once the first changes the revision/root, the second receives `RCL_RELATIONAL_CONCURRENCY_CONFLICT`. An invalid write set is rejected before a new snapshot is returned.

## Federation boundary

| Semantic / capability | Owner | Evidence level |
|---|---|---|
| relation/schema/constraint/query/transaction laws | RCL | executable local candidate |
| snapshot root and optimistic conflict law | RCL | executable local candidate |
| durable commit or recovery performed on disk | Provider | receipt required; not performed by RCL |
| WAL, fsync policy, locks, isolation implementation and crash recovery | Provider | external runtime gap |
| replication, distributed consensus and query planning | Provider / RNCS | external runtime gap |
| SQL grammar or source frontend | auxiliary language / frontend | not a semantic owner |

`durableCommitProven` and `providerRecoveryProven` are therefore evidence fields, not authority grants. Provider receipts are root-bound and must not claim canonical promotion, RCL evidence commit, world-fact promotion or RNCS reality commit.

## Verification

```text
npm run test:rcl-relational-protocol
```

The focused suite covers deterministic roots, constraint rejection, selection/join/aggregate projection, read-set binding, atomic multi-write commit, invalid-write rollback, stale concurrent commit rejection, required durable receipts, authority non-escalation and rooted recovery admission.

This candidate does not change the existing K326 K400 claim. K326 remains admitted only for the previously verified bounded in-memory integer profile. The broader durable/concurrent database engine remains unverified until a real Provider supplies its own runtime, crash and persistence evidence.
