import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const GAME_DIRECTORY='examples/universal-stress/game-native';
export const GAME_CONTROL_SOURCE='examples/runtime-hosts/game-frame.rcl';
export const FROZEN_GAME_INPUTS=[{horizontal:1,jump:true},{horizontal:-1,jump:false},{horizontal:0,jump:false}];
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const GAME_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES,CRDT_PROFILE]
  .map(profile=>({...profile,environments:['game-runtime'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; actual native RCL program hook on each fixed step, RCL-owned scene input/physics/collision, verified output binding and state-bound SVG projection; deterministic local game runtime, no browser, physical timing or external effects claim'}));
