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

The server exposes 32 tools: 20 RCL tools and 12 RNCS tools. RCL intentionally has the larger surface.

RCL tools:

- `rcl_status`
- `rcl_package_metadata`
- `rcl_native_vm_status`
- `rcl_list_examples`
- `rcl_read_example`
- `rcl_compile_source`
- `rcl_compile_file`
- `rcl_run_native_source`
- `rcl_run_native_file`
- `rcl_disassemble_source`
- `rcl_disassemble_file`
- `rcl_hash_source`
- `rcl_read_repo_file`
- `rcl_search_repo`
- `rcl_list_bootstrap_compilers`
- `rcl_read_bootstrap_compiler`
- `rcl_bootstrap_stage5_smoke`
- `rcl_selfhost_inventory`
- `rcl_read_selfhost_source`
- `rcl_rncs_fusion_surface`

RNCS tools:

- `rncs_fusion_verify`
- `rncs_list_modules`
- `rncs_read_module`
- `rncs_control_plane_evidence`
- `rncs_edge_evidence`
- `rncs_runtime_bundle_status`
- `rncs_full_repo_status`
- `rncs_vsr_status`
- `rncs_rsr_status`
- `rncs_vsr_list_examples`
- `rncs_rsr_list_schemas`
- `rncs_read_gateway_runtime`

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
