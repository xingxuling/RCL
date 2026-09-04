# K326 Compiler Database Campaign v0.1

## Verdict

`PASS_GITHUB_LINUX_WINDOWS_NATIVE_DATABASE_AUTHORITY_BOUND`

This campaign does not claim that RCL is a SQL engine. It freezes one bounded `compiler-runtime::database` profile in which RCL source owns integer relation rows, primary-key uniqueness, foreign-key existence, selection, join, aggregation and atomic insert commit/rollback. Native `rclc` and `rclvm` are the execution boundary. JavaScript is an independent oracle and evidence organ only.

## Reality Audit and semantic ownership

- Existing RCL `Sequence`, recursion, comparison, Boolean and `choose` semantics are sufficient; no new Core primitive or opcode was added.
- SQL contributes the donor semantics `PRIMARY KEY`, `FOREIGN KEY`, `SELECT`, equi-join, aggregate and atomic rollback.
- Existing source-capability SQL frontends remain auxiliary ingestion organs and do not own this candidate's canonical semantics.
- No SQLite, PostgreSQL, MySQL, DuckDB, Python or opaque Provider participates in compilation or execution.
- `RCL_GAP_K326_DURABLE_CONCURRENT_RELATIONAL_RUNTIME` is split: the RCL-owned semantic protocol candidate now covers rooted snapshots, serializable optimistic conflicts, atomic write sets and Provider receipt/recovery admission; durable storage, isolation implementation, query planning and crash recovery remain Provider-owned and open.

No Silent RCL Bypass record: the task needed bounded relational execution; existing RCL primitives express it directly, so no execution-language workaround was required. SQL remains the named donor rather than a hidden owner.

## Frozen profile

The canonical source contains three customers and four initial orders. It verifies:

- primary-key uniqueness;
- selection of customers in region `10`;
- customer/order equi-join;
- approved-order sum and count aggregation;
- duplicate-primary-key rollback;
- missing-foreign-key rollback;
- negative-domain-value rollback;
- one valid atomic insert and the post-commit query result.

Expected bounded results are initial sum/count `160 / 2`, three rejected transactions preserving four rows, and one committed transaction producing five rows and sum/count `185 / 3`.

## Nine-gate evidence

| Gate | Local result | Evidence |
|---|---|---|
| EXPRESS | PASS_LOCAL | database semantics are explicit in canonical RCL source |
| COMPILE | PASS_LOCAL | bootstrap compiler and native `rclc` produce byte-identical RBC |
| LOWER | PASS_LOCAL | generic Sequence/control-flow bytecode only; no database-special opcode |
| EXECUTE | PASS_LOCAL | native `rclvm` completed 20/20 rounds |
| CORRECT | PASS_LOCAL | independent JavaScript relational oracle matches every frozen projection |
| ROBUST | PASS_LOCAL | four semantic mutations plus corrupt RBC fail closed |
| PERFORMANCE | PASS_LOCAL | P95 compile, execute and combined time remain inside the frozen contract budget |
| AI_GENERATE | PASS | three unique read-only ephemeral sessions restored exact canonical bytes; GitHub focused replay passed |
| EVIDENCE | PASS | rooted runtime/AI receipts and exact GitHub Linux/Windows authority are bound |

All nine non-compensatory gates are admitted for this frozen profile. GitHub run `33093366736` passed focused job `98591815601` and Windows job `98591815857` for source commit `f7c266c6360ef72162064e6605a11fe3de4d1069`; the authority root is `4eb155d0b6824d85c5191f2106c316a5a1d81c4e84b5c3e1c6ab6153617c208f`.

## Multi-civilization Integration Court

| Civilization | Effect on the artifact |
|---|---|
| Founder Twin | selected a reusable relational-transaction stress cell rather than a product-specific database wrapper |
| 柳清莲 Gate | kept all nine gates non-compensatory and denied local evidence promotion |
| 洞哥 Grounding | required direct native compiler/VM rounds and a separately implemented oracle |
| Product / UX | named scripts, stable contracts and readable bounded results make reproduction direct |
| Engineering / Code | reused RCL primitives and introduced no Core churn or model-specific opcode |
| Test | added positive, boundary, mutation, root-tamper and exact-repair replay checks |
| Security | denied unknown foreign keys, duplicate keys, negative values, corrupt artifacts and opaque providers |
| Release | requires exact source SHA plus focused Linux and real Windows GitHub job identity |
| Evidence Ledger | binds source, compiler, RBC, semantic-state, trial, runtime and future hosted authority roots |

## License and diff audit

No dependency, copied implementation, external dataset or database engine was added. The new semantic source and oracle fixtures are repository-authored. The intended diff is limited to the K326 source/contracts/evidence/tests/scripts, workflow/package wiring, K400 evidence builder and status documentation.

## Claim boundary

The frozen K326 profile and this follow-on candidate grant no SQL grammar, durable database engine, Provider persistence implementation, lock-based or multi-version isolation implementation, WAL, crash recovery, cost-based optimizer, external database service, distributed database, arbitrary schema/query, unrelated K400 cell or K400 completion claim.

## Follow-on RCL semantic candidate

`src/relational-transaction-protocol.mjs` and `tests/relational-transaction-protocol.test.mjs` close the reusable semantic slice of the remaining K326 gap without changing the frozen K326 nine-gate claim. The candidate defines schema/snapshot/query/transaction roots, read-set binding, serializable optimistic conflict rejection, atomic insert/replace/delete application, Provider durable-commit binding and Provider recovery admission. See `docs/RCL_RELATIONAL_TRANSACTION_PROTOCOL_v0.1.md` for the API and federation boundary.
