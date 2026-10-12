import fs from 'node:fs';
import {parentPort,threadId} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
const target=createPortableNativeTarget('windows'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
parentPort.postMessage({ready:true,threadId,binding:target.binding});
parentPort.on('message',message=>{
  try{
    if(sha(fs.readFileSync(message.file))!==message.inputHash)throw new Error('RCL_DATAFLOW_INPUT_BINDING');
    const result=message.operation==='compile'?target.compile(message.file,message.output):target.execute(message.file,message.sourceRoot);
    parentPort.postMessage({id:message.id,ok:true,threadId,inputHash:message.inputHash,stages:['source-binding',message.operation==='compile'?'native-compilation':'native-execution','receipt-sink'],result});
  }catch(error){parentPort.postMessage({id:message.id,ok:false,threadId,code:error.code,message:error.message});}
});
