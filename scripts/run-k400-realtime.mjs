import {REALTIME_PROFILES} from './k400-realtime-definitions.mjs';
import {runRealtimeProfile,verifyRealtimeProfile} from './k400-realtime-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:REALTIME_PROFILES.map(item=>item.id)){
  const definition=REALTIME_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_REALTIME_PROFILE:'+id);
  if(verify){const result=await verifyRealtimeProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runRealtimeProfile(definition);
}
