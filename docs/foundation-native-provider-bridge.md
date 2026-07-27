# Foundation Native Provider Bridge

## Status

Foundation Batch A, Meta Batch B, and Batch C are verified `bridge` integrations, not
native Foundation syntax. Both execute self-hosted RBC 1.2 in the C Native VM
and call registered `RclVmProviderV1` implementations in
`native/foundation_provider.c`.

Batch A provider `rcl.foundation.batch-a` covers, in enforced causal order:

1. `quantitative`
2. `knowledge`
3. `perception`
4. `natural-language-reality`
5. `understanding-reality`
6. `creative-reality`

Meta Batch B provider `rcl.foundation.meta-batch-b` covers:

1. `meta-spacetime`
2. `meta-acceleration`
3. `meta-compression`

Batch C provider `rcl.foundation.batch-c` covers, in enforced causal order:

1. `physical`
2. `embodiment`

Declared Foundation-domain syntax remains outside the native bytecode subset
and continues to fail with `RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED`.

## Runtime Path

```text
request
  -> Batch A, Meta Batch B, or Batch C JS adapter
  -> shared foundation-native-batch-runtime.mjs
  -> selfhost/compiler.rbc through native/rclc.exe
  -> RBC 1.2 with ordered dynamic provider_call instructions
  -> native/rclfoundation.exe
  -> selected RclVmProviderV1 provider
  -> standard Foundation runtime results
  -> semantic validation, deterministic receipt, replay verification
```

Every result has `proposal`, `constraints`, `stateDelta`, `evidence`,
`confidence`, `authorityRequired`, and `replayMetadata`. Each result's
`beforeRoot` must equal the preceding result's `afterRoot`.

Meta Batch B adds executable semantics:

- `meta-spacetime` advances a bounded causal timeline for create operations and
  leaves it unchanged for inspect operations.
- `meta-acceleration` applies a requested integer factor with a hard maximum of
  8 and an explicit fidelity floor.
- `meta-compression` packs a 64-byte hexadecimal content-root representation
  into 32 bytes and verifies an exact restoration before returning a result.
  Its scope is root representation, not arbitrary asset compression.

Batch C adds executable semantics:

- `physical` validates bounded tick, timestep, body-count, and contact-budget
  variables for a deterministic semi-implicit step.
- `embodiment` accepts only bounded body commands and binds its
  `physicalParentRoot` to the preceding physical causal root.

## Run

```bash
npm run build:native
npm run demo:foundation-native-batch-a
npm run demo:foundation-native-meta-batch-b
npm run test:foundation-native-batch-a
npm run test:foundation-native-meta-batch-b
npm run test:foundation-native-batch-c
npm run conformance:foundation
```

Programmatic use:

```js
import {
  runFoundationNativeBatchA,
  runFoundationNativeMetaBatchB,
} from '@taowind/rcl-reality-forge';

const foundation = runFoundationNativeBatchA({
  input: {
    speechAct: 'create',
    utterance: 'Create one bounded reality candidate.',
  },
});

const meta = runFoundationNativeMetaBatchB({
  causalParents: [foundation.finalStateRoot],
  input: {
    speechAct: 'create',
    timeline: {
      tick: 12,
      observerFrame: 'subjective-bounded',
      eventCount: 3,
    },
    acceleration: {
      requestedFactor: 4,
      fidelityFloor: 0.95,
    },
    compression: {
      codec: 'content-addressed',
      restoreRequired: true,
    },
  },
});
```

## Failure Contract

- `RCL_NATIVE_PROVIDER_MISSING`: the native host did not register the provider.
- `RCL_FOUNDATION_AUTHORITY_DENIED`: `authorized` is not `true`.
- `RCL_FOUNDATION_AIF_REJECTED`: `aifDecision` is not `stable`.
- `RCL_FOUNDATION_EVIDENCE_REQUIRED`: evidence or causal parents are empty.
- `RCL_FOUNDATION_CAUSAL_ORDER`: capabilities were called out of order.
- `RCL_FOUNDATION_PARENT_INVALID`: a predecessor result has the wrong format,
  domain, or root.
- `RCL_FOUNDATION_META_SPACETIME_INVALID`: timeline input is unbounded.
- `RCL_FOUNDATION_META_ACCELERATION_INVALID`: factor or fidelity is outside the
  accepted input range.
- `RCL_FOUNDATION_META_COMPRESSION_INVALID`: the reversible restore contract is
  absent.
- `RCL_FOUNDATION_RESULT_SEMANTICS`: a format-valid host result does not match
  the requested semantic transition.

## Migration

Consumers should import the canonical RCL runners instead of copying provider
code or synthesizing Foundation results locally. Treat returned results as
proposals: authority requirements remain explicit, and neither bridge executes
irreversible product actions by itself.

The checked Windows distribution includes `native/rclfoundation.exe`. Linux and
macOS builds produce `native/rclfoundation` through `native/Makefile` and
require OpenSSL, matching the existing Native VM build contract.

## Performance Evidence

The files under `benchmarks/foundation-native-*-baseline.json` record
deterministic bytecode, instruction, result, and working-set estimates. Tests
reject resource growth above 20 percent. Wall-clock compile, runtime, and
replay latency use broad environment budgets because compiler cache and host
load make exact timing non-deterministic.
