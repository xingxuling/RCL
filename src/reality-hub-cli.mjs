#!/usr/bin/env node
import { tryCompileReality } from './index.mjs';
import { checkSourceFile, printPublicHelp, printVersion, runDoctor } from './cli-contract.mjs';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'lsp-rename-preview') {
  const { writeFacetRenamePreview } = await import('./lsp-dap-bridge-runtime.mjs');
  let result;
  if (![5, 7].includes(args.length) || (args.length === 7 && (args[5] !== '--types' || !args[6] || args[6].startsWith('--'))) || args.slice(1, 5).some(value => !value || value.startsWith('--'))) {
    result = { ok: false, code: 'RCL_LSP_RENAME_ARGUMENT_INVALID' };
  } else {
    try { result = writeFacetRenamePreview(args[1], args[2], args[3], args[4], { typePath: args[6] }); }
    catch (error) { result = { ok: false, code: error.code ?? 'RCL_LSP_RENAME_EXPORT_FAILED', message: error.message }; }
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'portable-run') {
  const { runPortableCli } = await import('./portable-cli.mjs');
  const result = runPortableCli(args.slice(1));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'session') {
  const { runSessionCli } = await import('./session-cli.mjs');
  const result = await runSessionCli(args.slice(1));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok === false ? 1 : 0);
}

if (command === '--version' || command === '-v') {
  printVersion();
  process.exit(0);
}

if (command === 'version') {
  printVersion({ json: args.includes('--json') });
  process.exit(0);
}

if (command === 'doctor') {
  const result = runDoctor();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'check') {
  const result = checkSourceFile(args[1], tryCompileReality);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === '--help' || command === '-h' || command === 'help' || command === undefined) {
  printPublicHelp();
  process.exit(0);
}

await import('./cli.mjs');
