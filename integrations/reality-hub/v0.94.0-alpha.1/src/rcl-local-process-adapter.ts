import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RclCheckResult } from "./rcl-adapter-types";

const execFileAsync = promisify(execFile);

type InvokeOptions = {
  timeoutMs?: number;
  maxBuffer?: number;
  acceptedExitCodes?: number[];
};

export class RclLocalProcessAdapter {
  constructor(private readonly executable = "rcl") {}

  private async invoke<T>(args: string[], options: InvokeOptions = {}): Promise<T> {
    try {
      const { stdout } = await execFileAsync(this.executable, args, {
        shell: false,
        timeout: options.timeoutMs ?? 15_000,
        maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
        windowsHide: true,
      });
      return JSON.parse(stdout) as T;
    } catch (error) {
      const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
      const accepted = options.acceptedExitCodes ?? [];
      if (typeof failure.code === "number" && accepted.includes(failure.code) && failure.stdout) {
        return JSON.parse(failure.stdout) as T;
      }
      throw new Error(`RCL process failed: ${failure.stderr || failure.message}`);
    }
  }

  version() {
    return this.invoke(["version", "--json"]);
  }

  doctor() {
    return this.invoke(["doctor"]);
  }

  check(sourceFile: string) {
    return this.invoke<RclCheckResult>(["check", sourceFile], { acceptedExitCodes: [1] });
  }

  run(sourceFile: string) {
    return this.invoke(["run", sourceFile], { timeoutMs: 60_000 });
  }
}
