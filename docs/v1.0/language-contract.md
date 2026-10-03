# RCL 1.0 language and toolchain contract

Version 1.0 stabilizes the governed core language, its public compiler/runtime
entrypoints, semantic state root v2 and the installable source toolchain. Existing
research extensions remain available under their own component contracts. Local
release verification, canonical-main promotion and remote deployment are recorded
separately in VERSION-CONTRACT.json and the release evidence ledger.

## Stable governed core

A reality contains typed facets, subjects and warrants. An emergence declares a
cause, a when guard, needs, proposed alter operations, preserve invariants and
witness labels. The compiler rejects invalid syntax, types and unresolved names.
During execution a false guard produces an unchanged-state record. A triggered
rule checks the active warrants for its needs, computes changes from the prior
state and validates preserves before committing RCL state. Foresee computes a
projection; realize commits the admitted transition. Witness text is a declared
label, not proof that an external event occurred.

The admitted native value profile includes Null, Truth, finite binary64 Number,
Unicode-scalar Text, Sequence and supported typed Record/Union/Ref layouts.
Number is binary64, not an arbitrary-precision integer. Negative zero is semantic
zero for root v2. Native Text rejects embedded NUL and unpaired surrogates before
execution because its current runtime uses NUL-terminated strings. Record layout
marker names are reserved in typed declarations. See the root protocol for the
precise normalization and rejection rules.

Core functions and expressions are checked by the compiler and exercised through
the native-core RBC path. An extension being accepted by the reference compiler
does not establish that the whole-language RCL-authored compiler or native VM can
lower it. Unsupported native operations return an error rather than receiving
credit through a substituted reference execution.

## Public API and CLI

Node.js 20 or later is required. The package is ESM and exports through its root:

```js
import {
  compileReality, tryCompileReality, runReality, runRealityNative,
  verifyNativeParity, RCL_SEMANTIC_STATE_ROOT_V2,
} from '@taowind/rcl-reality-forge';

const program = compileReality(source);
const reference = await runReality(program, {
  stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2,
});
const native = runRealityNative(program, {
  stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2,
  requireNativeStateRoot: true,
});
```

Existing exports remain present. compileReality throws structured RCL errors;
tryCompileReality returns diagnostics. Native execution errors expose a code,
message and details; callers must check failure instead of treating missing
native evidence as success. requireNativeStateRoot enforces independent JS
verification of the emitted final state and negotiated algorithm.

The installed rcl and source Reality Hub wrapper expose --version, version
--json, doctor, check and help. Other commands delegate to the existing complete
CLI, including run, native, bytecode and native-run. Check compiles without
executing the program. Doctor checks toolchain availability and its declared
boundaries. The CLI run command and native API default to root v2. The direct
runReality API preserves rcl.reference-state-root.v0.6 for compatibility; this
legacy reference algorithm differs from native v1. Select v2 explicitly when
comparing reference/native states. rcl-forge and rcl-mcp retain their entrypoints.

The local MCP server exposes bounded repository read, compile and verification
operations over real JSON-RPC processes. Its own protocol/server version is
independent of the package version. Installing the package does not update a
remote MCP service or confer external execution authority.

## Component and evidence boundaries

| Surface | Version 1.0 contract |
| --- | --- |
| Native VM and state roots | Rebuild from the bound C source; root v2 default; explicit historical v1 replay |
| RCL-authored compiler | Native-core fixed point and eligible example byte parity; whole-language/runtime self-hosting remains unclaimed |
| Foundation domains | Preserve implementation-bound direct-lowering and provider-bridge registries; deployment evidence remains separate |
| Web, Native UI and Android | Preserve existing compilers, adapters and local equivalence checks; fresh browser/device delivery needs its own evidence |
| Forge, tensor, ML and agent extensions | Preserve APIs, fixtures and negative controls under their declared profiles; no blanket production or hardware promotion |
| K400 research matrix | Retain pinned 24 PASS / 376 UNTESTED history; v1.0 release tests do not close untested cells |
| External effects | Host adapters, durable writes and deployment require their own authority; the core language is not an OS security sandbox |

Component identities in COMPONENT-VERSIONS.json, RBC/typed ABI formats and each
extension's version remain independent. Root algorithms must accompany stored
roots. Consumers retain historical receipts and negotiate an algorithm before
execution; they must not relabel old digests as v2. DOWNSTREAM-CONSUMERS.json
requires source provenance, rebuilt native artifacts and independent tests before
claiming synchronization. This local release does not synchronize other repos.

## Release compatibility policy

Stable core/API or root semantics change only with explicit contract and version
updates. New research APIs may carry their own candidate component versions.
A release includes runnable examples, source assets, native build support and
verification scripts. Package installation and the public commands must work
outside the source checkout. Packaged source truth is verified against exact
bytes; a local build receipt does not establish hosted availability.

Use [the root protocol](semantic-state-root-v2.md) for migration details and
[acceptance](acceptance.md) for required release evidence. Historical evidence
files remain pinned to their original source and algorithm.
