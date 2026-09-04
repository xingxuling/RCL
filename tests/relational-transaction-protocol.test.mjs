import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { realityRoot } from '../src/canonical.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import {
  RelationalTransactionProtocolError,
  admitRelationalRecovery,
  abortRelationalTransaction,
  beginRelationalTransaction,
  bindRelationalRead,
  commitRelationalTransaction,
  createRelationalProviderCommitReceipt,
  createRelationalProviderRecoveryReceipt,
  createRelationalRecoveryRequest,
  createRelationalSchema,
  createRelationalSnapshot,
  previewRelationalTransaction,
  readRelationalQuery,
  stageRelationalWrite,
  verifyRelationalProviderCommitReceipt,
  verifyRelationalSnapshot,
} from '../src/relational-transaction-protocol.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'rcl-relational-transaction-protocol-candidate-v0.1.json');

function makeSchema() {
  return createRelationalSchema({
    schemaId: 'rcl.relational.protocol.test',
    relations: [
      {
        name: 'customers',
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'region', type: 'integer' },
          { name: 'name', type: 'text' },
        ],
        primaryKey: ['id'],
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'customerId', type: 'integer' },
          { name: 'amount', type: 'integer' },
          { name: 'approved', type: 'boolean' },
        ],
        primaryKey: ['id'],
        foreignKeys: [{ columns: ['customerId'], targetRelation: 'customers', targetColumns: ['id'] }],
      },
    ],
  });
}

function makeSnapshot(schema, revision = 0, extraOrders = []) {
  return createRelationalSnapshot(schema, {
    revision,
    relations: {
      customers: [
        { id: 1, region: 10, name: 'Ada' },
        { id: 2, region: 20, name: 'Lin' },
        { id: 3, region: 10, name: 'Mina' },
      ],
      orders: [
        { id: 100, customerId: 1, amount: 70, approved: true },
        { id: 101, customerId: 2, amount: 40, approved: true },
        { id: 102, customerId: 1, amount: 30, approved: false },
        { id: 103, customerId: 3, amount: 90, approved: true },
        ...extraOrders,
      ],
    },
  });
}

test('relational schema and snapshot roots are deterministic and constraint checked', () => {
  const schema = makeSchema();
  const reordered = createRelationalSchema({
    schemaId: 'rcl.relational.protocol.test',
    relations: [...schema.relations].reverse(),
  });
  assert.equal(reordered.schemaRoot, schema.schemaRoot);
  const snapshot = makeSnapshot(schema);
  assert.equal(verifyRelationalSnapshot(schema, snapshot).status, 'VERIFIED');
  assert.throws(() => createRelationalSnapshot(schema, {
    relations: {
      customers: [{ id: 1, region: 10, name: 'Ada' }, { id: 1, region: 20, name: 'Lin' }],
      orders: [],
    },
  }), (error) => error instanceof RelationalTransactionProtocolError && error.code === 'RCL_RELATIONAL_PRIMARY_KEY_DUPLICATE');
  assert.throws(() => createRelationalSnapshot(schema, {
    relations: {
      customers: [{ id: 1, region: 10, name: 'Ada' }],
      orders: [{ id: 100, customerId: 99, amount: 10, approved: true }],
    },
  }), (error) => error.code === 'RCL_RELATIONAL_FOREIGN_KEY_MISSING');
});

test('relational query protocol expresses selection, inner join, deterministic projection and aggregation', () => {
  const schema = makeSchema();
  const snapshot = makeSnapshot(schema);
  const result = readRelationalQuery(schema, snapshot, {
    relation: 'orders',
    join: { relation: 'customers', leftColumn: 'customerId', rightColumn: 'id' },
    where: [
      { from: 'base', column: 'approved', op: 'eq', value: true },
      { from: 'join', column: 'region', op: 'eq', value: 10 },
    ],
    select: [
      { from: 'base', column: 'id', as: 'order_id' },
      { from: 'join', column: 'name', as: 'customer_name' },
    ],
    orderBy: [{ from: 'base', column: 'id', direction: 'desc' }],
  });
  assert.deepEqual(result.rows, [
    { order_id: 103, customer_name: 'Mina' },
    { order_id: 100, customer_name: 'Ada' },
  ]);
  const aggregate = readRelationalQuery(schema, snapshot, {
    relation: 'orders',
    join: { relation: 'customers', leftColumn: 'customerId', rightColumn: 'id' },
    where: [{ from: 'join', column: 'region', op: 'eq', value: 10 }],
    aggregates: [
      { fn: 'count', column: '*', as: 'order_count' },
      { fn: 'sum', column: 'amount', as: 'amount_sum' },
    ],
  });
  assert.deepEqual(aggregate.rows, [{ order_count: 3, amount_sum: 190 }]);
  const same = readRelationalQuery(schema, snapshot, {
    relation: 'orders',
    join: { relation: 'customers', leftColumn: 'customerId', rightColumn: 'id' },
    where: [{ from: 'join', column: 'region', op: 'eq', value: 10 }],
    aggregates: [
      { fn: 'count', column: '*', as: 'order_count' },
      { fn: 'sum', column: 'amount', as: 'amount_sum' },
    ],
  });
  assert.equal(same.queryRoot, aggregate.queryRoot);
});

