# Native UI Self-Host Device-Adaptation Slice

## Verified scope

The canonical RCL-authored compiler still owns the minimal form:

```rcl
reality MinimalUI {
  ui App {
    view Root {
    }
  }
}
```

It now also owns the exact `examples/native-ui/counter.rcl` semantic slice, `examples/selfhost-core/native-ui-parameterized.rcl`, `examples/selfhost-core/native-ui-governed.rcl`, `examples/selfhost-core/native-ui-fixed.rcl`, `examples/native-ui/navigation.rcl`, and `examples/native-ui/device-adaptation.rcl`: mutable state, derived expressions, lifecycle/restore, theme declarations, role/class/node style rules, recursive view nodes, content/accessibility properties, bindings, normalized layout, UI-local state events, typed/custom parameters, standard signature inference, event-scope references, governed `realize` statements, rule-reference validation, fixed width/height intent, canonical in-app route transitions and non-overlapping width profiles with adaptive layout direction. All declared fixtures reach byte-identical JavaScript/bootstrap and self-hosted RBC artifacts.

The expanded C0 → C1 → C2 compiler fixed point remains byte-identical through native Windows `rclc`. The artifact is 265,286 bytes at SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`. Each generation executes 88,744,649 instructions, leaving 211,255,351 of the 300 million instruction budget. The two native generations completed in 228.989 seconds in the sealed adaptation evidence run on this machine, within the predeclared 240 second gate; an independent focused reproduction completed the compiler processes in 232.033 seconds. The per-process timeout is 150 seconds to tolerate host jitter, while the unchanged two-generation `<240 seconds` acceptance gate prevents that tolerance from hiding a performance regression. Self-host performance remains a measured local result rather than a production claim.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Mutation and fail-closed evidence

Four same-task mutations—derived text, layout gap, theme color and event increment—each change the rooted artifact while remaining byte-identical between the JS oracle and self-host compiler. This prevents an unchanged or hard-coded Counter root from satisfying the gate.

Explicit and standard-inferred UI-local parameters normalize to identical roots where their signatures are semantically identical. Wrong standard types, unknown standard parameters and duplicates fail closed in both compilers. Governed handlers carry `authority: "reality-transaction"`; a valid emergence-rule rename changes the UI root while remaining byte-identical between compilers. Unknown rules and handlers mixing UI-local work with `realize` fail closed in both compilers. Runtime dispatch without a Gateway fails closed, while a Gateway receives only `CandidateReality`; the UI/compiler owns no direct reality commit authority. Fixed `320` and `320.0` normalize to the same RBC. Navigation mutations to the initial route, route identity or target mapping change the UI root and stay byte-identical across compilers. Device profile/layout mutations also change the rooted artifact; duplicate, unknown or overlapping profiles, invalid bounds and unsupported layout modes fail closed. The same adaptation root lowers to real Chrome compact/vertical and expanded/horizontal behavior and Android `screenWidthDp` orientation logic, with equal host semantic traces. Resources, broader adaptation and full accessibility remain absent or partial. The verified label is `CANDIDATE_CANONICAL_DEVICE_ADAPTATION_SELFHOST_SLICE_VERIFIED`, not repository-wide Native UI parity or canonical promotion.

Evidence: `examples/native-ui/evidence/selfhost-device-adaptation-result.json`, `examples/native-ui/evidence/device-adaptation-browser-result.json`, `examples/native-ui/evidence/device-adaptation-android-build-result.json`, `tests/general-selfhost-fixedpoint.test.mjs` and `tests/native-ui-backends-equivalence.test.mjs`. Earlier navigation, fixed, governed, parameterized, Counter and minimal receipts remain predecessor-generation evidence.
