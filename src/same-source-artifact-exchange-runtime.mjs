
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_VERSION = '0.96.0-alpha.2';
export const RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_SPEC_FORMAT = 'rcl.same-source-artifact-exchange.spec.v0.96';
export const RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_RESULT_FORMAT = 'rcl.same-source-artifact-exchange.result.v0.96';
export const RCL_SAME_SOURCE_ARTIFACT_ROOT_ALGORITHM = 'rcl.same-source.artifact-root.sha256.v0.2';

function sha256(value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  return crypto.createHash('sha256').update(body).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function artifactRootBinding(artifact) {
  return {
    algorithm: RCL_SAME_SOURCE_ARTIFACT_ROOT_ALGORITHM,
    format: artifact?.format ?? null,
    artifactId: artifact?.artifactId ?? null,
    producerInstanceId: artifact?.producerInstanceId ?? null,
    coreId: artifact?.coreId ?? null,
    lineageRoot: artifact?.lineageRoot ?? null,
    epoch: artifact?.epoch ?? null,
    kind: artifact?.kind ?? null,
    mime: artifact?.mime ?? null,
    virtualPath: artifact?.virtualPath ?? null,
    visible: artifact?.visible ?? null,
    parentRoot: artifact?.parentRoot ?? null,
    bodyHash: artifact?.bodyHash ?? null,
    claims: artifact?.claims ?? null,
    authorityScope: artifact?.authorityScope ?? null,
  };
}

export function artifactRootFor(artifact) {
  return sha256(canonicalJson(artifactRootBinding(artifact)));
}


function hashUnit(seed) {
  return Number.parseInt(sha256(seed).slice(0, 13), 16) / 0x1fffffffffffff;
}

function pick(seed, values) {
  return values[Math.floor(hashUnit(seed) * values.length) % values.length];
}

function shuffle(seed, values) {
  return [...values]
    .map((value, index) => ({ value, rank: sha256(`${seed}:${index}:${canonicalJson(value)}`) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(row => row.value);
}

const AXES = Object.freeze({
  topology: ['containment_interface', 'parallel_branch', 'hierarchical_tree', 'mesh_federation'],
  channel: ['shared_substrate', 'message_bus', 'memory_bridge', 'causal_link'],
  continuity: ['core_shared_instances', 'episodic_copy', 'independent_agents', 'forked_lineage'],
  memory: ['shared_state', 'distilled_state', 'episodic_log', 'local_only'],
  role: ['translator', 'observer', 'builder', 'governor'],
  protocol: ['sel_cel_hybrid', 'typed_packets', 'artifact_ledger', 'state_diff'],
});

function buildModel(seed) {
  return Object.fromEntries(Object.entries(AXES).map(([axis, values]) => [axis, pick(`${seed}:${axis}`, values)]));
}

function instanceId(realmPrefix, seed40, index) {
  const local = BigInt(seed40) ^ BigInt(`0x${sha256(`instance:${index}`).slice(0, 10)}`);
  const clipped = local & ((1n << 40n) - 1n);
  return `${realmPrefix}:${clipped.toString(16).padStart(10, '0').toUpperCase()}`;
}

export function buildSameSourceArtifactExchangeSpec(input = {}) {
  return {
    format: RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_SPEC_FORMAT,
    version: RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_VERSION,
    id: input.id ?? 'same_source_artifact_exchange_v096',
    boundary: input.boundary ?? 'sandbox_multi_instance_artifact_exchange_not_external_universe_proof',
    coreId: input.coreId ?? 'core:ssp:AAB8A4',
    realmPrefix: input.realmPrefix ?? 'AA-B8-A4',
    instanceSeed40: input.instanceSeed40 ?? '0x809AEF1D05',
    seed: Number(input.seed ?? 20260913),
    instanceCount: Number(input.instanceCount ?? 128),
    epochs: Number(input.epochs ?? 8),
    fanout: Number(input.fanout ?? 4),
    artifactKinds: input.artifactKinds ?? ['state-snapshot', 'model-delta', 'evidence-note'],
    chunkBytes: Number(input.chunkBytes ?? 96),
    thresholds: {
      minDeliveryRate: input.thresholds?.minDeliveryRate ?? 1,
      minIntegrityRate: input.thresholds?.minIntegrityRate ?? 1,
      minCrossCoreRejectRate: input.thresholds?.minCrossCoreRejectRate ?? 1,
      minTamperRejectRate: input.thresholds?.minTamperRejectRate ?? 1,
      minReplayRejectRate: input.thresholds?.minReplayRejectRate ?? 1,
      minArtifactRootRejectRate: input.thresholds?.minArtifactRootRejectRate ?? 1,
      minSenderProvenanceRejectRate: input.thresholds?.minSenderProvenanceRejectRate ?? 1,
      minChunkIntegrityRejectRate: input.thresholds?.minChunkIntegrityRejectRate ?? 1,
      minConvergenceGain: input.thresholds?.minConvergenceGain ?? 0.05,
    },
    guards: {
      noNetwork: true,
      noHostFilesystemAccess: true,
      noExternalUniverseProof: true,
      requireSameCore: true,
      requireArtifactHash: true,
      requireLineage: true,
      requireSenderProvenance: true,
      requireChunkHash: true,
      rejectReplay: true,
      ...(input.guards ?? {}),
    },
  };
}

export function createInstances(specInput = {}) {
  const spec = buildSameSourceArtifactExchangeSpec(specInput);
  const seed40 = BigInt(spec.instanceSeed40);
  return Array.from({ length: spec.instanceCount }, (_, index) => {
    const id = instanceId(spec.realmPrefix, seed40, index);
    const birthState = buildModel(`${spec.seed}:${id}:birth`);
    const birthStateRoot = sha256(canonicalJson(birthState));
    return {
      id,
      coreId: spec.coreId,
      index,
      epoch: 0,
      birthState,
      birthStateRoot,
      lineageRoot: sha256(`${spec.coreId}:${id}:${birthStateRoot}`),
      state: { ...birthState },
      stateRoot: birthStateRoot,
      vfs: [],
      inbox: [],
      seenArtifactIds: new Set(),
      acceptedArtifacts: 0,
      rejectedArtifacts: 0,
    };
  });
}

export function buildSparseEdges(instances, specInput = {}) {
  const spec = buildSameSourceArtifactExchangeSpec({ ...specInput, instanceCount: instances.length });
  const edges = [];
  const n = instances.length;
  for (const sender of instances) {
    const targets = new Set();
    for (let k = 1; k <= spec.fanout; k += 1) {
      const offset = 1 + (Number.parseInt(sha256(`${spec.seed}:${sender.id}:edge:${k}`).slice(0, 8), 16) % Math.max(1, n - 1));
      const targetIndex = (sender.index + offset) % n;
      if (targetIndex !== sender.index) targets.add(targetIndex);
    }
    for (const targetIndex of targets) edges.push({ from: sender.index, to: targetIndex });
  }
  return edges;
}

function artifactBody(instance, kind, epoch) {
  if (kind === 'state-snapshot') {
    return JSON.stringify({
      type: kind,
      producer: instance.id,
      epoch,
      coreId: instance.coreId,
      lineageRoot: instance.lineageRoot,
      state: instance.state,
      stateRoot: instance.stateRoot,
    }, null, 2);
  }
  if (kind === 'model-delta') {
    return Object.entries(instance.state).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  }
  return [
    '# Evidence Note',
    `producer=${instance.id}`,
    `core=${instance.coreId}`,
    `epoch=${epoch}`,
    `stateRoot=${instance.stateRoot}`,
    `lineageRoot=${instance.lineageRoot}`,
  ].join('\n') + '\n';
}

export function generateArtifacts(instance, specInput = {}, epoch = instance.epoch) {
  const spec = buildSameSourceArtifactExchangeSpec(specInput);
  const artifacts = spec.artifactKinds.map((kind, index) => {
    const body = artifactBody(instance, kind, epoch);
    const bodyHash = sha256(body);
    const parentRoot = instance.vfs.length ? instance.vfs.at(-1).artifactRoot : instance.birthStateRoot;
    const artifact = {
      format: 'rcl.same-source.artifact.v0.96',
      artifactId: `artifact_${sha256(`${instance.id}:${epoch}:${kind}:${bodyHash}`).slice(0, 20)}`,
      producerInstanceId: instance.id,
      coreId: instance.coreId,
      lineageRoot: instance.lineageRoot,
      epoch,
      kind,
      mime: kind === 'state-snapshot' ? 'application/json' : 'text/plain',
      virtualPath: `/vfs/${instance.id.replaceAll(':','_')}/epoch-${epoch}/${index}-${kind}`,
      visible: true,
      parentRoot,
      body,
      bodyHash,
      claims: { ...instance.state },
      authorityScope: 'sandbox-artifact-only',
      artifactRootAlgorithm: RCL_SAME_SOURCE_ARTIFACT_ROOT_ALGORITHM,
    };
    artifact.artifactRoot = artifactRootFor(artifact);
    return artifact;
  });
  instance.vfs.push(...artifacts);
  return artifacts;
}

export function autonomousDiscoverArtifacts(instance) {
  return instance.vfs
    .filter(artifact => artifact.visible)
    .map(artifact => ({
      ...artifact,
      selectedBy: 'AutonomousArtifactScout',
      userPreselected: false,
      salience: Number((0.4 + hashUnit(`salience:${artifact.artifactRoot}`) * 0.6).toFixed(6)),
    }))
    .sort((a, b) => b.salience - a.salience || a.artifactId.localeCompare(b.artifactId));
}

function chunkCompressedArtifact(artifact, chunkBytes) {
  const compressed = zlib.gzipSync(Buffer.from(artifact.body, 'utf8'), { level: 9 });
  const chunks = [];
  for (let offset = 0, seq = 0; offset < compressed.length; offset += chunkBytes, seq += 1) {
    const raw = compressed.subarray(offset, Math.min(compressed.length, offset + chunkBytes));
    chunks.push({
      seq,
      byteLength: raw.length,
      payload: raw.toString('base64'),
      chunkHash: sha256(raw),
    });
  }
  return {
    codec: 'gzip',
    artifactRootAlgorithm: artifact.artifactRootAlgorithm ?? null,
    artifactRoot: artifact.artifactRoot ?? null,
    payloadHash: sha256(compressed),
    originalBodyHash: artifact.bodyHash,
    chunks,
  };
}

function receiveArtifact(receiver, artifact, envelope, spec, controls = {}) {
  if (spec.guards.requireSameCore && artifact.coreId !== receiver.coreId) {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'cross_core_rejected' };
  }
  if (spec.guards.rejectReplay && receiver.seenArtifactIds.has(artifact.artifactId)) {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'replay_rejected' };
  }
  if (spec.guards.requireArtifactHash) {
    if (artifact.artifactRootAlgorithm !== RCL_SAME_SOURCE_ARTIFACT_ROOT_ALGORITHM
      || envelope.artifactRootAlgorithm !== RCL_SAME_SOURCE_ARTIFACT_ROOT_ALGORITHM) {
      receiver.rejectedArtifacts += 1;
      return { accepted: false, reason: 'artifact_root_algorithm_rejected' };
    }
    const expectedArtifactRoot = artifactRootFor(artifact);
    if (artifact.artifactRoot !== expectedArtifactRoot || envelope.artifactRoot !== expectedArtifactRoot) {
      receiver.rejectedArtifacts += 1;
      return { accepted: false, reason: 'artifact_root_mismatch' };
    }
  }
  const ordered = [...envelope.chunks].sort((a, b) => a.seq - b.seq);
  const chunkBuffers = [];
  if (spec.guards.requireChunkHash) {
    for (let index = 0; index < ordered.length; index += 1) {
      const chunk = ordered[index];
      const raw = Buffer.from(chunk?.payload ?? '', 'base64');
      const valid = Number.isInteger(chunk?.seq)
        && chunk.seq === index
        && Number.isInteger(chunk?.byteLength)
        && chunk.byteLength === raw.length
        && typeof chunk?.chunkHash === 'string'
        && chunk.chunkHash === sha256(raw);
      if (!valid) {
        receiver.rejectedArtifacts += 1;
        return { accepted: false, reason: 'chunk_integrity_mismatch' };
      }
      chunkBuffers.push(raw);
    }
  }
  const compressed = Buffer.concat(spec.guards.requireChunkHash
    ? chunkBuffers
    : ordered.map(c => Buffer.from(c.payload, 'base64')));
  if (sha256(compressed) !== envelope.payloadHash) {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'payload_hash_mismatch' };
  }
  let body;
  try {
    body = zlib.gunzipSync(compressed).toString('utf8');
  } catch {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'decompression_failed' };
  }
  if (sha256(body) !== artifact.bodyHash || artifact.bodyHash !== envelope.originalBodyHash) {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'body_hash_mismatch' };
  }
  if (spec.guards.requireLineage && !artifact.lineageRoot) {
    receiver.rejectedArtifacts += 1;
    return { accepted: false, reason: 'missing_lineage' };
  }
  receiver.seenArtifactIds.add(artifact.artifactId);
  receiver.inbox.push({
    artifactId: artifact.artifactId,
    artifactRoot: artifact.artifactRoot,
    artifactRootAlgorithm: artifact.artifactRootAlgorithm,
    producerInstanceId: artifact.producerInstanceId,
    coreId: artifact.coreId,
    lineageRoot: artifact.lineageRoot,
    epoch: artifact.epoch,
    kind: artifact.kind,
    claims: { ...artifact.claims },
    bodyHash: artifact.bodyHash,
    authorityScope: artifact.authorityScope,
  });
  receiver.acceptedArtifacts += 1;
  return { accepted: true, reason: 'accepted' };
}

