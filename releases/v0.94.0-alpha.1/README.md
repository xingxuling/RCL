# RCL v0.94.0-alpha.1 Reality Hub Release Authority

This directory is the version-locked authority surface for integrating RCL Reality Hub with the canonical `xingxuling/RCL` source.

## Canonical binding

- Package: `@taowind/rcl-reality-forge`
- Package version: `0.94.0-alpha.1`
- Required Node.js: `>=18`
- Canonical compiler check path: JavaScript reference compiler
- Native core compiler self-hosting: verified at the declared Stage-40 subset
- Full self-hosting: **false**
- Complete native runtime: **false**
- JavaScript reference runtime still required: **true**

## Public CLI contract

```text
rcl version --json
rcl doctor
rcl check <source.rcl>
rcl run <source.rcl>
```

`check` validates without running the program. `run` is a separate authority level and requires explicit user intent.

## Release artifacts

The binary archives are not committed to this branch. `SHA256SUMS` records the verified local build artifacts that must be uploaded through an immutable release channel before Reality Hub exposes a download button. Reality Hub must not invent, guess or silently substitute a URL.

## Integration topology

- Hosted web: server-side MCP JSON-RPC adapter.
- Local desktop or companion service: local process adapter using `execFile` with `shell: false`.
- Browser code must never spawn local processes.
- Failure of the canonical adapter must produce a blocker; it must not silently fall back to the teaching simulator.

See `release-manifest.json`, `VERSION-CONTRACT.json` and `../../integrations/reality-hub/v0.94.0-alpha.1/`.