import fs from 'node:fs';
const [endpoint,token,route,file]=process.argv.slice(2);
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/u.test(endpoint??''))throw new Error('RCL_HTTP_LOOPBACK_REQUIRED');
const request=await fetch(endpoint+route,{method:route==='/health'?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  ...(file?{body:fs.readFileSync(file,'utf8')}:{}) ,signal:AbortSignal.timeout(60_000)});
const body=await request.json();console.log(JSON.stringify({...body,httpStatus:request.status}));
if(!request.ok||!body.ok)process.exitCode=1;