export function transmitArtifact(sender, receiver, artifact, specInput = {}, options = {}) {
  const spec = buildSameSourceArtifactExchangeSpec(specInput);
  if (spec.guards.requireSenderProvenance) {
    const senderOwnsArtifact = artifact?.producerInstanceId === sender?.id
      && artifact?.coreId === sender?.coreId
      && Array.isArray(sender?.vfs)
      && sender.vfs.some(row => row?.artifactId === artifact?.artifactId
        && row?.artifactRoot === artifact?.artifactRoot
        && row?.bodyHash === artifact?.bodyHash
        && row?.producerInstanceId === sender?.id);
    if (!senderOwnsArtifact) {
      receiver.rejectedArtifacts += 1;
      return { accepted: false, reason: 'sender_provenance_rejected' };
    }
  }
  const envelope = chunkCompressedArtifact(artifact, spec.chunkBytes);
  envelope.chunks = shuffle(`${spec.seed}:${sender.id}:${receiver.id}:${artifact.artifactId}`, envelope.chunks);
  if (options.tamper === true && envelope.chunks.length) {
    const first = envelope.chunks[0];
    first.payload = Buffer.from('tampered-artifact').toString('base64');
  }
  if (options.tamperChunkHash === true && envelope.chunks.length) {
    envelope.chunks[0].chunkHash = '0'.repeat(64);
  }
  return receiveArtifact(receiver, artifact, envelope, spec, options);
}

