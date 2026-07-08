# RCL/RNCS MCP for ChatGPT

This repo includes a lightweight HTTP MCP server that lets ChatGPT call RCL/RNCS verification tools.

## Start locally

```powershell
npm run mcp -- --host 127.0.0.1 --port 8765 --path /mcp
```

Local endpoint:

```text
http://127.0.0.1:8765/mcp
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

## Tools Exposed

- `rcl_status`: repo, native VM, and RNCS fusion summary.
- `rncs_fusion_verify`: runs RCL/RNCS fusion verification and evidence parity checks.
- `rncs_read_module`: reads vendored RNCS `.rcl` modules.
- `rcl_compile_source`: compiles RCL source to RBC and can run it in the native VM.
- `rcl_selfhost_inventory`: lists self-host stage scripts and selfhost `.rcl` files without executing them.

## Connect To ChatGPT

ChatGPT requires the MCP endpoint to be reachable over HTTPS. For local development, expose the local `/mcp` endpoint with Secure MCP Tunnel, ngrok, Cloudflare Tunnel, or an equivalent HTTPS tunnel.

In ChatGPT:

1. Open Settings -> Apps & Connectors -> Advanced settings.
2. Enable Developer mode if your workspace allows it.
3. Go to Settings -> Connectors -> Create.
4. Use a name like `RCL RNCS`.
5. Set the connector URL to the public HTTPS `/mcp` endpoint, for example:

```text
https://your-tunnel.example/mcp
```

After creation, ChatGPT should show the advertised tools. Start a new chat, add the connector from the `+` menu, then ask questions such as:

```text
Use RCL RNCS to verify current RNCS fusion state.
```

```text
Read the RNCS aether_earth RCL module and explain what it proves.
```

```text
Compile this RCL source and run it natively.
```

## Notes

The first MCP version is tool-only. It does not ship a ChatGPT UI component yet. That is intentional: the useful base layer is ChatGPT being able to call real RCL/RNCS tools and inspect evidence before we add a visual Apps SDK surface.
