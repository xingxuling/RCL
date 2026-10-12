# Native compiler warrant admission — 2026-10-12

Package/native versions remain **2.0.0**. This maintenance extends the RCL-authored
compiler on top of canonical main `450a794242d623909d714bccb55c475a2084c84d`.

The earlier compiler parsed/emitted conditional warrants but omitted their
expressions from semantic admission. A directly invoked native compiler could
therefore emit artifacts for unknown names, non-Truth conditions or invalid
operators/calls that the JavaScript checker rejected. An unused warrant declaration
could also hide the error because no invocation lowered its predicate.

## Result

The shared `selfhost/compiler-core.rcl` now visits every conditional warrant before
lowering. RCL-owned helpers infer the bounded predicate types and validate:

- References and function names, using existing path/call validation.
- Known condition result types, unary/logical/arithmetic/comparison operands and
  conditional-expression branch types.
- Native builtin signatures and user-defined predicate argument types/arity.
- Reachable predicate function bodies and declared return types. A visited-call
  set admits recursive/mutually recursive functions without endless static recursion.

The general and session compiler entries share this owner. Dynamic Sequence
element types remain Unknown under the existing contract; this does not infer
element truth from a sequence value. Runtime warrant/guard/preserve evaluation
remains in the native VM. Complete parity with all JavaScript type-system extensions
is not claimed, and unrelated unreachable function bodies have no newly claimed
complete type-checking guarantee.

The native compiler retains the `RCLC_COMPILER_FAILURE` envelope. Its message now
includes the RCL diagnostic, such as `RCL_WARRANT_CONDITION_TYPE` or `RCL_CALL_TYPE`,
plus context. Existing compiler semantic errors still use synthetic 1:1 spans;
precise source-position diagnostics remain open. A rejected compilation preserves
the caller's previous output artifact.

## Evidence

The [JSON record](warrant-compiler-admission-2026-10-12.json) binds source, artifact,
tests and retained logs:

- Before repair: 18 valid cases passed; 22 invalid-condition rejection checks
  failed because the old native compiler admitted the source.
- Current admission suite: **41 PASS**, covering 23 invalid and 18 valid cases.
  Each invalid source is passed directly to both native RCL compiler entries,
  bypassing JavaScript target validation. Valid targets match bootstrap bytecode
  exactly and execute real native/reference warrant behavior.
- Scoped regression: **89 PASS / 0 FAIL / 0 SKIP** across ten files, including all
  37 session checks, general compiler compatibility, public CLI and Stage0 binding.
- Native fixed point: **C0 == C1 == C2**, 297797 bytes, SHA-256
  `b8474f5e2e831d39fdef0cca59c6db95aefef7e3f6b2c6e129895501e9e054ce`.
- Existing example corpus: **120 exact byte matches / 40 explicitly unsupported / 0 failures**.

Reproduce admission with `npm run test:warrant-compiler`. Rebuild/check the native
fixed point with `npm run build:selfhost-compiler`, then run
`npm run verify:selfhost-examples`. These are local executions; no hosted workflow
is needed for these commands.

## Route and scope

The local DWAC four-mode router selected DEEP_DEVELOPMENT. The connected planning
profile returned HTTP 429, so no successful federation plan/execution is claimed
for this wave. Laya returned ABSTAIN at confidence 0.024; Codex retained judgment
and followed the user's instruction to keep versions unchanged.

REUSE: existing parser/AST, reference/call validation, compiler entries, native VM,
session runtime and root/bytecode contracts. ADAPT: RCL semantic admission and
diagnostic context; regenerate the existing compiler artifact. KEEP_SEPARATE:
bounded predicate typing, historical release/maintenance records, advisory routing
and source-position/compaction/platform follow-up work.

The native C implementation/binaries are unchanged. This evidence is Windows
local; no full-repository regression, new standalone installation, fresh Linux,
Android hardware, package publication or remote deployment is claimed.
GitHub Actions remain NOT_RUN_USER_INSTRUCTION. Earlier evidence stays frozen at
its own source snapshot, including the previous session-integrity maintenance.
