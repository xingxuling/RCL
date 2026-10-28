# RCL-authored rule host-call lowering

The native self-hosted compiler now parses and retains rule-level host calls,
includes them in canonical program metadata, collects provider/capability/request/
target strings in reference order, emits CALL_PROVIDER plus the existing flagged
STAGE_STORE, and includes their instructions in branch/function addresses. Calls
survive later immutable updates to a rule. Host response stores select RBC 1.2;
conditional warrants continue to select RBC 1.3.

The admitted native profile requires a declared host/offer, one literal Text
request and a matching Text target. Declared needs retain existing warrant
admission and runtime checks. Foresee directives for host-effect rules reject.
The direct RCL-authored session compiler also rejects rule host effects, retaining
the existing pure replay boundary. These calls use the existing native provider
ABI and its current effect behavior; external settlement or effect rollback is
not introduced.

A separate pre-change native execution exposed an existing bootstrap-lowering
gap: a host/target declared Number compiled successfully, but the native provider
ABI stored a Text response. Both bootstrap native admission and RCL-authored
admission now reject non-Text response targets before bytecode output. High-level
reference host semantics remain separate from this native ABI restriction.

The initial sixteen controls recorded 1 PASS / 15 FAIL (the existing missing-
warrant rejection already passed). Eighteen final cases pass after adding numeric
and Truth response-ABI controls. They cover the two formerly excluded examples,
multiple calls plus alterations/functions/preserves, unused calls, trailing commas
already accepted by the reference parser, conditional warrants, malformed syntax,
invalid requests/hosts/targets, foresee rejection, session rejection and a real
local echo-provider run with host-call/source receipts. Rejections retain the
existing output file.

Final C0=C1=C2 is 362965 bytes, SHA-256
`d3b195d3931f09035fccc35120775cc40f50c61b3231e09dac1a6d83c3d3cd4d`.
All 178 affected checks pass. The full collector now executes host-call sources
instead of excluding them: at the unchanged 60000-ms target budget, 195 exact
matches, 38 reference compile rejections and zero failures across 233 files; 122
actual native attempts and 73 reused aliases. Historical reports retain their
earlier compiler-bound results. This is not complete language, publisher, device
or new K400 acceptance, and no hosted Actions ran.

The existing public API can compile the supplied local example:

```js
import { compileSourceFileSelfHosted } from '@taowind/rcl-reality-forge';
compileSourceFileSelfHosted('examples/native-provider-host-call.rcl', 'host-target.rbc');
```

Execution requires registration of the intended provider through the existing
native embedding API. The test uses the repository's local echo provider.
