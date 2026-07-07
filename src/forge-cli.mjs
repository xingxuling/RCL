#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forgeApp } from './forge/app-forge.mjs';
import { forgeMedia } from './forge/media-forge.mjs';
import { forgeNeural } from './forge/neuro-forge.mjs';
import { readJson, writeJson, ensureDir } from './forge/common.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
  console.log(`RCL Reality Forge v0.1.0-alpha.1

Usage:
  rcl-forge app <blueprint.json> <output-dir>
  rcl-forge media <blueprint.json> <output-dir>
  rcl-forge neural <blueprint.json> <output-dir>
  rcl-forge all <output-root>
`);
}

async function runOne(kind, blueprintFile, outputDir) {
  const blueprint = readJson(blueprintFile);
  if (kind === 'app') return forgeApp(blueprint, outputDir);
  if (kind === 'media') return forgeMedia(blueprint, outputDir);
  if (kind === 'neural') return forgeNeural(blueprint, outputDir);
  throw new Error(`Unknown framework '${kind}'`);
}

const [command, first, second] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(command ? 0 : 2);
}

try {
  if (command === 'all') {
    const outputRoot = path.resolve(first ?? path.join(ROOT, 'output', 'reality-forge-demo'));
    ensureDir(outputRoot);
    const app = await runOne('app', path.join(ROOT, 'examples/forge/app/task-board.json'), path.join(outputRoot, 'app'));
    const media = await runOne('media', path.join(ROOT, 'examples/forge/media/first-light.json'), path.join(outputRoot, 'media'));
    const neural = await runOne('neural', path.join(ROOT, 'examples/forge/neural/xor.json'), path.join(outputRoot, 'neural'));
    const summary = {
      format: 'rcl.reality-forge.demo-summary.v0.1',
      createdAt: new Date().toISOString(),
      outputRoot,
      frameworks: { app, media, neural },
    };
    writeJson(outputRoot, 'demo-summary.json', summary);
    fs.writeFileSync(path.join(outputRoot, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RCL Reality Forge Demo</title><style>body{margin:0;background:#0f0d14;color:#f5efff;font:16px system-ui;padding:24px}main{max-width:1000px;margin:auto}h1{font-size:clamp(2.5rem,8vw,6rem);line-height:.95}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{display:block;color:inherit;text-decoration:none;border:1px solid #40394d;border-radius:24px;padding:24px;background:#191620;transition:.2s}.card:hover{transform:translateY(-3px);border-color:#9ee5d7}.tag{color:#9ee5d7;font-size:.8rem;letter-spacing:.12em}.muted{color:#c8bfd1}</style><main><p class="tag">RCL REALITY FORGE · VERIFIED ALPHA</p><h1>同一个现实，三条生产线。</h1><p class="muted">软件像建筑总包，多媒介像同一家制片厂，神经框架像肌肉外面长出实验室与部署门禁。</p><div class="grid"><a class="card" href="app/index.html"><p class="tag">APP FORGE</p><h2>打开现实任务板</h2><p>可离线运行、增删记录、导出数据。</p></a><a class="card" href="media/preview.html"><p class="tag">MEDIA FORGE</p><h2>查看分镜与视频</h2><p>同一 Blueprint 生成画面、WAV、MIDI 与 MP4。</p></a><a class="card" href="neural/report.html"><p class="tag">NEURO FORGE</p><h2>查看训练报告</h2><p>MLP 学习 XOR，再由 RCL 证据门禁裁决部署。</p></a></div></main></html>`, 'utf8');
    console.log(JSON.stringify(summary, null, 2));
  } else {
    if (!first || !second || !fs.existsSync(first)) {
      usage();
      process.exit(2);
    }
    const result = await runOne(command, path.resolve(first), path.resolve(second));
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    code: error.code ?? 'FORGE_FAILURE',
    message: error.message,
    details: error.details ?? {},
    stack: error.stack,
  }, null, 2));
  process.exit(1);
}
