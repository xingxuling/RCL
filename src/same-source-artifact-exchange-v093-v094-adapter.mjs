
// Merge-ready adapter for canonical xingxuling/RCL.
// This file intentionally reuses v0.94 autonomous VFS discovery/emission
// and v0.93 deterministic file transmission instead of replacing them.

import {
  runAutonomousSandboxFileEmissionProtocol,
} from './autonomous-sandbox-file-emission-protocol.mjs';

import {
  runSandboxComputerFileTransmissionProtocol,
} from './sandbox-computer-file-transmission-protocol.mjs';

export function runV093V094ArtifactCompatibilityProbe({
  senderInstanceId = 'instance:A',
  receiverInstanceId = 'instance:B',
  files = [],
} = {}) {
  const vfs = {
    root: `rcl://same-source/${senderInstanceId}`,
    source: 'same_source_instance_virtual_artifact_store',
    files: files.map((file, index) => ({
      id: file.id ?? `artifact_${index}`,
      virtualPath: file.virtualPath ?? `/vfs/${senderInstanceId}/artifact-${index}`,
      mime: file.mime ?? 'text/plain',
      visible: file.visible ?? true,
      content: String(file.content ?? ''),
    })),
  };

  const emission = runAutonomousSandboxFileEmissionProtocol({
    id: `same_source_autonomous_emission_${senderInstanceId}`,
    virtualFs: vfs,
    thresholds: {
      hashPassRate: 1,
      autonomousSelectionRate: 1,
      allVisibleFilesTransmitted: true,
      manualPreselectionCount: 0,
      leakageScore: 0,
      negativeControlPassRate: 0,
      renameInvariantMin: 0.995,
      continuousStepsMin: 1,
      decodedFileMin: Math.max(1, files.length),
      semanticTranslationMin: 0,
    },
  });

  const transferFiles = files.map((file, index) => ({
    id: file.id ?? `artifact_${index}`,
    mode: 'lossless',
    role: 'same_source_artifact_exchange',
    displayName: `artifact-${index}.payload`,
    mime: file.mime ?? 'text/plain',
    content: String(file.content ?? ''),
  }));

  const transmission = runSandboxComputerFileTransmissionProtocol({
    id: `same_source_transfer_${senderInstanceId}_to_${receiverInstanceId}`,
    files: transferFiles,
    thresholds: {
      losslessHashPassRate: 1,
      semanticAnchorScore: 0,
      symbolicProtocolScore: 0,
      leakageScore: 0,
      negativeControlPassRate: 0,
      renameInvariantMin: 0.995,
      continuousStepsMin: 1,
    },
  });

  return {
    ok: emission.ok && transmission.ok,
    senderInstanceId,
    receiverInstanceId,
    v094AutonomousEmission: {
      ok: emission.ok,
      selectedFileCount: emission.result.judge.selectedFileCount,
      hashPassRate: emission.result.judge.hashPassRate,
      canonicalRoot: emission.result.canonicalRoot,
    },
    v093Transmission: {
      ok: transmission.ok,
      losslessHashPassRate: transmission.result.judge.losslessHashPassRate,
      canonicalRoot: transmission.result.canonicalRoot,
    },
  };
}
