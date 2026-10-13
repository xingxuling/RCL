// ADAPT of the frozen browser adapter; explicit artifact injection only.
// Donor SHA256: 486169bce02ef724c890c4421c319aa6106ba559a0002ec38eb55d2da65766bd
// RCL compilation and instruction execution remain inside actual browser WASM.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const relative=file=>path.relative(ROOT,file).replaceAll('\\','/');
const describe=file=>({path:relative(file),sha256:sha(fs.readFileSync(file))});
const html='<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>RCL 浏览器运行环境</title><body><output id="runtime-status">加载运行环境</output><script type="module" src="./runtime.mjs"></script></body></html>';

async function loadDriver(requested){
  const require=createRequire(import.meta.url);let file;
  try{file=requested?require.resolve(path.resolve(requested)):require.resolve('playwright-core');}
  catch{throw new Error('RCL_BROWSER_DRIVER_MISSING: install playwright-core or provide RCL_PLAYWRIGHT_MODULE');}
  const module=await import(pathToFileURL(file).href),pkg=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'package.json'),'utf8'));
  return{chromium:module.chromium??module.default?.chromium,file,version:pkg.version,sha256:sha(fs.readFileSync(file))};
}

/** Actual browser WebAssembly execution; Node only compiles, transports and verifies. */
export async function createArtifactBrowserTarget(options={}){
  const driver=await loadDriver(options.playwrightModule??process.env.RCL_PLAYWRIGHT_MODULE);
  const candidates=[options.browserPath,process.env.RCL_BROWSER_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',driver.chromium.executablePath()].filter(Boolean);
  const browserPath=candidates.find(file=>fs.existsSync(file));if(!browserPath)throw new Error('RCL_BROWSER_EXECUTABLE_MISSING');
  const wasm=path.resolve(options.vmPath??path.join(ROOT,'native/wasi/rclvm.wasm')),compilerWasm=path.resolve(options.compilerWasmPath??path.join(ROOT,'native/wasi-compiler/rclc.wasm')),compilerArtifact=path.resolve(options.compilerArtifactPath??path.join(ROOT,'selfhost/compiler.rbc')),shim=path.join(ROOT,'src/vendor/browser-wasi-shim');
  const provenance=JSON.parse(fs.readFileSync(path.join(shim,'PROVENANCE.json'),'utf8'));
  for(const item of provenance.files)if(sha(fs.readFileSync(path.join(shim,item.path)))!==item.sha256)throw new Error('RCL_BROWSER_SHIM_SOURCE_DRIFT:'+item.path);
  const prefix='/'+randomUUID()+'/',routes=new Map([[prefix,{bytes:Buffer.from(html),type:'text/html; charset=utf-8'}],
    [prefix+'runtime.mjs',{bytes:fs.readFileSync(path.join(ROOT,'src/browser-runtime-page.mjs')),type:'text/javascript'}],
    [prefix+'vm.wasm',{bytes:fs.readFileSync(wasm),type:'application/wasm'}],
    [prefix+'compiler.wasm',{bytes:fs.readFileSync(compilerWasm),type:'application/wasm'}]]);
  for(const file of provenance.files.filter(item=>item.path.endsWith('.js')))routes.set(prefix+'shim/'+file.path,{bytes:fs.readFileSync(path.join(shim,file.path)),type:'text/javascript'});
  const server=http.createServer((request,response)=>{
    const route=routes.get(request.url);if(request.method!=='GET'||!route){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'content-type':route.type,'cache-control':'no-store','x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'"});response.end(route.bytes);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  let browserServer,browser,context,page,busy=false,disposed=false;
  async function close(){disposed=true;await browser?.close();await browserServer?.close();await new Promise(resolve=>server.close(resolve));}
  try{
    browserServer=await driver.chromium.launchServer({executablePath:browserPath,headless:true,host:'127.0.0.1'});
    browser=await driver.chromium.connect(browserServer.wsEndpoint());context=await browser.newContext();
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    page=await context.newPage();await page.goto(origin+prefix);await page.waitForFunction(()=>window.rclBrowserRuntime?.ready===true);
    const initial=await page.evaluate(()=>({pageToken:window.rclBrowserRuntime.pageToken,wasmHash:window.rclBrowserRuntime.wasmHash,compilerHash:window.rclBrowserRuntime.compilerHash,userAgent:navigator.userAgent}));
    if(initial.wasmHash!==sha(fs.readFileSync(wasm))||initial.compilerHash!==sha(fs.readFileSync(compilerWasm)))throw new Error('RCL_BROWSER_VM_ARTIFACT_MISMATCH');
    const browserPid=browserServer.process().pid;
    return{environment:'browser',binding:{context:'browser',execution:'Actual headless Chromium browser compiling RCL source and executing the native C VM through WebAssembly and WASI Preview 1',
        os:'Browser',hostPlatform:process.platform,arch:'wasm32',compilerLocation:'Browser window executing RCL-authored compiler RBC',compilerBinary:describe(compilerWasm),compilerArtifact:describe(compilerArtifact),
        binary:describe(wasm),executionRealm:'browser-window',vmArchitecture:'wasm32',browser:{binaryPath:browserPath,sha256:sha(fs.readFileSync(browserPath)),version:browser.version(),pid:browserPid,userAgent:initial.userAgent},
        driver:{binaryPath:driver.file,sha256:driver.sha256,version:driver.version},shim:describe(path.join(shim,'PROVENANCE.json')),
        runtimeOwner:'RCL_C_VM_BROWSER_WEBASSEMBLY',nodeWasiExecutionUsed:false,hostedDeploymentClaimed:false,securitySandboxClaimed:false},
      async compile(source,output){
        if(disposed)throw new Error('RCL_BROWSER_TARGET_CLOSED');if(busy)throw new Error('RCL_BROWSER_BACKPRESSURE');
        const started=performance.now(),text=fs.readFileSync(source,'utf8'),sourceHash=sha(text),bytes=fs.readFileSync(compilerArtifact),nonce=randomUUID();
        busy=true;
        try{
          const observed=await page.evaluate(input=>window.rclBrowserRuntime.compile(input),{source:text,sourceHash,compilerBytes:Array.from(bytes),compilerArtifactHash:sha(bytes),nonce});
          if(observed.nonce!==nonce||observed.sourceHash!==sourceHash||observed.compilerHash!==initial.compilerHash||observed.compilerArtifactHash!==sha(bytes)||observed.executionOwner!=='RCL_COMPILER_RBC_BROWSER_WEBASSEMBLY')throw new Error('RCL_BROWSER_COMPILER_BINDING');
          if(observed.exitCode!==0||!observed.bytecode){const error=new Error(observed.stdout+'\n'+observed.stderr);error.code='RCL_BROWSER_COMPILE_REJECTED';throw error;}
          const bytecode=Buffer.from(observed.bytecode);if(sha(bytecode)!==observed.artifactHash)throw new Error('RCL_BROWSER_COMPILER_OUTPUT_BINDING');
          const compilerMetrics=JSON.parse(observed.stdout);if(compilerMetrics.status!=='ok'||compilerMetrics.bytes!==bytecode.length||!(compilerMetrics.executedInstructions>0))throw new Error('RCL_BROWSER_COMPILER_METRICS');
          fs.writeFileSync(output,bytecode);return{bytecode,ms:performance.now()-started,browserCompileTrace:{...observed,bytecode:undefined,stdout:undefined,stderr:undefined,browserPid,compilerMetrics}};
        }finally{busy=false;}
      },
      async execute(file,sourceRoot){
        if(disposed)throw new Error('RCL_BROWSER_TARGET_CLOSED');if(busy)throw new Error('RCL_BROWSER_BACKPRESSURE');
        if(!/^[0-9a-f]{64}$/u.test(sourceRoot??''))throw new Error('RCL_BROWSER_SOURCE_ROOT_REQUIRED');
        const started=performance.now(),bytes=fs.readFileSync(file),artifactHash=sha(bytes),nonce=randomUUID();busy=true;
        try{
          const observed=await page.evaluate(input=>window.rclBrowserRuntime.execute(input),{bytes:Array.from(bytes),artifactHash,nonce});
          if(observed.nonce!==nonce||observed.artifactHash!==artifactHash||observed.wasmHash!==initial.wasmHash||observed.executionOwner!=='RCL_C_VM_BROWSER_WEBASSEMBLY')throw new Error('RCL_BROWSER_EXECUTION_BINDING');
          if(observed.exitCode!==0){let rejected;try{rejected=JSON.parse(observed.stdout);}catch{}const error=new Error(observed.stdout+'\n'+observed.stderr);
            error.code=rejected?.code??/\b(RCL_NATIVE_[A-Z_]+)\b/u.exec(observed.stderr)?.[1]??'RCL_BROWSER_NATIVE_REJECTED';throw error;}
          const payload=JSON.parse(observed.stdout);
          if(payload.status!=='ok'){const error=new Error(observed.stdout+'\n'+observed.stderr);error.code=payload.code??'RCL_BROWSER_NATIVE_REJECTED';throw error;}
          const result=verifyNativeSemanticStateRoot(payload,{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
          if(result.sourceRoot!==sourceRoot)throw new Error('RCL_BROWSER_SOURCE_ROOT_MISMATCH');
          return{result,ms:performance.now()-started,browserTrace:{...observed,stdout:undefined,stderr:undefined,browserPid,sourceRoot}};
        }finally{busy=false;}
      },
      async verifyReset(file,sourceRoot){
        const first=await this.execute(file,sourceRoot),next=await this.execute(file,sourceRoot);
        if(first.browserTrace.pageToken!==next.browserTrace.pageToken||next.browserTrace.instance!==first.browserTrace.instance+1)throw new Error('RCL_BROWSER_INSTANCE_SEQUENCE');
        await page.reload();await page.waitForFunction(()=>window.rclBrowserRuntime?.ready===true);const reset=await this.execute(file,sourceRoot);
        if(reset.browserTrace.pageToken===first.browserTrace.pageToken||reset.browserTrace.instance!==1||reset.result.stateRoot!==first.result.stateRoot)throw new Error('RCL_BROWSER_PAGE_RESET_FAILED');
        return{status:'PASS',pageResetObserved:true,browserPid,pageTokenBefore:first.browserTrace.pageToken,pageTokenAfter:reset.browserTrace.pageToken,
          firstInstance:first.browserTrace.instance,nextInstance:next.browserTrace.instance,resetInstance:1,stateRoot:reset.result.stateRoot,sourceRoot,artifactHash:sha(fs.readFileSync(file))};
      },dispose:close};
  }catch(error){await close();throw error;}
}
