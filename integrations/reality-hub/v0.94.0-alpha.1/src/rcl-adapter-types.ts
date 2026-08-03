export type RclDiagnostic = {
  code?: string;
  severity?: "info" | "warning" | "error" | string;
  message: string;
  line?: number;
  column?: number;
};

export type RclCheckResult = {
  ok: boolean;
  command: "check";
  file?: string;
  compiler?: string;
  authenticity?: string;
  boundary?: string;
  diagnostics: RclDiagnostic[];
  summary?: string;
};

export type RclMcpToolResult<T = unknown> = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent: T;
};
