import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
const [directory,token]=process.argv.slice(2);
if(!directory||!/^[0-9a-f]{64}$/u.test(token??''))throw new Error('RCL_HTTP_WORKER_ARGUMENTS');
const root=path.resolve(directory),target=createPortableNativeTarget('windows');
const sha=value=>createHash('sha256').update(value).digest('hex');
const send=(response,status,body)=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(body));};
const server=http.createServer(async(request,response)=>{
  if(request.headers.authorization!=='Bearer '+token)return send(response,403,{ok:false,code:'RCL_HTTP_AUTHORITY_DENIED'});
  if(request.method==='GET'&&request.url==='/health')return send(response,200,{ok:true,pid:process.pid,binding:target.binding});
  if(request.method!=='POST'||!['/compile','/execute','/shutdown'].includes(request.url))return send(response,404,{ok:false,code:'RCL_HTTP_ROUTE_UNKNOWN'});
  try{
    const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>2*1024*1024)throw new Error('RCL_HTTP_INPUT_LIMIT');chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    if(request.url==='/shutdown'){send(response,200,{ok:true});server.close(()=>process.exit(0));return;}
    if(request.url==='/compile'){
      if(typeof body.source!=='string'||sha(body.source)!==body.sourceHash)throw new Error('RCL_HTTP_SOURCE_BINDING');
      const file=path.join(root,body.sourceHash+'.rcl'),output=path.join(root,body.sourceHash+'.rbc');fs.writeFileSync(file,body.source);
      const compiled=target.compile(file,output);return send(response,200,{ok:true,pid:process.pid,sourceHash:body.sourceHash,
        artifactHash:sha(compiled.bytecode),bytecode:compiled.bytecode.toString('base64'),compileMs:compiled.ms});
    }
    if(typeof body.bytecode!=='string'||!/^[0-9a-f]{64}$/u.test(body.artifactHash??''))throw new Error('RCL_HTTP_ARTIFACT_INPUT');
    const bytecode=Buffer.from(body.bytecode,'base64');if(sha(bytecode)!==body.artifactHash)throw new Error('RCL_HTTP_ARTIFACT_BINDING');
    const file=path.join(root,body.artifactHash+'.rbc');fs.writeFileSync(file,bytecode);
    const execution=target.execute(file,body.sourceRoot);return send(response,200,{ok:true,pid:process.pid,artifactHash:body.artifactHash,result:execution.result,executeMs:execution.ms});
  }catch(error){const code=error.code??/"code"\s*:\s*"([A-Z0-9_]+)"/u.exec(error.message)?.[1]??'RCL_HTTP_REQUEST_FAILED';
    send(response,400,{ok:false,code,message:error.message});}
});
server.listen(0,'127.0.0.1',()=>fs.writeFileSync(path.join(root,'ready.json'),JSON.stringify({port:server.address().port,pid:process.pid})));
server.on('error',error=>{fs.writeFileSync(path.join(root,'startup-error.txt'),String(error.stack));process.exit(1);});
