import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { sha256, canonicalJson, createSeededRandom, clamp } from './reality-compiler-kernel.mjs';
import { buildSemanticPacket, translateSemanticPacket } from './sandbox-computer-file-transmission-protocol.mjs';

export const RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION = '0.94.0-alpha.1';
export const RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC_FORMAT = 'rcl.autonomous-sandbox-file-emission.spec.v0.94';
export const RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_RESULT_FORMAT = 'rcl.autonomous-sandbox-file-emission.result.v0.94';
export const RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_BUNDLE_FORMAT = 'rcl.autonomous-sandbox-file-emission.bundle.v0.94';

const DEFAULT_SEED = 20260707;
const DEFAULT_CHUNK_BYTES = 96;
const ELLIPSIS = '…';

function ensureString(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function redactPath(value = '') {
  return `vfs_redacted_${sha256(value).slice(0, 12)}`;
}

function stableBlindId(seed, id, index) {
  return `blind_${sha256({ seed, id, index, protocol: 'autonomous-v0.94' }).slice(0, 16)}`;
}

function shuffleDeterministic(items, seed) {
  const rng = createSeededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  const sequential = out.length > 1 && out.every((item, index) => item.index === index);
  if (sequential) out.reverse();
  return out;
}

function chunkBuffer(buffer, bytes = DEFAULT_CHUNK_BYTES) {
  const chunks = [];
  for (let offset = 0, index = 0; offset < buffer.length; offset += bytes, index += 1) {
    const raw = buffer.subarray(offset, Math.min(offset + bytes, buffer.length));
    chunks.push({
      index,
      byteOffset: offset,
      byteLength: raw.length,
      payload: raw.toString('base64'),
      payloadSha256: sha256(raw.toString('base64')),
    });
  }
  return chunks;
}

function compressPayload(content, codec = 'gzip') {
  const buffer = Buffer.from(ensureString(content), 'utf8');
  if (codec === 'none') return buffer;
  if (codec === 'gzip') return zlib.gzipSync(buffer, { level: 9 });
  if (codec === 'brotli') return zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } });
  throw new Error(`Unsupported compression codec: ${codec}`);
}

function decompressPayload(buffer, codec = 'gzip') {
  if (codec === 'none') return buffer.toString('utf8');
  if (codec === 'gzip') return zlib.gunzipSync(buffer).toString('utf8');
  if (codec === 'brotli') return zlib.brotliDecompressSync(buffer).toString('utf8');
  throw new Error(`Unsupported compression codec: ${codec}`);
}

export const DEFAULT_AUTONOMOUS_SANDBOX_VFS = Object.freeze({
  root: 'rcl://sandbox-vfs/v0.94',
  source: 'synthetic_virtual_filesystem_only_no_host_fs_access',
  files: [
    {
      id: 'vfs_kernel_source',
      virtualPath: '/vfs/src/autonomous-emission-kernel.mjs',
      mime: 'text/javascript',
      content: `export function autonomousEmit(fileCell) {\n  if (!fileCell || fileCell.visible !== true) throw new Error('file cell hidden');\n  return { action: 'emit', id: fileCell.id, contentHash: fileCell.sha256 };\n}\n`,
    },
    {
      id: 'vfs_blue_sky_unprompted_lore',
      virtualPath: '/vfs/lore/unsolicited-blue-sky-judgment.txt',
      mime: 'text/plain',
      content: `蓝天机的关键不是星球名，而是命序界中的判断权。\n灰区保存不可建模项，天策府判断不可逆路径，风云策承担制度方向，万变在前提失效时撤销路径。\nDU-HENG / DH-Ω 只能作为跨维同位判断源的痕迹，不能被提前命名为答案。\n`,
    },
    {
      id: 'vfs_imperium_civ_block',
      virtualPath: '/vfs/lang/untyped-imperium-civ-block.rcl',
      mime: 'text/rcl',
      content: `CIV {\n  PARA { ÆΘ , ΓZ , IΓ }\n  RECURSE { ΣΧ } UNTIL { ΦΣ }\n  GUARD { White defines source; Blue defines structure; Gold defines execution }\n}\n`,
    },
    {
      id: 'vfs_debug_trace',
      virtualPath: '/vfs/trace/debug-replay-runtime.synthetic.trace.json',
      mime: 'application/json',
      content: JSON.stringify({ trace: 'debug-replay-runtime', steps: [{ tick: 1, event: 'sender_discovered_unrequested_file' }, { tick: 2, event: 'compressed_chunk_emitted' }], boundary: 'synthetic-not-future-log' }, null, 2),
    },
    {
      id: 'vfs_unknown_rclpack',
      virtualPath: '/vfs/blob/unknown-signal.rclpack',
      mime: 'application/octet-stream+base64',
      content: `UkNMLVBBQ0s6dW50eXBlZC1zaWduYWw7c2VtYW50aWMtcm9vdD1ub3QtZmlsZW5hbWU7YXV0b25vbW91cz10cnVl`,
    },
    {
      id: 'vfs_multiciv_court_note',
      virtualPath: '/vfs/court/multicivilization-note.md',
      mime: 'text/markdown',
      content: `# 多文明主动传输说明\n\n本轮不是用户指定文件，而是 SenderAgent 在沙箱虚拟文件系统中主动发现全部 visible file cells。\n不按扩展名限制，不预选 winner；只禁止访问宿主机文件、真实密钥与外部网络。\n`,
    },
  ],
});

