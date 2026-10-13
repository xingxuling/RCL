# RCL execution inside the RNCS candidate branch runtime

This continuation adds fifteen unique RNCS-runtime coordinates: **246 PASS /
0 BLOCKED / 154 UNTESTED**, `RESEARCH_PREVIEW`, U3, `INCOMPLETE`.
Matrix root: `3259fb047ec8d6c3b39be281a7f2c42b5b792dda646c48a070b2d226bfa8e7d6`.
The full 400-cell goal remains active; package identity `2.0.0` stays frozen.

## Reused canonical assets

The actual RNCS Reality Branch Fabric is reused from
[RNCS-Unified-Platform](https://github.com/xingxuling/RNCS-Unified-Platform-/tree/4cbbeae5fc5e4bad5c7b4fef6621bc3cfe6eb6f1/packages/control/reality-branch-fabric),
commit `4cbbeae5fc5e4bad5c7b4fef6621bc3cfe6eb6f1`, package
`@taowind/reality-branch-fabric@0.2.0-alpha.1`, Apache-2.0.
Its nine implementation modules, package manifest and license are copied
unchanged into `src/vendor/rncs-reality-branch`. Provenance pins both SHA256 and
Git blob identities; all eleven original Git blob hashes were verified.
The dirty local RNCS checkout was inspected as reference, then excluded from
the donor bytes. No change is made to RNCS's canonical repository.

Existing RCL self-hosted compilation, native VM and source-owned native session
admission are reused. The adapter adds a real RNCS branch lifecycle around that
provider, beyond the previously bundled static authority mirror.

## Execution and authority

The native RCL compiler produces bytecode, verified against independent bootstrap
bytes. An isolated native run forecasts its candidate state. RNCS then constructs
a branch and simulation, creates a sealed execution plan, and actually invokes
the RCL provider again inside `executePlan`. Provider results must match source,
artifact and complete forecasted semantic state before RNCS applies its operations.

The RCL source-declared conditional dispatch warrant owns local admission and
completion. RNCS binds those actual transitions to its authority request and
decision, verifies the completed execution receipt, and merges only the local
candidate. Success advances the candidate generation lineage. Missing approval,
stale generations and injected failure after provider execution fail closed;
RNCS records rollback and the candidate generation does not advance.

RNCS forbids floating point in its hashed envelopes. A typed transport preserves
finite f64 values as canonical binary64 hex, and tags Truth/Text/null/sequences
and objects. Materialization is checked against the full original RCL state,
history and projections. Values such as `1/3`, Unicode text and nested sequences
round-trip through an actual RNCS candidate merge without decimal rounding.

The receipt exposes the real branch, simulation, comparison, plan, provider
evidence, authority request/decision, merged state and generation roots. The
complete native admission transcript is independently replayed against RCL's
reference session, including denial and restart. These cells use
`lowered-execution` credit: program computation remains in the native RCL VM;
the RNCS host owns the candidate lifecycle.

This is an in-memory, local candidate runtime. It does not perform production
RFE storage writes or establish human signer identity, key custody, external
side effects, an operating-system sandbox or an arbitrary RNCS-world claim.

## Frozen acceptance

A preliminary contract inherited an incorrect GPU phrase during template reuse.
Those unpublished drafts were archived before runtime admission. Corrected
contracts were frozen again, with unchanged ten-case oracles and budgets, before
three entirely new proposal-only contexts generated the accepted repairs.
Only the final context responses appear in `independent-batch.json`; the earlier
draft-context responses receive no credit.

Twelve profiles each pass twenty actual RNCS baseline cycles, ten pre-sealed input
cases, three effective semantic mutants and three unchanged independent repairs.
One noncanonical repair additionally passes all ten pre-sealed inputs.
Each profile also checks missing approval, stale-base rejection, provider rollback,
source-owned dispatch denial and a new native admission process plus fresh RNCS
context. The entire original and restarted control transcript is retained.

Measured p95 compilation is 75.0–172.7 ms; complete forecast/provider/RNCS
execution is 173.9–216.9 ms. Frozen connected-runtime budgets remain 5000 ms
and 2000 ms. These measurements exclude initial admission-runtime construction
and do not establish a throughput advantage.

| Profile | New coordinates | Runtime report root |
| --- | --- | --- |
| learning | K393 | `f7db332dc3d2fad26a9b0cac9e852857c901051894e3f5ac463ec55589009f51` |
| agent | K394 | `9fe9b00e2d37e7285835d6bb95bb251246ed515b96b506e80a2aaf7b3670d8a4` |
| automation | K396 | `32fc1f2e5174df495a98cb3fa858f14251c779fda6188e2b62ac88515342b4c7` |
| logical-events | K391 | `9a73285381c4682094465b4da0ac913cb7f19877f5859c205d89c831949a94c7` |
| governance-reactive | K397, K398 | `bca0bf947a17589d288d242dabca43024d325016fa5b699c8c992d63e52ddd58` |
| mixed-paradigm | K400 | `a4cdd25e87b06c80a2e2cf5c250d7ffc25bb5e74d805a942e4e7ea70dad4bf58` |
| relations | K386 | `7af4e160f2619e7f66df743640bbc344c2c57972d842347ed07077204a0af4b1` |
| simulation-scientific | K389, K392 | `bf180ea6434f957bb89288290cbfdf083c028c58b235412bd827a2a1c864dd12` |
| algorithm-cli | K381, K382 | `2d770054a623d8d907ca6dea7ec6a42b9a3a6c9715552e16b0e4b994cdf53ec2` |
| media | K395 | `eb9a8ddd0d6f1bd9586651eff5c5c0dfb4258dfd4155bd94d478e6e119728aef` |
| compiler | K387 | `7c823565fc669c6dba8698afc9f00afdcd971afebaf879388f5d6266117c120a` |
| game | K388 | `4017caa4c2cc31e2360df0e2f1b74a22ef113701342b0400eeb380900378dc91` |

Closing the stable coordinate named K400 does not complete the 400-cell matrix.
All nine gates are complete only for the fifteen declared coordinates;
154 other cells remain UNTESTED. No new GitHub Actions run is requested.

Thirty-four focused admission, actual-runtime and matrix/maturity checks pass.
Tracked tree `725b82b88794fe9638b05cd560d9e31acec4c584` was exported to a fresh
directory: all historical and new source-bound admissions rebuild to the same
246-cell matrix root, and the same 34 checks pass with another actual RNCS
runtime control run. Only documentation and the whitespace interpretation of
already-preserved CRLF provenance bytes change afterward; bound code and receipt
bytes remain identical.

## Run

```text
node scripts/run-rncs-native.mjs examples/universal-stress/portable-profiles/simulation-scientific.rcl
node scripts/run-k400-rncs.mjs --verify
npm run evidence:k400
```

The public asynchronous API is `createPortableRncsTarget()` with `compile`,
`execute`, `verifyContextGuard`, `verifyReset` and `dispose`. It uses the checked-in
Windows native compiler/VM/session daemon and the frozen vendored RNCS modules;
no external RNCS installation or npm package installation is required.
