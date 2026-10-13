import {GPU_PROFILES} from './k400-gpu-definitions.mjs';
import {runGpuProfile,verifyGpuProfile} from './k400-gpu-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:GPU_PROFILES.map(item=>item.id)){
  const definition=GPU_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_GPU_PROFILE:'+id);
  if(verify){const result=await verifyGpuProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runGpuProfile(definition);
}
