import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
export const gpuUiPolicyFiles=['scripts/k400-gpu-ui-engine.mjs','scripts/k400-gpu-ui-traces.mjs','scripts/k400-gpu-text-traces.mjs','scripts/k400-gpu-ui-flow.mjs','scripts/k400-gpu-ui-targets.mjs','scripts/k400-gpu-ui-definitions.mjs','scripts/k400-gpu-ui-source-bindings.mjs','src/portable-gpu-text-target.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyUiSourceBinding(b){assert.equal(sha(fs.readFileSync(path.join(ROOT,b.path))),b.sha256,b.path);}
export function uiAdmissionBindings(){return gpuUiPolicyFiles.map(path=>({path,sha256:sha(fs.readFileSync(ROOT+'/'+path))}));}
