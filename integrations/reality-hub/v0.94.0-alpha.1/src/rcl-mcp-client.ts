import type { RclMcpToolResult } from "./rcl-adapter-types";

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

export class RclMcpClient {
  private nextId = 1;

  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });
    if (!response.ok) throw new Error(`RCL MCP HTTP ${response.status}`);
    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (payload.error) throw new Error(`RCL MCP ${payload.error.code}: ${payload.error.message}`);
    if (payload.result === undefined) throw new Error("RCL MCP returned no result");
    return payload.result;
  }

  initialize() {
    return this.request<{ serverInfo: { name: string; version: string } }>("initialize");
  }

  listTools() {
    return this.request<{ tools: Array<{ name: string; description?: string }> }>("tools/list");
  }

  async callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.request<RclMcpToolResult<T>>("tools/call", {
      name,
      arguments: args,
    });
    return result.structuredContent;
  }

  status() {
    return this.callTool("rcl_status");
  }

  packageMetadata() {
    return this.callTool("rcl_package_metadata");
  }

  compile(source: string) {
    return this.callTool("rcl_compile_source", { source, runNative: false });
  }

  compileAndRunNative(source: string, timeoutMs = 5000) {
    return this.callTool("rcl_compile_source", { source, runNative: true, timeoutMs });
  }
}
