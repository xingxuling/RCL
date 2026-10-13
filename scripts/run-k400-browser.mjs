import {BROWSER_PROFILES} from './k400-browser-definitions.mjs';
import {runBrowserProfile,verifyBrowserProfile} from './k400-browser-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:BROWSER_PROFILES.map(item=>item.id)){
  const definition=BROWSER_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_BROWSER_PROFILE:'+id);
  if(verify){const result=await verifyBrowserProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runBrowserProfile(definition);
}
