#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRbc13DomainVmWithPublicApi } from './materialize-rbc13-domain-vm-public-api.mjs';

/**
 * Compatibility entrypoint: structured semantic-error forwarding is now part
 * of the public candidate VM materializer itself.
 */
export function materializeRbc13DomainVmWithSemanticErrors(sourceText) {
  return materializeRbc13DomainVmWithPublicApi(sourceText);
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const input = path.resolve(process.argv[2] ?? 'native/rclvm.c');
  const output = path.resolve(process.argv[3] ?? 'output/rbc13-domain-vm/rclvm-rbc13-domain-semantic-error-candidate.c');
  const candidate = materializeRbc13DomainVmWithSemanticErrors(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, candidate);
  process.stdout.write(`${output}\n`);
}
