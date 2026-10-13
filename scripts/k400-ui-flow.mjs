import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createNativeUiWebBridge} from '../src/ui/native-web-bridge.mjs';
import {UI_EVENTS} from './k400-ui-definitions.mjs';
import {createUiExecutionTarget} from './k400-ui-targets.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function runUiFlow(environment,source,driver,{controls=false,screenshotPath=null}={}){
  const bridge=await createNativeUiWebBridge(source,{factory:()=>createUiExecutionTarget(environment)}),page=driver.page,logStart=driver.logs.length;
  async function observe(){return page.evaluate(()=>({snapshot:window.rclNativeBridge.snapshot,ready:window.rclNativeBridge.ready,error:window.rclNativeBridge.error,title:document.title,
    rendered:Object.fromEntries(Array.from(document.querySelectorAll('[data-rcl-node]')).map(e=>[e.dataset.rclNode,{text:e instanceof HTMLInputElement?e.value:e.textContent,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},role:e.dataset.rclRole,label:e.getAttribute('aria-label')}]))}));}
  try{
    await page.goto(bridge.url);await page.waitForFunction(()=>window.rclNativeBridge?.ready===true);const initial=await observe(),steps=[];
    for(const event of UI_EVENTS){const revision=bridge.runtime.snapshot().revision;await page.locator('[data-rcl-node="'+event.nodeId+'"]').click();await page.waitForFunction(rev=>window.rclNativeBridge.snapshot.revision===rev+1&&!window.rclNativeBridge.pending,revision);steps.push(await observe());}
    let control;
    if(controls){
      const before=bridge.runtime.snapshot(),headers={'content-type':'application/json','x-rcl-ui-token':bridge.token};
      async function send(body,token=bridge.token){const response=await fetch(bridge.url+'/api/event',{method:'POST',headers:{...headers,'x-rcl-ui-token':token},body:JSON.stringify(body)});return{status:response.status,payload:await response.json()};}
      const event=UI_EVENTS[0],unauthorized=await send({event,expectedStateRoot:before.stateRoot},'wrong'),stale=await send({event,expectedStateRoot:'0'.repeat(64)}),unknown=await send({event:{nodeId:'Missing',type:'activate',payload:{}},expectedStateRoot:before.stateRoot}),denied=await send({event,expectedStateRoot:before.stateRoot,authorized:false});
      const afterRejected=bridge.runtime.snapshot();assert.equal(afterRejected.stateRoot,before.stateRoot);
      await page.reload();await page.waitForFunction(()=>window.rclNativeBridge?.ready===true);const reloaded=await observe();assert.equal(reloaded.snapshot.stateRoot,before.stateRoot);
      await page.setViewportSize({width:414,height:896});const mobile=await observe();const rect=mobile.rendered.IncrementButton.rect;assert.ok(rect.width>0&&rect.height>=44);assert.ok(rect.x>=0&&rect.x+rect.width<=414);
      const image=await page.screenshot({fullPage:true});if(screenshotPath){fs.mkdirSync(path.dirname(screenshotPath),{recursive:true});fs.writeFileSync(screenshotPath,image);}
      control={unauthorized,stale,unknown,denied,before,afterRejected,reloaded,mobile,screenshot:{sha256:sha(image),base64:image.toString('base64')},failureReceipts:bridge.runtime.failures()};
      await page.setViewportSize({width:1100,height:800});
      const desktopImage=await page.screenshot({fullPage:true});control.desktopScreenshot={sha256:sha(desktopImage),base64:desktopImage.toString('base64')};
      if(screenshotPath)fs.writeFileSync(screenshotPath.replace(/\.png$/u,'-desktop.png'),desktopImage);
    }
    const logs=driver.logs.slice(logStart);assert.deepEqual(logs,[]);
    return{format:'rcl.k400-ui-flow.v1',status:'PASS_FLOW',environment,url:bridge.url,transport:bridge.transport,uiRoot:bridge.runtime.ui.semanticRoot,html:bridge.html,htmlHash:bridge.htmlHash,
      driverBinding:driver.binding,targetBinding:structuredClone(bridge.runtime.target.binding),initial,steps,records:bridge.runtime.ledger(),controllerLedger:bridge.runtime.target.controllerLedger?.()??null,requests:bridge.requests(),logs,control};
  }catch(error){let observed;try{observed=await observe();}catch{}const details={environment,sourceHash:sha(source),error:error.message,revision:observed?.snapshot?.revision,browserError:observed?.error,logs:driver.logs.slice(logStart),failures:bridge.runtime.failures().map(f=>({code:f.code,diagnostic:f.diagnostic}))};throw new Error('RCL_UI_FLOW_FAILURE:'+JSON.stringify(details),{cause:error});}
  finally{await bridge.dispose();}
}
