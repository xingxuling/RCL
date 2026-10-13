import {AI_PROFILES} from './k400-ai-definitions.mjs';
import {runAiProfile,verifyAiProfile} from './k400-ai-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:AI_PROFILES.map(item=>item.id)){
  const definition=AI_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_AI_PROFILE:'+id);
  if(verify){const result=await verifyAiProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runAiProfile(definition);
}
