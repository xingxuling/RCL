#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database.rcl');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition) { checks[name] = { pass: Boolean(condition) }; }

function independentOracle() {
  const customers = [{ id: 1, region: 10 }, { id: 2, region: 20 }, { id: 3, region: 10 }];
  const orders = [
    { id: 100, customer: 1, amount: 70, approved: 1 },
    { id: 101, customer: 2, amount: 40, approved: 1 },
    { id: 102, customer: 1, amount: 30, approved: 0 },
    { id: 103, customer: 3, amount: 90, approved: 1 },
  ];
  const insert = (rows, row) => rows.some((item) => item.id === row.id)
    || !customers.some((item) => item.id === row.customer)
    || row.amount < 0
    ? { rows, committed: 0 }
    : { rows: [...rows, row], committed: 1 };
  const aggregate = (rows) => rows
    .filter((order) => order.approved === 1
      && customers.some((customer) => customer.id === order.customer && customer.region === 10))
    .reduce((sum, order) => sum + order.amount, 0);
  return {
    initialSum: aggregate(orders),
    duplicate: insert(orders, { id: 103, customer: 2, amount: 55, approved: 1 }),
    orphan: insert(orders, { id: 104, customer: 99, amount: 25, approved: 1 }),
    negative: insert(orders, { id: 104, customer: 3, amount: -25, approved: 1 }),
    valid: insert(orders, { id: 104, customer: 3, amount: 25, approved: 1 }),
  };
}

export function verifyK326CompilerDatabaseCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const oracle = independentOracle();
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-relational-transaction', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'database-semantics-expressed', /primary_keys_unique/u.test(source)
      && /customer_is_in_region/u.test(source)
      && /sum_approved_orders_for_region/u.test(source));
    check(checks, 'atomic-controls-expressed', /transaction\.duplicate/u.test(source)
      && /transaction\.orphan/u.test(source)
      && /transaction\.negative/u.test(source)
      && /transaction\.valid/u.test(source));
    check(checks, 'no-opaque-database-provider', !/provider_call\(|sqlite|postgres|mysql|duckdb|python|powershell|cmd\.exe/iu.test(source));
    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k326-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 90_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 90_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      observed = {
        customerCount: runtime.state?.['query.region_10_customer_count'],
        initialSum: runtime.state?.['query.region_10_initial_sum'],
        initialJoinCount: runtime.state?.['query.region_10_initial_join_count'],
        duplicate: runtime.state?.['transaction.duplicate'],
        orphan: runtime.state?.['transaction.orphan'],
        negative: runtime.state?.['transaction.negative'],
        valid: runtime.state?.['transaction.valid'],
        committedSum: runtime.state?.['query.region_10_committed_sum'],
        committedJoinCount: runtime.state?.['query.region_10_committed_join_count'],
      };
      check(checks, 'native-relational-query', runtime.state?.['evaluation.pass'] === true
        && observed.customerCount === 2
        && observed.initialSum === oracle.initialSum
        && observed.initialJoinCount === 2
        && observed.committedSum === 185
        && observed.committedJoinCount === 3);
      check(checks, 'native-atomic-rollback', observed.duplicate?.[1] === oracle.duplicate.committed
        && observed.orphan?.[1] === oracle.orphan.committed
        && observed.negative?.[1] === oracle.negative.committed
        && observed.duplicate?.[0]?.length === oracle.duplicate.rows.length
        && observed.orphan?.[0]?.length === oracle.orphan.rows.length
        && observed.negative?.[0]?.length === oracle.negative.rows.length);
      check(checks, 'native-valid-commit', observed.valid?.[1] === oracle.valid.committed
        && observed.valid?.[0]?.length === oracle.valid.rows.length);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 8
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k326.compiler-database-candidate-verification.v0.1',
    status: passed ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    artifactSha256,
    semanticStateRoot,
    observed,
    checks,
    errorCode,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK326CompilerDatabaseCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
