## RCL Reality Transaction

### Scope
- [ ] This PR has one bounded purpose and names the affected authority surface.
- [ ] Candidate behavior is isolated from `main` until verification passes.

### Canonical authority
- [ ] `package.json`, `VERSION-CONTRACT.json`, `CURRENT-STATUS.md`, and README claims remain consistent.
- [ ] No bridge, reference-runtime, candidate, or demo capability is relabeled as native or canonical without new evidence.
- [ ] Whole-language runtime self-hosting is not claimed unless the full stated boundary is proved.

### Verification and evidence
- [ ] `RCL canonical verification` passes.
- [ ] `RCL Authority Contract` passes.
- [ ] New or changed behavior includes positive tests and at least one meaningful negative control.
- [ ] Evidence paths, roots, hashes, receipts, or replay artifacts are listed below.

### Native and derived artifacts
- [ ] Native binaries and generated artifacts are rebuilt from this branch rather than copied from an old branch.
- [ ] Source SHA / manifest / artifact hashes are updated together.
- [ ] Reference/native parity is verified when native behavior changes.

### Downstream and rollback
- [ ] RNCS, zhinao, Reality Hub, and other migration consumers are identified when affected.
- [ ] Rollback or revert behavior is explicit.

### Evidence ledger
<!-- List commands, workflow runs, artifact paths, hashes and known limitations. -->

### Declared limitations
<!-- State exactly what this PR does not prove. -->
