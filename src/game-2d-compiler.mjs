import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compileReality } from './compiler.mjs';

export const RCL_2D_GAME_COMPILER_VERSION = '0.1.0';
export const RCL_2D_GAME_FORMAT = 'rcl.2d-game.v0.1';
export const RCL_2D_GAME_RUNTIME_MANIFEST_FORMAT = 'rcl.2d-game-runtime-manifest.v0.1';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function evidenceRoot(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function finiteNumber(value, label, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) throw new Error('RCL_2D_GAME_NUMBER:' + label);
  return number;
}

function positiveNumber(value, label, fallback) {
  const number = finiteNumber(value, label, fallback);
  if (number <= 0) throw new Error('RCL_2D_GAME_POSITIVE:' + label);
  return number;
}

function literalFacetValue(facet) {
  if (!facet.value || facet.value.kind !== 'LiteralExpr') {
    throw new Error('RCL_2D_GAME_NON_LITERAL_INITIAL_FACET:' + facet.path);
  }
  return facet.value.value;
}

function lowerExpr(expression) {
  if (!expression) return null;
  if (expression.kind === 'LiteralExpr') return { kind: 'literal', value: expression.value };
  if (expression.kind === 'PathExpr') return { kind: 'path', path: expression.path };
  if (expression.kind === 'UnaryExpr') {
    return { kind: 'unary', operator: expression.operator, expression: lowerExpr(expression.expression) };
  }
  if (expression.kind === 'BinaryExpr') {
    return {
      kind: 'binary',
      operator: expression.operator,
      left: lowerExpr(expression.left),
      right: lowerExpr(expression.right),
    };
  }
  if (expression.kind === 'CallExpr' && expression.name === 'choose') {
    return { kind: 'choose', args: expression.args.map(lowerExpr) };
  }
  throw new Error('RCL_2D_GAME_UNSUPPORTED_EXPRESSION:' + expression.kind);
}

function lowerRule(rule) {
  if ((rule.calls ?? []).length > 0) throw new Error('RCL_2D_GAME_HOST_CALL_NOT_SUPPORTED:' + rule.name);
  return {
    name: rule.name,
    kind: rule.kind,
    actor: rule.kind === 'Emergence' ? rule.cause : rule.from,
    when: lowerExpr(rule.when),
    needs: structuredClone(rule.needs ?? []),
    alters: (rule.alters ?? []).map((alter) => ({
      target: alter.target,
      expression: lowerExpr(alter.expression),
    })),
    preserves: (rule.preserves ?? []).map(lowerExpr),
    witnesses: [...(rule.witnesses ?? [])],
  };
}

function normalizeStateBinding(binding, label) {
  if (typeof binding !== 'string' || binding.length === 0) {
    throw new Error('RCL_2D_GAME_STATE_BINDING:' + label);
  }
  return binding;
}

