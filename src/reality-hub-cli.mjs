#!/usr/bin/env node
import { tryCompileReality } from './index.mjs';
import { checkSourceFile, printPublicHelp, printVersion, runDoctor } from './cli-contract.mjs';

const args = process.argv.slice(2);
const command = args[0];

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
