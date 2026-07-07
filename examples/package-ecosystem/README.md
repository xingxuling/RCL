# RCL Package Ecosystem Example

This example is the v0.42 P5 seed project. It contains:

- `rcl.toml` manifest
- `src/app.rcl` source entry
- local + remote pinned dependency examples
- Linux / Windows / Android / Web target mapping

Try:

```bash
node src/cli.mjs package-lock examples/package-ecosystem
node src/cli.mjs package-cache examples/package-ecosystem output/v0.42/example-cache
node src/cli.mjs package-release examples/package-ecosystem output/v0.42/example-release
node src/cli.mjs package-release-verify output/v0.42/example-release
```