export function normalizeRcl2DGameSpec(spec) {
  if (!spec || spec.schema !== RCL_2D_GAME_FORMAT) throw new Error('RCL_2D_GAME_SPEC_SCHEMA');
  const width = positiveNumber(spec.width, 'width', 320);
  const height = positiveNumber(spec.height, 'height', 180);
  const physics = {
    gravity: finiteNumber(spec.physics?.gravity, 'gravity', 1.5),
    groundY: finiteNumber(spec.physics?.groundY, 'groundY', height - 36),
    maxFallSpeed: positiveNumber(spec.physics?.maxFallSpeed, 'maxFallSpeed', 12),
    friction: finiteNumber(spec.physics?.friction, 'friction', 1),
  };
  const player = spec.player ?? {};
  const playerSize = {
    width: positiveNumber(player.size?.width, 'player.size.width', 18),
    height: positiveNumber(player.size?.height, 'player.size.height', 24),
  };
  const playerState = {
    x: normalizeStateBinding(player.state?.x, 'player.x'),
    y: normalizeStateBinding(player.state?.y, 'player.y'),
    vx: normalizeStateBinding(player.state?.vx, 'player.vx'),
    vy: normalizeStateBinding(player.state?.vy, 'player.vy'),
    grounded: normalizeStateBinding(player.state?.grounded, 'player.grounded'),
  };
  const entities = (spec.entities ?? []).map((entity, index) => ({
    id: String(entity.id ?? 'entity_' + index),
    kind: String(entity.kind ?? 'static'),
    x: finiteNumber(entity.x, 'entity.' + index + '.x', 0),
    y: finiteNumber(entity.y, 'entity.' + index + '.y', 0),
    width: positiveNumber(entity.width, 'entity.' + index + '.width', 12),
    height: positiveNumber(entity.height, 'entity.' + index + '.height', 12),
    color: String(entity.color ?? '#ffd166'),
    collectedState: entity.collectedState ? normalizeStateBinding(entity.collectedState, 'entity.collectedState') : null,
  }));
  const controls = { ...(spec.controls ?? {}) };
  for (const name of ['start', 'left', 'right', 'jump', 'reset', 'tick', 'collect']) {
    if (controls[name] !== undefined && typeof controls[name] !== 'string') {
      throw new Error('RCL_2D_GAME_CONTROL:' + name);
    }
  }
  return {
    schema: RCL_2D_GAME_FORMAT,
    title: String(spec.title ?? 'RCL 2D Game'),
    width,
    height,
    tickRate: positiveNumber(spec.tickRate, 'tickRate', 30),
    physics,
    player: {
      id: String(player.id ?? 'player'),
      size: playerSize,
      color: String(player.color ?? '#4cc9f0'),
      state: playerState,
    },
    entities,
    controls,
    renderer: {
      background: String(spec.renderer?.background ?? '#101827'),
      ground: String(spec.renderer?.ground ?? '#26354d'),
      accent: String(spec.renderer?.accent ?? '#f72585'),
    },
  };
}

function validateStateBindings(state, spec) {
  const bindings = [
    ...Object.values(spec.player.state),
    ...spec.entities.map((entity) => entity.collectedState).filter(Boolean),
  ];
  for (const binding of bindings) {
    if (!Object.prototype.hasOwnProperty.call(state, binding)) {
      throw new Error('RCL_2D_GAME_UNKNOWN_STATE:' + binding);
    }
  }
}

export function compileRcl2DGameFromProgram(program, gameSpec) {
  const spec = normalizeRcl2DGameSpec(gameSpec);
  const state = Object.fromEntries(
    program.facets
      .filter((facet) => !facet.deferred)
      .map((facet) => [facet.path, literalFacetValue(facet)]),
  );
  validateStateBindings(state, spec);
  const rules = program.rules.map(lowerRule);
  const manifestWithoutRoot = {
    schema: RCL_2D_GAME_RUNTIME_MANIFEST_FORMAT,
    compiler: 'RCL 2D Game Compiler',
    compilerVersion: RCL_2D_GAME_COMPILER_VERSION,
    program: program.name,
    programRoot: program.programRoot,
    state,
    facets: program.facets
      .filter((facet) => !facet.deferred)
      .map((facet) => ({ path: facet.path, valueType: facet.valueType })),
    warrants: program.warrants.map((warrant) => ({
      subject: warrant.subject,
      capability: warrant.capability,
      target: warrant.target,
    })),
    rules,
    game: spec,
    metadata: {
      sourceFormat: RCL_2D_GAME_FORMAT,
      coverageMode: 'lowered-execution',
      semantics: [
        'RCL state',
        'RCL authority',
        'RCL preserve-guarded transactions',
        'fixed-step 2D physics',
        'axis-aligned collision',
        'scene projection',
      ],
    },
  };
  return {
    ...manifestWithoutRoot,
    manifestRoot: evidenceRoot(manifestWithoutRoot),
  };
}

