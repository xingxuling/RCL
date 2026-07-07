import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertArray, assertFiniteNumber, assertObject, assertText, atomicDirectory,
  artifactManifest, escapeHtml, identifier, receipt, writeBuffer, writeJson, writeText,
} from './common.mjs';
import { runAuthorizedProvider } from './rcl-driver.mjs';

export const MEDIA_FORGE_VERSION = '0.1.0-alpha.1';

function parseHexColor(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^#?([0-9a-f]{6})$/i.exec(text);
  const hex = match?.[1] ?? fallback.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function colorHex(rgb) {
  return `#${rgb.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

export function validateMediaBlueprint(input) {
  const blueprint = structuredClone(assertObject(input, 'media blueprint'));
  blueprint.title = assertText(blueprint.title, 'title', { max: 160 });
  blueprint.width = Math.round(assertFiniteNumber(blueprint.width ?? 320, 'width', { min: 160, max: 1280 }));
  blueprint.height = Math.round(assertFiniteNumber(blueprint.height ?? 180, 'height', { min: 90, max: 720 }));
  blueprint.fps = Math.round(assertFiniteNumber(blueprint.fps ?? 8, 'fps', { min: 1, max: 30 }));
  blueprint.sampleRate = Math.round(assertFiniteNumber(blueprint.sampleRate ?? 22050, 'sampleRate', { min: 8000, max: 48000 }));
  blueprint.tempo = Math.round(assertFiniteNumber(blueprint.tempo ?? 100, 'tempo', { min: 40, max: 220 }));
  blueprint.scenes = assertArray(blueprint.scenes, 'scenes', { min: 1 }).map((scene, index) => {
    const value = assertObject(scene, `scenes[${index}]`);
    value.id = String(value.id ?? `scene-${index + 1}`);
    value.caption = assertText(value.caption ?? value.id, `scenes[${index}].caption`, { max: 240 });
    value.duration = assertFiniteNumber(value.duration ?? 2, `scenes[${index}].duration`, { min: 0.5, max: 10 });
    value.mood = String(value.mood ?? 'curious').slice(0, 80);
    value.energy = assertFiniteNumber(value.energy ?? 0.5, `scenes[${index}].energy`, { min: 0, max: 1 });
    value.colorA = colorHex(parseHexColor(value.colorA, '#33245c'));
    value.colorB = colorHex(parseHexColor(value.colorB, '#71d8c6'));
    value.motif = String(value.motif ?? 'orb').slice(0, 40);
    value.notes = Array.isArray(value.notes) && value.notes.length ? value.notes.map(String).slice(0, 16) : ['C4', 'E4', 'G4'];
    return value;
  });
  const total = blueprint.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (total > 30) throw new Error('Media demo blueprint is limited to 30 seconds in v0.1');
  const pixelFrames = blueprint.width * blueprint.height * blueprint.fps * total;
  if (pixelFrames > 50_000_000) {
    throw new Error(`Media blueprint exceeds the v0.1 pixel-frame budget: ${Math.round(pixelFrames).toLocaleString()} > 50,000,000`);
  }
  return blueprint;
}

function generateMediaWorldRcl(blueprint) {
  const reality = identifier(`${blueprint.title}_MediaWorld`, 'MediaWorld');
  const total = blueprint.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const avgEnergy = blueprint.scenes.reduce((sum, scene) => sum + scene.energy, 0) / blueprint.scenes.length;
  return `# Canonical media-world projection. Rendering and audio synthesis remain replaceable Providers.
reality ${reality} {
  facet media.duration : Number = ${total.toFixed(6)}
  facet media.scene_count : Number = ${blueprint.scenes.length}

  energy score {
    reservoir narrative : Energy = joules(${Math.max(1, Math.round(avgEnergy * 100))})
    reservoir projection : Energy = joules(0)
    flow render from narrative to projection amount joules(${Math.max(1, Math.round(avgEnergy * 60))}) efficiency 0.9 evidence "media:energy-arc"
    preserve score.narrative >= joules(0)
    preserve score.projection >= joules(0)
    witness "media:energy-projection"
  }

  spacetime timeline {
    frame media dimensions 3 topology "timeline"
    clock playback : Time = seconds(0) tick seconds(${(1 / blueprint.fps).toFixed(8)}) rate 1
    coordinate origin = point("media", meters(0), meters(0), meters(0), seconds(0)) target "story.origin" clock playback
    preserve timeline.playback >= seconds(0)
  }

  spirit theme {
    facet identity : Text = ${JSON.stringify(blueprint.title)}
    value continuity : Number = 1 weight 1
    purpose communicate : Truth = true priority 1
    affect intensity : Number = ${avgEnergy.toFixed(6)} intensity ${avgEnergy.toFixed(6)}
    preserve theme.value.continuity >= 1
    evidence "media:shared-world-identity"
  }

  energize score
  synchronize timeline steps ${Math.max(1, Math.round(total * blueprint.fps))}
  integrate theme
}`;
}

function generateSvg(scene, index, blueprint) {
  const a = scene.colorA;
  const b = scene.colorB;
  const x = 20 + ((index * 37) % 60);
  const y = 30 + ((index * 29) % 50);
  const radius = 18 + Math.round(scene.energy * 44);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${blueprint.width} ${blueprint.height}" role="img" aria-label="${escapeHtml(scene.caption)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="12"/></filter></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${blueprint.width * x / 100}" cy="${blueprint.height * y / 100}" r="${radius * 1.8}" fill="white" opacity=".22" filter="url(#blur)"/>
<circle cx="${blueprint.width * (100 - x) / 100}" cy="${blueprint.height * (100 - y) / 100}" r="${radius}" fill="white" opacity=".28"/>
<path d="M0 ${blueprint.height * .72} Q ${blueprint.width * .35} ${blueprint.height * (.35 + scene.energy * .25)} ${blueprint.width} ${blueprint.height * .62} V${blueprint.height}H0Z" fill="rgba(0,0,0,.22)"/>
<text x="${blueprint.width * .07}" y="${blueprint.height * .78}" fill="white" font-family="sans-serif" font-size="${Math.max(14, blueprint.width / 18)}" font-weight="700">${escapeHtml(scene.caption)}</text>
<text x="${blueprint.width * .07}" y="${blueprint.height * .9}" fill="white" opacity=".8" font-family="sans-serif" font-size="${Math.max(9, blueprint.width / 34)}">${escapeHtml(scene.mood)} · energy ${scene.energy.toFixed(2)}</text>
</svg>`;
}

function makePpmFrame(width, height, scene, localFrame, sceneFrames, sceneIndex) {
  const a = parseHexColor(scene.colorA, '#33245c');
  const b = parseHexColor(scene.colorB, '#71d8c6');
  const pixels = Buffer.alloc(width * height * 3);
  const progress = sceneFrames <= 1 ? 0 : localFrame / (sceneFrames - 1);
  const cx = width * (0.15 + 0.7 * progress);
  const cy = height * (0.5 + 0.22 * Math.sin(progress * Math.PI * 2 + sceneIndex));
  const radius = Math.min(width, height) * (0.08 + scene.energy * 0.16);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = Math.max(0, Math.min(1, (x / Math.max(1, width - 1)) * 0.65 + (y / Math.max(1, height - 1)) * 0.35));
      let r = a[0] * (1 - t) + b[0] * t;
      let g = a[1] * (1 - t) + b[1] * t;
      let bl = a[2] * (1 - t) + b[2] * t;
      const distance = Math.hypot(x - cx, y - cy);
      const glow = Math.max(0, 1 - distance / radius);
      const wave = Math.sin((x + sceneIndex * 17) * 0.035 + progress * 8) * Math.cos(y * 0.028 - progress * 5);
      r += glow * 120 + wave * 12 * scene.energy;
      g += glow * 105 + wave * 9 * scene.energy;
      bl += glow * 145 + wave * 16 * scene.energy;
      pixels[offset++] = Math.max(0, Math.min(255, Math.round(r)));
      pixels[offset++] = Math.max(0, Math.min(255, Math.round(g)));
      pixels[offset++] = Math.max(0, Math.min(255, Math.round(bl)));
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii'), pixels]);
}

const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function midiNumber(note) {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match || NOTE_INDEX[match[1]] === undefined) return 60;
  return (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
}
function frequency(note) { return 440 * (2 ** ((midiNumber(note) - 69) / 12)); }

function writeWav(blueprint) {
  const totalDuration = blueprint.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const samples = Math.ceil(totalDuration * blueprint.sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  let sceneStart = 0;
  for (const scene of blueprint.scenes) {
    const startSample = Math.floor(sceneStart * blueprint.sampleRate);
    const endSample = Math.min(samples, Math.floor((sceneStart + scene.duration) * blueprint.sampleRate));
    const beatDuration = 60 / blueprint.tempo;
    for (let sample = startSample; sample < endSample; sample += 1) {
      const time = (sample - startSample) / blueprint.sampleRate;
      const noteIndex = Math.floor(time / beatDuration) % scene.notes.length;
      const withinBeat = (time % beatDuration) / beatDuration;
      const freq = frequency(scene.notes[noteIndex]);
      const envelope = Math.min(1, withinBeat * 12) * Math.max(0, 1 - withinBeat * 0.72);
      const value = (Math.sin(2 * Math.PI * freq * time) + 0.28 * Math.sin(2 * Math.PI * freq * 2 * time)) * 0.35 * scene.energy * envelope;
      pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * 32767))), sample * 2);
    }
    sceneStart += scene.duration;
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(blueprint.sampleRate, 24); header.writeUInt32LE(blueprint.sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function variableLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) { buffer <<= 8; buffer |= ((value & 0x7f) | 0x80); }
  while (true) { bytes.push(buffer & 0xff); if (buffer & 0x80) buffer >>= 8; else break; }
  return Buffer.from(bytes);
}
function chunk(id, data) {
  const header = Buffer.alloc(8); header.write(id, 0); header.writeUInt32BE(data.length, 4); return Buffer.concat([header, data]);
}
function writeMidi(blueprint) {
  const division = 480;
  const events = [];
  const tempoMicro = Math.round(60000000 / blueprint.tempo);
  events.push(Buffer.from([0x00, 0xff, 0x51, 0x03, (tempoMicro >> 16) & 0xff, (tempoMicro >> 8) & 0xff, tempoMicro & 0xff]));
  const beatSeconds = 60 / blueprint.tempo;
  for (const scene of blueprint.scenes) {
    const beats = Math.max(1, Math.round(scene.duration / beatSeconds));
    for (let i = 0; i < beats; i += 1) {
      const note = midiNumber(scene.notes[i % scene.notes.length]);
      const velocity = Math.max(24, Math.min(120, Math.round(35 + scene.energy * 80)));
      events.push(Buffer.from([0x00, 0x90, note, velocity]));
      events.push(Buffer.concat([variableLength(division), Buffer.from([0x80, note, 0x00])]));
    }
  }
  events.push(Buffer.from([0x00, 0xff, 0x2f, 0x00]));
  const headerData = Buffer.alloc(6); headerData.writeUInt16BE(0, 0); headerData.writeUInt16BE(1, 2); headerData.writeUInt16BE(division, 4);
  return Buffer.concat([chunk('MThd', headerData), chunk('MTrk', Buffer.concat(events))]);
}

