#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SELFHOST_SOURCE_TRUTH_MODULES } from '../src/selfhost-source-truth-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'selfhost/rcl-source-selfhost-stage0.rcl');
let source = fs.readFileSync(target, 'utf8');
for (const [, relative, facet] of SELFHOST_SOURCE_TRUTH_MODULES) {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  const line = '  facet ' + facet + ' : Text = "' + hash + '"';
  const pattern = new RegExp('^  facet ' + facet.replaceAll('.', '\\.') + ' : Text = "[0-9a-f]+"$', 'mu');
  if (pattern.test(source)) source = source.replace(pattern, line);
  else source = source.replace('  facet source.core_module_count', line + '\n\n  facet source.core_module_count');
}
for (const facet of ['core_module_count', 'js_reference_runtime_count']) {
  source = source.replace(new RegExp('(facet source\\.' + facet + ' : Number = )\\d+', 'u'), (_, prefix) => prefix + SELFHOST_SOURCE_TRUTH_MODULES.length);
  source = source.replace(new RegExp('(source\\.' + facet + ' == )\\d+', 'gu'), (_, prefix) => prefix + SELFHOST_SOURCE_TRUTH_MODULES.length);
}
fs.writeFileSync(target, source);
console.log(JSON.stringify({ ok: true, file: 'selfhost/rcl-source-selfhost-stage0.rcl', boundModules: SELFHOST_SOURCE_TRUTH_MODULES.length }));
