import {CRDT_PROFILE} from './k400-crdt-definitions.mjs';
import {runCrdtProfile,verifyCrdtProfile} from './k400-crdt-engine.mjs';
if(process.argv.includes('--verify')){const result=await verifyCrdtProfile(CRDT_PROFILE);console.log(JSON.stringify({admitted:result.admitted,id:result.id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
else await runCrdtProfile(CRDT_PROFILE);
