import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_NATIVE_DAEMON_PATH = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvmd.exe' : 'rclvmd');

export class EmbeddedNativeVm {
  constructor(bytecodeOrPath, options = {}) {
    this.daemonPath = options.daemonPath ?? DEFAULT_NATIVE_DAEMON_PATH;
    this.tempDir = null;
    this.pending = [];
    if (Buffer.isBuffer(bytecodeOrPath) || bytecodeOrPath instanceof Uint8Array) {
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-embedded-'));
      this.bytecodePath = path.join(this.tempDir, 'program.rbc');
      fs.writeFileSync(this.bytecodePath, bytecodeOrPath);
    } else this.bytecodePath = bytecodeOrPath;
    if (!fs.existsSync(this.daemonPath)) throw new Error(`RCL daemon missing at ${this.daemonPath}`);
    this.process = spawn(this.daemonPath, [this.bytecodePath], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.stderr = '';
    this.process.stderr.on('data', chunk => { this.stderr += chunk.toString(); });
    this.lines = readline.createInterface({ input: this.process.stdout });
    this.lines.on('line', line => {
      const waiter = this.pending.shift();
      if (!waiter) return;
      try { waiter.resolve(JSON.parse(line)); } catch (error) { waiter.reject(error); }
    });
    this.process.on('exit', code => {
      while (this.pending.length) this.pending.shift().reject(new Error(`RCL daemon exited with ${code}: ${this.stderr}`));
    });
    this.ready = this.#next();
  }

  #next() { return new Promise((resolve, reject) => this.pending.push({ resolve, reject })); }
  async #command(command) {
    await this.ready;
    const response = this.#next();
    this.process.stdin.write(`${command}\n`);
    return response;
  }
  async run({ resetState = false } = {}) { return this.#command(resetState ? 'RUN_RESET' : 'RUN'); }
  async reset() { return this.#command('RESET'); }
  async close() {
    if (!this.process.killed) { this.process.stdin.write('QUIT\n'); this.process.stdin.end(); }
    await new Promise(resolve => this.process.once('exit', resolve));
    this.lines.close();
    if (this.tempDir) fs.rmSync(this.tempDir, { recursive: true, force: true });
  }
}
