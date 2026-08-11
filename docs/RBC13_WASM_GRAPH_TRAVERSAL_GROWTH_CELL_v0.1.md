# RBC 1.3 WASM Graph Traversal Growth Cell v0.1

- Status: **VERIFIED**
- Cell: `wasm-vm::algorithm::graph-traversal`
- Evidence root: `97a58a4091d8ebf8103cac95daeea42225d8cb437dc26af0088a031d17f93ee9`
- Native C body: **VERIFIED**; WASM body: **VERIFIED**; JS reference: **VERIFIED**
- Evidence tier: **native-candidate**; canonical permission: **false**

## Fixed workload

bounded breadth-first traversal with deterministic neighbor order, visited discovery order, visited set, step budget, and termination class. Cases: positive-chain, cycle, disconnected, empty, budget-exhaustion, invalid-node, malformed-graph.

| Case | Class | JS status | Root parity | Result/error parity | JS semantic root |
|---|---|---|---|---|---|
| positive-chain | positive | ok | true | true | e92d63b3638b35ca0ab8e7f943db805c9bf0e8cd76170ce0a1faabd2fe92c2d0 |
| cycle | cycle | ok | true | true | a35b6672827e6a9ce4a0b3202eab6bec4c34c34ec50b869f31463711e2dea464 |
| disconnected | disconnected | ok | true | true | d86dbcc131164bf257b8647598c0eb07090bbe81f6879e08c1522e2eaf3c1d36 |
| empty | empty | error | true | true | 1662aba1282f155ab2039c552542b7c804a4243a91cbad171c9781f86dba2162 |
| budget-exhaustion | budget-exhaustion | ok | true | true | 1388effeeb4789b737b178851a37516cd3e0733a607a8dcf4d9d5a816297b90f |
| invalid-node | invalid-node | error | true | true | b13604b45fc88269801f06f6c3bc85f01c74bc821d7bd08a3a49439d78d11118 |
| malformed-graph | malformed | error | true | true | f9150995f9dfb18649e6ca7e1c0b534d721619c00c77e66ed092d3bbb6fe24b7 |

## Cross-body and replay gates

- Positive: **true**; cycle: **true**; disconnected: **true**; empty: **true**; budget exhaustion: **true**; invalid node: **true**; malformed graph: **true**
- Replay: **VERIFIED**; cross-body replay-root parity: **true**
- Universal Stress cell: **VERIFIED**, coverage mode `experimental-cross-body-semantic`

## WASM value and host ABI

- Tags: Null=0, Truth=1, Number=2, Text=3, Sequence=4, Record=5, TypedRecord=6
- Memory: 65536 bytes, input=1024, output=4096
- Bounds: max nodes=32; recursion=8; nonfinite, malformed, duplicate fields, unsupported types, and invalid pointers fail closed.
- Negative controls: unsupported-type=true, malformed-length=true, nonfinite-number=true, duplicate-field=true, invalid-pointer=true

## Strategic ruling

Organ identity is the logical contract plus semantic/evidence identity; C, WASM, or Rust bodies are replaceable only after the same ABI, semantic root, error, receipt, and replay gates pass.

C and WASM bodies are replaceable implementations of one logical Organ contract. This VERIFIED result is an experimental cross-body parity witness, not canonical permission, universal capability, or proof that organ identity is tied to C.

Blocker: **none**

Reproduction: `npm run verify:rbc13-wasm-graph-growth-cell`
