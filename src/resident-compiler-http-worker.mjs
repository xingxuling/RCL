import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createResidentSequenceCompiler} from './resident-sequence-compiler.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const [directory,token]=process.argv.slice(2),owned=path.resolve(directory??'');
if(path.dirname(owned)!==path.resolve(os.tmpdir())||!path.basename(owned).startsWith('rcl-resident-http-')||!/^[0-9a-f]{64}$/u.test(token??''))throw new Error('RCLC_HTTP_OWNED_SCOPE');
const compiler=await createResidentSequenceCompiler(),vm=path.join(ROOT,'native/rclvm.exe');let busy=false,sequence=0;
const binding={owner:'RCL_RESIDENT_COMPILER_HTTP',serverPid:process.pid,compiler:compiler.binding,
  vm:{path:'native/rclvm.exe',sha256:sha(fs.readFileSync(vm)),bytes:fs.statSync(vm).size},
  transport:'AUTHENTICATED_HTTP_LOOPBACK',referenceCompilationUsed:false,referenceExecutionUsed:false,hostedDeploymentClaimed:false,securitySandboxClaimed:false};
function send(response,status,body){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({serverPid:process.pid,...body}));}
function decode(body,name,hash){if(typeof body[name]!=='string'||!/^[0-9a-f]{64}$/u.test(body[hash]??''))throw new Error('RCLC_HTTP_INPUT_FORMAT');const bytes=Buffer.from(body[name],'base64');if(sha(bytes)!==body[hash])throw new Error('RCLC_HTTP_INPUT_BINDING');return bytes;}
const server=http.createServer(async(request,response)=>{
  if(request.headers.authorization!=='Bearer '+token)return send(response,403,{ok:false,code:'RCLC_HTTP_AUTHORITY_DENIED'});
  if(request.method==='GET'&&request.url==='/health')return send(response,200,{ok:true,binding,sequence,busy});
  if(request.method!=='POST'||!['/compile','/execute','/shutdown'].includes(request.url))return send(response,404,{ok:false,code:'RCLC_HTTP_ROUTE_UNKNOWN'});
  if(busy)return send(response,409,{ok:false,code:'RCLC_HTTP_BACKPRESSURE'});
  busy=true;
  try{
    const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>8*1024*1024)throw new Error('RCLC_HTTP_INPUT_LIMIT');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks),body=JSON.parse(bytes.toString('utf8')||'{}');
    if(!/^[0-9a-f-]{36}$/u.test(body.requestId??''))throw new Error('RCLC_HTTP_REQUEST_ID');
    const requestId=body.requestId,requestHash=sha(bytes),requestSequence=++sequence;
    if(request.url==='/shutdown'){
      const compilerExit=await compiler.dispose();send(response,200,{ok:true,requestId,requestHash,requestSequence,compilerExit});server.close(()=>process.exit(0));return;
    }
    if(request.url==='/compile'){
      const seed=decode(body,'compilerBase64','compilerHash');
      if(typeof body.source!=='string'||sha(body.source)!==body.sourceHash)throw new Error('RCLC_HTTP_SOURCE_BINDING');
      const input=path.join(owned,body.compilerHash+'.rbc'),source=path.join(owned,body.sourceHash+'.rcl');fs.writeFileSync(input,seed);fs.writeFileSync(source,body.source);
      const result=await compiler.compile(input,source);send(response,200,{ok:true,requestId,requestHash,requestSequence,
        sourceHash:body.sourceHash,compilerHash:body.compilerHash,artifactHash:sha(result.bytecode),bytecodeBase64:result.bytecode.toString('base64'),nativeCompilerTrace:result.compilerTrace});return;
    }
    const artifact=decode(body,'bytecodeBase64','artifactHash');if(!/^[0-9a-f]{64}$/u.test(body.sourceRoot??''))throw new Error('RCLC_HTTP_SOURCE_ROOT');
    const file=path.join(owned,body.artifactHash+'.rbc');fs.writeFileSync(file,artifact);
    const native=await new Promise(resolve=>{const child=execFile(vm,[file],{encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:32*1024*1024,
      env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}},(error,stdout,stderr)=>resolve({pid:child.pid,command:vm,args:[file],status:error?(Number.isInteger(error.code)?error.code:null):0,signal:error?.signal??null,stdout,stderr}));});
    native.stdoutHash=sha(native.stdout);native.stderrHash=sha(native.stderr);
    if(native.status!==0){const error=new Error(native.stdout+'\n'+native.stderr);error.nativeExecutionTrace=native;throw error;}
    const result=verifyNativeSemanticStateRoot(JSON.parse(native.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
    if(result.sourceRoot!==body.sourceRoot)throw new Error('RCLC_HTTP_EXECUTION_SOURCE_BINDING');
    send(response,200,{ok:true,requestId,requestHash,requestSequence,artifactHash:body.artifactHash,result,nativeExecutionTrace:native});
  }catch(error){send(response,400,{ok:false,code:error.code??'RCLC_HTTP_REQUEST_FAILED',message:error.message,
    nativeCompilerTrace:error.compilerTrace??null,nativeExecutionTrace:error.nativeExecutionTrace??null});}
  finally{busy=false;}
});
server.on('error',async error=>{process.stderr.write(String(error.stack));try{await compiler.dispose();}finally{process.exit(1);}});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({status:'ready',pid:process.pid,port:server.address().port,binding})+'\n'));
