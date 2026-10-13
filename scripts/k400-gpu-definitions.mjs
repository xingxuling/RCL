import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const GPU_DIRECTORY='examples/universal-stress/gpu-native';
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const GPU_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES]
  .map(profile=>({...profile,environments:['gpu'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; host RCL-owned compilation, generic RBC instructions/authority/transaction decisions on actual AMD FP64 OpenCL GPU, host hashes device-produced snapshots; one serial work item, no parallel throughput, CPU VM fallback, provider calls, typed records, sessions or whole-family claim'}));
