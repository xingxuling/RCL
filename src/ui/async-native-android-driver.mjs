// ADAPT of native-android-driver.mjs: identical scoped ADB operations, asynchronous transport.
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {parseAndroidHierarchy} from './native-android-driver.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

export function runAndroidCommand(executable,args,{binary=false,timeout=30000}={}){
  return new Promise((resolve,reject)=>{
    execFile(executable,args,{encoding:binary?null:'utf8',windowsHide:true,timeout,maxBuffer:32*1024*1024},(error,stdout,stderr)=>{
      const result={stdout:stdout??(binary?Buffer.alloc(0):''),stderr:stderr??'',status:error?(Number.isInteger(error.code)?error.code:null):0};
      if(error)reject(Object.assign(error,{commandResult:result}));else resolve(result);
    });
  });
}

export async function createAsyncNativeAndroidDriver({adbPath='C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe',serial='emulator-5554',applicationId='org.rcl.k400.mobile'}={}){
  if(!/^[A-Za-z0-9_.:-]+$/u.test(serial)||!/^org\.rcl\.[a-z0-9.]+$/u.test(applicationId))throw new Error('RCL_MOBILE_DRIVER_SCOPE');
  const commands=[];
  async function adb(args,options={}){
    const started=performance.now();let result;
    try{result=await runAndroidCommand(adbPath,['-s',serial,...args],options);}
    catch(error){result=error.commandResult??{stdout:'',stderr:error.message,status:null};commands.push({index:commands.length,args,started,ended:performance.now(),status:result.status,stdoutHash:sha(result.stdout),stderrHash:sha(result.stderr)});throw new Error('RCL_MOBILE_ADB_FAILED:'+args[0]+':'+String(result.stderr),{cause:error});}
    commands.push({index:commands.length,args,started,ended:performance.now(),status:result.status,stdoutHash:sha(result.stdout),stderrHash:sha(result.stderr)});return result.stdout;
  }
  if((await adb(['get-state'])).trim()!=='device')throw new Error('RCL_MOBILE_DEVICE_REQUIRED');
  const binding={kind:'ACTUAL_ANDROID_NATIVE_VIEW',driverIo:'ASYNC_CHILD_PROCESS',adb:{path:adbPath,sha256:sha(fs.readFileSync(adbPath))},serial,applicationId,device:{
    api:Number((await adb(['shell','getprop','ro.build.version.sdk'])).trim()),
    abi:(await adb(['shell','getprop','ro.product.cpu.abi'])).trim(),
    fingerprint:(await adb(['shell','getprop','ro.build.fingerprint'])).trim(),
    emulator:(await adb(['shell','getprop','ro.kernel.qemu'])).trim()==='1',
    size:(await adb(['shell','wm','size'])).trim(),density:(await adb(['shell','wm','density'])).trim()},physicalDeviceClaimed:false,webViewUsed:false};
  async function frames(session){
    const log=await adb(['logcat','-d','-v','brief','-s','RCLRemoteUI:I','*:S']);
    return log.split(/\r?\n/u).flatMap(line=>{const at=line.indexOf('{');if(at<0)return[];try{const value=JSON.parse(line.slice(at));return value.session===session?[value]:[];}catch{return[];}});
  }
  return{binding,commands:()=>structuredClone(commands),adb,
    async install(apk){
      const installed=await adb(['install','-r',path.resolve(apk)],{timeout:60000});
      const packagePath=(await adb(['shell','pm','path',applicationId])).trim().replace(/^package:/u,'');
      if(!/^\/data\/app\/[A-Za-z0-9_~+/=.-]+\/base\.apk$/u.test(packagePath))throw new Error('RCL_MOBILE_INSTALLED_APK_SCOPE');
      const bytes=await adb(['exec-out','cat',packagePath],{binary:true});
      if(sha(bytes)!==sha(fs.readFileSync(apk)))throw new Error('RCL_MOBILE_INSTALLED_APK_HASH');
      binding.installedApk={path:packagePath,sha256:sha(bytes),bytes:bytes.length};return installed;
    },
    launch({url,token,uiRoot,session}){return adb(['shell','am','start','-W','-n',applicationId+'/.MainActivity','--es','endpoint',url,'--es','token',token,'--es','uiRoot',uiRoot,'--es','session',session]);},
    stop(){return adb(['shell','am','force-stop',applicationId]);},frames,
    async waitFrame(session,predicate,{timeout=60000}={}){
      const end=performance.now()+timeout;
      while(performance.now()<end){const all=await frames(session),error=all.find(f=>f.kind==='error');if(error)throw new Error('RCL_MOBILE_APP_ERROR:'+JSON.stringify(error.detail));const match=all.filter(predicate).at(-1);if(match)return match;await new Promise(r=>setTimeout(r,75));}
      throw new Error('RCL_MOBILE_FRAME_TIMEOUT:'+session);
    },
    async hierarchy(){
      const file='/sdcard/rcl-mobile-'+randomUUID()+'.xml';
      try{await adb(['shell','uiautomator','dump',file]);const xml=await adb(['exec-out','cat',file]);return{xml,sha256:sha(xml),nodes:parseAndroidHierarchy(xml)};}
      finally{if(!/^\/sdcard\/rcl-mobile-[0-9a-f-]{36}\.xml$/u.test(file))throw new Error('RCL_MOBILE_DUMP_SCOPE');await adb(['shell','rm',file]);}
    },
    async tap(node){
      if(!node.bounds||node.bounds.some(v=>!Number.isInteger(v)||v<0))throw new Error('RCL_MOBILE_TAP_BOUNDS');
      const[l,t,r,b]=node.bounds,point={x:Math.floor((l+r)/2),y:Math.floor((t+b)/2)};
      await adb(['shell','input','tap',String(point.x),String(point.y)]);return point;
    },
    screenshot(){return adb(['exec-out','screencap','-p'],{binary:true});},
  };
}
