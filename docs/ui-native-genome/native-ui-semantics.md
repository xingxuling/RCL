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
→ proposed local state
→ atomic local replacement
→ new semantic projection + trace
```

Expressions may reference declared state, derived state and declared event parameters. Unknown references and derived cycles fail compilation. Event expressions read the pre-event snapshot; multiple statements therefore form one deterministic proposed-state transaction rather than order-dependent partial mutation.

State, derived expressions, bound properties, style values, event parameters and mutation targets carry `Number`, `Text` or `Truth` types. Standard event parameters have canonical signatures (`input/change.value: Text`); custom parameters require an explicit type. Static mismatch, missing runtime payloads, invalid payload types and invalid restore snapshots fail closed.

## Property contracts

Content properties are role-scoped: text binds `value`, action binds `label`, and input binds `value`. `placeholder` is input-only and `accessibility_label` is available where declared by the role contract. Style properties use a separate allowlist. Unknown, duplicated or role-invalid properties fail closed.

## Events

The canonical vocabulary includes `activate`, `input`, `change`, `submit`, `focus`, `blur`, `navigate`, lifecycle events and `custom`. v0.1 exercises `activate` and `change`; the remaining names are schema capacity rather than fully verified behavioral coverage.

## Lifecycle

Canonical stages are `create`, `activate`, `suspend`, `resume` and `destroy`. Restore declarations identify the local state entries that may be restored from a host snapshot. Undeclared snapshot keys are ignored.

## Non-claims

This candidate does not implement navigation, asynchronous effects, focus traversal, general accessibility trees, animation, image/media resources, list virtualization, a layout constraint solver or platform pixel equivalence.
