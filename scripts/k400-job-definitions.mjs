import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const JOB_DIRECTORY='examples/universal-stress/job-contexts';
export const JOB_ENVIRONMENTS=['serverless','database','dataflow-runtime'];
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,
  sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const JOB_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable]
  .map(profile=>({...profile,source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),environments:JOB_ENVIRONMENTS,
    scope:profile.scope+'; native execution in fresh local handlers, SQLite SQL-function transactions and a bounded worker-thread dataflow pipeline; no cloud FaaS, arbitrary SQL, external stream or OS sandbox claim'}));
