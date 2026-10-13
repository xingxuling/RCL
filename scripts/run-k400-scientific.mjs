import {SCIENTIFIC_PROFILES} from './k400-scientific-definitions.mjs';
import {runScientificProfile,verifyScientificProfile} from './k400-scientific-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:SCIENTIFIC_PROFILES.map(item=>item.id)){
  const definition=SCIENTIFIC_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_SCIENTIFIC_PROFILE:'+id);
  if(verify){const result=await verifyScientificProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runScientificProfile(definition);
}
