#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRclControlPlane, verifyLegacyManifestParity } from './index.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(packageRoot, '../../..');
const artifactDir = path.join(packageRoot, 'evidence', 'latest');
const result = buildRclControlPlane({ artifactDir });
const parity = verifyLegacyManifestParity(repoRoot);
console.log(JSON.stringify({
  format: result.format,
  stage: result.stage,
  modules: result.modules,
  allReady: result.allReady,
  allDeterministic: result.allDeterministic,
  allReferenceParity: result.allReferenceParity,
  stateRoot: result.stateRoot,
  edgeCount: result.edges.length,
  manifestParity: parity.passed,
  artifactDir,
}, null, 2));