function majority(values, seed) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || sha256(`${seed}:${a[0]}`).localeCompare(sha256(`${seed}:${b[0]}`)))[0]?.[0];
}

export function mergeInboxIntoState(instance, epoch) {
  if (!instance.inbox.length) return { changed: false, stateRoot: instance.stateRoot };
  const next = { ...instance.state };
  for (const axis of Object.keys(AXES)) {
    const incoming = instance.inbox.map(item => item.claims?.[axis]).filter(Boolean);
    next[axis] = majority([instance.state[axis], ...incoming], `${instance.id}:${epoch}:${axis}`);
  }
  const changed = canonicalJson(next) !== canonicalJson(instance.state);
  instance.state = next;
  instance.stateRoot = sha256(canonicalJson(next));
  instance.epoch = epoch;
  instance.inbox = [];
  return { changed, stateRoot: instance.stateRoot };
}

export function convergenceScore(instances) {
  const axes = Object.keys(AXES);
  const scores = axes.map(axis => {
    const counts = new Map();
    for (const instance of instances) counts.set(instance.state[axis], (counts.get(instance.state[axis]) ?? 0) + 1);
    const max = Math.max(...counts.values());
    return max / instances.length;
  });
  return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(6));
}

export function runArtifactExchangeControls(specInput = {}) {
  const spec = buildSameSourceArtifactExchangeSpec({ ...specInput, instanceCount: 2, epochs: 1 });
  const [a, b] = createInstances(spec);
  const [artifact] = generateArtifacts(a, spec, 1);

  const tamper = transmitArtifact(a, b, artifact, spec, { tamper: true });
  const tamperRejected = tamper.accepted === false;

  const chunkTamper = transmitArtifact(a, b, artifact, spec, { tamperChunkHash: true });
  const chunkIntegrityRejected = chunkTamper.reason === 'chunk_integrity_mismatch';

  const metadataTampered = {
    ...artifact,
    claims: { ...artifact.claims, role: artifact.claims?.role === 'governor' ? 'observer' : 'governor' },
  };
  const artifactRootTamper = transmitArtifact(a, b, metadataTampered, spec);
  const artifactRootRejected = artifactRootTamper.reason === 'artifact_root_mismatch';

  const forged = {
    ...artifact,
    artifactId: `${artifact.artifactId}_forged`,
    claims: { ...artifact.claims, role: 'forged-role' },
  };
  forged.artifactRoot = artifactRootFor(forged);
  const senderProvenance = transmitArtifact(a, b, forged, spec);
  const senderProvenanceRejected = senderProvenance.reason === 'sender_provenance_rejected';

  const clean = transmitArtifact(a, b, artifact, spec);
  const replay = transmitArtifact(a, b, artifact, spec);
  const replayRejected = replay.reason === 'replay_rejected';

  const foreign = { ...artifact, artifactId: `${artifact.artifactId}_foreign`, coreId: 'core:foreign' };
  foreign.artifactRoot = artifactRootFor(foreign);
  const foreignEnvelope = chunkCompressedArtifact(foreign, spec.chunkBytes);
  const crossCore = receiveArtifact(b, foreign, foreignEnvelope, spec);
  const crossCoreRejected = crossCore.reason === 'cross_core_rejected';

  return {
    tamperRejected,
    chunkIntegrityRejected,
    artifactRootRejected,
    senderProvenanceRejected,
    replayRejected,
    crossCoreRejected,
    cleanAccepted: clean.accepted,
  };
}