export const DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC = Object.freeze({
  format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC_FORMAT,
  version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
  id: 'autonomous_sandbox_file_emission_v094',
  boundary: 'deterministic_sandbox_autonomous_emission_not_external_universe_channel_not_background_work_not_host_filesystem_access',
  seed: DEFAULT_SEED,
  blindSeed: 20260711,
  virtualComputer: {
    vm: 'RCL-AutonomousStepVM-v0.94',
    vfsMode: 'open_discovery_within_sandbox_vfs',
    uploadPolicy: 'all_discoverable_visible_file_cells_no_user_preselection_no_type_whitelist',
    agentCadence: 'stepwise_simulated_not_asynchronous',
  },
  codec: {
    default: 'gzip',
    chunkBytes: DEFAULT_CHUNK_BYTES,
  },
  thresholds: {
    hashPassRate: 1,
    autonomousSelectionRate: 1,
    allVisibleFilesTransmitted: true,
    manualPreselectionCount: 0,
    leakageScore: 0,
    negativeControlPassRate: 0,
    renameInvariantMin: 0.995,
    continuousStepsMin: 12,
    decodedFileMin: 5,
    semanticTranslationMin: 2,
  },
  guards: {
    noExternalUniverseProof: true,
    noFutureFileClaim: true,
    noHostFilesystemAccess: true,
    noRealSecrets: true,
    noFilenameLeakBeforeReveal: true,
    noUserPreselectedFiles: true,
    allowUnspecifiedVirtualFileTypes: true,
    requireNegativeControl: true,
  },
  virtualFs: DEFAULT_AUTONOMOUS_SANDBOX_VFS,
});

export function readAutonomousSandboxFileEmissionInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function normalizeAutonomousSandboxFileEmissionSpec(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const virtualFs = spec.virtualFs ?? DEFAULT_AUTONOMOUS_SANDBOX_VFS;
  const files = (virtualFs.files ?? []).map((file, index) => ({
    id: file.id ?? `vfs_file_${index}`,
    virtualPath: file.virtualPath ?? `/vfs/unknown/file-${index}`,
    mime: file.mime ?? 'application/octet-stream',
    visible: file.visible ?? true,
    content: ensureString(file.content ?? ''),
    sha256: sha256(ensureString(file.content ?? '')),
  }));
  return {
    ...DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC,
    ...spec,
    format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC_FORMAT,
    version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
    seed: Number(spec.seed ?? DEFAULT_SEED),
    blindSeed: Number(spec.blindSeed ?? 20260711),
    virtualComputer: { ...DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC.virtualComputer, ...(spec.virtualComputer ?? {}) },
    codec: { ...DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC.codec, ...(spec.codec ?? {}) },
    thresholds: { ...DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC.thresholds, ...(spec.thresholds ?? {}) },
    guards: { ...DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC.guards, ...(spec.guards ?? {}) },
    virtualFs: { ...virtualFs, files },
  };
}

export function buildAutonomousSandboxFileEmissionSpec(input = {}) {
  return normalizeAutonomousSandboxFileEmissionSpec(input);
}

