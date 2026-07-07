import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileReality, runReality, forgeApp, forgeMedia, forgeNeural } from '../src/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function fixture(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function temp(name) { return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`)); }

function assertManifest(output, framework) {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.framework, framework);
  assert.match(manifest.root, /^[0-9a-f]{64}$/);
  assert.ok(manifest.artifactCount > 0);
  assert.ok(manifest.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256)));
  return manifest;
}

test('RCL App Forge creates an authorized runnable offline application', async () => {
  const root = temp('rcl-app-forge');
  const output = path.join(root, 'app');
  const receipt = await forgeApp(fixture('examples/forge/app/task-board.json'), output);
  assert.equal(receipt.status, 'verified');
  for (const file of ['index.html', 'app.js', 'styles.css', 'sw.js', 'blueprint.json', 'schema.json', 'policy.rcl', 'authority.rcl', 'rcl-run.json', 'manifest.json']) {
    assert.ok(fs.existsSync(path.join(output, file)), file);
  }
  const policy = compileReality(fs.readFileSync(path.join(output, 'policy.rcl'), 'utf8'));
  assert.equal(policy.rules.length, 2);
  const rclRun = JSON.parse(fs.readFileSync(path.join(output, 'rcl-run.json'), 'utf8'));
  assert.ok(rclRun.history.some(item => Array.isArray(item.witnesses) && item.witnesses.includes('rcl:app-forge:authorized-build')));
  assertManifest(output, 'RCL App Forge');
});

test('RCL Media Forge generates a shared visual/audio projection and a playable MP4', async () => {
  const root = temp('rcl-media-forge');
  const output = path.join(root, 'media');
  const receipt = await forgeMedia(fixture('examples/forge/media/first-light.json'), output);
  for (const file of ['preview.html', 'timeline.json', 'soundtrack.wav', 'score.mid', 'media-world.rcl', 'authority.rcl', 'rcl-run.json', 'render-report.json', 'manifest.json']) {
    assert.ok(fs.existsSync(path.join(output, file)), file);
  }
  const world = await runReality(fs.readFileSync(path.join(output, 'media-world.rcl'), 'utf8'));
  assert.equal(world.foundation.domains.energy, 1);
  assert.equal(world.foundation.domains.spirit, 1);
  const render = JSON.parse(fs.readFileSync(path.join(output, 'render-report.json'), 'utf8'));
  if (render.available) {
    assert.equal(render.ok, true, render.stderr);
    assert.ok(fs.existsSync(path.join(output, 'video.mp4')));
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(output, 'video.mp4')], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    assert.ok(Number(probe.stdout.trim()) >= 5.9);
  } else {
    assert.equal(receipt.status, 'proxy-verified');
  }
  const midi = fs.readFileSync(path.join(output, 'score.mid'));
  assert.equal(midi.subarray(0, 4).toString('ascii'), 'MThd');
  const wav = fs.readFileSync(path.join(output, 'soundtrack.wav'));
  assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
  assertManifest(output, 'RCL Media Forge');
});

test('RCL Neuro Forge trains XOR and RCL blocks or permits deployment from measured evidence', async () => {
  const root = temp('rcl-neuro-forge');
  const output = path.join(root, 'neural');
  const receipt = await forgeNeural(fixture('examples/forge/neural/xor.json'), output);
  assert.equal(receipt.status, 'verified');
  assert.equal(receipt.details.deployed, true);
  assert.ok(receipt.details.accuracy >= 0.95);
  for (const file of ['model.json', 'metrics.json', 'training-history.json', 'deployment-gate.rcl', 'deployment-run.json', 'report.html', 'authority.rcl', 'rcl-run.json', 'manifest.json']) {
    assert.ok(fs.existsSync(path.join(output, file)), file);
  }
  const deployment = JSON.parse(fs.readFileSync(path.join(output, 'deployment-run.json'), 'utf8'));
  assert.equal(deployment.state['model.deployed'], true);
  assert.equal(deployment.foundation.domains.neural, 1);
  assert.equal(deployment.foundation.domains.quantitative, 1);
  assert.equal(deployment.foundation.domains.knowledge, 1);
  assert.equal(deployment.foundation.domains.science, 1);
  assert.ok(deployment.projections.length === 1);
  assertManifest(output, 'RCL Neuro Forge');
});
