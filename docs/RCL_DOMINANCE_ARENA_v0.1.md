# RCL Dominance Arena v0.1

## Purpose

Universal Stress measures whether RCL can enter many environments. It does not, by itself, show that RCL is better than the strongest existing tool for one environment. Dominance Arena adds a separate vertical comparison contract without weakening Universal Stress or changing its nine-gate meaning.

Every selected task now has three independent scorecard axes:

| Axis | Question | Source of authority |
| --- | --- | --- |
| Capability | Can RCL express, compile, lower, execute, verify and preserve the task? | Universal Stress gates except `AI_GENERATE` |
| Dominance | Does RCL beat the named reference on the same workload and raw metrics? | Comparable arena receipts |
| Authorability | Can a human or AI author and repair the RCL solution? | The independent `AI_GENERATE` contract |

`AI_GENERATE` remains important. It is no longer allowed to erase direct evidence that the language/compiler itself works.

## Non-compensatory comparison

An arena comparison declares the task input root, candidate, reference, metric definitions, direction, units and evidence roots. Each required metric is compared independently. A weighted average cannot hide a loss in correctness, resource use or change cost.

The current comparison status is:

```text
no comparable result -> UNVERIFIED
any required metric loss -> FAIL
all required metrics comparable, no loss, at least one strict win -> PASS
```

Ties are retained as `TIE`; an all-tie comparison is not promoted to dominance.

## First arena: compiler toolchain

The checked-in manifest is:

```text
examples/dominance-arena/compiler-toolchain.v0.1.json
```

It executes the production K01 self-host verification command as the RCL candidate and records optional `rustc` and Node version probes. The candidate receipt is real execution evidence. The probes are deliberately not treated as competing compiler results because they do not compile a semantically matched corpus.

K01's scorecard adapter explicitly excludes the historical `stage0` proxy boundary from compiler correctness. That stage remains visible in the self-host summary and still records that the core runtime has not been rewritten in RCL; it is not the K01 compiler-self-hosting proposition.

Run it with:

```bash
npm run evidence:dominance-arena
```

Generated JSON and Markdown are written under `output/dominance-arena/`, which is ignored build output. The report contains:

- command receipt, exit code, timeout/tool-not-found classification and output hashes;
- source revision receipt binding the run to the checked-out Git commit;
- evidence and artifact hashes;
- capability, dominance and authorability axes;
- reference probe results;
- explicit comparability and evidence boundaries.

## Second arena: executable compiler microbenchmark

The first matched reference track is defined at:

```text
examples/dominance-arena/compiler-microbench.v0.1.json
```

It binds all providers to the SHA-256 of the same workload file, then runs:

- RCL `compileRealityToBytecode` followed by the repository's native VM;
- `rustc` followed by the emitted reference executable.
- CPython followed by the same source-level program.

Every path must produce the declared numeric result. The evidence records average
compile/preparation time, average cold-process runtime and emitted artifact bytes.
For CPython, preparation is `py_compile`, not machine-code compilation. The last
metric is explicitly a footprint proxy: a smaller artifact is not a claim about
total process memory use.

Run it with:

```bash
npm run evidence:dominance-arena:microbench
```

The provider-evidence comparison is generated at runtime. A missing tool, provider
failure or different `inputRoot` yields `BLOCKED`, `FAIL` or `UNVERIFIED` as
appropriate; it cannot be converted into a pass by the manifest. On the current
Windows host, RCL beats the Rust reference on every required raw metric, but loses
the CPython comparison on artifact footprint (`2948 B` vs `1204 B`), so the
multi-reference arena correctly reports `Dominance: FAIL`. This is a microbenchmark
result only, not proof of whole-language, ecosystem, authoring, concurrency or
commercial-product superiority.

## Promotion requirements

The compiler arena cannot report `Dominance: PASS` until all of the following are present for at least one reference:

1. An identical source/task corpus and input root.
2. Independent RCL and reference implementations of the task.
3. Correctness and robustness receipts for both implementations.
4. Build, runtime, memory/resource and concurrency measurements with declared units.
5. Human and AI development/change-cost evidence, or an explicit `UNVERIFIED` label for those dimensions.
6. Repeated runs or a declared deterministic seed policy.
7. A reproducible report root and source revision binding.

Tool availability, a version string, a generated source file or a successful process exit cannot satisfy these requirements.

The microbenchmark is intentionally narrower than the promotion requirements:
robustness, concurrency, memory sampling, development cost and broader workload
families remain open evidence dimensions.

## Capability metabolism boundary

Dominance Arena does not promote a donor feature into the RCL genome. Capability Metabolism remains responsible for semantic absorption and native promotion. A donor advantage found by an arena is an input to that process, not evidence that the donor has already been digested.

## Verification

```bash
npm run test:dominance-arena
npm run test:dominance-arena:microbench
node --test --test-concurrency=1 tests/universal-stress-k01-selfhost-adapter.test.mjs
npm run evidence:dominance-arena:microbench
```
