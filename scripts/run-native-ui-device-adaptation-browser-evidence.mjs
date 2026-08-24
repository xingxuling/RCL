#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildRclWebApplication } from '../src/web-application-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(ROOT, 'examples/native-ui/device-adaptation.rcl');
const outputRoot = path.join(ROOT, 'output/native-ui-device-adaptation/web');
const htmlPath = path.join(outputRoot, 'adaptive.html');
const evidencePath = path.join(ROOT, 'examples/native-ui/evidence/device-adaptation-browser-result.json');
const browsers = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browser = browsers.find((candidate) => fs.existsSync(candidate));
if (!browser) throw new Error('RCL_UI_DEVICE_ADAPTATION_BROWSER_NOT_FOUND');

const build = buildRclWebApplication({ rclPath: sourcePath, specPath: null, outputPath: htmlPath });
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-device-adaptation-browser-'));

function decodeOutput(html) {
  const match = html.match(/<output id="rcl-test-result"[^>]*>([\s\S]*?)<\/output>/u);
  if (!match) throw new Error('RCL_UI_DEVICE_ADAPTATION_BROWSER_RESULT_MISSING');
  return JSON.parse(match[1]
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&'));
}

try {
  const observations = [];
  for (const requestedWidth of [320, 840]) {
    const profilePath = path.join(tempRoot, `profile-${requestedWidth}`);
    const execution = spawnSync(browser, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      `--user-data-dir=${profilePath}`, `--window-size=${requestedWidth},800`,
      '--virtual-time-budget=3000', '--dump-dom', `${pathToFileURL(htmlPath).href}?rclTest=1`,
    ], { encoding: 'utf8', timeout: 30_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (execution.error) throw execution.error;
    if (execution.status !== 0) throw new Error(`RCL_UI_DEVICE_ADAPTATION_BROWSER_EXIT:${execution.status}:${execution.stderr}`);
    const result = decodeOutput(execution.stdout);
    if (result.status !== 'PASS') throw new Error(`RCL_UI_DEVICE_ADAPTATION_BROWSER_RESULT:${JSON.stringify(result)}`);
    observations.push({ requestedWidth, profile: result.deviceAdaptation?.profile, layouts: result.deviceAdaptation?.layouts });
  }
  if (observations[0].profile !== 'compact' || observations[0].layouts?.Root !== 'vertical'
      || observations[1].profile !== 'expanded' || observations[1].layouts?.Root !== 'horizontal') {
    throw new Error(`RCL_UI_DEVICE_ADAPTATION_BROWSER_SEMANTICS:${JSON.stringify(observations)}`);
  }
  const escapedBrowser = browser.replaceAll("'", "''");
  const version = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${escapedBrowser}').VersionInfo.ProductVersion`], { encoding: 'utf8', timeout: 10_000, windowsHide: true })
    : spawnSync(browser, ['--version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  const evidence = {
    format: 'rcl.native-ui.device-adaptation-browser-evidence.v0.1',
    status: 'PASS',
    mode: 'headless-real-browser-viewport-and-computed-style',
    browser: path.basename(browser),
    browserVersion: version.stdout.trim() || 'UNKNOWN',
    source: 'examples/native-ui/device-adaptation.rcl',
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    uiProgramRoot: build.manifest.uiProgramRoot,
    htmlSha256: build.htmlSha256,
    observations,
    boundary: 'Real browser viewport classification and computed flex direction are verified. This is not Android-device or cross-device performance evidence.',
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  const resolved = path.resolve(tempRoot);
  if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('RCL_UI_DEVICE_ADAPTATION_BROWSER_TEMP_SCOPE');
  fs.rmSync(resolved, { recursive: true, force: true });
}
