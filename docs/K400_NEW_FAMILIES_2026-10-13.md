# RCL expression, media and game kernels

Verified result: **202 PASS / 198 UNTESTED**, U3, INCOMPLETE. This campaign adds **36 distinct cells** after the 166-cell phase checkpoint, meeting the >=200 development milestone. Consolidated report root: `8327206e8514f1f8d34ca70abc558253ed52145c0099131569a68bc5b01a88fe`.

This campaign adds three RCL-owned program implementations using existing native language primitives. It changes no VM opcode, native task-specific handler or package version. Authoritative coverage is rebuilt from their admitted receipts into `examples/universal-stress/k400-current-evidence.json`; the current count is shown in `CURRENT-STATUS.md`.

## Program behavior and scope

| Family | Implemented behavior | Independent oracle | Frozen scope |
| --- | --- | --- | --- |
| compiler | Recursive-descent token parsing with parentheses and precedence, postfix stack-code emission, execution and complete-input validation | Shunting-yard lowering followed by independent stack evaluation | Number/add/subtract/multiply grammar; two parameterized expression fixtures and trailing-token rejection. No lexer, complete RCL compiler or whole-language self-hosting claim. |
| media | RGB gain/offset, inclusive clamp, optional inversion, horizontal row flip and exact run-length encode/decode | Array transforms, row slicing and independent run construction/expansion | Procedural 2x2 RGB sample sequences, including empty input. No arbitrary image/video/audio format or provider-generated media claim. |
| game | Fixed-step horizontal movement and wall bounds, grounded jump, gravity/landing, one-time pickup, ground enemy collision, terminal stop and governed trajectory commit | Independent imperative step simulation | Bounded platform-game kernel with a full trajectory. No renderer, input device, full game engine or arbitrary game generation claim. |

Sources are `examples/universal-stress/new-families/{compiler,media,game}.rcl`. The compiler fixture evaluates `(2 + 3) * 4 - 5` to 15; the game fixture records its trajectory and stops at the enemy after nine frames with one collected star. The media result exposes transformed/flipped samples and the exact decoded run stream.

Asset archaeology reused the repository's sequence-processing patterns and K04 governed game/star logic. K04's JavaScript Canvas profile remains separate from this new native physics kernel. The existing media scenario metadata remains separate from procedural sample computation and proves no provider rendering.

## Actual target adapters

| Environments | Execution mechanism and required control |
| --- | --- |
| windows, wasm-vm | Existing native C VM or the same VM compiled to wasm32-WASI; root mismatch rejected |
| linux, android | Native compiler and VM on WSL2 Linux or the connected x86_64 Android emulator; target identity and transferred artifact hashes checked |
| server | Authenticated loopback HTTP compilation/execution; unauthorized access rejected |
| embedded-runtime | Caller-owned native daemon C ABI instance; repeated canonical runs reuse the instance, explicit reset is checked |
| distributed-runtime | Two actual local HTTP workers with checked bytecode and result/history quorum; terminated peer replaced and replayed |
| serverless | A fresh local handler process per compile/run; process exit and endpoint termination observed |
| database | Native execution inside SQLite's `rcl_execute` SQL function; real commit, reopen recovery and rejected-result rollback |
| dataflow-runtime | Actual worker-thread source/execution/receipt stages; artifact binding and backpressure rejection |
| simulation-runtime, automation-runtime | Source-bound native RCL clock or admission/completion sessions; complete controller ledger independently replayed, including denial controls |

These are twelve explicit execution contexts. Local hosts do not establish public deployment, cloud FaaS, multiple physical hosts, microcontroller execution, external streams, physical mobile devices or hardened OS isolation.

## Evidence contract

Every program's contract fixes twenty rounds per target, ten independent input oracles, three effective semantic mutations, the C2 compiler hash and all eligible coordinates before independent generation. Three fresh proposal-only contexts see only the named mutated candidates and intended behavior. Original responses are preserved unchanged in `independent-batch.json`; every target applies and replays those returned edits. No canonical program, oracle edit or hidden test is supplied to the generators. This is requested tool isolation, with `osIsolationClaimed: false`.

Each target checks byte-exact parity against the retained bootstrap compiler, actual native/WASM execution, independently reconstructed typed semantic roots, expected state and complete source-declared transaction evidence. Game commits check their actor, authority, witnesses, changes and foresee/realize root continuity. Both phase contexts additionally replay every controller call using the reference session. Generic transport errors cannot qualify as detected semantic mutations.

The p95 acceptance ceilings remain 5,000 ms for compilation and 2,000 ms for execution, fixed before generation. They are bounded workload ceilings, not competitive performance or hard real-time claims. Every report binds the implementation, adapters, evaluator, compiler, native artifacts and original proposal batch. Shared coordinates, if present, supplement their existing profile without another cell credit.

## Reproduction

Cached receipt admission and full actual acquisition are separate commands:

```text
node scripts/run-k400-new-families.mjs --verify
node scripts/run-k400-new-families.mjs
node --test tests/k400-new-family-admission.test.mjs
npm run evidence:k400
```

Full acquisition requires Windows, the configured `RCL-K400-Alpine` WSL2 distribution and the connected x86_64 Android emulator. It executes all twelve contexts and does not fall back to another environment. Frozen source/case/definition files must not be edited or regenerated during acquisition.

After installation, the existing public runner also executes each new source directly:

```text
rcl portable-run windows examples/universal-stress/new-families/compiler.rcl
rcl portable-run wasm-vm examples/universal-stress/new-families/media.rcl
rcl portable-run linux examples/universal-stress/new-families/game.rcl
```

Focused admission checks reject omitted targets, false artifact identities, missing process/SQL/dataflow controls, controller-ledger tampering, rehashed wrong oracle answers, incorrect game actors, discarded proposals and generic errors. A complete K400 language claim still requires all 400 unique cells and all nine gates; package promotion additionally requires explicit release review.

Runtime receipt roots:

- media: `2ddaebc0ef6bd76fa3ab3bce626674cdb8dcc54e079872a10994932a727ede07`
- compiler: `da801ac81bc32453b73da8c5ce2c230ab17c955881af9e5ce0730219ba277d7b`
- game: `1d20f2cd8d2d7356ca4c82f0eff3536eef9da7157892309421da8fec758bc1c2`

All three actual acquisitions pass: 720 canonical baseline rounds, 360 sealed-input runs, 108 effective mutation observations and 108 unchanged repaired-source runs across 36 program/environment combinations, plus the context controls. Fifteen new admission tests pass. Full repository regression and new hosted CI were not run.

A fresh directory exported from staged tracked tree `933058a071bd179ea0fcc1e5faf5a70a01c9ae62` admits the historical, phase and new-family receipts and reconstructs the identical 202-cell report root. All 44 focused admission, maturity, matrix and actual native-controller checks pass there. This replay rechecks recorded acquisitions and runs the controller controls; it does not claim a second full twenty-round acquisition. Byte-bound Linux/WASI build manifests retain their captured line endings through explicit Git attributes.