test('transaction protocol binds read sets and commits an atomic multi-write snapshot', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  const query = readRelationalQuery(schema, initial, { relation: 'customers', where: [{ column: 'region', op: 'eq', value: 10 }] });
  let transaction = beginRelationalTransaction(schema, initial, { transactionId: 'tx-atomic' });
  transaction = bindRelationalRead(schema, transaction, query);
  transaction = stageRelationalWrite(schema, transaction, { relation: 'orders', operation: 'insert', row: { id: 104, customerId: 3, amount: 25, approved: true } });
  transaction = stageRelationalWrite(schema, transaction, { relation: 'orders', operation: 'insert', row: { id: 105, customerId: 1, amount: 15, approved: true } });
  const preview = previewRelationalTransaction(schema, transaction, initial);
  assert.equal(preview.revision, 1);
  const committed = commitRelationalTransaction(schema, transaction, initial);
  assert.equal(committed.snapshot.snapshotRoot, preview.snapshotRoot);
  assert.equal(committed.receipt.status, 'COMMITTED');
  assert.equal(committed.receipt.writeCount, 2);
  assert.deepEqual(committed.receipt.readSetRoots, [query.queryRoot]);
  assert.equal(committed.receipt.durability.durableCommitProven, false);
  assert.equal(initial.revision, 0);
  assert.equal(committed.snapshot.relations.orders.length, 6);
});

test('invalid atomic write sets fail closed without mutating the base snapshot', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  let duplicate = beginRelationalTransaction(schema, initial, { transactionId: 'tx-duplicate' });
  duplicate = stageRelationalWrite(schema, duplicate, { relation: 'orders', operation: 'insert', row: { id: 103, customerId: 2, amount: 1, approved: true } });
  assert.throws(() => commitRelationalTransaction(schema, duplicate, initial), (error) => error.code === 'RCL_RELATIONAL_PRIMARY_KEY_DUPLICATE');
  assert.equal(initial.relations.orders.length, 4);

  let orphan = beginRelationalTransaction(schema, initial, { transactionId: 'tx-orphan' });
  orphan = stageRelationalWrite(schema, orphan, { relation: 'orders', operation: 'insert', row: { id: 104, customerId: 999, amount: 1, approved: true } });
  assert.throws(() => commitRelationalTransaction(schema, orphan, initial), (error) => error.code === 'RCL_RELATIONAL_FOREIGN_KEY_MISSING');
  assert.equal(initial.relations.orders.length, 4);

  const aborted = abortRelationalTransaction(beginRelationalTransaction(schema, initial, { transactionId: 'tx-abort' }), 'caller_cancelled');
  assert.equal(aborted.status, 'ABORTED');
  assert.throws(() => stageRelationalWrite(schema, aborted, { relation: 'orders', operation: 'insert', row: { id: 104, customerId: 3, amount: 1, approved: true } }), (error) => error.code === 'RCL_RELATIONAL_TRANSACTION_NOT_OPEN');
});

test('serializable optimistic transactions reject stale concurrent commits', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  let first = beginRelationalTransaction(schema, initial, { transactionId: 'tx-first' });
  first = stageRelationalWrite(schema, first, { relation: 'orders', operation: 'insert', row: { id: 104, customerId: 3, amount: 25, approved: true } });
  let second = beginRelationalTransaction(schema, initial, { transactionId: 'tx-second' });
  second = stageRelationalWrite(schema, second, { relation: 'orders', operation: 'insert', row: { id: 105, customerId: 1, amount: 15, approved: true } });
  const firstCommit = commitRelationalTransaction(schema, first, initial);
  assert.throws(() => commitRelationalTransaction(schema, second, firstCommit.snapshot), (error) => error.code === 'RCL_RELATIONAL_CONCURRENCY_CONFLICT');
  assert.equal(firstCommit.snapshot.relations.orders.some((row) => row.id === 105), false);
});

