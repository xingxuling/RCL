import {PHASE_PROFILES} from './k400-phase-definitions.mjs';
import {runPhaseProfile,verifyPhaseProfile} from './k400-phase-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:PHASE_PROFILES.map(item=>item.id)){
  const definition=PHASE_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_PHASE_PROFILE:'+id);
  if(verify){const result=await verifyPhaseProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runPhaseProfile(definition);
}
