import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {compileReality} from './compiler.mjs';
import {compileRealityToBytecode} from './bytecode.mjs';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {semanticStateRootForAlgorithm} from './semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const counterRoot=vector=>semanticStateRootForAlgorithm({counter:vector},'rcl.semantic-state-root.v2');
const here=path.resolve(import.meta.dirname,'..');

export function bindCounterInputs(source,inputs){
  for(const[name,value]of Object.entries(inputs)){
    if(!/^[a-z_]+$/u.test(name)||(typeof value!=='boolean'&&!Number.isFinite(value)))throw new Error('RCL_COUNTER_INPUT');
    const pattern=new RegExp('(facet input\\.'+name+' : (?:Number|Truth) = )-?(?:[0-9.]+|true|false)','gu');
    if([...source.matchAll(pattern)].length!==1)throw new Error('RCL_COUNTER_SOURCE_INPUT:'+name);
    source=source.replace(pattern,(_match,prefix)=>prefix+String(value));
  }
  return source;
}

/** Three real loopback HTTP nodes. Only RCL computes/adopts counter values. */
export async function runReplicatedCounterNetwork(options={}){
  const source=options.source??fs.readFileSync(path.join(here,'examples/distributed/replicated-counter.rcl'),'utf8');
  const factory=options.factory??(()=>createPortableNativeTarget('windows'));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-counter-network-')),nodes=[],packets=[];
  let partitioned=true,packetSequence=0;
  async function run(node,inputs){
    const text=bindCounterInputs(source,inputs),input=path.join(directory,node.id+'-'+randomUUID()+'.rcl'),artifact=input+'.rbc';fs.writeFileSync(input,text);
    const compiled=await node.target.compile(input,artifact);
    if(!compiled.bytecode.equals(compileRealityToBytecode(text)))throw new Error('RCL_COUNTER_COMPILER_PARITY');
    const sourceRoot=compileReality(text).programRoot,execution=await node.target.execute(artifact,sourceRoot);
    return{inputs,sourceHash:sha(text),artifactHash:sha(compiled.bytecode),sourceRoot,result:{state:execution.result.state,stateRoot:execution.result.stateRoot,
      history:execution.result.history??[],projections:execution.result.projections??[]},
      compileTrace:compiled.browserCompileTrace??compiled.gpuCompileTrace??compiled.rncsCompileTrace??(node.target.environment==='serverless'?
        {handlerPid:compiled.handlerPid,terminationObserved:compiled.terminationObserved,processExited:compiled.processExited,request:compiled.request}:null),
      runtimeTrace:execution.browserTrace??execution.gpuTrace??execution.rncsTrace??execution.controllerTrace??(
        node.target.environment==='server'?{transport:node.target.binding.transport,workerPid:node.target.binding.workerPid}:
        node.target.environment==='embedded-runtime'?{instancePid:execution.instancePid,instanceRun:execution.instanceRun}:
        node.target.environment==='distributed-runtime'?{replicaPids:execution.replicaPids,replicaExecutions:execution.replicaExecutions}:
        node.target.environment==='serverless'?{handlerPid:execution.handlerPid,terminationObserved:execution.terminationObserved,processExited:execution.processExited,request:execution.request}:
        node.target.environment==='database'?{runId:execution.runId,committed:execution.committed,sqlFunction:execution.sqlFunction,sqlInvocations:execution.sqlInvocations,sqliteVersion:execution.sqliteVersion}:
        node.target.environment==='dataflow-runtime'?{threadId:execution.threadId,delivery:execution.delivery,stages:execution.stages,inputHash:execution.inputHash}:null),
      gpuRecords:execution.result.gpuRecords??null,gpuWarrants:execution.result.gpuWarrants??null};
  }
  async function send(sender,receiver,vector,extra={},badToken=false){
    const id=randomUUID(),body={id,sender,vector,...extra},before=[...nodes[receiver].vector];
    const response=await fetch(nodes[receiver].url,{method:'POST',headers:{'content-type':'application/json','x-rcl-node-token':badToken?'invalid':nodes[receiver].token},body:JSON.stringify(body)});
    const payload=await response.json();const item={sequence:packetSequence++,id,sender,receiver,vector,extra,httpStatus:response.status,
      before,after:[...nodes[receiver].vector],beforeRoot:counterRoot(before),afterRoot:counterRoot(nodes[receiver].vector),...payload};
    packets.push(item);return item;
  }
  try{
    for(let id=0;id<3;id++){
      const node={id,target:await factory(),token:randomUUID(),vector:[],busy:false};nodes.push(node);
      node.initial=await run(node,{});node.vector=[...node.initial.result.state['local.'+['a','b','c'][id]]];
      node.server=http.createServer(async(request,response)=>{
        function reply(status,payload){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(payload));}
        if(request.method!=='POST'||request.url!=='/packet'){reply(404,{code:'NOT_FOUND'});return;}
        if(request.headers['x-rcl-node-token']!==node.token){reply(403,{code:'TRANSPORT_UNAUTHORIZED',executed:false});return;}
        if(node.busy){reply(409,{code:'NODE_BACKPRESSURE',executed:false});return;}
        let bytes='';for await(const chunk of request){bytes+=chunk;if(bytes.length>4096){reply(413,{code:'PACKET_LIMIT',executed:false});return;}}
        let body;try{body=JSON.parse(bytes);}catch{reply(400,{code:'PACKET_JSON',executed:false});return;}
        if(!Array.isArray(body.vector)||body.vector.length!==3||body.vector.some(value=>!Number.isFinite(value))||!Number.isFinite(body.sender)){
          reply(400,{code:'PACKET_SHAPE',executed:false});return;
        }
        if(partitioned&&body.sender>=0&&body.sender<3&&body.sender!==id&&(body.sender>=2||id>=2)){
          reply(503,{code:'NETWORK_PARTITION',executed:false});return;
        }
        node.busy=true;
        try{
          const current=[...node.vector],observed=await run(node,{packet_mode:true,repeats:0,receiver:id,sender:body.sender,
            current_a:current[0],current_b:current[1],current_c:current[2],incoming_a:body.vector[0],incoming_b:body.vector[1],incoming_c:body.vector[2],
            allowed:body.allowed??true});
          if(observed.result.state['packet.accepted']!==true){reply(400,{code:'RCL_PACKET_REJECTED',executed:true,observed});return;}
          node.vector=[...observed.result.state['packet.result']];reply(200,{code:'MERGED',executed:true,observed});
        }catch(error){reply(500,{code:'RCL_NODE_EXECUTION_FAILED',diagnostic:error.message,executed:true});}
        finally{node.busy=false;}
      });
      await new Promise((resolve,reject)=>{node.server.once('error',reject);node.server.listen(0,'127.0.0.1',resolve);});
      node.url='http://127.0.0.1:'+node.server.address().port+'/packet';
    }
    const initial=nodes.map(node=>[...node.vector]);
    await send(0,1,initial[0]);await send(1,0,initial[1]);
    const cut=await send(2,0,initial[2]);if(cut.httpStatus!==503||cut.executed)throw new Error('RCL_COUNTER_PARTITION_NOT_OBSERVED');
    const partition=nodes.map(node=>[...node.vector]);partitioned=false;
    await send(1,2,[...nodes[1].vector]);await send(2,0,[...nodes[2].vector]);await send(2,1,[...nodes[2].vector]);
    const converged=nodes.map(node=>[...node.vector]);
    const stale=node=>node.initial.result.state['local.stale_a'];
    await send(0,1,[...stale(nodes[0])]);await send(2,0,[...nodes[2].vector]);await send(2,0,[...nodes[2].vector]);
    const foreign=await send(99,0,[1000,1000,1000]);if(foreign.httpStatus!==400||foreign.observed?.result.state['packet.accepted']!==false)throw new Error('RCL_COUNTER_FOREIGN_SENDER_ACCEPTED');
    const denied=await send(1,0,[1000,1000,1000],{allowed:false});if(denied.httpStatus!==400||denied.observed?.result.state['packet.accepted']!==false)throw new Error('RCL_COUNTER_WARRANT_BYPASSED');
    const unauthorized=await send(1,0,[1000,1000,1000],{},true);if(unauthorized.httpStatus!==403||unauthorized.executed)throw new Error('RCL_COUNTER_TRANSPORT_AUTHORITY_BYPASSED');
    for(const node of nodes)if(JSON.stringify(node.vector)!==JSON.stringify(converged[0]))throw new Error('RCL_COUNTER_CONVERGENCE_OR_DUPLICATE_FAILURE');
    if(packets.some(item=>![200,400,403,503].includes(item.httpStatus)))throw new Error('RCL_COUNTER_PACKET_EXECUTION_FAILURE');
    return{status:'PASS',sourceHash:sha(source),sourceRoot:compileReality(source).programRoot,artifactHash:sha(compileRealityToBytecode(source)),
      transport:'THREE_REAL_HTTP_LOOPBACK_NODES',nodeBindings:nodes.map(node=>node.target.binding),nodeUrls:nodes.map(node=>node.url),
      initial: nodes.map(node=>node.initial),initialVectors:initial,partitionVectors:partition,convergedVectors:converged,
      finalVectors:nodes.map(node=>node.vector),packets,nodeControllerLedgers:nodes.map(node=>node.target.controllerLedger?.()??null),
      sourceOwnsMerge:true,multiHostClaimed:false,cryptographicMemberIdentityClaimed:false};
  }finally{
    for(const node of nodes){if(node.server)await new Promise(resolve=>node.server.close(resolve));await node.target.dispose();}
    const resolved=path.resolve(directory);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('rcl-counter-network-'))throw new Error('RCL_COUNTER_TEMP_SCOPE');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
