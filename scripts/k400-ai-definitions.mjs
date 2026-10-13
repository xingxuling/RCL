import fs from 'node:fs';
import path from 'node:path';
import {GENOMES} from './k400-genomes/index.mjs';
import {PORTABLE_PROFILES} from './k400-portable-profile-definitions.mjs';
import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
export const AI_DIRECTORY='examples/universal-stress/ai-native';
export const AI_CONTROL_SOURCE='examples/runtime-hosts/ai-gate.rcl';
export const AI_DONOR_SOURCE='examples/native-ai/general-mlp.rcl';
const portable=PORTABLE_PROFILES.map(profile=>({...profile,id:profile.id==='algorithm-posix'?'algorithm-cli':profile.id,
  file:'scripts/k400-portable-profile-definitions.mjs',scope:profile.profile,sourcePath:'examples/universal-stress/portable-profiles/'+profile.id+'.rcl',oracle:inputs=>({state:profile.oracle(inputs),historyRules:[]})}));
export const FORWARD_PROFILE={id:'model-forward',file:'scripts/k400-ai-definitions.mjs',sourcePath:'examples/ai/native-model-forward.rcl',
  scope:'Native reused configurable Dense forward functions, identity hidden layer and softsign output; signed/fractional/large input boundaries; no training or broader AI competence claim for this direct forward fixture',
  families:['machine-learning','algorithm'],baseline:{feature_a:.5,feature_b:.25},cases:[[0,0],[1,0],[0,1],[1,1],[-2,3],[.5,.25],[0,-1],[-.5,4],[10,-10],[.125,-.375]].map(([feature_a,feature_b])=>({feature_a,feature_b})),
  oracle:({feature_a,feature_b})=>{const value=2*feature_a-feature_b+.25;return{state:{'result.model_valid':true,'result.hidden':[feature_a,feature_b],'result.output':[.5+.5*value/(1+Math.abs(value))]},historyRules:[]};},
  mutations:[
    {id:'dense-weighted-product',good:'sequence_get(layer_weights(layer), output_index * layer_input_size(layer) + input_index) * sequence_get(input, input_index)',bad:'sequence_get(layer_weights(layer), output_index * layer_input_size(layer) + input_index) + sequence_get(input, input_index)',intent:'Each dense unit sums weight times corresponding input plus its bias; do not add weight and input as separate terms.'},
    {id:'softsign-orientation',good:'0.5 + 0.5 * value / (1 + absolute(value))',bad:'0.5 - 0.5 * value / (1 + absolute(value))',intent:'The softsign01 activation increases with its pre-activation: one half plus one half times value divided by one plus its absolute value.'},
    {id:'second-layer-composition',good:'layer_forward(model_second_layer(model), model_hidden(model, input))',bad:'layer_forward(model_first_layer(model), model_hidden(model, input))',intent:'A two-layer model forwards the hidden representation through its second layer to produce the final output width.'},
  ]};
export const AI_PROFILES=[...GENOMES.map(profile=>({...profile,sourcePath:'examples/universal-stress/genomes/'+profile.id+'.rcl'})),...portable,...NEW_FAMILIES,CRDT_PROFILE,FORWARD_PROFILE]
  .map(profile=>({...profile,environments:['ai-runtime'],source:()=>fs.readFileSync(path.join(ROOT,profile.sourcePath),'utf8'),
    scope:profile.scope+'; actual native RCL program in a pinned RCL-trained MLP workflow, source-owned clamp/mean feature channels and advisory-only inference publication, model/source binding, authority rejection and actual controller reset; local bounded model organ, no general AI or external effects claim'}));
