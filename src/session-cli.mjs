import fs from 'node:fs';
import path from 'node:path';
import { openDurableRealitySession, verifyDurableRealitySession } from './durable-session.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { compileRealitySessionNative } from './session-compiler.mjs';

export async function runSessionCli(args) {
  const [operation, first, second, ...flags] = args;
  try {
    if (operation === 'compile' && first && second) {
      const source = fs.readFileSync(path.resolve(first), 'utf8');
      const compiled = flags.includes('--bootstrap') ? { bytecode: compileRealitySessionBytecode(source), evidence: { compilerOwner: 'JavaScript bootstrap' } }
        : compileRealitySessionNative(source);
      fs.writeFileSync(path.resolve(second), compiled.bytecode, { flag: 'wx' });
      return { ok: true, outputPath: path.resolve(second), bytes: compiled.bytecode.length, ...compiled.evidence };
    }
    if (operation === 'verify' && first) return await verifyDurableRealitySession(first, { verifyReference: [second, ...flags].includes('--reference') });
    if (!['init', 'invoke', 'inspect', 'recover'].includes(operation) || !first || (['init', 'invoke'].includes(operation) && !second)) {
      throw new Error('Usage: rcl session init <source.rcl> <directory> | invoke <directory> <command.json> | inspect <directory> | verify <directory> [--reference] | recover <directory> --repair-incomplete-tail | compile <source.rcl> <output.rbc> [--bootstrap]');
    }
    const options = operation === 'init' ? { source: fs.readFileSync(path.resolve(first), 'utf8') } : { requireExisting: true };
    if (operation === 'recover') {
      if (![second, ...flags].includes('--repair-incomplete-tail')) throw new Error('Recovery requires --repair-incomplete-tail');
      options.repairIncompleteTail = true;
    }
    const directory = operation === 'init' ? second : first;
    const session = await openDurableRealitySession(directory, options);
    try {
      if (operation === 'invoke') return { ok: true, ...await session.invoke(JSON.parse(fs.readFileSync(path.resolve(second), 'utf8'))) };
      return { ok: true, ...session.snapshot() };
    } finally { await session.close(); }
  } catch (error) {
    return { ok: false, status: 'FAIL', code: error.code ?? 'RCL_SESSION_CLI_ERROR', message: error.message, details: error.details ?? null };
  }
}
