# Native UI Semantics v0.1

## Minimal irreducible set

`UIProgram` owns one view tree, declared local state, derived state, a style sheet, lifecycle policy and event graph. A `UIViewNode` owns stable identity, a platform-neutral role, local content/style properties, bindings, events, layout and children.

Supported roles are `container`, `text`, `action` and `input`. They are semantic roles rather than widget class names.

## Reactive transaction

```text
declared state
→ derived evaluation
→ bound semantic properties
→ canonical event
→ proposed local state + proposed route
→ atomic UI-local replacement
→ new semantic projection + trace
```

Expressions may reference declared state, derived state and declared event parameters. Unknown references and derived cycles fail compilation. Event expressions read the pre-event snapshot; multiple statements therefore form one deterministic proposed-state transaction rather than order-dependent partial mutation.

State, derived expressions, bound properties, style values, event parameters and mutation targets carry `Number`, `Text` or `Truth` types. Standard event parameters have canonical signatures (`input/change.value: Text`); custom parameters require an explicit type. Static mismatch, missing runtime payloads, invalid payload types and invalid restore snapshots fail closed.

## Property contracts

Content properties are role-scoped: text binds `value`, action binds `label`, and input binds `value`. `placeholder` is input-only and `accessibility_label` is available where declared by the role contract. Style properties use a separate allowlist. Unknown, duplicated or role-invalid properties fail closed.

## Events and navigation

The canonical vocabulary includes `activate`, `input`, `change`, `submit`, `focus`, `blur`, lifecycle events and `custom`. v0.1 exercises `activate` and `change`; the remaining names are schema capacity rather than fully verified behavioral coverage.

Navigation is a canonical `rcl.native-ui.navigation.v0.1` extension. A route has a stable route identity and targets one direct child of the root view, allowing non-route shell nodes to remain shared. One event may issue at most one `navigate route`; `set` and `navigate` may commit together because both are UI-local. `navigate` and `realize` may not coexist in one handler because Reality authority is external. Missing declarations, duplicate routes or targets, unknown initial/routes/targets and multiple transitions fail closed.

## Lifecycle

Canonical stages are `create`, `activate`, `suspend`, `resume` and `destroy`. Restore declarations identify the local state entries that may be restored from a host snapshot. Undeclared snapshot keys are ignored.

## Non-claims

This candidate does not implement asynchronous effects, focus traversal, general accessibility trees, animation, image/media resources, list virtualization, a layout constraint solver, device adaptation or platform pixel equivalence. Navigation evidence is structural/semantic and does not claim real Android-device behavior.
