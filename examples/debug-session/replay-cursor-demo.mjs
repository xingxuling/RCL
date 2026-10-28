import assert from 'node:assert/strict';
import { runDebugSession, createDebugReplayCursor } from '../../src/index.mjs';

const result = runDebugSession({ debugConfig: {
  breakpoints: [{ id: 'facets', kind: 'event-kind', eventKind: 'facet.evaluation' }],
  watchExpressions: [{ id: 'session', facet: 'app.session' }],
} });
assert.equal(result.ok, true);
const options = { trace: result.trace, expectedSessionRoot: result.session.sessionRoot, expectedTraceRoot: result.trace.traceRoot };
const cursor = createDebugReplayCursor(result.session, options);
const first = cursor.step('continue');
const checkpoint = JSON.parse(JSON.stringify(cursor.snapshot()));
const resumed = createDebugReplayCursor(result.session, { ...options, cursorSnapshot: checkpoint, expectedCursorRoot: checkpoint.cursorRoot });
assert.deepEqual(resumed.snapshot(), checkpoint);
const second = resumed.step('continue');
const reversed = resumed.step('reverse-continue');
assert.ok(second.afterCursor.frameIndex > first.afterCursor.frameIndex);
assert.equal(reversed.afterCursor.frameIndex, first.afterCursor.frameIndex);
assert.deepEqual(reversed.variableWindow, first.variableWindow);
console.log(JSON.stringify({
  ok: true, format: 'rcl.debug-replay-cursor-demo.v1',
  sessionRoot: result.session.sessionRoot, traceRoot: result.trace.traceRoot,
  checkpointRoot: checkpoint.cursorRoot,
  frames: [first.afterCursor.frameIndex, second.afterCursor.frameIndex, reversed.afterCursor.frameIndex],
  stepRoots: [first.stepRoot, second.stepRoot, reversed.stepRoot],
  boundary: 'Navigation and variable windows over admitted recorded events; no live VM pause or reverse execution.',
}, null, 2));
