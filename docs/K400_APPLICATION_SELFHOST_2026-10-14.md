# Complete compiler in native science and advisory-model workflows

The public `createApplicationCompilerTarget(environment)` API accepts the caller's
actual compiler generation and source in `ai-runtime` and `scientific-runtime`.
It extends the existing native RCL controllers and application organs, preserving
their source/binary bindings, model training, numerical kernel and observer.
Version promotion remains frozen. Hosted Actions are not requested.

Each compilation snapshots its compiler/source inputs before awaiting admission.
The original native RCL controller prepares a job bound to SHA256 source bytes
before the resident native compiler is invoked. Two explicit native metrics feed
the existing application: `artifact bytes / (1 + artifact bytes)` and
`executed instructions / instruction budget`. In AI, the actual pinned RCL-trained
MLP performs native forward inference. In science, native RCL computes shifted
moments and regression, and an actual NumPy/SciPy process independently observes
the exact binary64 samples. The controller publishes after that observation.
Only then is the compiled artifact written to the caller's output path.

The metric projection is bounded transport. It does not establish understanding
of the program, compilation quality prediction, new model competence or arbitrary
HPC performance. AI outputs remain advisory and cannot grant authority. A foreign
model rejects compilation before a native compiler call. Requesting predictor
authority or supplying an actually incorrect statistical kernel rejects
publication after real compilation, creates no output file, and settles the
original RCL workflow's failed job. Malformed source and a corrupt compiler also
settle failure. Pause rejects both compilation and program execution before native
invocation. One operation may be in flight; healthy full compilation and native
program replay recover after the rejection controls.

Program execution uses the original application workflow with an additional native
RCL preflight projection and a snapshot of the supplied program bytes. The original
workflow still owns source-bound program execution, measurement projection,
inference or numeric observation, and publication. Native program state roots and
the complete controller command ledger are independently checked by the evaluator.
Reference code is evaluation evidence and does not execute the application.

The [frozen contract](../examples/universal-stress/selfhost-application/general-compiler-application-contract.json)
preserves twenty complete C0-to-C20 generations, ten sealed programs and three
unchanged fresh repairs **in each environment**. Each complete generation executes
101897504 instructions and returns the pinned 297957-byte compiler. The original
300000000-instruction, 50000 ms compile P95 and 5000 ms execute P95 limits remain.
The three new proposal-only contexts received only their exact frozen candidates
and requirements. Their [raw replies and input hashes](../examples/universal-stress/selfhost-application/independent-batch.json)
are retained; canonical source, oracle edits and hidden cases were withheld.
OS isolation is not claimed.

| Cell | Context | Compile P95 ms | Execute P95 ms |
| --- | --- | ---: | ---: |
| K239 | native advisory-model workflow | 4312.1566 | 979.9361 |
| K219 | native scientific workbench | 4004.9334 | 422.5718 |

The two actual public API tests and forty-two admission checks pass, without
failures or skips. The scientific receipt binds 53 actual observer records to
compiler and program measurements. The duplicate native-metric binding check
rejects a changed report copy even when its evidence root is recomputed.

The [complete profile index](../examples/universal-stress/selfhost-application/general-compiler-application-runtime.json)
binds K239 and K219. Admission verifies the existing application binding and
model/numeric oracle, exact compiler protocol/reply/identity, every controller
transition, compile-metric observations, source roots, native state roots,
publication rejection, recovery and shutdown. Focused forged-evidence checks
cover native identity, duplicate metrics, feature/sample substitution, missing
observation or completion, paused native calls, failure settlement, denied output,
model/authority tampering, observer identity/result/ledger and missing generations.

The compiler and scientific observer expose actual zero exit codes. The unchanged
session API awaits controller termination without returning its code; this API
confirms process absence and records `UNAVAILABLE_FROM_REUSED_SESSION_API`.
Existing application program traces expose actual process status, stdout/stderr
hashes and independently verified results, rather than a raw stdout archive.
No independent OS/device, external effect, security sandbox or whole-language
release is claimed. Detailed measurements, checks and relocated-source delivery
are retained in [the verification receipt](evidence/application-selfhost/verification.json).

DWAC's actual local four-mode router chose `DEEP_DEVELOPMENT`; its receipt is
[source pinned](evidence/application-selfhost/dwac-mode.json). Laya's low-risk gap
classification returned `ABSTAIN` at confidence 0.0022. Codex retains the final
development and admission decisions. Profile engine/admission headers identify
the exact reused donor files and hashes.

```js
import {createApplicationCompilerTarget, compileReality} from './src/index.mjs';

const target = await createApplicationCompilerTarget('scientific-runtime');
try {
  // hello.rcl contains: reality Hello { facet value : Number = 9 + 2 }
  const compiled = await target.compile('c1.rbc', 'hello.rcl', 'hello.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  const executed = await target.execute('hello.rbc', compileReality(source).programRoot);
  console.log(compiled.workflowTrace.observation, executed.result.state);
} finally {
  await target.dispose();
}
```

Select `ai-runtime` for the advisory-model workflow. `c1.rbc` is the caller's
actual preceding compiler generation. Use `npm run test:selfhost-application`
for the focused API and admission checks.
