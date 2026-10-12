import { donorSource,edit,definition,casesFrom } from './shared.mjs';
const donor='examples/universal-stress/k340-compiler-mixed-paradigm.rcl';
const baseline={batch_size:8};
function source(){return donorSource(donor,'PortableMixedParadigm','k400-mixed-paradigm-v1')
  .replaceAll('compiler.digest == 204','compiler.digest == input.batch_size * (input.batch_size + 1) * (2 * input.batch_size + 1) / 6');}
function oracle({batch_size}){let sum=0;for(let value=1;value<=batch_size;value++)sum+=value*value;const ran=batch_size>0;
  return{state:{'compiler.phase':ran?2:0,'compiler.digest':ran?sum:0,'compiler.accepted':ran,'compiler.emitted':ran},historyRules:ran?['analyze_batch','emit_batch']:[],historyActors:ran?['builder','builder']:[]};}
export default definition({id:'mixed-paradigm',donor,source,baseline,oracle,families:['mixed-paradigm'],
  scope:'bounded recursive arithmetic, declarative authority, transactional invariants and state-triggered rule composition; no arbitrary multi-language interoperation claim',
  cases:casesFrom(['batch_size'],[[0],[-1],[1],[2],[3],[4],[5],[10],[12],[16]]),
  mutations:[
    {id:'recursive-square',good:'n * n + sum_squares(n - 1)',bad:'n + n + sum_squares(n - 1)',intent:'Compute the sum of squares for the functional stage, agreeing with the closed-form invariant before transactional commit.'},
    {id:'analyze-warrant',good:'warrant compiler.analyze on source',bad:'warrant compiler.no_analyze on source',intent:'The builder needs the exact compiler.analyze warrant on source before analyzing a positive batch; do not change the declared requirements.'},
    {id:'phase-trigger',good:'when compiler.phase == 1 and compiler.digest',bad:'when compiler.phase == 2 and compiler.digest',intent:'Emission follows successful analysis at phase one, then advances to phase two; preserve the digest and all authority requirements.'},
  ]},'scripts/k400-genomes/mixed.mjs');
