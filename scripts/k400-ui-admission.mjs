import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT} from './k400-genomes/shared.mjs';
import {UI_DIRECTORY,UI_PROFILE} from './k400-ui-definitions.mjs';
import {CONTROL_SOURCES} from './k400-phase-definitions.mjs';
import {UI_TARGET_CONTRACTS} from './k400-ui-traces.mjs';
import {verifyUiProfile as verifyBaseProfile} from './k400-ui-engine.mjs';
// A separate admission layer pins the controller's role in addition to the
// acquisition verifier's complete byte/source/state/command replay.
export function verifyUiControllerRole(environment,binding){
  const phase=environment==='rncs-runtime'?'automation-runtime':environment;
  const source=CONTROL_SOURCES[phase]??(UI_TARGET_CONTRACTS[environment]?JSON.parse(fs.readFileSync(path.join(ROOT,UI_TARGET_CONTRACTS[environment]),'utf8')).controllerSource.path:null);
  if(source)assert.equal(binding.controller.sourcePath,source,'Canonical controller for selected UI context');else assert.equal(binding.controller,undefined);
}
export async function verifyUiAdmission(supplied){
  const prefix=UI_DIRECTORY+'/'+UI_PROFILE.id;
  if(!supplied&&!fs.existsSync(path.join(ROOT,prefix+'-runtime.json')))return verifyBaseProfile();
  for(const environment of UI_PROFILE.environments){const report=JSON.parse(fs.readFileSync(path.join(ROOT,prefix+'-'+environment+'-runtime.json'),'utf8'));
    const flows=[...report.rounds,...report.inputResults,...report.trials,...report.trials.flatMap(t=>t.semanticRepairCases)].map(r=>r.flow).concat(report.trials.map(t=>t.broken));
    for(const flow of flows)verifyUiControllerRole(environment,flow.targetBinding);verifyUiControllerRole(environment,report.negativeControls.binding);
  }
  const admission=await verifyBaseProfile(supplied);if(!admission.admitted)return admission;
  return admission;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const admission=await verifyUiAdmission();console.log(JSON.stringify({admitted:admission.admitted,id:admission.id,reportRoot:admission.reportRoot,claims:admission.claims.length}));}