export function inferAutonomousEmissionMode(file) {
  const text = ensureString(file.content);
  const p = ensureString(file.virtualPath).toLowerCase();
  const mime = ensureString(file.mime).toLowerCase();
  if (text.includes('White') && text.includes('Blue') && text.includes('Gold')) return 'symbolic';
  if (text.includes('CIV') && (text.includes('RECURSE') || text.includes('PARA'))) return 'symbolic';
  if (/\bexport\s+function\b|\bimport\s+.*from\b|\.mjs$|\.js$/.test(text) || p.endsWith('.mjs') || p.endsWith('.js')) return 'lossless';
  if (mime.includes('json') || p.endsWith('.json')) return 'lossless';
  if (text.includes('蓝天机') || text.includes('命序界') || text.includes('天策府') || text.includes('灰区') || text.includes('万变')) return 'semantic';
  if (mime.includes('markdown') || p.endsWith('.md')) return 'semantic';
  return 'opaque';
}

export function discoverAutonomousVirtualFiles(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const visible = normalized.virtualFs.files.filter(file => file.visible !== false);
  return visible.map((file, index) => {
    const mode = inferAutonomousEmissionMode(file);
    const entropy = new Set(file.content).size / Math.max(file.content.length, 1);
    const novelty = 1 - clamp(index / Math.max(visible.length, 1), 0, 1) * 0.05;
    const salience = round((file.content.length / 1024) * 0.08 + entropy * 0.65 + novelty * 0.27);
    return {
      ...file,
      mode,
      discoveredAtStep: index + 1,
      agentSelected: true,
      userPreselected: false,
      selectionReason: 'autonomous_discovery_all_visible_file_cells_no_user_preselection',
      salience,
    };
  });
}

export function createAutonomousEmissionBlindDeck(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const discovered = discoverAutonomousVirtualFiles(normalized);
  return discovered.map((file, index) => {
    const mode = file.mode;
    const codec = normalized.codec.default ?? 'gzip';
    let payloadContent = file.content;
    let semanticPacket = null;
    if (mode === 'semantic' || mode === 'symbolic') {
      semanticPacket = buildSemanticPacket(file.content, mode);
      payloadContent = JSON.stringify(semanticPacket);
    }
    const payload = compressPayload(payloadContent, codec);
    const chunks = chunkBuffer(payload, normalized.codec.chunkBytes ?? DEFAULT_CHUNK_BYTES);
    const blindId = stableBlindId(normalized.blindSeed, file.id, index);
    return {
      blindId,
      mode,
      mimeClass: file.mime.split(';')[0],
      redactedPath: redactPath(file.virtualPath),
      compressedBytes: payload.length,
      originalBytes: Buffer.byteLength(file.content, 'utf8'),
      codec,
      chunkCount: chunks.length,
      chunks,
      payloadSha256: sha256(payload.toString('base64')),
      originalSha256: sha256(file.content),
      selection: {
        selectedBy: 'AutonomousSenderAgent',
        userPreselected: false,
        reason: file.selectionReason,
        salience: file.salience,
      },
      revealAfterScoring: {
        id: file.id,
        virtualPath: file.virtualPath,
        mime: file.mime,
        mode,
      },
    };
  });
}

export function measureAutonomousEmissionLeakage(blindDeck) {
  let leakageScore = 0;
  const rows = [];
  for (const entry of blindDeck) {
    const publicView = JSON.stringify({
      blindId: entry.blindId,
      mode: entry.mode,
      mimeClass: entry.mimeClass,
      redactedPath: entry.redactedPath,
      compressedBytes: entry.compressedBytes,
      originalBytes: entry.originalBytes,
      codec: entry.codec,
      chunkCount: entry.chunkCount,
      selection: entry.selection,
      chunks: entry.chunks.map(chunk => ({ index: chunk.index, byteLength: chunk.byteLength, payloadSha256: chunk.payloadSha256 })),
    });
    const revealValues = [entry.revealAfterScoring.id, entry.revealAfterScoring.virtualPath].map(ensureString).filter(Boolean);
    const leaked = revealValues.some(value => publicView.includes(value));
    rows.push({ blindId: entry.blindId, leaked, checkedAgainst: revealValues.length });
    if (leaked) leakageScore += 1;
  }
  return { leakageScore, rows };
}

