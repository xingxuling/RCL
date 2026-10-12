import {NEW_FAMILIES} from './k400-new-family-definitions.mjs';
import {runFamilyProfile,verifyFamilyProfile} from './k400-new-family-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:NEW_FAMILIES.map(item=>item.id)){
  const definition=NEW_FAMILIES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_FAMILY_PROFILE:'+id);
  if(verify){const result=await verifyFamilyProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runFamilyProfile(definition);
}
