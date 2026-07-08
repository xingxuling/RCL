import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveRclRncsControlPlaneDir,
  RCL_RNCS_FUSION_RESULT_FORMAT,
  RNCS_CONTROL_PLANE_EDGES,
  RNCS_SEMANTIC_MODULES,
  writeRclRncsFusionReports,
} from '../src/rncs-rcl-fusion.mjs';

test('RCL fuses the RNCS RCL control plane through Stage5 and evidence parity', () => {
  const controlPlaneDir = resolveRclRncsControlPlaneDir();
  assert.ok(
    fs.existsSync(controlPlaneDir),
    `expected RNCS control plane at ${controlPlaneDir}`,
  );

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rncs-fusion-'));
  try {
    const fusion = writeRclRncsFusionReports(outputDir);
    assert.equal(fusion.ok, true);
    assert.equal(fusion.result.format, RCL_RNCS_FUSION_RESULT_FORMAT);
    assert.equal(fusion.result.controlPlane.id, 'rncs-rcl-control');
    assert.equal(fusion.result.rclModuleCount, 14);
    assert.equal(fusion.result.semanticModuleCount, RNCS_SEMANTIC_MODULES.length);
    assert.equal(fusion.result.edgeCount, RNCS_CONTROL_PLANE_EDGES.length);
    assert.equal(fusion.result.allReady, true);
    assert.equal(fusion.result.allDeterministic, true);
    assert.equal(fusion.result.allReferenceParity, true);
    assert.equal(fusion.result.allEdgeEvidencePresent, true);
    assert.equal(fusion.result.allEdgeEvidenceParity, true);
    assert.equal(fusion.result.evidenceSummary.current, true);
    assert.equal(fusion.result.evidenceSummary.availableEdgeEvidenceCount, RNCS_CONTROL_PLANE_EDGES.length);
    assert.deepEqual(fusion.result.evidenceSummary.missingEdgeEvidence, []);
    assert.equal(fusion.result.evidenceSummary.availableEdgeEvidenceParity, true);
    assert.equal(fusion.result.runtimeBundle.ready, true);
    assert.equal(fusion.result.runtimeBundle.evidence.byteParity, true);
    assert.equal(fusion.result.controlPlaneEvidence.edgeParity, true);
    assert.equal(fusion.result.controlPlaneEvidence.moduleParity, true);
    assert.equal(fusion.result.controlPlaneEvidence.stateRootParity, true);
    assert.match(fusion.rclSurface, /facet fusion\.established : Truth = true/);
    assert.ok(fs.existsSync(fusion.artifacts.result));
    assert.ok(fs.existsSync(fusion.artifacts.modules));
    assert.ok(fs.existsSync(fusion.artifacts.edges));
    assert.ok(fs.existsSync(fusion.artifacts.rclSurface));
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