export function compileRcl2DGame(rclSource, gameSpec) {
  return compileRcl2DGameFromProgram(compileReality(rclSource), gameSpec);
}

function truthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

function binary(operator, left, right) {
  if (operator === 'and') return truthy(left) && truthy(right);
  if (operator === 'or') return truthy(left) || truthy(right);
  if (operator === '+') return typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : left + right;
  if (operator === '-') return left - right;
  if (operator === '*') return left * right;
  if (operator === '/') return left / right;
  if (operator === '%') return left % right;
  if (operator === '==') return left === right;
  if (operator === '!=') return left !== right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  throw new Error('RCL_2D_GAME_OPERATOR:' + operator);
}

function evaluate(expression, snapshot) {
  if (!expression) return true;
  if (expression.kind === 'literal') return expression.value;
  if (expression.kind === 'path') {
    if (!Object.prototype.hasOwnProperty.call(snapshot, expression.path)) {
      throw new Error('RCL_2D_GAME_STATE_MISSING:' + expression.path);
    }
    return snapshot[expression.path];
  }
  if (expression.kind === 'unary') {
    const value = evaluate(expression.expression, snapshot);
    if (expression.operator === 'not') return !truthy(value);
    if (expression.operator === '-') return -value;
    throw new Error('RCL_2D_GAME_UNARY:' + expression.operator);
  }
  if (expression.kind === 'choose') {
    return truthy(evaluate(expression.args[0], snapshot))
      ? evaluate(expression.args[1], snapshot)
      : evaluate(expression.args[2], snapshot);
  }
  return binary(expression.operator, evaluate(expression.left, snapshot), evaluate(expression.right, snapshot));
}

function scopeMatches(granted, required) {
  return granted === required || required.startsWith(granted + '.') || granted === '*';
}

function applyRule(manifest, state, history, name) {
  const rule = manifest.rules.find((candidate) => candidate.name === name);
  if (!rule) throw new Error('RCL_2D_GAME_RULE_UNKNOWN:' + name);
  const before = structuredClone(state);
  if (!truthy(evaluate(rule.when, before))) {
    const skipped = { status: 'not-triggered', rule: name, state: structuredClone(state) };
    history.push(skipped);
    return skipped;
  }
  for (const need of rule.needs) {
    const granted = manifest.warrants.some((warrant) =>
      warrant.subject === rule.actor &&
      warrant.capability === need.capability &&
      scopeMatches(warrant.target, need.target));
    if (!granted) throw new Error('RCL_2D_GAME_AUTHORITY_DENIED:' + name + ':' + need.capability);
  }
  const proposed = structuredClone(before);
  for (const alter of rule.alters) proposed[alter.target] = evaluate(alter.expression, before);
  for (const preserve of rule.preserves) {
    if (!truthy(evaluate(preserve, proposed))) {
      throw new Error('RCL_2D_GAME_PRESERVE_FAILED:' + name);
    }
  }
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, proposed);
  const committed = {
    status: 'realized',
    rule: name,
    actor: rule.actor,
    before,
    after: structuredClone(state),
    witnesses: [...rule.witnesses],
  };
  history.push(committed);
  return committed;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function intersects(left, right) {
  return left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y;
}

function applyPhysics(manifest, state) {
  const spec = manifest.game;
  const p = spec.player.state;
  let x = Number(state[p.x]);
  let y = Number(state[p.y]);
  let vx = Number(state[p.vx]);
  let vy = Number(state[p.vy]);
  const maxX = spec.width - spec.player.size.width;
  x = clamp(x + vx, 0, maxX);
  y += vy;
  vy = Math.min(vy + spec.physics.gravity, spec.physics.maxFallSpeed);
  if (y >= spec.physics.groundY) {
    y = spec.physics.groundY;
    vy = 0;
    state[p.grounded] = true;
  } else {
    state[p.grounded] = false;
  }
  state[p.x] = x;
  state[p.y] = y;
  state[p.vy] = vy;
  state[p.vx] = Math.abs(vx) < spec.physics.friction ? 0 : vx * spec.physics.friction;
}

