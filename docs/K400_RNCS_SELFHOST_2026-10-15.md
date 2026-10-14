# Complete compiler in the canonical RNCS candidate runtime

The public `createRncsCompilerTarget()` API accepts the caller's actual RCL compiler
generation, source and native program. It reuses the pinned RNCS Reality Branch
Fabric at commit `4cbbeae5fc5e4bad5c7b4fef6621bc3cfe6eb6f1`, the existing native RCL
automation controller, and the two-worker compiler graph. The upstream RNCS files
and original native owners remain unchanged. Package identity stays `2.0.0`;
version promotion is frozen and whole-language release is false.

Compiler, source and program bytes are captured before asynchronous work. Each
operation first runs an actual native preview. Its rooted output determines the
RNCS branch's metadata and invariants. The canonical execution plan then calls a
provider which actually invokes the supplied compiler or native program again.
Both runs pass the source-owned native RCL admission/completion controller. Exact
compiler byte equality or typed semantic-result equality binds the provider to
the plan. Compilation uses SHA256 source bytes; program execution uses its RCL
program root. Only an approved, current-generation candidate merge publishes the
compiled bytes and advances the local candidate generation.

The candidate stores artifact metadata, and the API returns or writes the actual
native bytes. This is a local candidate runtime with no durable artifact store or
production RFE commit. Its sealed local authority decision is bound to actual RCL
admission/completion roots; it does not establish human-key authority or a security
sandbox. Reference code checks the receipts and native results; it does not execute
the compiler provider. Reusing one implementation does not establish independent
implementation agreement.

An injected second-step failure executes the native provider, rolls back candidate
metadata and discards unpublished output. Denied merge and stale generation also
reject publication after real provider execution. These rejections preserve the
candidate state, generation and generation root. The native work already completed
remains recorded in its own controller ledger. Pause denies compile and execute
before native dispatch. Malformed source and a corrupt compiler settle failed
native jobs. Bounded backpressure rejects overlap, then healthy full compilation
and repeated native execution recover.

The [frozen contract](../examples/universal-stress/selfhost-rncs/general-compiler-rncs-contract.json)
preserves twenty byte-identical C0-to-C20 generations. Each generation performs
two actual complete compilations, giving forty complete native invocations.
Each executes 101897504 instructions under the unchanged 300000000-instruction
budget and returns the pinned 297957-byte compiler. Ten sealed programs and three
unchanged fresh repairs use the same real runtime. Original P95 budgets remain
50000 ms for compilation and 5000 ms for execution.

Final acquisition measures compile P95 **9712.9832 ms** and execute P95
**451.0730 ms**. The actual public API test and twenty-nine admission checks pass,
with zero failures or skips. Its 59 outer operations bind 228 native controller
commands, 52 accepted candidate generations and 33 actual native/worker exit
records. A relocated tracked Git tree also passes the real public API test,
captured K399 admission and doctor without copying ignored tools or caches.

The three independent proposal-only contexts received their exact frozen candidate
and task requirements. Canonical source, oracle edits and hidden tests were
withheld. Their [raw replies and input hashes](../examples/universal-stress/selfhost-rncs/independent-batch.json)
are retained; OS isolation is not claimed. The evaluator proves each semantic
mutant is effective, applies the returned repair unchanged, and checks the
restored full compiler on actual native execution.

Admission reconstructs canonical branches, workspaces, simulations, comparisons,
execution plans, provider receipts, authority requests/decisions and merges. It
independently replays every native RCL command, verifies both native child traces,
compiler identities and raw protocol replies, exact source/artifact/state roots,
candidate continuity, rejected publication, rollback, recovery and shutdown.
Resealed or rehashed forged records cannot substitute predictor authority, omit
native provider work or completion, mutate rolled-back candidates, hide a VM exit,
or invent a controller exit code. The compiler and both worker threads expose
actual zero exits. Controller process absence is observed; its unchanged session
API does not return an exit code, so the receipt records
`UNAVAILABLE_FROM_REUSED_SESSION_API`.

The [profile index](../examples/universal-stress/selfhost-rncs/general-compiler-rncs-runtime.json)
can grant only K399, `rncs-runtime::self-hosting`, after every frozen gate passes.
Detailed measurements and delivery checks are retained in the
[verification receipt](evidence/rncs-selfhost/verification.json). K400 completion
and broader runtime claims remain separate.

The actual pinned DWAC four-mode router chose
[`DEEP_DEVELOPMENT`](evidence/rncs-selfhost/dwac-mode.json). Laya's low-risk evidence
[classification](evidence/rncs-selfhost/laya-classification.json) returned
`CANDIDATE` for a bounded candidate workflow at confidence 0.7517. These are advisory
records. Codex owns the implementation and evidence admission decisions; neither
tool authorizes publication or determines K400 acceptance. No hosted Actions are
requested.

```js
import {createRncsCompilerTarget, compileReality} from './src/index.mjs';

const target = await createRncsCompilerTarget();
try {
  // hello.rcl contains: reality Hello { facet value : Number = 9 + 2 }
  const compiled = await target.compile('c1.rbc', 'hello.rcl', 'hello.rbc');
  const source = 'reality Hello { facet value : Number = 9 + 2 }';
  const executed = await target.execute('hello.rbc', compileReality(source).programRoot);
  console.log(compiled.rncsTrace.after.generation, executed.result.state);
} finally {
  await target.dispose();
}
```

`c1.rbc` is the caller's actual preceding compiler generation. Use
`npm run test:selfhost-rncs` for the focused public API and admission checks.