function previewHtml(blueprint) {
  const cards = blueprint.scenes.map((scene, index) => `<article><img src="posters/scene-${String(index + 1).padStart(2, '0')}.svg" alt=""><div><small>${scene.duration}s · ${escapeHtml(scene.mood)}</small><h2>${escapeHtml(scene.caption)}</h2><p>${scene.notes.map(escapeHtml).join(' · ')}</p></div></article>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(blueprint.title)}</title><style>body{margin:0;background:#0d0c12;color:#f5efff;font:16px system-ui;padding:24px}main{max-width:1000px;margin:auto}h1{font-size:clamp(2rem,7vw,5rem)}article{display:grid;grid-template-columns:minmax(180px,360px) 1fr;gap:20px;align-items:center;margin:20px 0;padding:16px;border:1px solid #40394d;border-radius:22px;background:#17141d}img{width:100%;border-radius:14px}small,p{color:#c8bfd1}@media(max-width:650px){article{grid-template-columns:1fr}}</style><main><p>RCL MEDIA FORGE</p><h1>${escapeHtml(blueprint.title)}</h1>${cards}<p><a href="video.mp4" style="color:#9ee5d7">打开生成视频</a> · <a href="soundtrack.wav" style="color:#9ee5d7">打开音频</a></p></main></html>`;
}

function renderMp4(root, blueprint) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(blueprint.fps),
    '-i', path.join(root, 'frames', 'frame-%06d.ppm'),
    '-i', path.join(root, 'soundtrack.wav'),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', path.join(root, 'video.mp4'),
  ], { encoding: 'utf8' });
  return {
    available: result.error?.code !== 'ENOENT',
    ok: result.status === 0,
    status: result.status,
    stderr: result.stderr?.slice(-4000) ?? '',
  };
}

