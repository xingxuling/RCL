import fs from 'node:fs';
import path from 'node:path';
import { openDurableRealitySession, verifyDurableRealitySession, verifyDurableRealitySessionBackup, verifyDurableRealitySessionHistoryPage, verifyDurableRealitySessionHistoryPages } from './durable-session.mjs';
import { compileRealitySessionBytecode } from './bytecode.mjs';
import { compileRealitySessionNative } from './session-compiler.mjs';
import { sessionError } from './session-contract.mjs';
import { RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from './semantic-state-root.mjs';

const USAGE = 'Usage: rcl session init <source.rcl> <directory> | invoke <directory> <command.json> | inspect <directory> | history <directory> [--from-revision <integer>] [--limit <1..1000>] | history-verify <page-or-pages.json> [--expected-root <sha256>] [--expected-page-root <sha256>] [--expected-previous-root <sha256>] | verify <directory> [--reference] | backup <directory> <new-directory> | backup-verify <directory> [--expected-backup-root <sha256>] | checkpoint <directory> <new-directory> --expected-root <sha256> | recover <directory> --repair-incomplete-tail | compile <source.rcl> <output.rbc> [--bootstrap]. Session commands that execute native replay accept --reject-projected-ast and --state-root-v3-candidate. Existing-session commands accept --expected-root <sha256> and --minimum-revision <integer>. Opening a checkpoint continuation requires --expected-checkpoint-root <sha256>.';

function parseArguments(args) {
  const [operation, ...tokens] = args;
  const counts = { init: 2, invoke: 2, inspect: 1, history: 1, 'history-verify': 1, verify: 1, backup: 2, 'backup-verify': 1, checkpoint: 2, recover: 1, compile: 2 };
  const invalid = message => { throw sessionError('RCL_SESSION_CLI_ARGUMENT_INVALID', `${message}. ${USAGE}`); };
  if (!Object.hasOwn(counts, operation)) invalid('Unknown session operation');
  const count = counts[operation], positional = tokens.slice(0, count);
  if (positional.length !== count || positional.some(value => !value || value.startsWith('--'))) invalid('Missing positional arguments');
  const allowed = operation === 'compile' ? ['--bootstrap'] : operation === 'init' ? ['--reject-projected-ast', '--state-root-v3-candidate']
    : operation === 'history-verify' ? ['--expected-root', '--expected-page-root', '--expected-previous-root', '--expected-checkpoint-root', '--minimum-revision']
    : ['--expected-root', '--expected-checkpoint-root', '--minimum-revision', '--reference', '--reject-projected-ast', '--state-root-v3-candidate', ...(operation === 'history' ? ['--from-revision', '--limit'] : []), ...(operation === 'backup-verify' ? ['--expected-backup-root'] : []), ...(operation === 'recover' ? ['--repair-incomplete-tail'] : [])];
  const options = {}, seen = new Set();
  const flags = tokens.slice(count);
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (!allowed.includes(flag) || seen.has(flag)) invalid(`Unknown, duplicate or inappropriate argument '${flag}'`);
    seen.add(flag);
    if (['--expected-root', '--expected-backup-root', '--expected-page-root', '--expected-previous-root', '--expected-checkpoint-root'].includes(flag)) {
      const value = flags[++index];
      if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) invalid(`${flag} requires a lowercase SHA-256 root`);
      options[{ '--expected-root': 'expectedJournalRoot', '--expected-backup-root': 'expectedBackupRoot', '--expected-page-root': 'expectedPageRoot', '--expected-previous-root': 'expectedPreviousRoot', '--expected-checkpoint-root': 'expectedCheckpointRoot' }[flag]] = value;
    } else if (flag === '--minimum-revision') {
      const value = flags[++index];
      if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value) || !Number.isSafeInteger(Number(value))) invalid('--minimum-revision requires a nonnegative safe integer');
      options.minimumRevision = Number(value);
    } else if (flag === '--from-revision' || flag === '--limit') {
      const value = flags[++index];
      if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value)) || (flag === '--limit' && Number(value) > 1000)) invalid(`${flag} requires a positive safe integer${flag === '--limit' ? ' no greater than 1000' : ''}`);
      options[flag === '--limit' ? 'limit' : 'fromRevision'] = Number(value);
    } else if (flag === '--reference') options.verifyReference = true;
    else if (flag === '--reject-projected-ast') (options.native ??= {}).rejectProjectedAst = true;
    else if (flag === '--state-root-v3-candidate') (options.native ??= {}).stateRootAlgorithm = RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE;
    else if (flag === '--repair-incomplete-tail') options.repairIncompleteTail = true;
    else options.bootstrap = true;
  }
  if (operation === 'recover' && !options.repairIncompleteTail) invalid('Recovery requires --repair-incomplete-tail');
  if (operation === 'checkpoint' && options.expectedJournalRoot === undefined) invalid('Checkpoint export requires --expected-root');
  return { operation, first: positional[0], second: positional[1], options };
}

export async function runSessionCli(args) {
  try {
    // Parse every argument before reading sources, starting a VM or writing files.
    const { operation, first, second, options } = parseArguments(args);
    if (operation === 'history-verify') {
      const file = path.resolve(first), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) throw sessionError('RCL_SESSION_HISTORY_PAGE_FILE_INVALID');
      if (stat.size > 128 * 1024 * 1024) throw sessionError('RCL_SESSION_HISTORY_PAGE_FILE_LIMIT');
      const captured = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)));
      return Array.isArray(captured) ? verifyDurableRealitySessionHistoryPages(captured, options) : verifyDurableRealitySessionHistoryPage(captured, options);
    }
    if (operation === 'compile') {
      const source = fs.readFileSync(path.resolve(first), 'utf8');
      const compiled = options.bootstrap ? { bytecode: compileRealitySessionBytecode(source), evidence: { compilerOwner: 'JavaScript bootstrap' } }
        : compileRealitySessionNative(source);
      fs.writeFileSync(path.resolve(second), compiled.bytecode, { flag: 'wx' });
      return { ok: true, outputPath: path.resolve(second), bytes: compiled.bytecode.length, ...compiled.evidence };
    }
    if (operation === 'verify') return await verifyDurableRealitySession(first, options);
    if (operation === 'backup-verify') return await verifyDurableRealitySessionBackup(first, options);
    if (operation === 'init') options.source = fs.readFileSync(path.resolve(first), 'utf8');
    else options.requireExisting = true;
    const directory = operation === 'init' ? second : first;
    const session = await openDurableRealitySession(directory, options);
    try {
      if (operation === 'history') return { ok: true, ...await session.history({ fromRevision: options.fromRevision, limit: options.limit, expectedJournalRoot: options.expectedJournalRoot }) };
      if (operation === 'backup') return { ok: true, ...await session.backup(second) };
      if (operation === 'checkpoint') return { ok: true, ...await session.checkpoint(second, options.expectedJournalRoot) };
      if (operation === 'invoke') return { ok: true, ...await session.invoke(JSON.parse(fs.readFileSync(path.resolve(second), 'utf8'))) };
      return { ok: true, ...session.snapshot() };
    } finally { await session.close(); }
  } catch (error) {
    return { ok: false, status: 'FAIL', code: error.code ?? 'RCL_SESSION_CLI_ERROR', message: error.message, details: error.details ?? null };
  }
}