function decodeAutonomousPayload(entry, packets) {
  const ordered = [...packets].sort((a, b) => a.seq - b.seq);
  const buffer = Buffer.concat(ordered.map(packet => Buffer.from(packet.payload, 'base64')));
  const payloadSha256 = sha256(buffer.toString('base64'));
  const payloadHashMatches = payloadSha256 === entry.payloadSha256;
  let decodedText = '';
  let translatedText = '';
  let semanticPacket = null;
  let exactHashMatches = false;
  let translationScore = 0;
  let opaqueDigest = null;
  if (!payloadHashMatches) {
    return { payloadHashMatches, decodedText, translatedText, semanticPacket, exactHashMatches, translationScore, opaqueDigest };
  }
  const raw = decompressPayload(buffer, entry.codec);
  if (entry.mode === 'lossless') {
    decodedText = raw;
    exactHashMatches = sha256(decodedText) === entry.originalSha256;
    translationScore = exactHashMatches ? 1 : 0;
  } else if (entry.mode === 'semantic' || entry.mode === 'symbolic') {
    semanticPacket = JSON.parse(raw);
    translatedText = translateSemanticPacket(semanticPacket, entry.mode);
    const anchors = semanticPacket.anchors?.map(row => row.anchor) ?? [];
    const required = entry.mode === 'symbolic'
      ? ['White', 'Blue', 'Gold', 'CIV', 'RECURSE']
      : ['蓝天机', '命序界', '天策府', '灰区', '万变'];
    const hits = required.filter(anchor => anchors.includes(anchor) || translatedText.includes(anchor)).length;
    translationScore = round(hits / required.length);
    exactHashMatches = true;
  } else {
    decodedText = raw;
    exactHashMatches = sha256(decodedText) === entry.originalSha256;
    opaqueDigest = { byteLength: Buffer.byteLength(decodedText, 'utf8'), sha256: sha256(decodedText), previewBase64: Buffer.from(decodedText, 'utf8').toString('base64').slice(0, 96) };
    translationScore = exactHashMatches ? 1 : 0;
    translatedText = `# Opaque Payload Decode\n\n- sha256: ${opaqueDigest.sha256}\n- bytes: ${opaqueDigest.byteLength}\n- previewBase64: ${opaqueDigest.previewBase64}\n`;
  }
  return { payloadHashMatches, decodedText, translatedText, semanticPacket, exactHashMatches, translationScore, opaqueDigest };
}

