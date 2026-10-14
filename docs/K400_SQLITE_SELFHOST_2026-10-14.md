# Complete compiler in SQLite transactions

The new public `createSqliteCompilerTarget` API runs the supplied complete RCL
compiler inside an actual SQLite scalar function. SQLite reads the compiler BLOB
and source row, invokes the native C ABI process and commits the returned artifact
and job atomically. Execution similarly invokes the actual native VM from SQL.
The API returns compiler BLOBs read back from SQLite after commit. RCL semantics
remain in the native RCL compiler/VM; SQLite supplies persistence and transactions.

This adds the separately frozen K159 profile. The original database target,
resident compiler, HTTP/cold handlers and native binaries retain their existing
bindings. The sibling API adapts the existing database scalar-function pattern and
reuses the resident compiler protocol/binary. The profile engine/admission headers
pin their actual HTTP donor paths and hashes. DWAC's local four-mode router selected
`DEEP_DEVELOPMENT`; the [receipt](evidence/sqlite-selfhost/dwac-mode.json) is advisory.
Laya abstained on prioritization and supplied no authorization.

The [contract](../examples/universal-stress/selfhost-sqlite/general-compiler-sqlite-contract.json)
freezes the complete compiler, ten sealed programs, performance budgets, SQLite
version/schema and transaction controls before three new independent proposal-only
contexts read their exact candidates. The [batch](../examples/universal-stress/selfhost-sqlite/independent-batch.json)
retains their unchanged completed responses. They received no canonical source,
oracle edits, hidden tests or acceptance conclusions; OS isolation is not claimed.

The [runtime receipt](../examples/universal-stress/selfhost-sqlite/general-compiler-sqlite-database-runtime.json)
and [index](../examples/universal-stress/selfhost-sqlite/general-compiler-sqlite-runtime.json)
verify twenty complete C0-to-C20 generations, ten sealed native programs and three
effective independent repairs. Each generation executes 101897504 native instructions
under the unchanged 300000000 budget and reproduces the exact 297957-byte compiler.
Compiler input/output BLOBs, sources, job rows, native replies and clean process exits
are bound to the actual SQL invocation and transaction. SQLite is version 3.51.3.

Malformed source and a corrupt compiler roll back without adding artifacts,
sources or jobs. A successfully compiled new artifact with an unexpected hash also
rolls back, proving a failure after native compilation cannot publish its artifact.
Execution with a wrong source root is likewise rejected without a job commit.
Closing and reopening the database preserves a complete generation's job and exact
artifact hashes. Subsequent full compilation and two native program runs succeed.

Compilation P95 is 5499.3468 ms and execution P95 is 269.9402 ms, below the
unchanged 50000/5000 ms limits. Measurements include the SQL transaction and native
process. This is a bounded local Windows/SQLite profile; remote databases, cloud
deployment, a security sandbox and whole-language maturity are not established.

Run `npm run test:selfhost-sqlite`. Its fourteen focused checks include actual native
generations, execution, persisted jobs, database reopen and rollback, plus twelve
rehashed evidence forgeries involving SQL invocation, native PID/exit, commit,
artifact storage, rollback, reopen and missing generations. A separately exported
tracked-source directory also tests the public API and revalidates captured admission.
The [verification receipt](evidence/sqlite-selfhost/verification.json) records these
separate scopes and the consolidated K400 result. Native sources/binaries are not
rebuilt or credited again. Version promotion remains frozen and Actions are not used.

```js
import fs from 'node:fs';
import {createSqliteCompilerTarget, compileReality} from './src/index.mjs';

fs.mkdirSync('output/sqlite-api', {recursive: true});
const target = await createSqliteCompilerTarget();
try {
  const seed = 'selfhost/variants/utf16-columns/compiler.rbc';
  target.compile(seed, 'selfhost/variants/utf16-columns/compiler.rcl',
    'output/sqlite-api/c1.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  fs.writeFileSync('output/sqlite-api/hello.rcl', source);
  const compiled = target.compile('output/sqlite-api/c1.rbc',
    'output/sqlite-api/hello.rcl', 'output/sqlite-api/hello.rbc');
  const run = target.execute('output/sqlite-api/hello.rbc',
    compileReality(source).programRoot);
  console.log(run.result.state.value); // 11
  target.reopen();
  console.log(target.inspectJob(compiled.transaction.id)); // persisted hashes/job
} finally {
  target.dispose(); // closes only this target's SQLite file and temporary scope
}
```
