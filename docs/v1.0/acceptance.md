# RCL v1.0 development acceptance

User objective: continue iterating RCL until at least v1.0 is implemented and verified.

Baseline: xingxuling/RCL main at bd2187a5303a2bdc1e3a05ec98231400854c226a, package 0.94.0-alpha.1.
Development branch: codex/rcl-v1-development. Work is local until explicitly promoted.

## Required outcomes

1. Stable, documented language and public toolchain contracts: permission checks,
   guarded transitions, invariant rejection, deterministic semantics and evidence.
   Keep every existing source capability available with its actual maturity class.
2. Cross-implementation finite Number precision, explicit state-root algorithm
   negotiation, type-safe canonical encoding, historical verification and negative
   controls. Check compiler numeric round trips as well as final-state hashing.
3. Rebuild the native VM, compiler, daemon and embedding libraries from the exact
   source, bind dependencies and hashes, and exercise the installed artifacts.
4. Reproduce the claimed RCL-authored native-core compiler fixed point and example
   parity. Keep whole-language runtime self-hosting separate from native-core proof.
5. Preserve Web, Native UI, Android, package and Forge capabilities; run relevant
   existing integration/conformance checks. Publish accurate capability profiles
   for experimental extensions and untested K400 cells.
6. Exercise the public CLI and MCP entrypoints, errors and authority boundaries
   through real processes. Unavailable runtimes must fail visibly.
7. Produce installable packages with dependency closure, runnable examples,
   native build support, matching version/engine requirements and provenance.
   Verify installation outside the development checkout.
8. Run the complete existing local test suite and declared release verifiers after
   necessary native builds, resolve failures, and inspect actual coverage.
   GitHub Actions are not enabled under the user's instruction.
9. Update package version, root contracts, component contracts, current bilingual
   documentation, changelog and release records to the verified v1.0 state.
   Preserve historical releases and algorithms.
10. Deliver a reproducible v1.0 artifact and evidence ledger. Local candidate,
    canonical main, remote deployment and published release remain distinct states.

## Evidence rules

Tests support only their actual scope. A version field, plan, cached receipt,
partial suite or static manifest alone cannot complete this objective.
Do not promote an unknown capability to PASS. Hardware and platform limitations
stay explicit. Requirements remain open until their authoritative evidence exists.

## Verified local release

Status: LOCAL_VERIFIED_WINDOWS_LINUX. Package/native VM: 1.0.0.
The exact local verification record is verification.json. Final artifact hashes
are in the delivered external release-manifest.json and SHA256SUMS.

- All 328 test files were executed in two non-overlapping batches on unchanged
  core/test source: 1683 PASS / 0 FAIL / 2 SKIP (1685 cases). Ten compiler/toolchain
  tests were reused from the fresh declared self-host verifier rather than
  repeating the same expensive fixed-point computations.
- Stage0 through Stage40 all pass (41 verifiers); their bounded/proxy maturity
  remains unchanged. Windows and Linux reproduce the 268045-byte compiler fixed
  point C0 == C1 == C2, SHA-256
  47507cd33dd09b72b2d45ba6170bd9c710c5437b32706243c8ff122f2be01299.
- Eligible examples: 119 byte-parity passes, 40 explicitly unsupported cases.
- Native root v2 passes Windows and Linux Number, Text, typed record, Intent,
  special facet-name, transition/projection and rejection/tamper controls.
  Frozen v0.1 evidence owners explicitly retain v1 instead of relabeling digests.
- Independent Windows and Node 20 Debian Linux installations exercise public
  exports, CLI, Forge artifacts, a real MCP HTTP process with 32 tools, v1/v2
  negotiation and invalid-source rejection. The Linux shared library is loaded
  by an external C program. The installed Linux package passes 28 focused cases,
  including the C/JS F64 primitive case skipped by the Windows test definition.
- Release verifiers bind staged Foundation capability/conformance truth and
  exact packaged runtime source bytes; root/source/overclaim negative controls
  reject tampering. Native Rust compiler caches are excluded from delivery.
- The other Windows skip is the optional K08-D provider campaign. This release
  adds no fresh physical-device, broad GPU-production, hosted CI or AI-generation
  campaign credit.
- DWAC/Federation supplied an advisory plan with a provider gap. Codex executed
  the source changes and verification. Laya abstained on initial prioritization.
- The connected remote MCP was observed at 0.94.0-alpha.1. Canonical-main merge,
  npm publication and remote redeployment remain separate, unperformed actions.
  GitHub Actions were not run under the user's instruction.

The implemented and verified local v1.0 acceptance is complete. Historical
research evidence remains pinned to its original source, algorithms and scope.
