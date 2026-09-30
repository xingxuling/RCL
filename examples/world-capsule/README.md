# World Capsule computation bridge

This example connects the existing local World Capsule knowledge structure to a bounded, executable RCL resource constraint. It introduces the necessary capsule registries into this repository without changing the language runtime or adding a `capsule` keyword.

`resource-choice` is a promoted middle capsule composing `commerce-resource` and `individual-agent`. Its roots contain Objects, State, Relations, Constraints, Dynamics and Evidence slots. Dependencies are semantic ancestry; lazy activation expands only the two selected members.

`resource-choice-compute-map.v0.1.json` explicitly binds existing constraint/dynamics atoms to typed inputs and output expressions. The emitter reads this mapping, supports only addition, subtraction and greater-or-equal, and generates RCL facets and governed alterations. This is human-authored operational semantics, not mathematics automatically inferred from prose. The map root, middle meaning root, member roots and root registry hash are checked before expansion; unreviewed versions or edited maps are rejected.

Inputs are available resources, required payment and confirmed usable credit, all finite nonnegative Numbers in the same currency. Outputs are usable resources, margin and payment feasibility. Scope assumes a single purchase without fees; credit provenance and units are not independently verified. Number arithmetic is floating point, not exact currency accounting. This example does not train a model or prove natural-language routing accuracy.

Run from the repository root, after the normal native build:

```sh
npm run build:native
node --test tests/capsule-compute.test.mjs
node examples/world-capsule/run-capsule-compute.mjs
```

The test compares expanded computation with explicit RCL programs, checks permission/witness history without host adapters, validates malformed/tampered data and repeated execution, and checks native VM state/root/history parity. The demo writes its expanded source and current execution evidence beside this README. Those generated files are not inputs or historical pass claims.

The root registry contains 12 capsules; the included middle registry retains its original reviewed data, but only `resource-choice` is executable through this bridge. Other World Capsule routers, synthetic benchmark reports and unrelated local prototypes are outside this change.
