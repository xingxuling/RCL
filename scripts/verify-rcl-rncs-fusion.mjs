#!/usr/bin/env node
import { writeRclRncsFusionReports } from '../src/rncs-rcl-fusion.mjs';

const outputDir = process.argv[2] ?? 'output/v0.94/rncs-rcl-fusion';
const fusion = writeRclRncsFusionReports(outputDir);

console.log(JSON.stringify({
  ok: fusion.ok,
  outputDir: fusion.outputDir,
  controlPlane: fusion.result.controlPlane,
  rclModuleCount: fusion.result.rclModuleCount,
  semanticModuleCount: fusion.result.semanticModuleCount,
  edgeCount: fusion.result.edgeCount,
  allReady: fusion.result.allReady,
  allDeterministic: fusion.result.allDeterministic,
  allReferenceParity: fusion.result.allReferenceParity,
  runtimeBundleReady: fusion.result.runtimeBundle.ready,
  evidenceCurrent: fusion.result.evidenceSummary.current,
  availableEdgeEvidenceParity: fusion.result.evidenceSummary.availableEdgeEvidenceParity,
  missingEdgeEvidence: fusion.result.evidenceSummary.missingEdgeEvidence,
  runtimeBundleEvidenceParity: fusion.result.evidenceSummary.runtimeBundleEvidenceParity,
  artifacts: fusion.artifacts,
}, null, 2));

if (!fusion.ok) process.exitCode = 1;