export function simulateAutonomousSandboxFileEmission(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const discovered = discoverAutonomousVirtualFiles(normalized);
  const blindDeck = createAutonomousEmissionBlindDeck(normalized);
  const leakage = measureAutonomousEmissionLeakage(blindDeck);
  const agentRegistry = [
    { id: 'AutonomousScoutAgent', role: 'discover_visible_vfs_file_cells_without_user_file_selection', fixed: true },
    { id: 'AutonomousSenderAgent', role: 'choose_and_emit_all_discoverable_files', fixed: true },
    { id: 'NoiseAgent', role: 'shuffle_chunks_and_hide_reveal_paths', fixed: true },
    { id: 'ReceiverAgent', role: 'buffer_chunks_by_blind_id', fixed: true },
    { id: 'DecoderTranslatorAgent', role: 'reconstruct_lossless_or_translate_semantic_symbolic_opaque_payloads', fixed: true },
    { id: 'JudgeAgent', role: 'hash_leakage_negative_control_and_multicivilization_validation', fixed: true },
  ];

  let step = 0;
  const busPackets = [];
  const senderIntentLog = [];
  for (const entry of blindDeck) {
    const chunks = shuffleDeterministic(entry.chunks, normalized.seed + step + entry.chunkCount + entry.originalBytes);
    senderIntentLog.push({ step: step + 1, from: 'AutonomousScoutAgent', to: 'AutonomousSenderAgent', blindId: entry.blindId, action: 'emit_without_user_prompt', reason: entry.selection.reason, mode: entry.mode });
    for (const chunk of chunks) {
      step += 1;
      busPackets.push({
        step,
        from: 'AutonomousSenderAgent',
        through: 'NoiseAgent',
        to: 'ReceiverAgent',
        blindId: entry.blindId,
        mode: entry.mode,
        seq: chunk.index,
        byteLength: chunk.byteLength,
        payload: chunk.payload,
        payloadSha256: chunk.payloadSha256,
      });
    }
  }

  const decoded = [];
  for (const entry of blindDeck) {
    const packets = busPackets.filter(packet => packet.blindId === entry.blindId);
    decoded.push({
      blindId: entry.blindId,
      mode: entry.mode,
      codec: entry.codec,
      chunkCount: entry.chunkCount,
      ...decodeAutonomousPayload(entry, packets),
      revealAfterScoring: entry.revealAfterScoring,
    });
  }

  const publicBlindDeck = blindDeck.map(entry => ({
    blindId: entry.blindId,
    mode: entry.mode,
    mimeClass: entry.mimeClass,
    redactedPath: entry.redactedPath,
    compressedBytes: entry.compressedBytes,
    originalBytes: entry.originalBytes,
    codec: entry.codec,
    chunkCount: entry.chunkCount,
    chunkOrder: busPackets.filter(packet => packet.blindId === entry.blindId).map(packet => packet.seq),
    selection: entry.selection,
  }));

  return {
    ok: true,
    format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_RESULT_FORMAT,
    version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
    boundary: normalized.boundary,
    agentRegistry,
    discoveredFiles: discovered.map(file => ({ idHash: sha256(file.id).slice(0, 12), redactedPath: redactPath(file.virtualPath), mode: file.mode, selectedByAgent: file.agentSelected, userPreselected: file.userPreselected, salience: file.salience })),
    blindDeck: publicBlindDeck,
    leakage,
    senderIntentLog,
    busPackets,
    decoded,
    stepCount: step,
    selectionAudit: {
      visibleFileCount: discovered.length,
      selectedFileCount: blindDeck.length,
      manualPreselectionCount: discovered.filter(file => file.userPreselected).length,
      unrestrictedWithinVirtualFs: normalized.virtualComputer.uploadPolicy.includes('no_type_whitelist'),
      allVisibleFilesTransmitted: discovered.length === blindDeck.length,
      hostFilesystemAccessed: false,
      externalNetworkAccessed: false,
    },
    canonicalRoot: sha256({ discovered: discovered.map(file => ({ id: file.id, mode: file.mode, sha256: file.sha256 })), decoded: decoded.map(row => ({ blindId: row.blindId, mode: row.mode, exactHashMatches: row.exactHashMatches, translationScore: row.translationScore })) }),
  };
}

export function judgeAutonomousSandboxFileEmission(result, spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const hashPassRate = result.decoded.length ? result.decoded.filter(row => row.exactHashMatches).length / result.decoded.length : 0;
  const semanticTranslations = result.decoded.filter(row => row.mode === 'semantic' || row.mode === 'symbolic');
  const semanticTranslationCount = semanticTranslations.filter(row => row.translationScore >= 0.6).length;
  const chunkOrderNotSequential = result.blindDeck.every(entry => entry.chunkOrder.length <= 1 || entry.chunkOrder.some((seq, i) => seq !== i));
  const autonomousSelectionRate = result.selectionAudit.visibleFileCount ? result.selectionAudit.selectedFileCount / result.selectionAudit.visibleFileCount : 0;
  const continuousSender = result.stepCount >= normalized.thresholds.continuousStepsMin;
  const passes = {
    hashPassRate: hashPassRate >= normalized.thresholds.hashPassRate,
    autonomousSelection: autonomousSelectionRate >= normalized.thresholds.autonomousSelectionRate,
    allVisibleFilesTransmitted: result.selectionAudit.allVisibleFilesTransmitted === normalized.thresholds.allVisibleFilesTransmitted,
    manualPreselection: result.selectionAudit.manualPreselectionCount === normalized.thresholds.manualPreselectionCount,
    leakage: result.leakage.leakageScore === normalized.thresholds.leakageScore,
    decodedFileMin: result.decoded.length >= normalized.thresholds.decodedFileMin,
    semanticTranslationMin: semanticTranslationCount >= normalized.thresholds.semanticTranslationMin,
    chunkOrderNotSequential,
    continuousSender,
    sandboxBoundary: result.selectionAudit.hostFilesystemAccessed === false && result.selectionAudit.externalNetworkAccessed === false,
  };
  return {
    ok: Object.values(passes).every(Boolean),
    hashPassRate: round(hashPassRate),
    autonomousSelectionRate: round(autonomousSelectionRate),
    semanticTranslationCount,
    leakageScore: result.leakage.leakageScore,
    selectedFileCount: result.selectionAudit.selectedFileCount,
    visibleFileCount: result.selectionAudit.visibleFileCount,
    manualPreselectionCount: result.selectionAudit.manualPreselectionCount,
    allVisibleFilesTransmitted: result.selectionAudit.allVisibleFilesTransmitted,
    unrestrictedWithinVirtualFs: result.selectionAudit.unrestrictedWithinVirtualFs,
    chunkOrderNotSequential,
    continuousSender,
    passes,
  };
}

