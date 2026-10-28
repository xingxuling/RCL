# Target-package manifest and payload binding

New packages declare `inventoryProfile: complete-payload-v1`. README creation now
precedes inventory capture, so its bytes are part of that profile. Package
verification checks the manifest root and optional `expectedManifestRoot`, schema,
file count, unique portable relative paths, byte lengths and SHA-256 hashes. It
rejects symbolic entries and unlisted payload, verifies source/bytecode identity
fields, recompiles the source through the existing package compiler and compares
the resulting bytecode. Empty or self-consistently rehashed false file/source
claims cannot substitute for these checks.

The existing `build/android-debug-build-report.json` and the aggregate
`rcl-package-report.json` are explicitly unbound generated diagnostics. Their
exclusion is reported as `unboundFiles`. Legacy v0.24 packages without the new
profile can retain their historical unbound README; verification reports
`inventoryProfile: legacy-readme-unbound` and no semantic-manifest binding claim.
This compatibility path does not silently describe old README bytes as verified.

New manifests also contain a semantic metadata root. It excludes informational
machine source/output paths, its own root fields and the existing volatile Android
build report. All other manifest metadata, including entrypoints and payload
inventory, remains bound. Release target matrices now record these roots for all
eight generated targets, including targets outside the four selected platform
rows. The release verifier checks them and reports
`targetManifestBindingVerified`. Relocation remains reproducible; altering a
target's semantic metadata rejects even after its local checksums are recomputed.

```text
rcl package-verify <package-directory> --expected-manifest-root <trusted-root>
```

Malformed arguments, wrong pins and rejected packages exit nonzero. Publisher
authentication remains false; external pins retain their separate trust boundary.

Eight new checks pass, including false inventories, foreign bytecode, legacy
compatibility, runtime diagnostic exclusions, complete payload, all-target release
binding, relocation and actual public CLI pins/exit status. Thirty consumer checks
also pass across package assembly/native and Node execution, RCLApp lifecycle,
ecosystem/release reproducibility and release negative controls. Logs are under
`output/module-development-20261028/package-manifest-integrity.log` and
`package-manifest-consumer-regression.log` in that same directory.

No external target-platform acceptance, publisher signature, hosted Actions,
deployment or package publication follows from these bounded local checks.
