# Native UI Self-Host Counter Slice

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

It now also owns the exact `examples/native-ui/counter.rcl` semantic slice: mutable state, derived expressions, lifecycle/restore, theme declarations, role/class/node style rules, recursive view nodes, content/accessibility properties, bindings, normalized layout and UI-local state events. Both sources reach byte-identical JavaScript/bootstrap and self-hosted RBC artifacts.

The expanded C0 → C1 → C2 compiler fixed point remains byte-identical through native Windows `rclc`. Each generation executes 103,063,637 instructions, leaving 196,936,363 of the 300 million instruction budget. The two native generations completed in 156.9–160.4 seconds in the recorded runs, within the 240 second gate but materially slower than the smaller predecessor.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Mutation and fail-closed evidence

Four same-task mutations—derived text, layout gap, theme color and event increment—each change the rooted artifact while remaining byte-identical between the JS oracle and self-host compiler. This prevents an unchanged or hard-coded Counter root from satisfying the gate.

Typed UI event parameters remain deliberately unsupported by the self-host slice and fail closed even though the JS reference accepts them. Fixed sizes, reality-transaction UI events, broader event forms, navigation, resources and device adaptation are likewise not promoted by this receipt. The verified label is `CANDIDATE_COUNTER_UI_SELFHOST_SLICE_VERIFIED`, not repository-wide Native UI parity or canonical promotion.

Evidence: `examples/native-ui/evidence/selfhost-counter-result.json` and `tests/general-selfhost-fixedpoint.test.mjs`. The earlier `selfhost-minimal-result.json` remains as the predecessor-generation receipt.
