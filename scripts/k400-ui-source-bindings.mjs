import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const directory='examples/universal-stress/ui-native/acquisition-verifier-v1';
const snapshots={
  'scripts/k400-ui-engine.mjs':'abe2df2b2d781639b69651c897da7b046b9716ca71b45d6bf4f98dec292b91df',
  'scripts/k400-ui-traces.mjs':'aee79fce9883114aae2efdbb64add8f97faffe8e90d78ab717b4ad866cc2dc5d',
};
/** Preserve actual acquisition provenance; never rewrite old receipt hashes. */
export function verifyUiSourceBinding(binding){
  if(sha(fs.readFileSync(path.join(ROOT,binding.path)))===binding.sha256)return;
  assert.equal(binding.sha256,snapshots[binding.path],'Runtime source changes require reacquisition');
  assert.ok(snapshots[binding.path]);
  assert.equal(sha(fs.readFileSync(path.join(ROOT,directory,path.basename(binding.path)+'.txt'))),binding.sha256);
}
export const UI_ADMISSION_BINDING_FILES=['scripts/k400-ui-engine.mjs','scripts/k400-ui-traces.mjs','scripts/k400-ui-source-bindings.mjs','scripts/k400-ui-admission.mjs',directory+'/manifest.json',...Object.keys(snapshots).map(f=>directory+'/'+path.basename(f)+'.txt')];
export function uiAdmissionBindings(){return UI_ADMISSION_BINDING_FILES.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))}));}
