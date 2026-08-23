import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(ROOT, 'output/native-ui-genome-v0.1/web/counter.html');
const evidencePath = path.join(ROOT, 'examples/native-ui/evidence/browser-runtime-result.json');
const profilePath = path.join(ROOT, 'output/native-ui-genome-v0.1/chrome-evidence-profile');
const referencePath = path.join(ROOT, 'output/native-ui-genome-v0.1/web/reference-counter.html');
const browsers = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browser = browsers.find((candidate) => fs.existsSync(candidate));
if (!browser) throw new Error('RCL_UI_BROWSER_NOT_FOUND');
if (!fs.existsSync(htmlPath)) throw new Error('RCL_UI_WEB_BUILD_MISSING');
fs.mkdirSync(profilePath, { recursive: true });

const url = `${pathToFileURL(htmlPath).href}?rclTest=1`;
const hostStarted = performance.now();
const execution = spawnSync(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  `--user-data-dir=${profilePath}`, '--virtual-time-budget=3000', '--dump-dom', url,
], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const hostElapsedMs = performance.now() - hostStarted;
if (execution.error) throw execution.error;
if (execution.status !== 0) throw new Error(`RCL_UI_BROWSER_EXIT:${execution.status}:${execution.stderr}`);
const match = execution.stdout.match(/<output id="rcl-test-result"[^>]*>([\s\S]*?)<\/output>/u);
if (!match) throw new Error('RCL_UI_BROWSER_RESULT_MISSING');
const decoded = match[1]
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');
const result = JSON.parse(decoded);
if (result.status !== 'PASS') throw new Error(`RCL_UI_BROWSER_RESULT:${JSON.stringify(result)}`);
const referenceHtml = `<!doctype html><meta charset="utf-8"><button id="inc">inc</button><button id="reset">reset</button><output id="reference-counter-result"></output><script>let count=0;inc.onclick=()=>{count+=1};reset.onclick=()=>{count=0};const iterations=50;const started=performance.now();for(let i=0;i<iterations;i++){inc.click();inc.click();reset.click()}const durationMs=performance.now()-started;document.querySelector('#reference-counter-result').textContent=JSON.stringify({status:count===0?'PASS':'FAIL',count,iterations,eventsPerIteration:3,durationMs});</script>`;
fs.writeFileSync(referencePath, referenceHtml, 'utf8');
const referenceExecution = spawnSync(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  `--user-data-dir=${profilePath}`, '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(referencePath).href,
], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
if (referenceExecution.error) throw referenceExecution.error;
if (referenceExecution.status !== 0) throw new Error(`RCL_UI_REFERENCE_BROWSER_EXIT:${referenceExecution.status}:${referenceExecution.stderr}`);
const referenceMatch = referenceExecution.stdout.match(/<output id="reference-counter-result">([\s\S]*?)<\/output>/u);
if (!referenceMatch) throw new Error('RCL_UI_REFERENCE_BROWSER_RESULT_MISSING');
const reference = JSON.parse(referenceMatch[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
if (reference.status !== 'PASS') throw new Error(`RCL_UI_REFERENCE_BROWSER_RESULT:${JSON.stringify(reference)}`);
const escapedBrowser = browser.replaceAll("'", "''");
const version = process.platform === 'win32'
  ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${escapedBrowser}').VersionInfo.ProductVersion`], { encoding: 'utf8', timeout: 10000, windowsHide: true })
  : spawnSync(browser, ['--version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
const evidence = {
  format: 'rcl.native-ui.browser-runtime-evidence.v0.1',
  status: result.status,
  browser: path.basename(browser),
  browserVersion: version.stdout.trim() || 'UNKNOWN',
  mode: 'headless-real-browser-dom-events',
  uiProgramRoot: result.uiProgramRoot,
  eventCount: result.trace.length,
  finalState: result.finalState,
  trace: result.trace,
  performance: {
    ...result.performance,
    referenceDurationMs: reference.durationMs,
    slowdown: reference.durationMs > 0 ? result.performance.rclDurationMs / reference.durationMs : null,
    hostBrowserProcessElapsedMs: hostElapsedMs,
    reference: 'same-process plain DOM button counter',
  },
};
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
