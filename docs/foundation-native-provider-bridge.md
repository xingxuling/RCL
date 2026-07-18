# Foundation Native Provider Bridge Batch A

## Status

Batch A is a verified `bridge`, not native Foundation syntax. It executes RBC 1.2 in the C Native VM and calls a registered `RclVmProviderV1` implementation in `native/foundation_provider.c`.

Covered domains, in enforced causal order:

1. `quantitative`
2. `knowledge`
3. `perception`
4. `natural-language-reality`
5. `understanding-reality`
6. `creative-reality`

Declared Foundation-domain syntax remains outside the native bytecode subset and continues to fail with `RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED`.

## Runtime Path

```text
request
  -> src/foundation-native-bridge.mjs
  -> selfhost/compiler.rbc through native/rclc.exe
  -> RBC 1.2 with six dynamic provider_call instructions
  -> native/rclfoundation.exe
  -> RclVmProviderV1 "rcl.foundation.batch-a"
  -> six standard Foundation runtime results
  -> deterministic receipt and replay verification
```

Every result has `proposal`, `constraints`, `stateDelta`, `evidence`, `confidence`, `authorityRequired`, and `replayMetadata`. Each result's `beforeRoot` must equal the previous result's `afterRoot`.

## Run

```bash
npm run build:native
npm run demo:foundation-native-batch-a
npm run test:foundation-native-batch-a
npm run conformance:foundation
```

Programmatic use:

```js
import { runFoundationNativeBatchA } from '@taowind/rcl-reality-forge';

const result = runFoundationNativeBatchA({
  authorized: true,
  aifDecision: 'stable',
  input: {
    speechAct: 'create',
    utterance: 'Create one bounded reality candidate.',
  },
  evidence: [{ type: 'operator-intent', id: 'request-1' }],
});
```

## Failure Contract

- `RCL_NATIVE_PROVIDER_MISSING`: the native host did not register the provider.
- `RCL_FOUNDATION_AUTHORITY_DENIED`: `authorized` is not `true`.
- `RCL_FOUNDATION_AIF_REJECTED`: `aifDecision` is not `stable`.
- `RCL_FOUNDATION_EVIDENCE_REQUIRED`: evidence or causal parents are empty.
- `RCL_FOUNDATION_CAUSAL_ORDER`: capabilities were called out of order.
- `RCL_FOUNDATION_PARENT_INVALID`: a predecessor result has the wrong format, domain, or root.

## Migration

Consumers should import `runFoundationNativeBatchA` from the canonical RCL package instead of copying the Provider or synthesizing Foundation results locally. Treat returned results as proposals; authority requirements remain explicit and this bridge does not execute irreversible product actions.

The checked Windows distribution adds `native/rclfoundation.exe`. Linux and macOS builds produce `native/rclfoundation` through `native/Makefile` and require OpenSSL, matching the existing Native VM build contract.

## Performance Evidence

`benchmarks/foundation-native-batch-a-baseline.json` records deterministic bytecode, instruction, result, and working-set estimates. Tests reject resource growth above 20 percent. Wall-clock compile, runtime, and replay latency are reported separately under broad environment budgets because compiler cache and host load make exact timing non-deterministic.