test('replace and delete participate in the same atomic constraint check', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  let transaction = beginRelationalTransaction(schema, initial, { transactionId: 'tx-replace-delete' });
  transaction = stageRelationalWrite(schema, transaction, {
    relation: 'orders',
    operation: 'replace',
    row: { id: 102, customerId: 1, amount: 35, approved: true },
  });
  transaction = stageRelationalWrite(schema, transaction, {
    relation: 'orders',
    operation: 'delete',
    key: { id: 101 },
  });
  const committed = commitRelationalTransaction(schema, transaction, initial);
  assert.equal(committed.snapshot.relations.orders.length, 3);
  assert.equal(committed.snapshot.relations.orders.find((row) => row.id === 102).amount, 35);
  assert.equal(committed.snapshot.relations.orders.some((row) => row.id === 101), false);

  let invalid = beginRelationalTransaction(schema, initial, { transactionId: 'tx-delete-parent' });
  invalid = stageRelationalWrite(schema, invalid, { relation: 'customers', operation: 'delete', key: { id: 1 } });
  assert.throws(() => commitRelationalTransaction(schema, invalid, initial), (error) => error.code === 'RCL_RELATIONAL_FOREIGN_KEY_MISSING');
  assert.equal(initial.relations.customers.length, 3);
});

test('provider-durable commit requires a bound Provider receipt and never grants Provider authority', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  let transaction = beginRelationalTransaction(schema, initial, { transactionId: 'tx-durable', durabilityIntent: 'provider-durable', providerId: 'sqlite-provider' });
  transaction = stageRelationalWrite(schema, transaction, { relation: 'orders', operation: 'insert', row: { id: 104, customerId: 3, amount: 25, approved: true } });
  assert.throws(() => commitRelationalTransaction(schema, transaction, initial), (error) => error.code === 'RCL_RELATIONAL_DURABILITY_RECEIPT_REQUIRED');
  const preview = previewRelationalTransaction(schema, transaction, initial);
  const providerReceipt = createRelationalProviderCommitReceipt({
    providerId: 'sqlite-provider',
    transactionId: transaction.transactionId,
    transactionRoot: transaction.transactionRoot,
    baseSnapshotRoot: initial.snapshotRoot,
    committedSnapshotRoot: preview.snapshotRoot,
    durableCommitPerformed: true,
  });
  assert.equal(verifyRelationalProviderCommitReceipt(providerReceipt, { committedSnapshotRoot: preview.snapshotRoot }).durableCommitProven, true);
  const committed = commitRelationalTransaction(schema, transaction, initial, { providerReceipt });
  assert.equal(committed.receipt.durability.providerReceiptRoot, providerReceipt.receiptRoot);
  assert.equal(committed.receipt.durability.durableCommitProven, true);
  assert.equal(committed.receipt.canonicalPromotionPerformed, false);

  const tampered = { ...providerReceipt, canonicalPromotionPerformed: true };
  tampered.receiptRoot = realityRoot({ ...tampered, receiptRoot: undefined });
  assert.throws(() => verifyRelationalProviderCommitReceipt(tampered), (error) => error.code === 'RCL_RELATIONAL_PROVIDER_RECEIPT_AUTHORITY_INVALID');
});

test('recovery remains a Provider operation but RCL admits only a rooted, durable replay receipt', () => {
  const schema = makeSchema();
  const initial = makeSnapshot(schema);
  const request = createRelationalRecoveryRequest({
    requestId: 'recovery-1',
    providerId: 'sqlite-provider',
    schemaRoot: schema.schemaRoot,
    targetSnapshotRoot: initial.snapshotRoot,
  });
  const providerReceipt = createRelationalProviderRecoveryReceipt({
    providerId: 'sqlite-provider',
    requestRoot: request.requestRoot,
    schemaRoot: schema.schemaRoot,
    targetSnapshotRoot: initial.snapshotRoot,
    recoveredSnapshotRoot: initial.snapshotRoot,
    providerRecoveryPerformed: true,
    durableRecoveryPerformed: true,
  });
  const admission = admitRelationalRecovery(schema, request, initial, providerReceipt);
  assert.equal(admission.status, 'ADMITTED_PROVIDER_RECOVERY');
  assert.equal(admission.providerRecoveryProven, true);
  assert.equal(admission.rclRecoveryPerformed, false);
  const incomplete = createRelationalProviderRecoveryReceipt({
    providerId: 'sqlite-provider',
    requestRoot: request.requestRoot,
    schemaRoot: schema.schemaRoot,
    targetSnapshotRoot: initial.snapshotRoot,
    recoveredSnapshotRoot: initial.snapshotRoot,
    providerRecoveryPerformed: true,
  });
  assert.throws(() => admitRelationalRecovery(schema, request, initial, incomplete), (error) => error.code === 'RCL_RELATIONAL_RECOVERY_PROVIDER_INVALID');
});

test('candidate evidence is explicitly local, rooted and non-promotional', () => {
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  assert.equal(evidence.status, 'CANDIDATE_LOCAL');
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, reportRoot: undefined }));
  assert.equal(evidence.tests.failed, 0);
  assert.equal(evidence.authority.githubHosted, false);
  assert.equal(evidence.authority.canonicalPromotionPerformed, false);
  assert.equal(evidence.authority.rclEvidenceCommitPerformed, false);
  assert.equal(evidence.authority.providerDurabilityPerformed, false);
});
