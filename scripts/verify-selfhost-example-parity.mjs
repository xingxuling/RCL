#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH,
  compileSourceSelfHosted,
  readSelfHostedCompilerSource,
} from '../src/selfhost-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'example-parity.json');
const examplesRoot = path.join(root, 'examples');

function collectRclFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectRclFiles(target, output);
    else if (entry.isFile() && entry.name.endsWith('.rcl')) output.push(target);
  }
  return output;
}

const eligible = [];
const unsupported = [];
const failures = [];
const bootstrapArtifact = Buffer.from(compileRealityToBytecode(readSelfHostedCompilerSource()));
const checkedArtifact = fs.existsSync(DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH)
  ? fs.readFileSync(DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH)
  : null;
const artifactParity = Boolean(checkedArtifact?.equals(bootstrapArtifact));
if (!artifactParity) {
  failures.push({
    file: 'selfhost/compiler.rbc',
    code: 'RCL_SELFHOST_ARTIFACT_PARITY_REQUIRED',
    referenceBytes: bootstrapArtifact.length,
    selfHostedBytes: checkedArtifact?.length ?? 0,
  });
}

for (const filePath of collectRclFiles(examplesRoot).sort()) {
  const relative = path.relative(root, filePath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(filePath, 'utf8');
  let reference;
  try {
    reference = Buffer.from(compileRealityToBytecode(source));
  } catch (error) {
    unsupported.push({ file: relative, code: error.code ?? 'RCL_REFERENCE_REJECTED', message: error.message });
    continue;
  }

  try {
    const selfHosted = Buffer.from(compileSourceSelfHosted(source));
    if (!selfHosted.equals(reference)) {
      failures.push({ file: relative, code: 'RCL_SELFHOST_BYTE_MISMATCH', referenceBytes: reference.length, selfHostedBytes: selfHosted.length });
    } else {
      eligible.push({ file: relative, bytes: selfHosted.length });
    }
  } catch (error) {
    failures.push({ file: relative, code: error.code ?? 'RCL_SELFHOST_COMPILE_FAILED', message: error.message });
  }
}

const report = {
  ok: failures.length === 0,
  format: 'rcl.selfhost.example-parity.v1',
  artifactParity,
  eligibleCount: eligible.length,
  unsupportedCount: unsupported.length,
  failureCount: failures.length,
  eligible,
  unsupported,
  failures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
