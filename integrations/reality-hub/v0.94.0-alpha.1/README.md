# RCL Reality Hub Integration 0.94.0-alpha.1

This directory connects Reality Hub to the canonical RCL source without presenting the teaching simulator as the real compiler.

## Hosted web

Use `RclMcpClient` from a server route. Browser code sends source text to the application server; the server calls the configured RCL MCP HTTPS endpoint.

MCP JSON-RPC sequence:

1. `initialize`
2. `tools/list`
3. `tools/call` with `rcl_compile_source`

`runNative: true` is a distinct privileged action and must never be the default compile path.

## Local desktop or companion service

Use `RclLocalProcessAdapter`. It invokes the public RCL CLI contract with `execFile` and `shell: false`:

- `rcl version --json`
- `rcl doctor`
- `rcl check <file.rcl>`
- `rcl run <file.rcl>`

## Release binding

- RCL version: `0.94.0-alpha.1`
- Node.js: `>=18`
- Release authority: `releases/v0.94.0-alpha.1/release-manifest.json`

## Required truth labels

- Check: canonical JavaScript reference compiler validation.
- Native core self-hosting: verified subset.
- Full self-hosting: false.
- Complete native runtime: false.
- JavaScript reference runtime still required: true.

Do not silently fall back to a teaching simulator when the canonical adapter fails.