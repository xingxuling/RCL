# Complete compiler in local cold handlers

K139 has a separate frozen full-compiler profile. The public
`createColdCompilerHttpTarget` API accepts the caller's actual compiler bytecode
and source. Every call starts a separate authenticated loopback HTTP worker and
native compiler, then returns only after both processes have exited cleanly.
Program execution additionally runs an actual native VM process. Successful
and rejected requests retain their invocation identity, native replies and exits.

This is a Windows local cold-handler capability. It does not establish a cloud
FaaS deployment, a security sandbox or a whole-language release. The previous
resident HTTP, embedded, Android and fixed-seed cold-handler owners retain their
original source and artifact bindings. Only the new sibling adapter grants K139.

## Reuse and development mode

The implementation reuses `createResidentCompilerHttpTarget` and its native
resident compiler C ABI. It adds per-call process lifetime and exit verification
in `src/cold-compiler-http-target.mjs`; no compiler semantics run in the wrapper.
The separate K139 engine/admission adapt the exact pinned HTTP engine/admission
sources named in their headers, with cold invocation checks replacing resident
instance reuse. DWAC's actual local four-mode router chose `DEEP_DEVELOPMENT`
for this evidence-rich bottleneck. Its [receipt](evidence/cold-selfhost/dwac-mode.json)
is advisory. Laya abstained on prioritization; it supplied no authorization.

## Frozen acceptance

The [contract](../examples/universal-stress/selfhost-serverless/general-compiler-serverless-contract.json)
was frozen before three new independent proposal-only contexts read their exact
mutated candidate files. They had no canonical source, oracle edits or hidden
tests. Their raw completed replies are recorded in the
[batch](../examples/universal-stress/selfhost-serverless/independent-batch.json).
OS isolation is not claimed. Each unchanged proposal must restore the compiler
and repair an observed semantic failure in the actual selected runtime.

The [runtime receipt](../examples/universal-stress/selfhost-serverless/general-compiler-serverless-serverless-runtime.json)
and [index](../examples/universal-stress/selfhost-serverless/general-compiler-serverless-runtime.json)
verify twenty complete C0-to-C20 generations, ten sealed native programs and
three effective fresh repairs. Each generation consumes the preceding compiler
artifact and returns the exact pinned 297957-byte compiler. Each full generation
executes 101897504 native instructions under the unchanged 300000000 budget.
New invocation/context tokens and clean exits prove fresh local handlers; process
IDs are not required to be globally unique because an OS can reuse them.

Malformed source and a truncated compiler are rejected. The subsequent fresh
handler completes a full compiler generation. Unauthorized requests leave the
handler's health unchanged; two fresh native program executions return the same
state. All recorded worker/compiler/native-program exits must match their actual
invocations. A rehashed claim with warm reuse, substituted context, missing exit
barrier, unclean exit or incomplete generation cannot pass admission.

Compilation P95 is 3374.1489 ms and execution P95 is 798.4370 ms, below the
unchanged 50000/5000 ms limits. These timings include handler creation and
termination. They describe this frozen local profile, not general throughput.

## API example

Run from the repository root on Windows with the captured native runtime present:

```js
import fs from 'node:fs';
import {createColdCompilerHttpTarget, compileReality} from './src/index.mjs';

fs.mkdirSync('output/cold-api', {recursive: true});
const target = await createColdCompilerHttpTarget();
try {
  const seed = 'selfhost/variants/utf16-columns/compiler.rbc';
  await target.compile(seed, 'selfhost/variants/utf16-columns/compiler.rcl',
    'output/cold-api/c1.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  fs.writeFileSync('output/cold-api/hello.rcl', source);
  const compiled = await target.compile('output/cold-api/c1.rbc',
    'output/cold-api/hello.rcl', 'output/cold-api/hello.rbc');
  const run = await target.execute('output/cold-api/hello.rbc',
    compileReality(source).programRoot);
  console.log(run.result.state.value); // 11
  console.log(compiled.coldInvocation.exit); // observed clean exits
} finally {
  await target.dispose();
}
```

The native test verifies actual generations, distinct live compiler processes,
denied requests, native execution, recovery, backpressure and closed-target
rejection. The separate admission tests verify the captured profile and reject
eleven rehashed forgeries. Use `npm run test:selfhost-cold` for these thirteen
focused checks. Existing native source and captured binaries are unchanged, so
the previous resident-native source rebuild evidence remains separate.

The consolidated K400 verdict and source delivery checks are captured in the
[verification receipt](evidence/cold-selfhost/verification.json). Package identity
remains 2.0.0 with version promotion frozen; K400 remains INCOMPLETE until all
400 coordinates meet their original gates. Hosted Actions are not used.