async function writeMediaArtifacts(blueprint, root) {
  writeJson(root, 'blueprint.json', blueprint);
  writeText(root, 'media-world.rcl', generateMediaWorldRcl(blueprint));
  writeText(root, 'preview.html', previewHtml(blueprint));
  writeBuffer(root, 'soundtrack.wav', writeWav(blueprint));
  writeBuffer(root, 'score.mid', writeMidi(blueprint));
  let globalFrame = 1;
  let cursor = 0;
  const timeline = [];
  blueprint.scenes.forEach((scene, sceneIndex) => {
    const sceneFrames = Math.max(1, Math.round(scene.duration * blueprint.fps));
    writeText(root, `posters/scene-${String(sceneIndex + 1).padStart(2, '0')}.svg`, generateSvg(scene, sceneIndex, blueprint));
    timeline.push({ ...scene, start: cursor, end: cursor + scene.duration, frames: sceneFrames });
    for (let localFrame = 0; localFrame < sceneFrames; localFrame += 1) {
      writeBuffer(root, `frames/frame-${String(globalFrame).padStart(6, '0')}.ppm`, makePpmFrame(blueprint.width, blueprint.height, scene, localFrame, sceneFrames, sceneIndex));
      globalFrame += 1;
    }
    cursor += scene.duration;
  });
  writeJson(root, 'timeline.json', { title: blueprint.title, duration: cursor, fps: blueprint.fps, scenes: timeline });
  const ffmpeg = renderMp4(root, blueprint);
  writeJson(root, 'render-report.json', ffmpeg);
  return ffmpeg;
}

