import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function launchNativeUiBrowser(options={}){
  const require=createRequire(import.meta.url),requested=options.playwrightModule??process.env.RCL_PLAYWRIGHT_MODULE;
  let file;try{file=requested?require.resolve(path.resolve(requested)):require.resolve('playwright-core');}catch{throw new Error('RCL_UI_PLAYWRIGHT_MISSING');}
  const module=await import(pathToFileURL(file).href),chromium=module.chromium??module.default.chromium,pkg=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'package.json'),'utf8'));
  const candidate=[options.browserPath,process.env.RCL_BROWSER_EXECUTABLE,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromium.executablePath()].filter(Boolean).find(p=>fs.existsSync(p));if(!candidate)throw new Error('RCL_UI_BROWSER_MISSING');
  const server=await chromium.launchServer({executablePath:candidate,headless:true,host:'127.0.0.1'}),browser=await chromium.connect(server.wsEndpoint()),context=await browser.newContext({viewport:options.viewport??{width:1100,height:800}}),page=await context.newPage(),logs=[];
  const userAgent=await page.evaluate(()=>navigator.userAgent);
  page.on('console',message=>{if(['error','warning'].includes(message.type()))logs.push({type:message.type(),text:message.text()});});page.on('pageerror',error=>logs.push({type:'pageerror',text:error.message}));
  return{browser,context,page,logs,binding:{browserPlugin:'ABSENT',fallbackReason:'Browser plugin not available',browser:{binaryPath:candidate,sha256:sha(fs.readFileSync(candidate)),version:browser.version(),pid:server.process().pid,userAgent},driver:{path:file,sha256:sha(fs.readFileSync(file)),version:pkg.version}},
    async dispose(){await context.close();await browser.close();await server.close();}};
}
