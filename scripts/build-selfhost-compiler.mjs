#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapSelfHostedCompiler } from '../src/selfhost-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const reportPath = path.join(outputDir, 'compiler-fixed-point.json');

try {
  const result = bootstrapSelfHostedCompiler();
  const report = {
    ...result,
    outputPath: path.relative(root, result.outputPath).replaceAll(path.sep, '/'),
    native: {
      c0ToC1: {
        status: result.native.c0ToC1.status,
        bytes: result.native.c0ToC1.bytes,
        peakStackDepth: result.native.c0ToC1.peakStackDepth,
        peakCallFrames: result.native.c0ToC1.peakCallFrames,
      },
      c1ToC2: {
        status: result.native.c1ToC2.status,
        bytes: result.native.c1ToC2.bytes,
        peakStackDepth: result.native.c1ToC2.peakStackDepth,
        peakCallFrames: result.native.c1ToC2.peakCallFrames,
      },
    },
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = {
    ok: false,
    format: 'rcl.selfhost.compiler.fixed-point.v1',
    code: error.code ?? 'RCL_SELFHOST_BUILD_FAILED',
    message: error.message,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
