import {createCrdtTarget} from './k400-crdt-targets.mjs';
import {createPortableNativeTarget} from '../src/portable-native-vm.mjs';
import {createPortableRealtimeTarget} from '../src/portable-realtime-target.mjs';
import {createPortableGameTarget} from '../src/portable-game-target.mjs';
import {createPortableScientificTarget} from '../src/portable-scientific-target.mjs';
import {createPortableAiTarget} from '../src/portable-ai-target.mjs';
export async function createUiExecutionTarget(environment){
  if(environment==='realtime-runtime')return createPortableRealtimeTarget();
  if(environment==='game-runtime')return createPortableGameTarget();
  if(environment==='scientific-runtime')return createPortableScientificTarget();
  if(environment==='ai-runtime')return createPortableAiTarget();
  if(environment==='compiler-runtime'){
    const target=createPortableNativeTarget('windows');return{...target,environment:'compiler-runtime',binding:{...target.binding,context:'compiler-runtime',execution:'Actual RCL-authored compiler to native C VM UI event pipeline',compilerWorkflowClaimed:true}};
  }
  return createCrdtTarget(environment);
}
