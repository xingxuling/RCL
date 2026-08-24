# Language Federation Migration Plan v0.1

| Language/family | Decision | Migration | Compatibility | Breaking risk | Rollback |
|---|---|---|---|---|---|
| RCL | KEEP canonical | register current reality/authority/lowering ownership | no syntax change | low | remove registry/export only |
| ASIL | ADAPT as interlingua candidate | add profile adapters one at a time; preserve UPDIA implementation | existing ASIL unchanged | schema drift across consumers | pin profile version and disable adapter |
| IAL | MERGE_FAMILY logically, do not merge code | map ontology/projection/task adapters under one `ial` identity; freeze field map before round-trip | old materials remain provenance | symbolic terms may have incompatible generations | retain adapters separately and mark lossy |
| RSL | ADAPT new bounded candidate | grow locale grammar only after corpus/equivalence gates | initial two commands stable under v0.1 profile | silent semantic expansion | disable locale/version adapter |
| SNLL | KEEP + ADAPT | commit/publish its existing source first, then add SNLL IR -> ASIL Social Profile | current RNCS bridge remains canonical until adapter passes | subject-local meaning flattened | keep current SNLL IR/RNCS path |
| CSL | KEEP AS DOMAIN AUXILIARY | repair lockfile, freeze identity/version, later map structural subset to ASIL | CSL parser/runtime remain independent | forced generalization would reduce density | remove ASIL adapter; retain CSL repo |
| E-Lang IR | SUPERSEDE / ARCHIVE | retain provenance and recovery notes; no current owner claims | no runtime dependency found | lost historical artifacts | recover original source and reassess |
| SEL/CEL | ORGAN_ONLY | register as bounded protocols, not standalone canonical languages | no behavior change | name inflation | remove registry entry |

## Next non-breaking sequence

1. Publish the existing SNLL work on its intended branch with a clean evidence bundle.
2. Repair CSL lockfile and add repository identity/version documentation.
3. Freeze IAL-to-ASIL field mapping and human-reviewed loss threshold before coding a round-trip.
4. Expand the RSL corpus by meaning class, not by translated keywords.
5. Add ASIL migrations before profile v0.2 changes.