export async function forgeMedia(input, outputDir) {
  const blueprint = validateMediaBlueprint(input);
  let finalReceipt;
  await atomicDirectory(outputDir, async temp => {
    let renderResult;
    const authorized = await runAuthorizedProvider({
      realityName: `${blueprint.title} Media Forge`,
      subject: 'media_director',
      host: 'media_forge',
      capability: 'generate',
      warrant: 'media.generate',
      target: 'forge',
      request: blueprint,
      witness: 'rcl:media-forge:authorized-projection',
      purpose: 'generate_multi_media_projection',
      provider: async parsed => {
        const validated = validateMediaBlueprint(parsed);
        renderResult = await writeMediaArtifacts(validated, temp);
        const providerManifest = artifactManifest(temp, {
          framework: 'RCL Media Forge', version: MEDIA_FORGE_VERSION,
          status: renderResult.ok ? 'verified' : 'proxy-verified',
          metadata: { title: validated.title, ffmpeg: renderResult },
        });
        return receipt({ framework: 'RCL Media Forge', capability: 'media.generate', outputDir, manifest: providerManifest, details: { ffmpeg: renderResult } });
      },
    });
    writeText(temp, 'authority.rcl', authorized.source);
    writeJson(temp, 'rcl-run.json', authorized.result);
    const manifest = artifactManifest(temp, {
      framework: 'RCL Media Forge', version: MEDIA_FORGE_VERSION,
      status: renderResult.ok ? 'verified' : 'proxy-verified',
      metadata: {
        title: blueprint.title,
        duration: blueprint.scenes.reduce((sum, scene) => sum + scene.duration, 0),
        ffmpeg: renderResult,
        executionRoot: authorized.result.stateRoot,
      },
    });
    writeJson(temp, 'manifest.json', manifest);
    finalReceipt = receipt({
      framework: 'RCL Media Forge', capability: 'media.generate', outputDir, manifest,
      details: { video: renderResult.ok ? path.join(outputDir, 'video.mp4') : null, preview: path.join(outputDir, 'preview.html'), ffmpeg: renderResult },
    });
  });
  return finalReceipt;
}
