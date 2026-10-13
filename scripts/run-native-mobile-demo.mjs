import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createNativeUiWebBridge} from '../src/ui/native-web-bridge.mjs';
import {createNativeAndroidDriver} from '../src/ui/native-android-driver.mjs';
import {createUiExecutionTarget} from './k400-ui-targets.mjs';
import {MOBILE_PROFILE,MOBILE_DIRECTORY} from './k400-mobile-definitions.mjs';
import {ROOT} from './k400-genomes/shared.mjs';
const environment=process.argv[2]??'windows';
if(!MOBILE_PROFILE.environments.includes(environment))throw new Error('RCL_MOBILE_DEMO_ENVIRONMENT');
const build=JSON.parse(fs.readFileSync(path.join(ROOT,MOBILE_DIRECTORY,'native-counter-build.json'),'utf8'));
const driver=createNativeAndroidDriver(),bridge=await createNativeUiWebBridge(MOBILE_PROFILE.source(),{factory:()=>createUiExecutionTarget(environment)});
const port=new URL(bridge.url).port;let closed=false;
async function close(){if(closed)return;closed=true;try{driver.stop();driver.adb(['reverse','--remove','tcp:'+port]);}finally{await bridge.dispose();}}
try{
  driver.install(path.join(ROOT,build.apk.path));driver.stop();driver.adb(['reverse','tcp:'+port,'tcp:'+port]);
  const session=randomUUID();driver.launch({url:bridge.url,token:bridge.token,uiRoot:bridge.runtime.ui.semanticRoot,session});
  await driver.waitFrame(session,f=>f.kind==='ready');
  console.log('Android 原生计数器已连接 RCL '+environment+' 后端。可直接操作增加、重置按钮，按 Ctrl+C 结束。');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
}finally{await close();}
