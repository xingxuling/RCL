import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const REALTIME_DIRECTORY='examples/universal-stress/realtime-native';
export const REALTIME_CONTROL_SOURCE='examples/runtime-hosts/realtime-gate.rcl';
export const REALTIME_SPIN_SOURCE='examples/runtime-hosts/realtime-spin-control.rcl';
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const REALTIME_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES,CRDT_PROFILE]
  .map(profile=>({...profile,environments:['realtime-runtime'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; actual monotonic timer release and asynchronous native RCL process with source-owned sampled-deadline publication, cancellation/exit observation and failure settlement; local soft realtime, no hard OS interrupt/timing guarantee or external effects'}));
