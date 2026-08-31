# Native UI / Web RCL Gap Register

No workaround below may be silently counted as canonical RCL capability.

| Gap | Task | Missing capability | Workaround / donor | Gap type | Generality | Candidate absorption | K400 cells |
|---|---|---|---|---|---|---|---|
| `RCL_GAP_UI_001` | K02 Web morphology | Historical: native RCL document/style/route morphology was absent when this row was opened | Current Native UI grammar + rooted canonical UI IR + Web lowering | Semantic / Compiler | cross-Web | **Current main has absorbed the semantic slice:** RCL parser owns Native UI syntax; canonical style/navigation/device-adaptation lower to Web from one semantic root. Do not add a second Web-only Canonical grammar. Browser standards breadth remains UI002. | K064 |
| `RCL_GAP_UI_002` | Browser completeness | DOM/CSS/URL/Fetch/event-loop/accessibility breadth | Browser execution organ | Domain / Runtime | browser-specific | keep standards engines auxiliary; absorb only portable semantics | K063, K064, K078 |
| `RCL_GAP_UI_003` | Android runtime proof | Historical: installed APK interaction/correctness/timing receipt | API 35 emulator/device evidence already recorded by the K03 campaign | Evidence / Device | mobile | **Bounded K083/K085/K098 slice closed by recorded emulator evidence;** broader real-device/OS/vendor coverage remains external evidence, not a new RCL semantic gap | K083, K085, K098 |
| `RCL_GAP_UI_004` | General Native UI resources/accessibility | resource identity, localization and complete accessibility tree | Existing Native UI role/content/accessibility semantics + platform frameworks | Semantic | cross-platform UI | **Candidate semantic slice added in PR #114:** rooted resource bundle/resolution/binding plus deterministic canonical accessibility tree and accessible-name fail closure. Platform resource/accessibility implementation remains Provider work. | GUI cells |
| `RCL_GAP_UI_005` | Independent AI generation without embedded model credentials | Ephemeral Codex CLI sessions with frozen offline candidates | Auxiliary evidence generator | Tooling / Evidence | cross-campaign | remain auxiliary; never receives semantic or promotion authority; this is not a reason to embed hosted model credentials into RCL Core | K063, K064, K078 |

## Current disposition (2026-09-01 candidate audit)

### UI001 — `SEMANTIC_SLICE_ALREADY_ABSORBED`

Current Native UI evidence on the exact supplied source snapshot executes:

```text
RCL parser-owned UI syntax
→ rooted canonical UI IR
→ style / navigation / device adaptation
→ Web lowering
→ Android lowering
```

Focused existing regression used for the PR #114 audit:

```text
node --test --test-concurrency=1 \
  tests/native-ui-parser-ir.test.mjs \
  tests/native-ui-runtime-style-layout.test.mjs \
  tests/native-ui-backends-equivalence.test.mjs \
  tests/native-ui-authority-boundary.test.mjs
```

Result: **30 / 30 PASS** before the new UI004 candidate was added.

This closes the original need for a second companion Web document/style/route grammar. It does **not** close browser standards completeness (UI002).

### UI002 — `OPEN_PROVIDER_RUNTIME_GAP`

DOM/CSS/URL/Fetch/event-loop/browser-accessibility breadth belongs primarily to standards/browser execution Providers. RCL should absorb portable semantics and contracts, not reimplement a browser engine inside the language Core.

### UI003 — `BOUNDED_DEVICE_EVIDENCE_CLOSED`

The current repository status already records the K03 API-35 emulator transaction/lifecycle/timing evidence for K083/K085/K098. This row is therefore historical for that bounded slice. It remains invalid to extrapolate one emulator profile into universal Android-device coverage.

### UI004 — `CANDIDATE_CLOSED_RCL_SEMANTIC_SLICE`

PR #114 adds `src/ui/ui-resource-accessibility.mjs`:

- content-addressed resource bundle identity;
- locale identity and deterministic locale/base/default fallback;
- rooted UI resource bindings limited to declared UI properties;
- complete canonical accessibility tree projection from the existing Native UI tree;
- deterministic focus order;
- action/input accessible-name fail closure;
- explicit `platformResourceProviderRequired` / `platformAccessibilityProviderRequired` boundaries.

New UI004 tests: **5 / 5 PASS**. Combined with the existing UI regression set: **35 / 35 PASS**.

This is a candidate semantic closure only. Web ARIA, Android accessibility services, screen readers, fonts, platform resource packaging and OS-specific behavior remain Provider/device evidence.

### UI005 — `AUXILIARY_EVIDENCE_ORGAN`

Independent model generation remains an auxiliary evidence role. It must not be promoted into RCL semantic ownership merely to remove credential requirements.

## Stress cases extracted

- `STRESS_UI_INDEPENDENT_REACTIVE_REPAIR`: an incorrect count transition must fail real Server state replay before repair.
- `STRESS_UI_INDEPENDENT_AUTHORITY_REPAIR`: a mismatched capability must be repaired without removing or weakening authority.
- `STRESS_UI_INDEPENDENT_VIEW_BINDING_REPAIR`: generated input value and observe bindings must target the same canonical state.
- `STRESS_UI_GENERATOR_READ_ONLY`: the generator receives no writable authoritative repository and only returns a Schema-bounded exact edit.
- `STRESS_UI_HOSTED_REPLAY`: local independent repair is insufficient until saved candidates replay on the exact hosted commit.
- `STRESS_UI_RESOURCE_IDENTITY`: localization changes must change the resource root while identical bundles replay identically.
- `STRESS_UI_A11Y_NAME`: actionable/focusable controls without an accessible name must fail closed.
- `STRESS_UI_A11Y_PLATFORM_BOUNDARY`: a canonical accessibility tree must not be relabeled as proof that a platform screen reader consumed it.

## Next absorption order

`canonical f64/root parity -> self-host typed lowering -> UI004 platform lowering evidence -> adjacent K400 cells`.

K339 already has its independent repair/fixed-point evidence. K083/K085/K098 have bounded API-35 emulator evidence. PR #114 adds the missing portable resource/accessibility semantics while intentionally leaving browser/device implementation external.
