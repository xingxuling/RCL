# Native UI Self-Host Governed Event Slice

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

It now also owns the exact `examples/native-ui/counter.rcl` semantic slice, `examples/selfhost-core/native-ui-parameterized.rcl`, and `examples/selfhost-core/native-ui-governed.rcl`: mutable state, derived expressions, lifecycle/restore, theme declarations, role/class/node style rules, recursive view nodes, content/accessibility properties, bindings, normalized layout, UI-local state events, typed/custom parameters, standard signature inference, event-scope references, governed `realize` statements and rule-reference validation. All declared fixtures reach byte-identical JavaScript/bootstrap and self-hosted RBC artifacts.

The expanded C0 → C1 → C2 compiler fixed point remains byte-identical through native Windows `rclc`. Each generation executes 112,233,068 instructions, leaving 187,766,932 of the 300 million instruction budget. The two native generations completed in about 145.8 seconds in the focused suite on this machine, within the 240 second gate but still a material performance residual.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Mutation and fail-closed evidence

Four same-task mutations—derived text, layout gap, theme color and event increment—each change the rooted artifact while remaining byte-identical between the JS oracle and self-host compiler. This prevents an unchanged or hard-coded Counter root from satisfying the gate.

Explicit and standard-inferred UI-local parameters normalize to identical roots where their signatures are semantically identical. Wrong standard types, unknown standard parameters and duplicates fail closed in both compilers. Governed handlers carry `authority: "reality-transaction"`; a valid emergence-rule rename changes the UI root while remaining byte-identical between compilers. Unknown rules and handlers mixing `set` with `realize` fail closed in both compilers. Runtime dispatch without a Gateway fails closed, while a Gateway receives only `CandidateReality`; the UI/compiler owns no direct reality commit authority. Fixed sizes, broader event forms, navigation, resources and device adaptation are likewise not promoted. The verified label is `CANDIDATE_GOVERNED_UI_SELFHOST_SLICE_VERIFIED`, not repository-wide Native UI parity or canonical promotion.

Evidence: `examples/native-ui/evidence/selfhost-governed-result.json` and `tests/general-selfhost-fixedpoint.test.mjs`. The earlier parameterized, Counter and minimal receipts remain as predecessor-generation evidence.
