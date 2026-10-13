import {GAME_PROFILES} from './k400-game-definitions.mjs';
import {runGameProfile,verifyGameProfile} from './k400-game-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify',ids=verify?args.slice(1):args;
for(const id of ids.length?ids:GAME_PROFILES.map(item=>item.id)){
  const definition=GAME_PROFILES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_GAME_PROFILE:'+id);
  if(verify){const result=await verifyGameProfile(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else await runGameProfile(definition);
}
