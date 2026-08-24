import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLanguageFederationEvidence, compileRslSurfaceToRcl } from '../src/auxiliary-language-federation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleRoot = path.join(root, 'examples', 'language-federation');
const evidenceRoot = path.join(exampleRoot, 'evidence');
const corpus = JSON.parse(fs.readFileSync(path.join(exampleRoot, 'rsl-corpus.v0.1.json'), 'utf8'));
const report = buildLanguageFederationEvidence({ corpus });
const zh = compileRslSurfaceToRcl('建立项目 federation_demo', 'zh-CN');
const en = compileRslSurfaceToRcl('create project federation_demo', 'en-US');

fs.mkdirSync(evidenceRoot, { recursive: true });
fs.writeFileSync(path.join(evidenceRoot, 'language-federation-report.v0.1.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceRoot, 'rsl-zh-cn-result.v0.1.json'), `${JSON.stringify(zh, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceRoot, 'rsl-en-us-result.v0.1.json'), `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceRoot, 'rsl-federation-demo.rcl'), zh.rclSource);

console.log(JSON.stringify({ status: report.status, root: report.root, benchmarkRoot: report.benchmark.root, languageCount: report.registry.languageCount }, null, 2));
