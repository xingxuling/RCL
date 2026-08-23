# Native UI Self-Host Parameterized Event Slice

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

It now also owns the exact `examples/native-ui/counter.rcl` semantic slice and `examples/selfhost-core/native-ui-parameterized.rcl`: mutable state, derived expressions, lifecycle/restore, theme declarations, role/class/node style rules, recursive view nodes, content/accessibility properties, bindings, normalized layout, UI-local state events, typed/custom parameters, standard signature inference and event-scope references. All declared fixtures reach byte-identical JavaScript/bootstrap and self-hosted RBC artifacts.

The expanded C0 → C1 → C2 compiler fixed point remains byte-identical through native Windows `rclc`. Each generation executes 108,605,671 instructions, leaving 191,394,329 of the 300 million instruction budget. The two native generations completed in about 145.1 seconds in the focused suite on this machine, within the 240 second gate but still a material performance residual.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Mutation and fail-closed evidence

Four same-task mutations—derived text, layout gap, theme color and event increment—each change the rooted artifact while remaining byte-identical between the JS oracle and self-host compiler. This prevents an unchanged or hard-coded Counter root from satisfying the gate.

Explicit and standard-inferred UI-local parameters normalize to identical roots where their signatures are semantically identical. Wrong standard types, unknown standard parameters and duplicates fail closed in both compilers. Reality-transaction UI events remain deliberately unsupported by the self-host slice even though the JS reference accepts them; fixed sizes, broader event forms, navigation, resources and device adaptation are likewise not promoted. The verified label is `CANDIDATE_PARAMETERIZED_UI_SELFHOST_SLICE_VERIFIED`, not repository-wide Native UI parity or canonical promotion.

Evidence: `examples/native-ui/evidence/selfhost-parameterized-result.json` and `tests/general-selfhost-fixedpoint.test.mjs`. The earlier Counter and minimal receipts remain as predecessor-generation evidence.
