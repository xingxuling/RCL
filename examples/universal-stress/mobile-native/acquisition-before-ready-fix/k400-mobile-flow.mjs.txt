import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createNativeUiWebBridge} from '../src/ui/native-web-bridge.mjs';
import {createUiExecutionTarget} from './k400-ui-targets.mjs';
import {UI_EVENTS} from './k400-ui-definitions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function runMobileFlow(environment,source,driver,build,{controls=false,screenshotPath=null}={}){
  const bridge=await createNativeUiWebBridge(source,{factory:()=>createUiExecutionTarget(environment)}),session=randomUUID(),port=new URL(bridge.url).port,commandStart=driver.commands().length,steps=[];
  const launch=()=>driver.launch({url:bridge.url,token:bridge.token,uiRoot:bridge.runtime.ui.semanticRoot,session});
  try{
    driver.stop();driver.adb(['reverse','tcp:'+port,'tcp:'+port]);launch();const initial=await driver.waitFrame(session,f=>f.kind==='ready'&&f.snapshot?.revision===0),initialHierarchy=driver.hierarchy();
    for(const[index,event]of UI_EVENTS.entries()){const hierarchy=index===0?initialHierarchy:driver.hierarchy(),label=event.nodeId==='IncrementButton'?'增加计数':'重置计数',node=hierarchy.nodes.find(n=>n['content-desc']===label&&n.package===build.applicationId);assert.ok(node,'Actual native action');const tap=driver.tap(node),frame=await driver.waitFrame(session,f=>f.kind==='commit'&&f.snapshot?.revision===index+1);steps.push({event,tap,hierarchy,frame});}
    let control;
    if(controls){
      const before=bridge.runtime.snapshot();async function send(body,token=bridge.token){const r=await fetch(bridge.url+'/api/event',{method:'POST',headers:{'content-type':'application/json','x-rcl-ui-token':token},body:JSON.stringify(body)});return{status:r.status,payload:await r.json()};}
      const event=UI_EVENTS[0],unauthorized=await send({event,expectedStateRoot:before.stateRoot},'wrong'),stale=await send({event,expectedStateRoot:'0'.repeat(64)}),unknown=await send({event:{nodeId:'Missing',type:'activate',payload:{}},expectedStateRoot:before.stateRoot}),denied=await send({event,expectedStateRoot:before.stateRoot,authorized:false});assert.deepEqual(bridge.runtime.snapshot(),before);
      const rotationBefore={auto:driver.adb(['shell','settings','get','system','accelerometer_rotation']).trim(),rotation:driver.adb(['shell','settings','get','system','user_rotation']).trim()};let rotated;
      try{driver.adb(['shell','settings','put','system','accelerometer_rotation','0']);driver.adb(['shell','settings','put','system','user_rotation','1']);rotated=await driver.waitFrame(session,f=>f.kind==='ready'&&f.instance!==initial.instance&&f.snapshot?.stateRoot===before.stateRoot);rotated={frame:rotated,hierarchy:driver.hierarchy()};}
      finally{for(const[key,value]of [['accelerometer_rotation',rotationBefore.auto],['user_rotation',rotationBefore.rotation]])driver.adb(['shell','settings',value==='null'?'delete':'put','system',key,...(value==='null'?[]:[value])]);await new Promise(r=>setTimeout(r,100));}
      const beforeRestartFrames=driver.frames(session),lastReady=beforeRestartFrames.filter(f=>f.kind==='ready').at(-1);driver.stop();launch();const restarted=await driver.waitFrame(session,f=>f.kind==='ready'&&f.pid!==lastReady.pid&&f.snapshot?.stateRoot===before.stateRoot),restartHierarchy=driver.hierarchy();
      const image=driver.screenshot();if(screenshotPath)fs.writeFileSync(screenshotPath,image);control={before,afterRejected:bridge.runtime.snapshot(),unauthorized,stale,unknown,denied,rotationBefore,rotated,beforeRestartFrames,restarted,restartHierarchy,failureReceipts:bridge.runtime.failures(),screenshot:{sha256:sha(image),base64:image.toString('base64')}};
    }
    return{format:'rcl.k400-mobile-flow.v1',environment,status:'PASS_FLOW',session,url:bridge.url,transport:bridge.transport,uiRoot:bridge.runtime.ui.semanticRoot,layoutRoot:build.layoutRoot,appBinding:driver.binding,buildBinding:build,initial,initialHierarchy,steps,records:bridge.runtime.ledger(),targetBinding:structuredClone(bridge.runtime.target.binding),controllerLedger:bridge.runtime.target.controllerLedger?.()??null,requests:bridge.requests(),frames:driver.frames(session),commands:driver.commands().slice(commandStart),control};
  }finally{driver.stop();driver.adb(['reverse','--remove','tcp:'+port]);await bridge.dispose();}
}
