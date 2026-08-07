#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { promoteAllRbc13DomainOrgans } from '../src/rbc13-domain-native-promotion.mjs';

const output = path.resolve(
  process.argv[2]
    ?? `output/rbc13-domain-native-promotion/report-${new Date().toISOString().replaceAll(':', '-')}.json`,
);

const suite = await promoteAllRbc13DomainOrgans({
  repeats: 3,
  nativeRepeats: 3,
  timeoutMs: 5_000,
  differentialTimeout: 60_000,
  runTimeout: 30_000,
  buildTimeout: 120_000,
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(suite, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  output,
  status: suite.status,
  verified: suite.verified,
  root: suite.root ?? null,
  reportRoots: suite.reportRoots ?? [],
}, null, 2)}\n`);

if (!suite.verified) process.exitCode = 2;
