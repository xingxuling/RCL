# Install workflow

1. Read `../release-sources.yaml` and the version-locked release manifest.
2. Confirm that authenticated GitHub access to the private repository is available. Stop if it is not.
3. Confirm Node.js `>=18`.
4. Download only from the configured immutable release URL.
5. Compute SHA-256 and compare with `2d456d733ef94454cf9e5a36196ad248742f4fbd35c5635df2718138fa6348c9`. Stop on mismatch.
6. Install: `npm install -g ./taowind-rcl-reality-forge-0.94.0-alpha.1.tgz`.
7. Run `rcl version --json`.
8. Run `rcl doctor`.
9. Run `rcl check ./hello-reality.rcl`.
10. Record evidence.

Do not automatically run an RCL program during installation. Do not present the private GitHub URL as an anonymous public download.
