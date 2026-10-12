import {CONTEXT_PROFILES} from './k400-context-definitions.mjs';
import {runContextProfile,verifyContextProfile} from './k400-context-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:CONTEXT_PROFILES.map(item=>item.id)){
  const definition=CONTEXT_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_CONTEXT_PROFILE:'+id);
  if(verify){const result=verifyContextProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runContextProfile(definition);
}
