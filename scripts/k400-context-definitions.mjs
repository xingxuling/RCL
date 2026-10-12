import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const CONTEXT_DIRECTORY='examples/universal-stress/contexts';
export const CONTEXT_ENVIRONMENTS=['server','embedded-runtime','distributed-runtime'];
const portable=PORTABLE_PROFILES.map(profile=>({
  ...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,
  sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]}),
}));
export const CONTEXT_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable]
  .map(profile=>({...profile,source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),environments:CONTEXT_ENVIRONMENTS,
    scope:profile.scope+'; executed via real loopback HTTP, caller-owned embedded instance and two-worker replicated transport; no public deployment/microcontroller/multi-host claim'}));
