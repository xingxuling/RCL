import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const sha=b=>createHash('sha256').update(b).digest('hex');
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
export function parseAndroidHierarchy(xml){return [...xml.matchAll(/<node\b([^>]*)>/gu)].map(m=>{const attrs=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/gu)].map(a=>[a[1],decode(a[2])]));return{...attrs,bounds:attrs.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/u)?.slice(1).map(Number)??null};});}
export function createNativeAndroidDriver({adbPath='C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe',serial='emulator-5554',applicationId='org.rcl.k400.mobile'}={}){
  if(!/^[A-Za-z0-9_.:-]+$/u.test(serial)||!/^org\.rcl\.[a-z0-9.]+$/u.test(applicationId))throw new Error('RCL_MOBILE_DRIVER_SCOPE');
  const commands=[];
  function adb(args,{binary=false,timeout=30000}={}){const started=performance.now(),run=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout,maxBuffer:32*1024*1024}),ended=performance.now(),stdout=run.stdout??(binary?Buffer.alloc(0):''),stderr=run.stderr??'';commands.push({index:commands.length,args,started,ended,status:run.status,stdoutHash:sha(stdout),stderrHash:sha(stderr)});if(run.error||run.status!==0)throw new Error('RCL_MOBILE_ADB_FAILED:'+args[0]+':'+String(stderr));return stdout;}
  if(adb(['get-state']).trim()!=='device')throw new Error('RCL_MOBILE_DEVICE_REQUIRED');
  const binding={kind:'ACTUAL_ANDROID_NATIVE_VIEW',adb:{path:adbPath,sha256:sha(fs.readFileSync(adbPath))},serial,applicationId,device:{api:Number(adb(['shell','getprop','ro.build.version.sdk']).trim()),abi:adb(['shell','getprop','ro.product.cpu.abi']).trim(),fingerprint:adb(['shell','getprop','ro.build.fingerprint']).trim(),emulator:adb(['shell','getprop','ro.kernel.qemu']).trim()==='1',size:adb(['shell','wm','size']).trim(),density:adb(['shell','wm','density']).trim()},physicalDeviceClaimed:false,webViewUsed:false};
  function frames(session){const log=adb(['logcat','-d','-v','brief','-s','RCLRemoteUI:I','*:S']);return log.split(/\r?\n/u).flatMap(line=>{const at=line.indexOf('{');if(at<0)return[];try{const value=JSON.parse(line.slice(at));return value.session===session?[value]:[];}catch{return[];}});}
  return{binding,commands:()=>structuredClone(commands),adb,
    install(apk){const installed=adb(['install','-r',path.resolve(apk)],{timeout:60000});const packagePath=adb(['shell','pm','path',applicationId]).trim().replace(/^package:/u,'');if(!/^\/data\/app\/[A-Za-z0-9_~+/=.-]+\/base\.apk$/u.test(packagePath))throw new Error('RCL_MOBILE_INSTALLED_APK_SCOPE');const bytes=adb(['exec-out','cat',packagePath],{binary:true});if(sha(bytes)!==sha(fs.readFileSync(apk)))throw new Error('RCL_MOBILE_INSTALLED_APK_HASH');binding.installedApk={path:packagePath,sha256:sha(bytes),bytes:bytes.length};return installed;},
    launch({url,token,uiRoot,session}){return adb(['shell','am','start','-W','-n',applicationId+'/.MainActivity','--es','endpoint',url,'--es','token',token,'--es','uiRoot',uiRoot,'--es','session',session]);},
    stop(){return adb(['shell','am','force-stop',applicationId]);},frames,
    async waitFrame(session,predicate,{timeout=60000}={}){const end=performance.now()+timeout;while(performance.now()<end){const all=frames(session),error=all.find(f=>f.kind==='error');if(error)throw new Error('RCL_MOBILE_APP_ERROR:'+JSON.stringify(error.detail));const match=all.filter(predicate).at(-1);if(match)return match;await new Promise(r=>setTimeout(r,75));}throw new Error('RCL_MOBILE_FRAME_TIMEOUT:'+session);},
    hierarchy(){const file='/sdcard/rcl-mobile-'+randomUUID()+'.xml';try{adb(['shell','uiautomator','dump',file]);const xml=adb(['exec-out','cat',file]);return{xml,sha256:sha(xml),nodes:parseAndroidHierarchy(xml)};}finally{if(!/^\/sdcard\/rcl-mobile-[0-9a-f-]{36}\.xml$/u.test(file))throw new Error('RCL_MOBILE_DUMP_SCOPE');adb(['shell','rm',file]);}},
    tap(node){if(!node.bounds||node.bounds.some(v=>!Number.isInteger(v)||v<0))throw new Error('RCL_MOBILE_TAP_BOUNDS');const[l,t,r,b]=node.bounds;const point={x:Math.floor((l+r)/2),y:Math.floor((t+b)/2)};adb(['shell','input','tap',String(point.x),String(point.y)]);return point;},
    screenshot(){return adb(['exec-out','screencap','-p'],{binary:true});},
  };
}