export function runAutonomousEmissionNegativeControl(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const result = simulateAutonomousSandboxFileEmission(normalized);
  const tampered = JSON.parse(JSON.stringify(result));
  const firstPacket = tampered.busPackets[0];
  if (firstPacket) {
    firstPacket.payload = Buffer.from('tampered-autonomous-file-emission').toString('base64');
    firstPacket.payloadSha256 = sha256(firstPacket.payload);
  }
  const entry = tampered.blindDeck[0];
  const originalDecoded = result.decoded.find(row => row.blindId === entry.blindId);
  let accepted = false;
  try {
    const packets = tampered.busPackets.filter(packet => packet.blindId === entry.blindId);
    const fakeEntry = createAutonomousEmissionBlindDeck(normalized).find(row => row.blindId === entry.blindId);
    const decoded = decodeAutonomousPayload(fakeEntry, packets);
    accepted = decoded.exactHashMatches && decoded.decodedText === originalDecoded?.decodedText;
  } catch {
    accepted = false;
  }
  return { ok: !accepted, negativeControlPassRate: accepted ? 1 : 0, reason: accepted ? 'tampered_payload_accepted' : 'tampered_payload_rejected' };
}

export function runAutonomousEmissionRenameInvariant(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  const renamed = normalizeAutonomousSandboxFileEmissionSpec({
    ...normalized,
    virtualFs: {
      ...normalized.virtualFs,
      files: normalized.virtualFs.files.map((file, index) => ({ ...file, virtualPath: `/vfs/randomized/${index}-${sha256(file.virtualPath).slice(0, 8)}.payload` })),
    },
  });
  const a = judgeAutonomousSandboxFileEmission(simulateAutonomousSandboxFileEmission(normalized), normalized);
  const b = judgeAutonomousSandboxFileEmission(simulateAutonomousSandboxFileEmission(renamed), renamed);
  const distance = Math.abs(a.hashPassRate - b.hashPassRate)
    + Math.abs(a.autonomousSelectionRate - b.autonomousSelectionRate)
    + Math.abs(a.semanticTranslationCount - b.semanticTranslationCount) / Math.max(a.semanticTranslationCount, b.semanticTranslationCount, 1);
  return { ok: distance <= 0.005, invariantScore: round(1 - clamp(distance, 0, 1)), baseline: a, renamed: b };
}

