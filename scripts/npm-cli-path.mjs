import fs from 'node:fs';
import path from 'node:path';

export function resolveNpmCli() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js'),
    path.resolve(nodeDir, '../share/nodejs/npm/bin/npm-cli.js'),
  ];
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    candidates.push(path.join(directory, 'node_modules/npm/bin/npm-cli.js'));
    const npm = path.join(directory, 'npm');
    try { candidates.push(fs.realpathSync(npm)); } catch { /* Not every PATH entry contains npm. */ }
  }
  const cli = candidates.find(candidate => candidate && /(?:npm-cli\.js|npm\.js)$/u.test(candidate) && fs.existsSync(candidate));
  if (!cli) throw new Error('RCL_NPM_CLI_MISSING: npm CLI could not be resolved without a shell');
  return cli;
}
