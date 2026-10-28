# Release bundle integrity closure

`verifyReleaseBundle(directory, { expectedReleaseRoot })` now verifies the existing
bundle's connected evidence instead of checking only metadata-file existence.
It validates the release root and every field of the deterministic seed envelope,
the package lock's own root/package identity, the source TOML/lock binding, the
cache's exact objects and cache/lock roots, the target-matrix root and release
platform projection, each declared target's package verification and inventory
root, the recomputed compatibility report and the recomputed SBOM.

The SBOM excludes itself when being rebuilt, as it was absent when the original
builder first computed it. This preserves existing deterministic bundle roots.
Existing volatile generated diagnostics/package reports remain excluded by their
established inventory contract. This change does not redefine them as rooted
payload. Symbolic entries, missing/malformed metadata and false success markers
reject with structured diagnostic reports. Verification performs no build, target
execution, publication or deletion.

```text
rcl package-release-verify <release-directory> --expected-release-root <trusted-root>
```

Unknown/repeated/malformed CLI arguments are rejected. A corrupt bundle or wrong
external pin exits nonzero. `externalReleaseAnchorChecked` reports whether the
caller supplied that pin. `publisherAuthenticationVerified` is always false:
the legacy envelope is a reproducible public seed checksum, not a private-key
signature. Without an independent pin, recomputing an entirely replaced set of
self-consistent evidence does not establish who authored it.

Eleven new checks initially failed against the previous verifier. They now pass,
covering source lock/cache/matrix/compatibility/SBOM/envelope tampering, missing or
malformed metadata, corrupted cache objects, unlisted payload, directory junctions
and actual public CLI pins/exit codes. All ten existing ecosystem checks pass,
including release creation, four-target assembly, cross-directory reproducibility
and CLI/demo behavior. Logs are in
`output/module-development-20261028/release-integrity-before.log`,
`release-integrity.log` and `release-regression.log` in that same directory.

This is bounded local Windows evidence. No GitHub Actions, publisher key signing,
production release, deployment or external target-platform acceptance is claimed.
