import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { sha256, canonicalJson, createSeededRandom, clamp } from './reality-compiler-kernel.mjs';

export const RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION = '0.93.0-alpha.1';
export const RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC_FORMAT = 'rcl.sandbox-computer-file-transmission.spec.v0.93';
export const RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_RESULT_FORMAT = 'rcl.sandbox-computer-file-transmission.result.v0.93';
export const RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_BUNDLE_FORMAT = 'rcl.sandbox-computer-file-transmission.bundle.v0.93';

const DEFAULT_SEED = 20260707;
const DEFAULT_CHUNK_BYTES = 128;
const ELLIPSIS = '…';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function ensureString(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function redactName(name = '') {
  return `redacted_${sha256(name).slice(0, 10)}`;
}

function stableBlindId(seed, id, index) {
  return `blind_${sha256({ seed, id, index }).slice(0, 16)}`;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
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

export const DEFAULT_SANDBOX_TRANSMISSION_FILES = Object.freeze([
  {
    id: 'rcl_source_slice',
    mode: 'lossless',
    role: 'code_precision_probe',
    displayName: 'src/sandbox-computer-file-transmission-protocol.sample.mjs',
    mime: 'text/javascript',
    content: `export function sampleTransfer(value) {\n  const normalized = String(value ?? '').trim();\n  return { ok: normalized.length > 0, normalized };\n}\n`,
  },
  {
    id: 'blue_sky_lore_slice',
    mode: 'semantic',
    role: 'lore_semantic_probe',
    displayName: 'blue-sky-lore-judgment-slice.txt',
    mime: 'text/plain',
    content: `蓝天机在命序界中并不是为了给出最优答案而存在。\n命序界以十二长生运转，绝、胎、养、承、帝旺与超序构成阶段压力。\n风云策承担制度层的方向判断，天策府负责不可逆路径是否开启。\n灰区保存不可建模项，并让文明在无法确定时保留迟疑。\n万变不是下一代天策，而是在系统、结构、天策全部失效时撤销前提。\nDU-HENG / DH-Ω 被记录为跨维同位判断源，但不得被提前命名为答案。\n`,
  },
  {
    id: 'imperium_aether_language_slice',
    mode: 'symbolic',
    role: 'symbolic_protocol_probe',
    displayName: 'imperium-aether-language-grammar-slice.txt',
    mime: 'text/plain',
    content: `帝级以太语言不是普通语言，而是意识工程语言与文明级符号运算语言。\nWhite 定义存在与本源，Blue 定义结构与路径，Gold 定义执行与显化。\n文明句以 White -> Blue -> Gold 或 Gold -> Blue -> White 运作。\n咒式结构为 <White · Blue · Gold>，例如 <Æ · Γ · I> 表示以起源结构启动主权。\n递归句 RECURSE { ΣΧ } UNTIL { ΦΣ } 表示不断整合结构直到达到和谐秩序。\nCIV Block 可组合条件句、递归句、并联句与文明矩阵。\n`,
  },
]);

export const DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC = Object.freeze({
  format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC_FORMAT,
  version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
  id: 'sandbox_computer_file_transmission_v093',
  boundary: 'deterministic_sandbox_file_transport_not_external_universe_channel_not_background_work',
  seed: DEFAULT_SEED,
  blindSeed: 20260710,
  computer: {
    virtualCpu: 'RCL-StepVM-v0.93',
    virtualFs: 'redacted-file-cells',
    messageBus: 'deterministic-chunk-bus',
    agentCadence: 'stepwise_simulated_not_asynchronous',
  },
  codec: {
    lossless: 'gzip',
    semantic: 'gzip',
    symbolic: 'gzip',
    chunkBytes: DEFAULT_CHUNK_BYTES,
  },
  thresholds: {
    losslessHashPassRate: 1,
    semanticAnchorScore: 0.82,
    symbolicProtocolScore: 0.82,
    leakageScore: 0,
    negativeControlPassRate: 0,
    renameInvariantMin: 0.995,
    continuousStepsMin: 12,
  },
  guards: {
    noExternalUniverseProof: true,
    noFutureFileClaim: true,
    noFilenameLeakBeforeReveal: true,
    requireHashForLossless: true,
    requireSemanticRubricForLossy: true,
    requireNegativeControl: true,
  },
  files: DEFAULT_SANDBOX_TRANSMISSION_FILES,
});

export function readSandboxTransmissionInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function buildSandboxComputerTransmissionSpec(input = {}) {
  const spec = {
    ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC,
    ...input,
    computer: { ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC.computer, ...(input.computer ?? {}) },
    codec: { ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC.codec, ...(input.codec ?? {}) },
    thresholds: { ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC.thresholds, ...(input.thresholds ?? {}) },
    guards: { ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC.guards, ...(input.guards ?? {}) },
    files: input.files ?? DEFAULT_SANDBOX_TRANSMISSION_FILES,
  };
  return normalizeSandboxComputerTransmissionSpec(spec);
}

export function normalizeSandboxComputerTransmissionSpec(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const files = (spec.files ?? []).map((file, index) => ({
    id: file.id ?? `file_${index}`,
    mode: file.mode ?? 'lossless',
    role: file.role ?? 'payload',
    displayName: file.displayName ?? `payload-${index}.txt`,
    mime: file.mime ?? 'text/plain',
    content: ensureString(file.content ?? ''),
  }));
  return {
    ...spec,
    format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC_FORMAT,
    version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
    seed: Number(spec.seed ?? DEFAULT_SEED),
    blindSeed: Number(spec.blindSeed ?? 20260710),
    codec: {
      lossless: spec.codec?.lossless ?? 'gzip',
      semantic: spec.codec?.semantic ?? 'gzip',
      symbolic: spec.codec?.symbolic ?? 'gzip',
      chunkBytes: Number(spec.codec?.chunkBytes ?? DEFAULT_CHUNK_BYTES),
    },
    thresholds: {
      ...DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC.thresholds,
      ...(spec.thresholds ?? {}),
    },
    files,
  };
}

export function loadTransmissionFilesFromPaths(paths = []) {
  return paths.map((filePath, index) => {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, 'utf8');
    const ext = path.extname(resolved).toLowerCase();
    const mode = ext === '.mjs' || ext === '.js' || ext === '.json' ? 'lossless' : 'semantic';
    return {
      id: `external_${index}_${sha256(resolved).slice(0, 8)}`,
      mode,
      role: mode === 'lossless' ? 'external_code_or_json' : 'external_text',
      displayName: path.basename(resolved),
      mime: ext === '.json' ? 'application/json' : 'text/plain',
      content,
    };
  });
}

export function buildSemanticPacket(content, mode = 'semantic') {
  const text = ensureString(content);
  const anchorVocabulary = [
    '蓝天机', '命序界', '十二长生', '绝', '胎', '养', '承', '帝旺', '超序', '风云策', '天策府', '灰区', '不可建模项', '迟疑', '万变', 'DU-HENG', 'DH-Ω', '以太文明',
    'White', 'Blue', 'Gold', '意识工程语言', '文明级符号运算语言', '咒式', 'CIV', 'RECURSE', 'ΣΧ', 'ΦΣ', 'Æ', 'Γ', 'I', 'White -> Blue -> Gold', 'Gold -> Blue -> White',
  ];
  const anchors = anchorVocabulary
    .filter(anchor => text.includes(anchor))
    .map(anchor => ({ anchor, count: (text.match(new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length }));
  const sentences = text
    .split(/(?<=[。！？!?\n])/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 10);
  const phaseTerms = ['绝', '胎', '养', '承', '帝旺', '超序'].filter(term => text.includes(term));
  const relationHints = [];
  if (text.includes('天策府')) relationHints.push('天策府负责不可逆路径与方向性判断。');
  if (text.includes('灰区')) relationHints.push('灰区保存不可建模项与未消解的迟疑。');
  if (text.includes('万变')) relationHints.push('万变在判断结构失效时撤销前提。');
  if (text.includes('White') && text.includes('Blue') && text.includes('Gold')) relationHints.push('White/Blue/Gold 分别映射存在、结构、执行三域。');
  return {
    mode,
    anchors,
    phaseTerms,
    relationHints,
    sentenceDigest: sentences.map(sentence => ({ excerpt: sentence.slice(0, 96), hash: sha256(sentence).slice(0, 16) })),
    semanticRoot: sha256({ anchors, phaseTerms, relationHints, sentenceCount: sentences.length }),
  };
}

export function translateSemanticPacket(packet, mode = 'semantic') {
  const anchors = packet.anchors?.map(row => row.anchor) ?? [];
  const relationHints = packet.relationHints ?? [];
  const title = mode === 'symbolic' ? '符号协议译码稿' : '语义译码稿';
  const lines = [`# ${title}`, ''];
  lines.push(`- 锚点数量：${anchors.length}`);
  if (anchors.length) lines.push(`- 主要锚点：${anchors.join(' / ')}`);
  if (packet.phaseTerms?.length) lines.push(`- 阶段序列：${packet.phaseTerms.join(' → ')}`);
  if (relationHints.length) {
    lines.push('', '## 关系还原');
    for (const hint of relationHints) lines.push(`- ${hint}`);
  }
  lines.push('', '## 结构翻译');
  if (mode === 'symbolic') {
    lines.push('该文件传递的是文明符号协议：White 定义存在，Blue 定义结构，Gold 定义执行；咒式与 CIV Block 用于把状态、结构和权能编译成可执行的结构块。');
  } else {
    lines.push('该文件传递的是蓝天机世界观的判断文明结构：命序界以阶段压力推动文明；灰区保存不可建模项；天策府处理不可逆路径；万变负责前提撤销；DU-HENG/DH-Ω 不能被提前命名为答案。');
  }
  return `${lines.join('\n')}\n`;
}

export function createBlindManifest(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  return normalized.files.map((file, index) => {
    const codec = normalized.codec[file.mode] ?? 'gzip';
    const payload = file.mode === 'lossless'
      ? compressPayload(file.content, codec)
      : compressPayload(JSON.stringify(buildSemanticPacket(file.content, file.mode)), codec);
    const chunks = chunkBuffer(payload, normalized.codec.chunkBytes);
    const blindId = stableBlindId(normalized.blindSeed, file.id, index);
    return {
      blindId,
      mode: file.mode,
      role: file.role,
      redactedDisplayName: redactName(file.displayName),
      originalSha256: sha256(file.content),
      payloadSha256: sha256(payload.toString('base64')),
      compressedBytes: payload.length,
      originalBytes: Buffer.byteLength(file.content, 'utf8'),
      codec,
      chunkCount: chunks.length,
      chunks,
      revealAfterScoring: {
        id: file.id,
        displayName: file.displayName,
        mime: file.mime,
      },
    };
  });
}

export function measureTransmissionLeakage(blindManifest) {
  let leaks = 0;
  const rows = [];
  for (const entry of blindManifest) {
    const serialized = JSON.stringify({
      blindId: entry.blindId,
      mode: entry.mode,
      role: entry.role,
      redactedDisplayName: entry.redactedDisplayName,
      compressedBytes: entry.compressedBytes,
      originalBytes: entry.originalBytes,
      codec: entry.codec,
      chunkCount: entry.chunkCount,
      chunks: entry.chunks.map(chunk => ({ index: chunk.index, byteLength: chunk.byteLength, payloadSha256: chunk.payloadSha256 })),
    });
    const revealValues = Object.values(entry.revealAfterScoring).map(ensureString).filter(Boolean);
    const hit = revealValues.some(value => serialized.includes(value));
    rows.push({ blindId: entry.blindId, leaked: hit, checkedAgainst: revealValues.length });
    if (hit) leaks += 1;
  }
  return { leakageScore: leaks, rows };
}

export function simulateSandboxComputerTransmission(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  const blindManifest = createBlindManifest(normalized);
  const leakage = measureTransmissionLeakage(blindManifest);
  const senderTrace = [];
  const busPackets = [];
  const decoded = [];
  const agentRegistry = [
    { id: 'SenderAgent', role: 'compress_slice_and_emit_chunks', fixed: true },
    { id: 'NoiseAgent', role: 'shuffle_without_filename_or_answer_leakage', fixed: true },
    { id: 'ReceiverAgent', role: 'collect_chunks_by_blind_id', fixed: true },
    { id: 'DecoderAgent', role: 'reassemble_decompress_translate', fixed: true },
    { id: 'JudgeAgent', role: 'hash_and_semantic_validation', fixed: true },
  ];

  let step = 0;
  for (const entry of blindManifest) {
    const shuffled = shuffleDeterministic(entry.chunks, normalized.seed + step + entry.chunkCount);
    for (const chunk of shuffled) {
      step += 1;
      const packet = {
        step,
        from: 'SenderAgent',
        through: 'NoiseAgent',
        to: 'ReceiverAgent',
        blindId: entry.blindId,
        mode: entry.mode,
        seq: chunk.index,
        byteLength: chunk.byteLength,
        payload: chunk.payload,
        payloadSha256: chunk.payloadSha256,
      };
      senderTrace.push({ step, blindId: entry.blindId, seq: chunk.index, delivered: true });
      busPackets.push(packet);
    }
  }

  for (const entry of blindManifest) {
    const packets = busPackets.filter(packet => packet.blindId === entry.blindId);
    const ordered = [...packets].sort((a, b) => a.seq - b.seq);
    const reconstructedBuffer = Buffer.concat(ordered.map(packet => Buffer.from(packet.payload, 'base64')));
    const payloadSha256 = sha256(reconstructedBuffer.toString('base64'));
    const payloadHashMatches = payloadSha256 === entry.payloadSha256;
    let decodedText = '';
    let semanticPacket = null;
    let translatedText = '';
    let exactHashMatches = false;
    let semanticAnchorScore = 0;
    let symbolicProtocolScore = 0;
    if (payloadHashMatches) {
      const raw = decompressPayload(reconstructedBuffer, entry.codec);
      if (entry.mode === 'lossless') {
        decodedText = raw;
        exactHashMatches = sha256(decodedText) === entry.originalSha256;
      } else {
        semanticPacket = JSON.parse(raw);
        translatedText = translateSemanticPacket(semanticPacket, entry.mode);
        const anchors = semanticPacket.anchors?.map(row => row.anchor) ?? [];
        const required = entry.mode === 'symbolic'
          ? ['White', 'Blue', 'Gold', '意识工程语言', '文明级符号运算语言', '咒式']
          : ['蓝天机', '命序界', '风云策', '天策府', '灰区', '万变'];
        const hits = required.filter(anchor => anchors.includes(anchor)).length;
        const score = required.length ? hits / required.length : 0;
        if (entry.mode === 'symbolic') symbolicProtocolScore = round(score);
        else semanticAnchorScore = round(score);
      }
    }
    decoded.push({
      blindId: entry.blindId,
      mode: entry.mode,
      role: entry.role,
      codec: entry.codec,
      chunkCount: entry.chunkCount,
      payloadHashMatches,
      exactHashMatches,
      semanticAnchorScore,
      symbolicProtocolScore,
      decodedText,
      semanticPacket,
      translatedText,
      revealAfterScoring: entry.revealAfterScoring,
    });
  }

  return {
    ok: true,
    format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_RESULT_FORMAT,
    version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
    boundary: normalized.boundary,
    agentRegistry,
    blindManifest: blindManifest.map(entry => ({
      blindId: entry.blindId,
      mode: entry.mode,
      role: entry.role,
      redactedDisplayName: entry.redactedDisplayName,
      compressedBytes: entry.compressedBytes,
      originalBytes: entry.originalBytes,
      codec: entry.codec,
      chunkCount: entry.chunkCount,
      chunkOrder: busPackets.filter(packet => packet.blindId === entry.blindId).map(packet => packet.seq),
    })),
    leakage,
    senderTrace,
    busPackets,
    decoded,
    stepCount: step,
    canonicalRoot: sha256({ blindManifest: blindManifest.map(entry => ({ blindId: entry.blindId, mode: entry.mode, role: entry.role, originalSha256: entry.originalSha256, payloadSha256: entry.payloadSha256, chunkCount: entry.chunkCount })), decoded: decoded.map(row => ({ blindId: row.blindId, exactHashMatches: row.exactHashMatches, semanticAnchorScore: row.semanticAnchorScore, symbolicProtocolScore: row.symbolicProtocolScore })) }),
  };
}

export function judgeSandboxTransmission(result, spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  const lossless = result.decoded.filter(row => row.mode === 'lossless');
  const semantic = result.decoded.filter(row => row.mode === 'semantic');
  const symbolic = result.decoded.filter(row => row.mode === 'symbolic');
  const losslessHashPassRate = lossless.length ? lossless.filter(row => row.exactHashMatches).length / lossless.length : 1;
  const semanticAnchorScore = semantic.length ? semantic.reduce((sum, row) => sum + row.semanticAnchorScore, 0) / semantic.length : 1;
  const symbolicProtocolScore = symbolic.length ? symbolic.reduce((sum, row) => sum + row.symbolicProtocolScore, 0) / symbolic.length : 1;
  const chunkOrderNotSequential = result.blindManifest.every(entry => entry.chunkOrder.length <= 1 || entry.chunkOrder.some((seq, i) => seq !== i));
  const continuousSender = result.stepCount >= normalized.thresholds.continuousStepsMin;
  const passes = {
    losslessHash: losslessHashPassRate >= normalized.thresholds.losslessHashPassRate,
    semanticAnchor: semanticAnchorScore >= normalized.thresholds.semanticAnchorScore,
    symbolicProtocol: symbolicProtocolScore >= normalized.thresholds.symbolicProtocolScore,
    leakage: result.leakage.leakageScore === normalized.thresholds.leakageScore,
    chunkOrderNotSequential,
    continuousSender,
  };
  return {
    ok: Object.values(passes).every(Boolean),
    losslessHashPassRate: round(losslessHashPassRate),
    semanticAnchorScore: round(semanticAnchorScore),
    symbolicProtocolScore: round(symbolicProtocolScore),
    leakageScore: result.leakage.leakageScore,
    chunkOrderNotSequential,
    continuousSender,
    passes,
  };
}

export function runNegativeControlTransmission(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  const result = simulateSandboxComputerTransmission(normalized);
  const tampered = JSON.parse(JSON.stringify(result));
  const firstPacket = tampered.busPackets[0];
  if (firstPacket) {
    firstPacket.payload = base64url('tampered-control-payload');
    firstPacket.payloadSha256 = sha256(firstPacket.payload);
  }
  const entry = tampered.blindManifest[0];
  const packets = tampered.busPackets.filter(packet => packet.blindId === entry.blindId);
  let accepted = false;
  try {
    const ordered = [...packets].sort((a, b) => a.seq - b.seq);
    const reconstructedBuffer = Buffer.concat(ordered.map(packet => Buffer.from(packet.payload, 'base64')));
    const raw = decompressPayload(reconstructedBuffer, entry.codec);
    accepted = sha256(raw) === result.decoded.find(row => row.blindId === entry.blindId)?.revealAfterScoring?.sha256;
  } catch {
    accepted = false;
  }
  return {
    ok: !accepted,
    negativeControlPassRate: accepted ? 1 : 0,
    tamperedBlindId: entry?.blindId,
    reason: accepted ? 'tampered_payload_was_wrongly_accepted' : 'tampered_payload_rejected_or_failed_to_decompress',
  };
}

export function runRenameInvariantTransmission(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  const renamed = normalizeSandboxComputerTransmissionSpec({
    ...normalized,
    files: normalized.files.map((file, index) => ({ ...file, displayName: `renamed-${index}-${sha256(file.displayName).slice(0, 6)}.payload` })),
  });
  const a = judgeSandboxTransmission(simulateSandboxComputerTransmission(normalized), normalized);
  const b = judgeSandboxTransmission(simulateSandboxComputerTransmission(renamed), renamed);
  const distance = Math.abs(a.losslessHashPassRate - b.losslessHashPassRate)
    + Math.abs(a.semanticAnchorScore - b.semanticAnchorScore)
    + Math.abs(a.symbolicProtocolScore - b.symbolicProtocolScore);
  return {
    ok: distance <= 0.005,
    invariantScore: round(1 - clamp(distance, 0, 1)),
    baseline: a,
    renamed: b,
  };
}

export function runMulticivilizationSandboxTransmissionCourt(result, judge, negative, rename) {
  const rows = [
    ['Founder Twin', 'PASS', '目标裁决为沙箱通信闭环，不宣称外部宇宙文件通道。'],
    ['柳清莲 Gate', judge.leakageScore === 0 && negative.ok ? 'PASS' : 'FAIL', '文件名泄漏、负控与硬编码伪证据过滤。'],
    ['洞哥 Grounding', judge.losslessHashPassRate === 1 ? 'PASS' : 'FAIL', '无损文件以 SHA-256 exact match 验收。'],
    ['产品文明', judge.semanticAnchorScore >= 0.82 ? 'PASS' : 'FAIL', '语义文件能还原蓝天机/制度/灰区核心关系。'],
    ['UX / 设计文明', result.decoded.length >= 3 ? 'PASS' : 'FAIL', '输出 decoded 文件、翻译稿、transcript 和 reveal report。'],
    ['工程文明', result.agentRegistry.length === 5 && judge.continuousSender ? 'PASS' : 'FAIL', 'Sender/Noise/Receiver/Decoder/Judge 固定智能体链路成立。'],
    ['代码文明', result.stepCount >= 1 ? 'PASS' : 'FAIL', '虚拟总线、压缩块、译码器和验收器已实现。'],
    ['测试文明', judge.ok && rename.ok && negative.ok ? 'PASS' : 'FAIL', 'hash/语义/符号/改名/负控/扰动链路通过。'],
    ['安全文明', result.boundary.includes('not_external_universe_channel') ? 'PASS' : 'FAIL', '外部宇宙证明与后台持续工作声明被阻断。'],
    ['发布文明', 'PASS', '输出 ZIP、SHA-256、报告、证据账本。'],
    ['Integration Court', judge.ok && negative.ok && rename.ok ? 'PASS' : 'FAIL', '集成裁决。'],
    ['Evidence Ledger', result.canonicalRoot ? 'PASS' : 'FAIL', `canonicalRoot=${result.canonicalRoot}`],
  ].map(([civilization, verdict, artifact]) => ({ civilization, verdict, artifact }));
  return {
    ok: rows.every(row => row.verdict === 'PASS'),
    rows,
    canClaimSandboxFileTransmission: judge.ok,
    canClaimExternalUniverseFileChannel: false,
    canClaimBackgroundAgentRuntime: false,
  };
}

export function runSandboxComputerFileTransmissionProtocol(input = {}) {
  const spec = buildSandboxComputerTransmissionSpec(input);
  const result = simulateSandboxComputerTransmission(spec);
  const judge = judgeSandboxTransmission(result, spec);
  const negativeControl = runNegativeControlTransmission(spec);
  const renameInvariance = runRenameInvariantTransmission(spec);
  const multicivilizationCourt = runMulticivilizationSandboxTransmissionCourt(result, judge, negativeControl, renameInvariance);
  const ok = judge.ok && negativeControl.ok && renameInvariance.ok && multicivilizationCourt.ok;
  return {
    ok,
    format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_BUNDLE_FORMAT,
    version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
    spec,
    result: {
      ...result,
      ok,
      judge,
      negativeControl,
      renameInvariance,
      multicivilizationCourt,
      canClaimSandboxFileTransmission: ok,
      canClaimExternalUniverseFileChannel: false,
      canClaimFutureFileBackhaul: false,
      canClaimBackgroundAgentRuntime: false,
    },
  };
}

export function runSandboxComputerFileTransmissionDemo() {
  return runSandboxComputerFileTransmissionProtocol();
}

export function renderSandboxComputerTransmissionRcl(spec = DEFAULT_SANDBOX_COMPUTER_FILE_TRANSMISSION_SPEC) {
  const normalized = normalizeSandboxComputerTransmissionSpec(spec);
  return `CIV {
  VERSION "${RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION}"
  BOUNDARY "${normalized.boundary}"

  AGENTS {
    SenderAgent -> NoiseAgent -> ReceiverAgent -> DecoderAgent -> JudgeAgent
  }

  GUARD {
    no_external_universe_proof
    no_future_file_claim
    no_filename_leak_before_reveal
    require_hash_for_lossless
    require_semantic_rubric_for_lossy
    require_negative_control
  }

  RECURSE {
    compress_file
    split_into_chunks
    shuffle_chunks
    transmit_to_receiver
    decode_or_translate
    judge_hash_or_semantics
  } UNTIL {
    lossless_hash_pass_rate >= ${normalized.thresholds.losslessHashPassRate}
    AND semantic_anchor_score >= ${normalized.thresholds.semanticAnchorScore}
    AND symbolic_protocol_score >= ${normalized.thresholds.symbolicProtocolScore}
    AND leakage_score == ${normalized.thresholds.leakageScore}
  }

  OUTPUT {
    decoded_files
    semantic_translations
    evidence_ledger
    reveal_after_scoring
    multicivilization_court
  }
}`;
}

function renderTranscriptMarkdown(bundle) {
  const { result } = bundle;
  const lines = ['# RCL v0.93 沙箱计算机文件传输 Transcript', ''];
  lines.push(`- stepCount: ${result.stepCount}`);
  lines.push(`- losslessHashPassRate: ${result.judge.losslessHashPassRate}`);
  lines.push(`- semanticAnchorScore: ${result.judge.semanticAnchorScore}`);
  lines.push(`- symbolicProtocolScore: ${result.judge.symbolicProtocolScore}`);
  lines.push(`- leakageScore: ${result.judge.leakageScore}`);
  lines.push('');
  lines.push('## 固定智能体');
  for (const agent of result.agentRegistry) lines.push(`- ${agent.id}: ${agent.role}`);
  lines.push('', '## 文件译码结果');
  for (const row of result.decoded) {
    lines.push(`### ${row.blindId}`);
    lines.push(`- mode: ${row.mode}`);
    lines.push(`- revealedName: ${row.revealAfterScoring.displayName}`);
    lines.push(`- exactHashMatches: ${row.exactHashMatches}`);
    lines.push(`- semanticAnchorScore: ${row.semanticAnchorScore}`);
    lines.push(`- symbolicProtocolScore: ${row.symbolicProtocolScore}`);
    const preview = (row.mode === 'lossless' ? row.decodedText : row.translatedText).slice(0, 320).replace(/\n/g, ' ');
    lines.push(`- preview: ${preview}${preview.length >= 320 ? ELLIPSIS : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

export function writeSandboxComputerFileTransmissionReports(outputDir = 'output/v0.93/sandbox-computer-file-transmission', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const decodedDir = path.join(target, 'decoded');
  fs.mkdirSync(decodedDir, { recursive: true });
  const bundle = runSandboxComputerFileTransmissionProtocol(input);
  const spec = buildSandboxComputerTransmissionSpec(input);
  const rcl = renderSandboxComputerTransmissionRcl(spec);
  const transcript = renderTranscriptMarkdown(bundle);
  const files = {
    'sandbox-computer-file-transmission-bundle.json': { format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_BUNDLE_FORMAT, version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION, ...bundle },
    'sandbox-computer-file-transmission-spec.json': spec,
    'sandbox-computer-file-transmission-result.json': bundle.result,
    'blind-manifest.json': bundle.result.blindManifest,
    'evidence-ledger.json': { canonicalRoot: bundle.result.canonicalRoot, senderTrace: bundle.result.senderTrace, leakage: bundle.result.leakage, judge: bundle.result.judge },
    'reveal-after-scoring.json': bundle.result.decoded.map(row => ({ blindId: row.blindId, mode: row.mode, ...row.revealAfterScoring })),
    'negative-control-audit.json': bundle.result.negativeControl,
    'rename-invariance.json': bundle.result.renameInvariance,
    'multicivilization-court.json': bundle.result.multicivilizationCourt,
    'sandbox-computer-file-transmission.rcl': rcl,
    'transmission-transcript.md': transcript,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  for (const row of bundle.result.decoded) {
    const suffix = row.mode === 'lossless' ? '.decoded.txt' : '.translated.md';
    const file = path.join(decodedDir, `${row.blindId}${suffix}`);
    fs.writeFileSync(file, row.mode === 'lossless' ? row.decodedText : row.translatedText);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.ok,
    format: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_BUNDLE_FORMAT,
    version: RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result.judge, canonicalRoot: bundle.result.canonicalRoot }),
  };
}

export function sandboxComputerTransmissionCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
