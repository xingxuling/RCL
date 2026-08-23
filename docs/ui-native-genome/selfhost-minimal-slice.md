# Native UI Self-Host Minimal Slice

## Verified scope

The canonical RCL-authored compiler now parses this bounded form:

```rcl
reality MinimalUI {
  ui App {
    view Root {
    }
  }
}
```

The same source reaches a byte-identical JavaScript/bootstrap and self-hosted RBC artifact. The C0 → C1 → C2 compiler fixed point also remains byte-identical through the native Windows `rclc` path under the existing 300 million instruction-per-run and 240 second total wall-clock gates.

## Semantic genome root

Native UI roots are computed from a versioned, position-independent semantic genome. Diagnostic source locations and derived caches such as resolved style/event indexes are excluded; state, expressions, node roles/properties/bindings/events, normalized layout, style rules, lifecycle and extension points remain bound. The enclosing reality program root stores each UI id and semantic root, so a source relocation is stable while a real UI mutation changes both roots.

## Fail-closed boundary

The self-host parser deliberately rejects the expanded Counter surface. State, derived expressions, nested nodes, events, layout, style, lifecycle and accessibility syntax remain implemented only by the reference candidate compiler. The verified label is `CANDIDATE_MINIMAL_UI_SELFHOST_SLICE_VERIFIED`, not full Native UI parity or promotion.

Evidence: `examples/native-ui/evidence/selfhost-minimal-result.json` and `tests/general-selfhost-fixedpoint.test.mjs`.
