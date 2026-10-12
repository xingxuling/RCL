# Native-core genome campaign, 2026-10-13

Goal: at least 200 verified K400 coordinates. Version advancement remains frozen. This campaign extends the existing portable Windows/WASI/Linux/Android x86_64 emulator execution path with additional program families. It does not claim that entire families or environments are solved.

Verified checkpoint: all six profiles passed every credited target and independent admission. They add 27 unique cells to the prior 44: **71 PASS / 329 UNTESTED**, verdict INCOMPLETE, maturity U3. Full matrix report root: `17a67fbb608ada16b289ade328f77db174407304c51a6131a419abb8b6258897`. The >=200 goal remains active.

## Source reuse and frozen contracts

ADAPT the existing compiler-runtime learning, agent, automation, logical-time, governance/reactive and mixed-paradigm RCL programs. REUSE the unchanged native C VM, RCL-authored compiler RBC and four actual target adapters. KEEP_SEPARATE all historical hosted-authority receipts.

The new sources and contracts are under `examples/universal-stress/genomes/`. Each profile pins its source, donor, definition module, compiler artifact and ten input/oracle cases before independent requests. The scripts under `scripts/k400-genomes/` contain the explicit independent oracle and mutation definitions. No source-specializing opcode, evaluator fallback or task-specific native VM patch is introduced.

| Profile | Bounded capability | Eligible coordinates |
|---|---|---|
| learning | perceptron training, numerical inference, advisory recommendation | K053/K013/K033/K093 |
| agent | finite deliberation, capability/budget/risk/approval checks, memory, observe-only and kill switch | K054/K014/K034/K094 |
| automation | dependency/retry/approval control, logical compensation and audit order | K056/K016/K036/K096 |
| logical-events | deterministic logical-time events, tie ordering and budget rejection | K051/K011/K031/K091 |
| governance-reactive | exact warrants, projected invariants, two transactions and state-triggered rule order | K057/K058/K017/K018/K037/K038/K097/K098 |
| mixed-paradigm | recursive computation with declarative authority, invariants and transactional/reactive composition | K060/K020/K040/K100 |

K098 already has an admitted Android UI/reactive profile. This additional native-core profile supplements its evidence and does not add another cell. The maximum increment from this entire campaign is therefore 27 distinct new coordinates.

## Independent repair

The human authorized three fresh proposal-only contexts. Each received one frozen mutated candidate per profile and its intended behavior, with permission to read only the named candidate files. Canonical programs, evaluator/case files, memory and network were not provided or requested. Hardened OS isolation is not claimed. The unchanged returned proposal objects are preserved in `independent-batch.json` and bound by each profile's `-proposals.json`.

An exact proposal must restore canonical source unchanged. The evaluator then compiles and runs the repaired source on every credited target. Effective mutations may produce wrong results, skip a required transition, violate a projected invariant or be rejected by the compiler for a missing warrant. A compiler rejection must specifically identify `RCL_WARRANT_MISSING`; a transport/startup failure cannot substitute for this semantic negative control.

## Target execution and admission

Each target requires twenty actual canonical compilation/execution rounds, ten pre-sealed input cases, three effective negative mutations and three repaired-source replays. Compilation uses the RCL-authored compiler; WASI compilation happens on the Windows host, while Linux and Android also compile on their actual targets. Every artifact must match the independent bootstrap compiler exactly. Native state-root-v2 is independently recomputed at the boundary.

Governed profiles additionally check the exact rule order, actor, requirements, witnesses, changed targets and empty external host calls. The verifier reconstructs every prior state backwards from the changes and checks the entire before/after root chain. Foresee and realize records must agree on their projected roots and authority.

The report stores identical observed states and transaction records once in a content-addressed value table; twenty measured round records still retain their actual source/artifact roots and timing. This reduces repetition without substituting test counts for K400 cells. Frozen local p95 ceilings remain 5000 ms for compilation and 2000 ms for execution. There is no competitive-performance or hard-real-time claim.

```text
node scripts/run-k400-genomes.mjs
node scripts/run-k400-genomes.mjs --verify
npm run evidence:k400
```

Only a successfully verified runtime receipt enters the consolidated matrix. Missing receipts remain unclaimed; malformed or drifted receipts fail admission. Overlapping complete profiles share one coordinate while retaining the original authority and scope. There is no new hosted CI authority, physical-device proof, external agent/tool effect, actual external compensation, arbitrary scientific/ML capability or operating-system security proof.

## HTTP execution organ

`createPortableHttpTarget` adds a real authenticated local HTTP worker that invokes the native RCL compiler and VM. It reuses the existing loopback server transport pattern and portable native execution path, without adding another RCL rule interpreter. Replies bind source/bytecode hashes, worker identity, program roots and semantic roots. Wrong authorization, malformed source, corrupt RBC and a mismatched expected program root are rejected.

At this 71-cell checkpoint, the HTTP organ has targeted execution and negative-control evidence. The subsequent [execution-context campaign](K400_EXECUTION_CONTEXTS_2026-10-13.md) completes all nine gates and adds 35 distinct coordinates, bringing the aggregate to 106. Public deployment, hardened network service and secure sandbox claims remain unverified.
