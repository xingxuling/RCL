import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const RNCS_DIRECTORY='examples/universal-stress/rncs-native';
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const RNCS_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES]
  .map(profile=>({...profile,environments:['rncs-runtime'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; RCL-owned native computation inside the frozen canonical RNCS RBF candidate runtime, source-owned conditional admission, integer-safe typed f64 transport and evidence-bound local candidate merge; no production RFE commit, human key custody, external effects or whole-family claim'}));
