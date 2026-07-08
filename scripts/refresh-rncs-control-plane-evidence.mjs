#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  BUNDLED_RNCS_CONTROL_PLANE_DIR,
  RNCS_CONTROL_PLANE_EDGES,
  runRclRncsFusion,
} from '../src/rncs-rcl-fusion.mjs';

const controlPlaneDir = path.resolve(process.argv[2] ?? BUNDLED_RNCS_CONTROL_PLANE_DIR);
const evidenceDir = path.join(controlPlaneDir, 'evidence', 'latest');
const fusion = runRclRncsFusion({ controlPlaneDir });

fs.mkdirSync(evidenceDir, { recursive: true });

for (const edge of fusion.result.edges) {
  fs.writeFileSync(path.join(evidenceDir, `${edge.from}-${edge.to}.rbc`), edge.targetBytecode);
}
fs.writeFileSync(path.join(evidenceDir, 'runtime-bundle.rbc'), fusion.result.runtimeBundle.targetBytecode);

const controlPlane = {
  format: 'rncs.rcl-control-plane.v0.2',
  stage: 'embedded-aot-authority-mirror',
  modules: fusion.result.modules,
  edges: fusion.result.edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    targetHash: edge.targetHash,
    targetState: edge.targetState,
    dependencyState: edge.dependencyState,
    moduleState: edge.moduleState,
    deterministic: edge.deterministic,
    referenceParity: edge.referenceParity,
    irCount: edge.irCount,
    byteLength: edge.byteLength,
    compilerVm: edge.compilerVm,
  })),
  state: fusion.result.state,
  allReady: fusion.result.allReady,
  allDeterministic: fusion.result.edges.every(edge => edge.deterministic),
  allReferenceParity: fusion.result.edges.every(edge => edge.referenceParity),
  stateRoot: fusion.result.stateRoot,
  runtimeBundle: {
    targetHash: fusion.result.runtimeBundle.targetHash,
    byteLength: fusion.result.runtimeBundle.byteLength,
    targetState: fusion.result.runtimeBundle.targetState,
    deterministic: fusion.result.runtimeBundle.deterministic,
    referenceParity: fusion.result.runtimeBundle.referenceParity,
  },
};

fs.writeFileSync(path.join(evidenceDir, 'control-plane.json'), `${JSON.stringify(controlPlane, null, 2)}\n`);

const refreshed = runRclRncsFusion({ controlPlaneDir });
console.log(JSON.stringify({
  ok: refreshed.ok,
  controlPlaneDir,
  expectedEdges: RNCS_CONTROL_PLANE_EDGES.length,
  refreshedEdges: controlPlane.edges.length,
  evidenceCurrent: refreshed.result.evidenceSummary.current,
  allReady: refreshed.result.allReady,
  allDeterministic: refreshed.result.allDeterministic,
  allReferenceParity: refreshed.result.allReferenceParity,
  runtimeBundleEvidenceParity: refreshed.result.evidenceSummary.runtimeBundleEvidenceParity,
  controlPlaneJsonParity: refreshed.result.evidenceSummary.controlPlaneJsonParity,
}, null, 2));

if (!refreshed.ok || !refreshed.result.evidenceSummary.current) process.exitCode = 1;
