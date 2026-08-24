# Native UI Self-Host Canonical-Navigation Slice

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

It now also owns the exact `examples/native-ui/counter.rcl` semantic slice, `examples/selfhost-core/native-ui-parameterized.rcl`, `examples/selfhost-core/native-ui-governed.rcl`, `examples/selfhost-core/native-ui-fixed.rcl`, and `examples/native-ui/navigation.rcl`: mutable state, derived expressions, lifecycle/restore, theme declarations, role/class/node style rules, recursive view nodes, content/accessibility properties, bindings, normalized layout, UI-local state events, typed/custom parameters, standard signature inference, event-scope references, governed `realize` statements, rule-reference validation, fixed width/height intent and canonical in-app route transitions. All declared fixtures reach byte-identical JavaScript/bootstrap and self-hosted RBC artifacts.

The expanded C0 → C1 → C2 compiler fixed point remains byte-identical through native Windows `rclc`. The artifact is 249,866 bytes at SHA-256 `836fd9dd246915411a7ccc4f0b09be59591c1a63de90d6a01b1425098aef079b`. Each generation executes 82,329,281 instructions, leaving 217,670,719 of the 300 million instruction budget. The two native generations completed in 223.9 seconds in the navigation evidence run on this machine, within the 240 second gate. A bounded 127-token chunk accumulator restored ordinary-heap JavaScript bootstrap after two linear-token-buffer prototypes exhausted the approximately 4 GiB heap; the heap limit was not increased. Self-host performance remains a measured local result rather than a production claim.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Mutation and fail-closed evidence

Four same-task mutations—derived text, layout gap, theme color and event increment—each change the rooted artifact while remaining byte-identical between the JS oracle and self-host compiler. This prevents an unchanged or hard-coded Counter root from satisfying the gate.

Explicit and standard-inferred UI-local parameters normalize to identical roots where their signatures are semantically identical. Wrong standard types, unknown standard parameters and duplicates fail closed in both compilers. Governed handlers carry `authority: "reality-transaction"`; a valid emergence-rule rename changes the UI root while remaining byte-identical between compilers. Unknown rules and handlers mixing UI-local work with `realize` fail closed in both compilers. Runtime dispatch without a Gateway fails closed, while a Gateway receives only `CandidateReality`; the UI/compiler owns no direct reality commit authority. Fixed `320` and `320.0` normalize to the same RBC. Navigation mutations to the initial route, route identity or target mapping change the UI root and stay byte-identical across compilers. Missing navigation, duplicate/unknown routes or targets, multiple transitions and navigation mixed with Reality authority fail closed. The same navigation root lowers to Web hidden-route DOM and Android `View.VISIBLE`/`View.GONE`, with equal host semantic traces. Resources, device adaptation and full accessibility remain absent. The verified label is `CANDIDATE_CANONICAL_NAVIGATION_SELFHOST_SLICE_VERIFIED`, not repository-wide Native UI parity or canonical promotion.

Evidence: `examples/native-ui/evidence/selfhost-navigation-result.json`, `tests/general-selfhost-fixedpoint.test.mjs` and `tests/native-ui-backends-equivalence.test.mjs`. The earlier fixed, governed, parameterized, Counter and minimal receipts remain as predecessor-generation evidence.