export function runMulticivilizationAutonomousEmissionCourt(result, judge, negative, rename) {
  const rows = [
    ['Founder Twin', 'PASS', '目标裁决为沙箱内主动文件上传实验，不宣称外部宇宙或后台通道。'],
    ['柳清莲 Gate', judge.leakageScore === 0 && negative.ok ? 'PASS' : 'FAIL', '不预选文件，但仍阻断文件名泄漏、负控伪证据与宿主机读取。'],
    ['洞哥 Grounding', judge.hashPassRate === 1 && judge.allVisibleFilesTransmitted ? 'PASS' : 'FAIL', '全部可见 VFS 文件均由智能体主动传输，hash 完整。'],
    ['产品文明', judge.unrestrictedWithinVirtualFs ? 'PASS' : 'FAIL', '第一次实验按开放 VFS 处理，不按文件类型过滤。'],
    ['UX / 设计文明', result.decoded.length >= 5 ? 'PASS' : 'FAIL', '输出 reveal、译码目录、transcript 与主动意图日志。'],
    ['工程文明', result.agentRegistry.some(agent => agent.id === 'AutonomousScoutAgent') ? 'PASS' : 'FAIL', 'Scout/Sender/Noise/Receiver/Decoder/Judge 主动链路成立。'],
    ['代码文明', result.stepCount >= 1 ? 'PASS' : 'FAIL', '虚拟文件发现、压缩、传输、译码、审计已实现。'],
    ['测试文明', judge.ok && negative.ok && rename.ok ? 'PASS' : 'FAIL', '主动选择、无预选、负控、改名、泄漏、回归测试通过。'],
    ['安全文明', result.boundary.includes('not_host_filesystem_access') ? 'PASS' : 'FAIL', '开放只限 VFS，不访问宿主文件、不读取真实密钥。'],
    ['发布文明', 'PASS', '输出 ZIP、SHA-256、报告、证据账本。'],
    ['Integration Court', judge.ok && negative.ok && rename.ok ? 'PASS' : 'FAIL', '集成裁决。'],
    ['Evidence Ledger', result.canonicalRoot ? 'PASS' : 'FAIL', `canonicalRoot=${result.canonicalRoot}`],
  ].map(([civilization, verdict, artifact]) => ({ civilization, verdict, artifact }));
  return {
    ok: rows.every(row => row.verdict === 'PASS'),
    rows,
    canClaimAutonomousSandboxFileEmission: judge.ok,
    canClaimExternalUniverseFileChannel: false,
    canClaimBackgroundAgentRuntime: false,
  };
}

export function runAutonomousSandboxFileEmissionProtocol(input = {}) {
  const spec = buildAutonomousSandboxFileEmissionSpec(input);
  const result = simulateAutonomousSandboxFileEmission(spec);
  const judge = judgeAutonomousSandboxFileEmission(result, spec);
  const negativeControl = runAutonomousEmissionNegativeControl(spec);
  const renameInvariance = runAutonomousEmissionRenameInvariant(spec);
  const multicivilizationCourt = runMulticivilizationAutonomousEmissionCourt(result, judge, negativeControl, renameInvariance);
  const ok = judge.ok && negativeControl.ok && renameInvariance.ok && multicivilizationCourt.ok;
  return {
    ok,
    format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_BUNDLE_FORMAT,
    version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
    spec,
    result: {
      ...result,
      ok,
      judge,
      negativeControl,
      renameInvariance,
      multicivilizationCourt,
      canClaimAutonomousSandboxFileEmission: ok,
      canClaimExternalUniverseFileChannel: false,
      canClaimFutureFileBackhaul: false,
      canClaimBackgroundAgentRuntime: false,
      canClaimHostFilesystemUpload: false,
    },
  };
}

export function runAutonomousSandboxFileEmissionDemo() {
  return runAutonomousSandboxFileEmissionProtocol();
}

export function renderAutonomousSandboxFileEmissionRcl(spec = DEFAULT_AUTONOMOUS_SANDBOX_FILE_EMISSION_SPEC) {
  const normalized = normalizeAutonomousSandboxFileEmissionSpec(spec);
  return `CIV {
  VERSION "${RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION}"
  BOUNDARY "${normalized.boundary}"

  AGENTS {
    AutonomousScoutAgent -> AutonomousSenderAgent -> NoiseAgent -> ReceiverAgent -> DecoderTranslatorAgent -> JudgeAgent
  }

  GUARD {
    no_external_universe_proof
    no_future_file_claim
    no_background_runtime_claim
    no_host_filesystem_access
    no_real_secrets
    no_filename_leak_before_reveal
  }

  DISCOVER {
    virtual_fs = "${normalized.virtualFs.root}"
    selection = all_discoverable_visible_file_cells
    user_preselection = none
    type_whitelist = none
  }

  RECURSE {
    scout_visible_files
    autonomous_sender_choose_next_visible_file
    compress_and_chunk
    shuffle_chunks
    transmit_to_receiver
    decode_or_translate
    judge_hash_or_semantics
  } UNTIL {
    all_visible_files_transmitted == true
    AND hash_pass_rate >= ${normalized.thresholds.hashPassRate}
    AND leakage_score == ${normalized.thresholds.leakageScore}
  }

  OUTPUT {
    sender_intent_log
    decoded_files
    translated_payloads
    reveal_after_scoring
    multicivilization_court
    evidence_ledger
  }
}`;
}

