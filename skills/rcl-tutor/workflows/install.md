# Install workflow

1. Read `../release-sources.yaml` and the version-locked release manifest.
2. Refuse installation while `artifact.url` is null.
3. Confirm Node.js `>=18`.
4. Download only from the configured immutable release URL.
5. Compute SHA-256 and compare with `128ca227f562f458fd64f5ff3bb665066f1febe555b0a25ef1a479efea187cb6`. Stop on mismatch.
6. Install: `npm install -g ./taowind-rcl-reality-forge-0.94.0-alpha.1.tgz`.
7. Run `rcl version --json`.
8. Run `rcl doctor`.
9. Run `rcl check ./hello-reality.rcl`.
10. Record evidence.

Do not automatically run an RCL program during installation.
