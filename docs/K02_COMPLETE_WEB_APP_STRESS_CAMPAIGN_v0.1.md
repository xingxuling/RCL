# K02 — Complete Web Application Stress Campaign v0.1

**Cell:** `browser::web`  
**Current result:** `PASS (9/9)` for the bounded vertical slice
**Coverage mode:** `lowered-execution`

## Goal

K02 asks whether an RCL-authored application can own application state, authority and transactional behavior, lower a structured Web representation into a real browser artifact, and preserve RCL invariants during user interaction.

It is deliberately stronger than "RCL can generate HTML text" and weaker than "RCL already implements an entire standards-complete browser engine".

## v0.1 vertical slice

```text
RCL source
├─ facets: application state
├─ subject/warrant: authority
└─ emergence: user-visible transactions
        ↓
RCL Web Application Compiler
        ↓
rcl.web-runtime-manifest.v0.1
├─ initial state
├─ lowered rules
├─ authority requirements
├─ structured HTML tree
├─ structured CSS rules
└─ routes
        ↓
standalone HTML/CSS/browser runtime
        ↓
real Chromium interaction
```

The Web companion manifest is an experimental morphology layer. Therefore the current result is `lowered-execution`, not `native-semantic`. A future RCL Web grammar should absorb the stable HTML/DOM/CSS genes directly.

## Direct evidence — 2026-08-08

Environment: Chromium 144.0.7559.96, driven by Playwright in the available execution container.

Measured positive path:

- build completed in 51.69 ms;
- standalone artifact size: 9,961 bytes;
- browser content load: 17.20 ms;
- input + submit interaction: 90.74 ms;
- `app.todo_count`: 0 → 1;
- `app.last_action`: `boot` → `first`;
- controlled input cleared after commit;
- DOM projection updated to count `1`;
- reset transaction returned count to `0` and last action to `reset`;
- generated Node HTTP/API server completed GET state → POST observe → POST rule → GET state with 200/200/200/200 and the same RCL state transition.

Negative controls:

- removing the `user` subject/warrant is rejected by the existing RCL compiler before Web lowering (`RCL_COMPILE_ERROR`);
- a deliberately contradictory preserve clause throws `RCL_WEB_PRESERVE_FAILED:addTodo` in real Chromium and leaves authoritative application state unchanged.

Evidence root:

```text
87d7d4e48322579c867b58f8469562a2f89a49c44676a1b137119ee75a02e45d
```

Evidence file:

```text
examples/universal-stress/k02-direct-evidence-2026-08-08.json
```

## Nine gates

```text
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      PASS
CORRECT      PASS
ROBUST       PASS
PERFORMANCE  PASS
AI_GENERATE  PASS
EVIDENCE     PASS

OVERALL      PASS (9/9)
```

`AI_GENERATE` is admitted only through the frozen `k02-ai-generation-contract.v0.1` contract. Three separate ephemeral read-only Codex CLI sessions received mutated candidates and failure diagnostics without the canonical files or oracle edits. They repaired reactive state transition, authority binding and reactive view binding; all three saved candidates restored canonical bytes and passed rooted RCL compilation, Web lowering, structural HTML checks and real loopback Node API execution. GitHub run `32865270251`, focused job `97858888422`, replayed those saved candidates for exact source commit `41a5850178161cb26b80129251cd803598aeceda`; authority root is `bd266a10f6c5083c9b09875de5ea390693257a61a0f891f08eda702e928698cf`.

The receipt also covers the exact K063 GUI and K078 reactive surfaces exercised by every trial. It does not prove arbitrary Web generation, standards completeness, native RCL Web morphology, Android execution or compiler self-evolution.

## Standards boundary

The architecture follows the Web platform's actual separation of concerns: HTML parsing produces a DOM tree; DOM defines tree/event behavior; CSS cascade resolves declared values; Fetch defines request/response fetching. K02 v0.1 only implements the narrow subset needed by the vertical slice. It does not claim WHATWG/W3C conformance.

## What K02 has eaten so far

- HTML gene: structured semantic tree → RCL Web document IR;
- DOM gene: element state binding + input/submit/click event projection;
- CSS gene: structured selector/declaration rules → browser CSS;
- browser gene: history route declarations and a browser-hosted event/runtime boundary;
- server gene: generated HTTP state/observe/rule API from the same manifest;
- RCL identity genes remain authoritative: state, subject/warrant, preserve and witness.

## What remains before "full Web" can be claimed

1. native RCL Web grammar rather than a companion JSON morphology manifest;
2. general DOM mutation/query APIs;
3. event capture/target/bubble semantics and cancellation;
4. URL + navigation + session history conformance subset;
5. Fetch/Request/Response/CORS semantics;
6. forms, validation and multipart/urlencoded submission;
7. persistent storage contracts;
8. async task/microtask/event-loop model;
9. modules/workers/WebSocket/streaming;
10. accessibility tree and browser security model;
11. differential tests against Web Platform Tests where applicable;
12. general intent-to-Web generation beyond the bounded repair contract.

## Browser target above K02

The next ceiling is not "more Web framework support". It is:

```text
RCL Web semantics
→ DOM/CSS/Fetch/URL/Event Loop
→ layout/paint/compositing
→ JS/WASM compatibility organ
→ network/storage/security
→ browser shell
```

A browser is therefore treated as a later stress tier built on K02, not as a separate unrelated project.
