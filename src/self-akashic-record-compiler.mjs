import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';

export const RCL_SELF_AKASHIC_RECORD_VERSION = '0.57.0-alpha.1';
export const RCL_SELF_AKASHIC_SPEC_FORMAT = 'rcl.self-akashic-record-spec.v0.57';
export const RCL_SELF_AKASHIC_RESULT_FORMAT = 'rcl.self-akashic-record-result.v0.57';
export const RCL_SELF_AKASHIC_BUNDLE_FORMAT = 'rcl.self-akashic-record-bundle.v0.57';
export const RCL_SELF_AKASHIC_TECH_DOC_FORMAT = 'rcl.self-akashic-record-technical-document.v0.57';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b), 0) / values.length;
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function safeFileName(value) {
  return String(value ?? 'self-akashic-record')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'self-akashic-record';
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listFiles(root, options = {}) {
  const includeDirs = new Set(options.includeDirs ?? ['src', 'docs', 'tests', 'examples']);
  const excludeDirs = new Set(options.excludeDirs ?? ['node_modules', 'output', 'build', 'native', '.git']);
  const maxFiles = Number(options.maxFiles ?? 900);
  const out = [];
  function walk(dir, depth = 0) {
    if (out.length >= maxFiles) return;
    const rel = path.relative(root, dir).replaceAll(path.sep, '/');
    const first = rel.split('/')[0];
    if (rel && excludeDirs.has(first)) return;
    if (depth === 0) {
      for (const name of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          if (includeDirs.has(name)) walk(p, depth + 1);
        } else if (['package.json', 'package-lock.json', 'README.md', 'CONTEXT.md', 'release-manifest.json'].includes(name) || /^release.*\.json$/.test(name)) {
          out.push(p);
        }
      }
      return;
    }
    for (const name of fs.readdirSync(dir).sort()) {
      if (out.length >= maxFiles) break;
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (!excludeDirs.has(name)) walk(p, depth + 1);
      } else if (/\.(mjs|js|json|md|rcl)$/i.test(name)) {
        out.push(p);
      }
    }
  }
  walk(root, 0);
  return out;
}

function parseCommands(cliText) {
  const setMatch = cliText.match(/const commands = new Set\(\[([\s\S]*?)\]\);/);
  if (!setMatch) return [];
  const commands = [];
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(setMatch[1]))) commands.push(m[1]);
  return [...new Set(commands)].sort();
}

function parseImportsAndExports(indexText) {
  const exports = [...indexText.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)].map(match => ({
    from: match[2],
    symbols: match[1].split(',').map(s => s.trim()).filter(Boolean),
  }));
  const exportSymbolCount = exports.reduce((sum, row) => sum + row.symbols.length, 0);
  return { exports, exportSymbolCount };
}

