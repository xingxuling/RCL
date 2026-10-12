import {JOB_PROFILES} from './k400-job-definitions.mjs';
import {runJobProfile,verifyJobProfile} from './k400-job-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:JOB_PROFILES.map(item=>item.id)){
  const definition=JOB_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_JOB_PROFILE:'+id);
  if(verify){const result=verifyJobProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runJobProfile(definition);
}