function collectIfOverlapping(manifest, state, history) {
  const spec = manifest.game;
  const p = spec.player.state;
  const player = {
    x: Number(state[p.x]),
    y: Number(state[p.y]),
    width: spec.player.size.width,
    height: spec.player.size.height,
  };
  for (const entity of spec.entities) {
    if (entity.kind !== 'collectible' || !entity.collectedState || state[entity.collectedState]) continue;
    if (!intersects(player, entity)) continue;
    const ruleName = spec.controls.collect;
    if (ruleName) applyRule(manifest, state, history, ruleName);
  }
}

export function renderRcl2DGameFrame(manifest, state) {
  const spec = manifest.game;
  const p = spec.player.state;
  const player = {
    type: 'rect',
    id: spec.player.id,
    x: Number(state[p.x]),
    y: Number(state[p.y]),
    width: spec.player.size.width,
    height: spec.player.size.height,
    color: spec.player.color,
  };
  const entities = spec.entities
    .filter((entity) => !entity.collectedState || !state[entity.collectedState])
    .map((entity) => ({ ...entity, type: 'rect' }));
  const primitives = [
    { type: 'rect', id: 'ground', x: 0, y: spec.physics.groundY + spec.player.size.height, width: spec.width, height: spec.height - spec.physics.groundY, color: spec.renderer.ground },
    ...entities,
    player,
  ];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + spec.width + ' ' + spec.height + '" width="' + spec.width + '" height="' + spec.height + '">',
    '<rect width="100%" height="100%" fill="' + spec.renderer.background + '"/>',
    ...primitives.map((item) => '<rect x="' + item.x + '" y="' + item.y + '" width="' + item.width + '" height="' + item.height + '" fill="' + item.color + '"/>'),
    '</svg>',
  ].join('');
  return { format: 'rcl.2d-game-frame.v0.1', width: spec.width, height: spec.height, primitives, svg };
}

export function simulateRcl2DGame(manifest, events = []) {
  if (!manifest || manifest.schema !== RCL_2D_GAME_RUNTIME_MANIFEST_FORMAT) {
    throw new Error('RCL_2D_GAME_MANIFEST_SCHEMA');
  }
  const state = structuredClone(manifest.state);
  const history = [];
  const frames = [];
  const controls = manifest.game.controls;
  const snapshot = () => {
    const frame = renderRcl2DGameFrame(manifest, state);
    frames.push({ index: frames.length, state: structuredClone(state), root: evidenceRoot(frame), svg: frame.svg });
  };
  const realize = (name) => applyRule(manifest, state, history, name);
  snapshot();
  for (const event of events) {
    if (event.type === 'rule') realize(event.name);
    else if (event.type === 'tick') {
      if (controls.tick) realize(controls.tick);
      applyPhysics(manifest, state);
      collectIfOverlapping(manifest, state, history);
    } else if (event.type === 'start') realize(controls.start);
    else if (event.type === 'left') realize(controls.left);
    else if (event.type === 'right') realize(controls.right);
    else if (event.type === 'jump') realize(controls.jump);
    else if (event.type === 'reset') realize(controls.reset);
    else throw new Error('RCL_2D_GAME_EVENT:' + event.type);
    snapshot();
  }
  return { state, history, frames, finalFrame: frames.at(-1) };
}

function htmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function emitRcl2DGameHtml(manifest) {
  const encoded = JSON.stringify(manifest).replaceAll('<', '\\u003c');
  return '<!doctype html>\n' +
    '<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + htmlEscape(manifest.game.title) + '</title>' +
    '<style>html,body{margin:0;min-height:100%;background:#080d18;color:#eaf2ff;font-family:system-ui,sans-serif}body{display:grid;place-items:center;padding:24px}main{width:min(100%,720px)}canvas{display:block;width:100%;image-rendering:pixelated;background:#101827;border:1px solid #31415d;border-radius:16px;box-shadow:0 18px 70px #0008}p{opacity:.8}kbd{padding:2px 6px;border:1px solid #4b5d7a;border-radius:5px}</style></head>' +
    '<body><main><h1>' + htmlEscape(manifest.game.title) + '</h1><canvas id="rcl-game" width="' + manifest.game.width + '" height="' + manifest.game.height + '"></canvas>' +
    '<p><kbd>←</kbd><kbd>→</kbd>移动，<kbd>Space</kbd>跳跃，<kbd>Enter</kbd>开始，<kbd>R</kbd>重置。</p></main>' +
    '<script>const manifest=' + encoded + ';const c=document.getElementById("rcl-game");const x=c.getContext("2d");const s=structuredClone(manifest.state);const p=manifest.game.player.state;let running=false;let last=0;function draw(){x.fillStyle=manifest.game.renderer.background;x.fillRect(0,0,c.width,c.height);x.fillStyle=manifest.game.renderer.ground;x.fillRect(0,manifest.game.physics.groundY+manifest.game.player.size.height,c.width,c.height);for(const e of manifest.game.entities){if(e.collectedState&&s[e.collectedState])continue;x.fillStyle=e.color;x.fillRect(e.x,e.y,e.width,e.height)}x.fillStyle=manifest.game.player.color;x.fillRect(s[p.x],s[p.y],manifest.game.player.size.width,manifest.game.player.size.height);x.fillStyle="#eaf2ff";x.font="10px system-ui";x.fillText("SCORE "+s["game.score"],8,14)}function step(t){const dt=Math.min((t-last)/16.67,3);last=t;if(running){s[p.x]=Math.max(0,Math.min(manifest.game.width-manifest.game.player.size.width,s[p.x]+s[p.vx]*dt));s[p.y]+=s[p.vy]*dt;s[p.vy]=Math.min(manifest.game.physics.maxFallSpeed,s[p.vy]+manifest.game.physics.gravity*dt);if(s[p.y]>=manifest.game.physics.groundY){s[p.y]=manifest.game.physics.groundY;s[p.vy]=0;s[p.grounded]=true}}draw();requestAnimationFrame(step)}addEventListener("keydown",e=>{if(e.key==="Enter")running=true;if(e.key.toLowerCase()==="r")location.reload();if(e.key==="ArrowRight")s[p.vx]=4;if(e.key==="ArrowLeft")s[p.vx]=-4;if(e.code==="Space"&&s[p.grounded]){s[p.vy]=-12;s[p.grounded]=false}});draw();requestAnimationFrame(step)</script></body></html>';
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function buildRcl2DGame({ rclPath, specPath, outputPath }) {
  const source = fs.readFileSync(rclPath, 'utf8');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const manifest = compileRcl2DGame(source, spec);
  const root = path.resolve(outputPath);
  writeText(path.join(root, 'program.rcl'), source);
  writeText(path.join(root, 'game-spec.json'), JSON.stringify(spec, null, 2) + '\n');
  writeText(path.join(root, 'rcl.2d-game-runtime-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeText(path.join(root, 'index.html'), emitRcl2DGameHtml(manifest));
  writeText(path.join(root, 'README.md'), '# ' + manifest.game.title + '\n\nGenerated by RCL 2D Game Compiler v' + RCL_2D_GAME_COMPILER_VERSION + '.\n\nThis is a lowered-execution game artifact: RCL owns state, authority and transactions; the 2D runtime owns fixed-step physics and scene projection.\n');
  return {
    status: 'GAME_PROJECT_GENERATED',
    root,
    program: manifest.program,
    manifestRoot: manifest.manifestRoot,
    html: path.join(root, 'index.html'),
    runtimeManifest: path.join(root, 'rcl.2d-game-runtime-manifest.json'),
    coverageMode: 'lowered-execution',
  };
}