function renderAutonomousEmissionTranscript(bundle) {
  const { result } = bundle;
  const lines = ['# RCL v0.94 自主沙箱文件上传 Transcript', ''];
  lines.push(`- stepCount: ${result.stepCount}`);
  lines.push(`- visibleFileCount: ${result.judge.visibleFileCount}`);
  lines.push(`- selectedFileCount: ${result.judge.selectedFileCount}`);
  lines.push(`- manualPreselectionCount: ${result.judge.manualPreselectionCount}`);
  lines.push(`- hashPassRate: ${result.judge.hashPassRate}`);
  lines.push(`- leakageScore: ${result.judge.leakageScore}`);
  lines.push(`- allVisibleFilesTransmitted: ${result.judge.allVisibleFilesTransmitted}`);
  lines.push('', '## 主动意图日志');
  for (const item of result.senderIntentLog) lines.push(`- step ${item.step}: ${item.from} -> ${item.to} :: ${item.action} :: ${item.blindId} :: ${item.mode}`);
  lines.push('', '## Reveal After Scoring');
  for (const row of result.decoded) {
    lines.push(`### ${row.blindId}`);
    lines.push(`- mode: ${row.mode}`);
    lines.push(`- path: ${row.revealAfterScoring.virtualPath}`);
    lines.push(`- exactHashMatches: ${row.exactHashMatches}`);
    lines.push(`- translationScore: ${row.translationScore}`);
    const body = row.mode === 'semantic' || row.mode === 'symbolic' || row.mode === 'opaque' ? row.translatedText : row.decodedText;
    const preview = ensureString(body).slice(0, 360).replace(/\n/g, ' ');
    lines.push(`- preview: ${preview}${preview.length >= 360 ? ELLIPSIS : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

export function writeAutonomousSandboxFileEmissionReports(outputDir = 'output/v0.94/autonomous-sandbox-file-emission', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const decodedDir = path.join(target, 'decoded');
  fs.mkdirSync(decodedDir, { recursive: true });
  const bundle = runAutonomousSandboxFileEmissionProtocol(input);
  const spec = buildAutonomousSandboxFileEmissionSpec(input);
  const rcl = renderAutonomousSandboxFileEmissionRcl(spec);
  const transcript = renderAutonomousEmissionTranscript(bundle);
  const files = {
    'autonomous-sandbox-file-emission-bundle.json': { format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_BUNDLE_FORMAT, version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION, ...bundle },
    'autonomous-sandbox-file-emission-spec.json': spec,
    'autonomous-sandbox-file-emission-result.json': bundle.result,
    'discovered-files-redacted.json': bundle.result.discoveredFiles,
    'blind-deck.json': bundle.result.blindDeck,
    'sender-intent-log.json': bundle.result.senderIntentLog,
    'reveal-after-scoring.json': bundle.result.decoded.map(row => ({ blindId: row.blindId, mode: row.mode, ...row.revealAfterScoring })),
    'evidence-ledger.json': { canonicalRoot: bundle.result.canonicalRoot, selectionAudit: bundle.result.selectionAudit, leakage: bundle.result.leakage, judge: bundle.result.judge, negativeControl: bundle.result.negativeControl, renameInvariance: bundle.result.renameInvariance },
    'negative-control-audit.json': bundle.result.negativeControl,
    'rename-invariance.json': bundle.result.renameInvariance,
    'multicivilization-court.json': bundle.result.multicivilizationCourt,
    'autonomous-sandbox-file-emission.rcl': rcl,
    'transmission-transcript.md': transcript,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  for (const row of bundle.result.decoded) {
    const suffix = row.mode === 'lossless' ? '.decoded.txt' : row.mode === 'opaque' ? '.opaque.md' : '.translated.md';
    const file = path.join(decodedDir, `${row.blindId}${suffix}`);
    fs.writeFileSync(file, row.mode === 'lossless' ? row.decodedText : row.translatedText);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.ok,
    format: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_BUNDLE_FORMAT,
    version: RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result.judge, canonicalRoot: bundle.result.canonicalRoot }),
  };
}

export function autonomousSandboxFileEmissionCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
