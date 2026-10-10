# RCL 2.0 capability development

Objective: continue RCL to at least 2.0 with demonstrated new capabilities.
Source baseline: xingxuling/RCL main, afe83b231754e8ae3adeb8058356e87165f7ad91,
package/native VM 1.0.0. Development branch: codex/rcl-v2-capability-development.

## Required capabilities

1. Native and reference governed sessions: initialize once, invoke a named rule
   repeatedly, project without committing, and retain state between commands.
2. Source-declared, typed input facets. Only those facets accept observations;
   rules continue to own state transitions, warrants and preserve checks.
   Rejected commands leave the whole prior state unchanged.
3. Native conditional warrants: reevaluate grants against current state for each
   command, with differential reference checks for expiry/revocation.
4. Canonical RCL-authored session bytecode compilation with byte-for-byte
   differential checks against the JavaScript bootstrap implementation.
5. Durable sessions: source-bound, root-bound command journal; real restart;
   deterministic native replay; idempotent retry; conflicting retries and stale
   revisions reject; exclusive writer; explicit recovery of an incomplete tail.
   No external effect executes during recovery. Durability is a local filesystem
   contract, not distributed exactly-once execution or an OS security sandbox.
6. Public API and CLI for creating, invoking, inspecting and verifying sessions.
   A runnable application/workflow demonstrates persistent inputs, transitions,
   revocation, rejected preserves, projections and restart.
7. Rebuild the native tools. Validate meaningful native/reference/self-host
   parity, corruption and process-restart controls, then run the relevant existing
   regression suites. Verify installation outside the development checkout.
8. Update package and independent component contracts only after capabilities
   pass. Deliver a reproducible installable 2.0 artifact, source provenance,
   release verifier, and an evidence record with exact scope and limitations.

## Reuse decisions from current source

- REUSE compiler/bytecode expression and rule lowering, native VM transactions,
  semantic root v2, and the RCL-authored compiler core.
- ADAPT runtime initialization and executeRule into the reference session API;
  extend the existing native daemon and C embedding ABI.
- KEEP_SEPARATE atomic-checkpoint (model/optimizer candidate), resource WAL
  (resource-isolation kernel), and external-effect settlement (provider protocol).
  None currently implements a durable governed program session.
- KEEP_SEPARATE historical K400/AI/hardware receipts. Session release tests do
  not close additional K400 cells or establish whole-language self-hosting.

## Execution constraints

GitHub Actions: NOT_RUN_USER_INSTRUCTION. Local release acceptance was completed
before any remote delivery. The user's subsequent 2026-10-10 commit/push request
authorized delivery to codex/rcl-v2-capability-development; CURRENT-STATUS.md
records that delivery. Main merge, publication, remote deployment and downstream
synchronization are outside that request.
Synced project sources and unrelated worktrees are read-only.
DWAC mode sequence: NORTH_STAR audit, DEEP_DEVELOPMENT implementation,
WHOLE_ARTIFACT release. Routing is advisory; Codex owns implementation/review.

## Status

LOCAL_VERIFIED_WINDOWS_X64. All required local release gates have passed.
Nineteen session checks cover actual native/reference execution, native RCL
compilation, process death/restart, inputs, projections, authority, journal
integrity, OS locks and idempotency. The reconciled suite covers all 332 files:
1702 pass, zero remaining failures, two explicit skips. Stage0–40 and 120 eligible
example byte comparisons pass; 40 examples retain unsupported status. A freshly
rebuilt native compiler reproduces C0 == C1 == C2 at 277414 bytes.

Independent Windows package installation, public CLI/API, RCL-authored session
compilation and durable restart/retry pass outside the development checkout.
The exact receipts and source hashes are in verification.json and the delivered
external evidence directory. The final archive's hash/install receipt belongs
to the external release manifest so the archive does not self-reference its hash.

The two skips are the optional opt-in K08-D provider campaign and a POSIX C F64
primitive test whose definition skips Windows. Five formerly unavailable
historical candidate-root cases were rerun with the available Zig compiler and
passed. The obsolete future-RBC assertion was updated from 1.3 to 1.4 and rerun;
the initial failed log is preserved. No unrelated failure was hidden.

The default v1.0 daemon's repeated RUN profile resets the probe to 1; the v2.0
session retains state to 50 after 50 invocations. Warm native API p95 is about
3 ms for this counter profile; this is not a distributed or external-effect
exactly-once claim. No new K400 cells, universal-language maturity, remote
deployment or whole-language/runtime self-hosting are promoted.

Fresh Linux/Android-device/hosted acceptance is not claimed. Ubuntu WSL cannot
mount its missing local disk and the Docker Linux engine is unavailable; the
v1.0 Linux record stays historical. Windows local source, artifacts and runtime
evidence establish the scope of this completed release.
