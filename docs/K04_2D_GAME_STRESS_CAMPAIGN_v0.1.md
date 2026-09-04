# K04 — RCL 2D Game Stress Campaign v0.1

Cell: game-runtime::game  
Coverage mode: lowered-execution  
First-slice result: BLOCKED until the direct evidence runner and the hosted independent AI_GENERATE replay are both bound to the repository. The local generator receipt is candidate-only until that hosted authority exists.

## Goal

K04 asks whether RCL can own the state, authority and transaction semantics of a 2D game, then lower them into a concrete fixed-step game runtime with movement, jump, collision, collection, reset and scene projection.

This is not a static sprite demo:

~~~
RCL source
├─ game/player facets
├─ subject + warrant
└─ emergence transactions
        ↓
RCL 2D Game Compiler
        ↓
rcl.2d-game-runtime-manifest.v0.1
        ↓
deterministic fixed-step runtime
├─ velocity / gravity
├─ boundary / ground collision
├─ collectible collision
└─ frame scene projection
        ↓
standalone HTML Canvas artifact
~~~

RCL owns state, authority, preserve guards, witnesses and rule commits. The runtime organ owns the ordinary execution mechanics of a 2D world. The result is deliberately classified as lowered-execution, not native-semantic.

## Implemented vertical slice

The included K04StarRunner specimen provides:

- startGame, moveRight, jump, advanceFrame, collectStar, and resetGame RCL rules;
- player position, velocity, grounded state, score, frame and world status;
- fixed-step physics with gravity, ground collision and horizontal bounds;
- collectible overlap triggering an RCL-governed score transaction;
- preserve failure and authority failure controls;
- deterministic replay and frame evidence roots;
- a generated HTML Canvas projection.

## Reproduction

~~~
node scripts/build-k04-2d-game.mjs
node scripts/run-k04-direct-evidence.mjs
node scripts/run-k04-game-runtime-evidence.mjs
node scripts/run-k04-game-independent-ai-generation.mjs
node --test --test-concurrency=1 tests/game-2d-compiler.test.mjs tests/universal-stress-k04-game-adapter.test.mjs
~~~

The evidence runner writes examples/universal-stress/evidence/k04-game-direct-evidence-v0.1.json. It must be run against the checked-out repository before its report is treated as an execution receipt.

## Nine gates

The first slice is expected to produce:

~~~
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      PASS
CORRECT      PASS
ROBUST       PASS
PERFORMANCE  PASS
AI_GENERATE  UNVERIFIED
EVIDENCE     PASS

OVERALL      BLOCKED
~~~

AI_GENERATE is not satisfied by the fact that the implementation was AI-assisted. The frozen contract `examples/universal-stress/k04-game-ai-generation-contract.v0.1.json` requires three fresh Codex CLI sessions, exact canonical-byte restoration and a GitHub hosted replay. The checked-in local receipt is `CANDIDATE` only until `github-replay.json` is bound.

## What this does not claim

- not a complete game engine;
- not native Godot, Unity, Android or console semantics;
- not a browser-execution proof for the Canvas artifact;
- not a claim that all game genres are already expressible;
- not universal-language maturity from one game cell.
