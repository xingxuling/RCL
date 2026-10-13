import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const SCIENTIFIC_DIRECTORY='examples/universal-stress/scientific-native';
export const SCIENTIFIC_CONTROL_SOURCE='examples/runtime-hosts/scientific-gate.rcl';
export const SCIENTIFIC_KERNEL_SOURCE='examples/scientific/statistics.rcl';
export const SCIENTIFIC_ORACLE_SOURCE='native/scientific-runtime/oracle.py';
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',
  oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const STATISTICS_PROFILE={id:'statistics',file:'scripts/k400-scientific-definitions.mjs',sourcePath:SCIENTIFIC_KERNEL_SOURCE,
  scope:'Native RCL shifted Welford population moments, extrema and index-based linear least-squares coefficients, finite binary64 data and bounded sequences; empty/singleton/negative-slope/large-offset boundaries; independent analytic and actual NumPy/SciPy checks',
  families:['algorithm','scientific'],baseline:{count:8,offset:3,scale:2},
  cases:[[0,0,1],[1,7,0],[2,-3,.5],[3,1000000,.75],[5,-8,.25],[8,1000000000000,.125],[11,6,-2.5],[16,0,0],[17,-100,.125],[32,1000,-4]].map(([count,offset,scale])=>({count,offset,scale})),
  oracle:({count,offset,scale})=>({state:{'samples.values':Array.from({length:count},(_,i)=>offset+scale*i),
    'result.count':count,'result.mean':count?offset+scale*(count-1)/2:0,'result.variance':count?scale*scale*(count*count-1)/12:0,
    'result.minimum':count?Math.min(offset,offset+scale*(count-1)):0,'result.maximum':count?Math.max(offset,offset+scale*(count-1)):0,
    'result.slope':count>1?scale:0,'result.intercept':count?offset:0},historyRules:[]}),
  mutations:[
    {id:'mean-update',good:'mean + delta / (index + 1)',bad:'mean - delta / (index + 1)',intent:'Update the shifted online mean toward each observation by delta divided by the new sample count; retain large-offset stability.'},
    {id:'population-variance',good:'sequence_get(internal.moments, 1) / result.count',bad:'sequence_get(internal.moments, 1) / (result.count + 1)',intent:'Compute population variance as the accumulated centered second moment divided by the actual sample count, with zero for an empty series.'},
    {id:'regression-cross-sum',good:'total + (index - center_x) *',bad:'total - (index - center_x) *',intent:'Accumulate centered x/y cross-products with their original sign so the least-squares slope follows increasing or decreasing observations.'},
  ]};
export const SCIENTIFIC_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES,CRDT_PROFILE,STATISTICS_PROFILE]
  .map(profile=>({...profile,environments:['scientific-runtime'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; actual native program outputs enter a native RCL numerical workbench with exact binary64 data binding, independent local NumPy/SciPy observation, source-owned error admission/failure settlement and real worker exit; at most 256 measured scalars, no arbitrary HPC or external-effects claim'}));
