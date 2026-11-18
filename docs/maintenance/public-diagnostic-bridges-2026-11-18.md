# Public diagnostic bridges

The default SDK preserved native structured diagnostics, but the legacy CLI catch printed only a stack and the MCP tool handler returned only an error name. The CLI now carries available semantic diagnostics as a JSON error on stderr, and the MCP handler adds optional code/diagnostic fields inside its existing JSON-RPC error data. Other error paths preserve their prior handling.

Nine focused controls pass. The subprocess controls exercise public native/bytecode compilation and reference/native-run execution, verify nonzero exit and exact spans, and retain pre-existing bytecode output. Direct MCP tool calls exercise actual native assertion failure and an ordinary runtime failure with the old data shape. No running external MCP server was restarted or redeployed. The compiler source/artifact is unchanged by this bridge increment; the earlier candidate archive predates these bridge files and must be refreshed for their delivery.
