import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const PHASE_DIRECTORY='examples/universal-stress/phase-contexts';
export const PHASE_ENVIRONMENTS=['simulation-runtime','automation-runtime'];
export const CONTROL_SOURCES={'simulation-runtime':'examples/runtime-hosts/simulation-clock.rcl','automation-runtime':'examples/runtime-hosts/automation-gate.rcl'};
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,
  sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const PHASE_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable]
  .map(profile=>({...profile,source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),environments:PHASE_ENVIRONMENTS,
    scope:profile.scope+'; native RCL session owns forecast/commit logical clock and job admission/completion around local native kernels; no physical simulation/time, external tools, canonical RNCS world or OS sandbox claim'}));
