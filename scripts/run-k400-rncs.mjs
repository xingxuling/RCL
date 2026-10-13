import {RNCS_PROFILES} from './k400-rncs-definitions.mjs';
import {runRncsProfile,verifyRncsProfile} from './k400-rncs-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:RNCS_PROFILES.map(item=>item.id)){
  const definition=RNCS_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_RNCS_PROFILE:'+id);
  if(verify){const result=await verifyRncsProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runRncsProfile(definition);
}