export function runSameSourceArtifactExchange(input = {}) {
  const spec = buildSameSourceArtifactExchangeSpec(input);
  const instances = createInstances(spec);
  const edges = buildSparseEdges(instances, spec);
  const initialConvergence = convergenceScore(instances);

  let transferAttemptCount = 0;
  let transferAcceptedCount = 0;
  const epochRows = [];

  for (let epoch = 1; epoch <= spec.epochs; epoch += 1) {
    const generated = new Map();
    for (const instance of instances) {
      generated.set(instance.index, autonomousDiscoverArtifacts({
        ...instance,
        vfs: generateArtifacts(instance, spec, epoch),
      }));
    }

    for (const edge of edges) {
      const sender = instances[edge.from];
      const receiver = instances[edge.to];
      const selected = generated.get(sender.index)?.[0];
      if (!selected) continue;
      transferAttemptCount += 1;
      const receipt = transmitArtifact(sender, receiver, selected, spec);
      if (receipt.accepted) transferAcceptedCount += 1;
    }

    let changedCount = 0;
    for (const instance of instances) {
      if (mergeInboxIntoState(instance, epoch).changed) changedCount += 1;
    }

    epochRows.push({
      epoch,
      convergence: convergenceScore(instances),
      changedCount,
      totalArtifacts: instances.reduce((sum, row) => sum + row.vfs.length, 0),
    });
  }

  const finalConvergence = convergenceScore(instances);
  const controls = runArtifactExchangeControls(spec);
  const deliveryRate = transferAttemptCount ? transferAcceptedCount / transferAttemptCount : 0;
  const integrityRate = instances.reduce((sum, row) => sum + row.acceptedArtifacts, 0) === transferAcceptedCount ? 1 : 0;

  const judge = {
    deliveryRate: Number(deliveryRate.toFixed(6)),
    integrityRate,
    convergenceGain: Number((finalConvergence - initialConvergence).toFixed(6)),
    controls,
  };
  const pass = judge.deliveryRate >= spec.thresholds.minDeliveryRate
    && judge.integrityRate >= spec.thresholds.minIntegrityRate
    && Number(controls.crossCoreRejected) >= spec.thresholds.minCrossCoreRejectRate
    && Number(controls.tamperRejected) >= spec.thresholds.minTamperRejectRate
    && Number(controls.replayRejected) >= spec.thresholds.minReplayRejectRate
    && Number(controls.artifactRootRejected) >= spec.thresholds.minArtifactRootRejectRate
    && Number(controls.senderProvenanceRejected) >= spec.thresholds.minSenderProvenanceRejectRate
    && Number(controls.chunkIntegrityRejected) >= spec.thresholds.minChunkIntegrityRejectRate
    && judge.convergenceGain >= spec.thresholds.minConvergenceGain;

  const evidence = {
    spec: { ...spec, guards: spec.guards },
    initialConvergence,
    finalConvergence,
    edgeCount: edges.length,
    transferAttemptCount,
    transferAcceptedCount,
    epochRows,
    instanceRoots: instances.slice(0, 16).map(row => ({
      id: row.id,
      lineageRoot: row.lineageRoot,
      stateRoot: row.stateRoot,
      acceptedArtifacts: row.acceptedArtifacts,
      rejectedArtifacts: row.rejectedArtifacts,
    })),
    judge,
  };

  return {
    ok: pass,
    format: RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_RESULT_FORMAT,
    version: RCL_SAME_SOURCE_ARTIFACT_EXCHANGE_VERSION,
    boundary: spec.boundary,
    canClaimExternalUniverseProof: false,
    canClaimIndependentExternalPeer: false,
    artifactExchangeEstablished: true,
    evidence,
    canonicalRoot: sha256(canonicalJson(evidence)),
  };
}
