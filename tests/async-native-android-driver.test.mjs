import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runAndroidCommand} from '../src/ui/async-native-android-driver.mjs';

test('waiting for a device child command keeps the in-process RCL bridge responsive',async()=>{
  const server=createServer((request,response)=>response.end('live'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let childSettled=false;
  try{
    const command=runAndroidCommand(process.execPath,['-e','setTimeout(()=>process.stdout.write("device-result"),500)']).finally(()=>{childSettled=true;});
    const reply=await fetch('http://127.0.0.1:'+server.address().port);
    assert.equal(await reply.text(),'live');assert.equal(childSettled,false,'The bridge must answer before the delayed child exits');
    const result=await command;assert.equal(result.status,0);assert.equal(result.stdout,'device-result');
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('device transport retains binary bytes and rejects actual command failures',async()=>{
  const result=await runAndroidCommand(process.execPath,['-e','process.stdout.write(Buffer.from([0,255,10,128]))'],{binary:true});
  assert.deepEqual(result.stdout,Buffer.from([0,255,10,128]));
  await assert.rejects(()=>runAndroidCommand(process.execPath,['-e','process.stderr.write("device-failed");process.exit(7)']),error=>error.commandResult.status===7&&error.commandResult.stderr==='device-failed');
});