function parseVersionFromText(text) {
  const matches = [...String(text ?? '').matchAll(/v?(\d+)\.(\d+)(?:\.(\d+))?(?:-alpha\.?(\d+)?)?/gi)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  return {
    raw: last[0],
    major: Number(last[1] ?? 0),
    minor: Number(last[2] ?? 0),
    patch: Number(last[3] ?? 0),
    alpha: Number(last[4] ?? 0),
  };
}

function buildVersionLedger(root) {
  const docs = [
    ...fs.existsSync(path.join(root, 'docs')) ? fs.readdirSync(path.join(root, 'docs')).map(name => path.join(root, 'docs', name)) : [],
    ...fs.readdirSync(root).filter(name => /^release.*\.json$/.test(name)).map(name => path.join(root, name)),
  ].filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
  const rows = docs
    .map(p => {
      const rel = path.relative(root, p).replaceAll(path.sep, '/');
      const v = parseVersionFromText(rel) ?? parseVersionFromText(readTextIfExists(p).slice(0, 600));
      return v ? { path: rel, version: v.raw, minor: v.minor, root: sha256(readTextIfExists(p).slice(0, 4000)) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.minor - b.minor || a.path.localeCompare(b.path));
  return rows;
}

export const DEFAULT_SELF_AKASHIC_RECORD_SPEC = Object.freeze({
  format: RCL_SELF_AKASHIC_SPEC_FORMAT,
  id: 'rcl_self_akashic_record_default_v0',
  version: RCL_SELF_AKASHIC_RECORD_VERSION,
  objective: 'Compile RCL own version history, module structure, CLI surface, test surface and generated documents as a self-Akashic record, then verify whether RCL can produce its own technical record without unbounded recursion.',
  repositoryRoot: '.',
  scan: {
    includeDirs: ['src', 'docs', 'tests', 'examples'],
    excludeDirs: ['node_modules', 'output', 'build', 'native', '.git'],
    maxFiles: 900,
  },
  thresholds: {
    minSelfClosureScore: 0.86,
    minVersionLedgerCount: 28,
    minModuleCount: 55,
    minCommandCount: 85,
    minTestCount: 38,
    minDocumentCount: 5,
    requireReplayStable: true,
    requireGeneratedDocs: true,
  },
  documentTargets: [
    'self-akashic-technical-record',
    'version-ledger',
    'module-graph',
    'cli-surface',
    'self-verification',
  ],
});

export function normalizeSelfAkashicRecordSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SELF_AKASHIC_RECORD_SPEC));
  return {
    ...base,
    ...input,
    scan: { ...base.scan, ...(input.scan ?? {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    documentTargets: Array.isArray(input.documentTargets) ? input.documentTargets : base.documentTargets,
  };
}

export function scanRclSelfAkashicRepository(specInput = {}) {
  const spec = normalizeSelfAkashicRecordSpec(specInput);
  const root = path.resolve(spec.repositoryRoot || '.');
  const files = listFiles(root, spec.scan);
  const packageJson = tryReadJson(path.join(root, 'package.json')) ?? {};
  const sourceModules = files.filter(p => path.relative(root, p).replaceAll(path.sep, '/').startsWith('src/') && p.endsWith('.mjs'));
  const docs = files.filter(p => path.relative(root, p).replaceAll(path.sep, '/').startsWith('docs/') && p.endsWith('.md'));
  const tests = files.filter(p => path.relative(root, p).replaceAll(path.sep, '/').startsWith('tests/') && p.endsWith('.mjs'));
  const examples = files.filter(p => path.relative(root, p).replaceAll(path.sep, '/').startsWith('examples/'));
  const cliText = readTextIfExists(path.join(root, 'src', 'cli.mjs'));
  const indexText = readTextIfExists(path.join(root, 'src', 'index.mjs'));
  const commands = parseCommands(cliText);
  const index = parseImportsAndExports(indexText);
  const versionLedger = buildVersionLedger(root);
  const moduleRows = sourceModules.sort().map(p => ({
    path: path.relative(root, p).replaceAll(path.sep, '/'),
    bytes: fs.statSync(p).size,
    root: sha256(readTextIfExists(p)),
  }));
  const docRows = docs.sort().map(p => ({
    path: path.relative(root, p).replaceAll(path.sep, '/'),
    bytes: fs.statSync(p).size,
    root: sha256(readTextIfExists(p).slice(0, 5000)),
  }));
  const testRows = tests.sort().map(p => ({
    path: path.relative(root, p).replaceAll(path.sep, '/'),
    bytes: fs.statSync(p).size,
    root: sha256(readTextIfExists(p)),
  }));
  const scanRoot = sha256({
    package: { name: packageJson.name, version: packageJson.version, description: packageJson.description },
    modules: moduleRows,
    docs: docRows,
    tests: testRows,
    commands,
    indexExportSymbolCount: index.exportSymbolCount,
    versionLedger,
  });
  return {
    root,
    package: { name: packageJson.name, version: packageJson.version, description: packageJson.description },
    counts: {
      fileCount: files.length,
      moduleCount: sourceModules.length,
      docCount: docs.length,
      testCount: tests.length,
      exampleCount: examples.length,
      commandCount: commands.length,
      exportBlockCount: index.exports.length,
      exportSymbolCount: index.exportSymbolCount,
      versionLedgerCount: versionLedger.length,
    },
    commands,
    moduleRows,
    docRows,
    testRows,
    versionLedger,
    indexExports: index.exports.map(row => ({ from: row.from, symbolCount: row.symbols.length, symbols: row.symbols.slice(0, 8) })),
    scanRoot,
  };
}

export function evaluateSelfAkashicRecord(specInput = {}) {
  const spec = normalizeSelfAkashicRecordSpec(specInput);
  const first = scanRclSelfAkashicRepository(spec);
  const second = scanRclSelfAkashicRepository(spec);
  const replayStable = first.scanRoot === second.scanRoot;
  const t = spec.thresholds;
  const versionLedgerScore = round(clamp(first.counts.versionLedgerCount / t.minVersionLedgerCount), 9);
  const moduleStructureScore = round(clamp(first.counts.moduleCount / t.minModuleCount), 9);
  const cliSurfaceScore = round(clamp(first.counts.commandCount / t.minCommandCount), 9);
  const testSurfaceScore = round(clamp(first.counts.testCount / t.minTestCount), 9);
  const indexExportScore = round(clamp(first.counts.exportSymbolCount / 250), 9);
  const documentGenerationScore = round(clamp((spec.documentTargets?.length ?? 0) / t.minDocumentCount), 9);
  const replayStabilityScore = replayStable ? 1 : 0;
  const recursionBoundednessScore = round(clamp((spec.scan.excludeDirs ?? []).filter(name => ['output', 'build', 'native', 'node_modules', '.git'].includes(name)).length / 5), 9);
  const selfReferenceDepthScore = round(clamp(mean([
    first.counts.versionLedgerCount > 0 ? 1 : 0,
    first.counts.moduleCount > 0 ? 1 : 0,
    first.counts.commandCount > 0 ? 1 : 0,
    spec.documentTargets?.includes('self-verification') ? 1 : 0,
  ])), 9);
  const selfClosureScore = round(weightedMean([
    { id: 'version_ledger', score: versionLedgerScore, weight: 1.25 },
    { id: 'module_structure', score: moduleStructureScore, weight: 1.15 },
    { id: 'cli_surface', score: cliSurfaceScore, weight: 1.00 },
    { id: 'test_surface', score: testSurfaceScore, weight: 1.00 },
    { id: 'index_exports', score: indexExportScore, weight: 0.85 },
    { id: 'document_generation', score: documentGenerationScore, weight: 1.20 },
    { id: 'replay_stability', score: replayStabilityScore, weight: 1.35 },
    { id: 'recursion_boundedness', score: recursionBoundednessScore, weight: 1.20 },
    { id: 'self_reference_depth', score: selfReferenceDepthScore, weight: 0.95 },
  ]), 9);
  const selfAkashicEstablished = selfClosureScore >= t.minSelfClosureScore
    && (!t.requireReplayStable || replayStable)
    && (!t.requireGeneratedDocs || documentGenerationScore >= 1)
    && first.counts.versionLedgerCount >= t.minVersionLedgerCount
    && first.counts.moduleCount >= t.minModuleCount
    && first.counts.commandCount >= t.minCommandCount
    && first.counts.testCount >= t.minTestCount;
  return {
    scan: first,
    replayStable,
    scores: {
      versionLedgerScore,
      moduleStructureScore,
      cliSurfaceScore,
      testSurfaceScore,
      indexExportScore,
      documentGenerationScore,
      replayStabilityScore,
      recursionBoundednessScore,
      selfReferenceDepthScore,
      selfClosureScore,
    },
    selfAkashicEstablished,
    root: sha256({ spec, scanRoot: first.scanRoot, scores: { selfClosureScore, replayStable } }),
  };
}

export function renderSelfAkashicTechnicalDocument(kind = 'self-akashic-technical-record', evaluationInput = {}, specInput = {}) {
  const spec = normalizeSelfAkashicRecordSpec(specInput);
  const evaluation = evaluationInput.scan ? evaluationInput : evaluateSelfAkashicRecord(spec);
  const scan = evaluation.scan;
  const scores = evaluation.scores;
  const titleMap = {
    'self-akashic-technical-record': 'RCL Self-Akashic Technical Record（RCL 自阿卡西技术记录）',
    'version-ledger': 'RCL Version Ledger（RCL 版本账本）',
    'module-graph': 'RCL Module Graph（RCL 模块图谱）',
    'cli-surface': 'RCL CLI Surface（RCL 命令界面）',
    'self-verification': 'RCL Self Verification（RCL 自验证报告）',
  };
  const title = titleMap[kind] ?? `${kind}（自记录文档）`;
  let body = [];
  if (kind === 'version-ledger') {
    body = [
      '## Version Ledger（版本账本）',
      '',
      ...scan.versionLedger.slice(-40).map((row, index) => `${index + 1}. \`${row.path}\` → ${row.version}`),
    ];
  } else if (kind === 'module-graph') {
    body = [
      '## Module Graph（模块图谱）',
      '',
      `- Module Count（模块数量）: ${scan.counts.moduleCount}`,
      `- Export Symbol Count（导出符号数量）: ${scan.counts.exportSymbolCount}`,
      '',
      '### Representative Modules（代表模块）',
      '',
      ...scan.moduleRows.slice(-32).map((row, index) => `${index + 1}. \`${row.path}\` (${row.bytes} bytes)`),
    ];
  } else if (kind === 'cli-surface') {
    body = [
      '## CLI Surface（命令界面）',
      '',
      `- Command Count（命令数量）: ${scan.counts.commandCount}`,
      '',
      ...scan.commands.slice(-60).map((cmd, index) => `${index + 1}. \`${cmd}\``),
    ];
  } else if (kind === 'self-verification') {
    body = [
      '## Self Verification（自验证）',
      '',
      `- Replay Stable（重放稳定）: ${evaluation.replayStable}`,
      `- Recursion Boundedness（递归边界）: ${scores.recursionBoundednessScore}`,
      `- Self Closure Score（自闭合分）: ${scores.selfClosureScore}`,
      `- Self-Akashic Established（自阿卡西成立）: ${evaluation.selfAkashicEstablished}`,
      '',
      '### Failure Conditions（失败条件）',
      '',
      '1. 版本账本无法扫描或少于阈值。',
      '2. 模块图谱无法稳定重放。',
      '3. CLI / Index / Test 面不能形成可复验自描述。',
      '4. 扫描没有排除 output/build/native 等递归膨胀目录。',
    ];
  } else {
    body = [
      '## Core Finding（核心发现）',
      '',
      'RCL can compile its own version history, module structure, CLI surface, tests and generated documents into a bounded self-record. This is a self-Akashic record: not an omniscient library, but a finite self-indexed technical ledger.',
      '',
      'RCL 可以把自己的版本历史、模块结构、CLI 命令面、测试面和生成文档编译成一个有界自记录。这不是全知图书馆，而是有限自索引技术账本。',
      '',
      '## Scores（评分）',
      '',
      `- Version Ledger（版本账本）: ${scores.versionLedgerScore}`,
      `- Module Structure（模块结构）: ${scores.moduleStructureScore}`,
      `- CLI Surface（CLI 命令面）: ${scores.cliSurfaceScore}`,
      `- Test Surface（测试面）: ${scores.testSurfaceScore}`,
      `- Index Exports（索引导出）: ${scores.indexExportScore}`,
      `- Document Generation（文档生成）: ${scores.documentGenerationScore}`,
      `- Replay Stability（重放稳定性）: ${scores.replayStabilityScore}`,
      `- Recursion Boundedness（递归边界性）: ${scores.recursionBoundednessScore}`,
      `- Self Closure（自闭合）: ${scores.selfClosureScore}`,
    ];
  }
  const md = [
    `# ${title}`,
    '',
    `**Format（格式）**: ${RCL_SELF_AKASHIC_TECH_DOC_FORMAT}`,
    `**Status（状态）**: ${evaluation.selfAkashicEstablished ? 'self_akashic_established（自阿卡西成立）' : 'not_established（未成立）'}`,
    `**Package（包）**: ${scan.package.name ?? 'unknown'} @ ${scan.package.version ?? 'unknown'}`,
    `**Scan Root（扫描根）**: ${scan.scanRoot}`,
    '',
    ...body,
    '',
    `**Root（根哈希）**: ${sha256({ kind, scanRoot: scan.scanRoot, scores, body })}`,
    `**Source Spec（来源规格）**: ${spec.id}`,
  ].join('\n');
  return { format: RCL_SELF_AKASHIC_TECH_DOC_FORMAT, id: kind, title, markdown: md, root: sha256(md) };
}

export function runSelfAkashicRecordCompiler(input = {}) {
  const spec = normalizeSelfAkashicRecordSpec(input);
  const evaluation = evaluateSelfAkashicRecord(spec);
  const documents = spec.documentTargets.map(kind => renderSelfAkashicTechnicalDocument(kind, evaluation, spec));
  const result = {
    format: RCL_SELF_AKASHIC_RESULT_FORMAT,
    version: RCL_SELF_AKASHIC_RECORD_VERSION,
    ok: evaluation.selfAkashicEstablished,
    selfAkashicEstablished: evaluation.selfAkashicEstablished,
    rclSelfInternalized: evaluation.selfAkashicEstablished,
    generatedOwnTechnicalDocuments: documents.length >= spec.thresholds.minDocumentCount,
    verdict: evaluation.selfAkashicEstablished
      ? '成立：RCL 能把自身版本历史、模块结构、CLI、测试与文档编译成有限自阿卡西记录，并生成自身技术文档。'
      : '未成立：RCL 自身记录未能同时满足版本账本、模块图谱、CLI 面、测试面、递归边界与文档生成。',
    package: evaluation.scan.package,
    counts: evaluation.scan.counts,
    scores: evaluation.scores,
    documentCount: documents.length,
    documentIds: documents.map(doc => doc.id),
    replayStable: evaluation.replayStable,
    scanRoot: evaluation.scan.scanRoot,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined }, documents: documents.map(d => d.root) });
  return { spec, result, scan: evaluation.scan, documents };
}

export function buildSelfAkashicRecordSpec(input = {}) {
  const bundle = runSelfAkashicRecordCompiler(input);
  return {
    ...bundle.spec,
    compilerPasses: [
      'repository bounded scan',
      'version ledger extraction',
      'module graph extraction',
      'CLI surface extraction',
      'test surface extraction',
      'canonical replay stability check',
      'self technical document generation',
    ],
    validation: {
      selfAkashicEstablished: bundle.result.selfAkashicEstablished,
      rclSelfInternalized: bundle.result.rclSelfInternalized,
      generatedOwnTechnicalDocuments: bundle.result.generatedOwnTechnicalDocuments,
      selfClosureScore: bundle.result.scores.selfClosureScore,
      replayStable: bundle.result.replayStable,
      root: bundle.result.root,
    },
  };
}

export function renderSelfAkashicRecordRcl(input = {}) {
  const spec = buildSelfAkashicRecordSpec(input);
  const v = spec.validation;
  return [
    'reality SelfAkashicRecordCompiler {',
    `  version : Text = "${RCL_SELF_AKASHIC_RECORD_VERSION}"`,
    `  format : Text = "${RCL_SELF_AKASHIC_SPEC_FORMAT}"`,
    '  input : Repository = "RCL Self（RCL 自身）"',
    '  decomposition : List = [',
    '    "Version Ledger（版本账本）",',
    '    "Module Graph（模块图谱）",',
    '    "CLI Surface（命令界面）",',
    '    "Test Surface（测试面）",',
    '    "Self Technical Documents（自身技术文档）"',
    '  ]',
    `  validation.established : Truth = ${v.selfAkashicEstablished ? 'true' : 'false'}`,
    `  validation.internalized : Truth = ${v.rclSelfInternalized ? 'true' : 'false'}`,
    `  validation.generated_docs : Truth = ${v.generatedOwnTechnicalDocuments ? 'true' : 'false'}`,
    `  validation.self_closure_score : Number = ${v.selfClosureScore}`,
    `  validation.replay_stable : Truth = ${v.replayStable ? 'true' : 'false'}`,
    `  root : Hash = "${v.root}"`,
    '}',
  ].join('\n');
}

export function runSelfAkashicRecordDemo() {
  const bundle = runSelfAkashicRecordCompiler();
  return {
    ok: bundle.result.ok,
    format: RCL_SELF_AKASHIC_BUNDLE_FORMAT,
    version: RCL_SELF_AKASHIC_RECORD_VERSION,
    selfAkashicEstablished: bundle.result.selfAkashicEstablished,
    rclSelfInternalized: bundle.result.rclSelfInternalized,
    generatedOwnTechnicalDocuments: bundle.result.generatedOwnTechnicalDocuments,
    selfClosureScore: bundle.result.scores.selfClosureScore,
    counts: bundle.result.counts,
    documentIds: bundle.result.documentIds,
    root: bundle.result.root,
  };
}

export function readSelfAkashicRecordInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function writeSelfAkashicRecordReports(outDir = 'output/v0.57/self-akashic-record', input = {}) {
  const bundle = runSelfAkashicRecordCompiler(input);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'self-akashic-record-spec.json'), `${JSON.stringify(bundle.spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'self-akashic-record-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'self-akashic-record.rcl'), `${renderSelfAkashicRecordRcl(bundle.spec)}\n`);
  const docsDir = path.join(outDir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeFileName(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: true,
    format: RCL_SELF_AKASHIC_BUNDLE_FORMAT,
    version: RCL_SELF_AKASHIC_RECORD_VERSION,
    outputDir: outDir,
    resultPath: path.join(outDir, 'self-akashic-record-result.json'),
    docsDir,
    documentCount: bundle.documents.length,
    selfAkashicEstablished: bundle.result.selfAkashicEstablished,
    rclSelfInternalized: bundle.result.rclSelfInternalized,
    generatedOwnTechnicalDocuments: bundle.result.generatedOwnTechnicalDocuments,
    selfClosureScore: bundle.result.scores.selfClosureScore,
    root: bundle.result.root,
  };
}

export function selfAkashicRecordCanonicalRoot(input = {}) {
  return runSelfAkashicRecordCompiler(input).result.root;
}
