import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadyHttpTarget} from '../src/ready-http-target.mjs';
test('twenty complete startup publications expose valid health and deny unauthorized requests',()=>{
  const pids=new Set();
  for(let i=0;i<20;i++){const target=createReadyHttpTarget();try{const health=target.inspectHealth();assert.equal(health.pid,target.binding.workerPid);assert.ok(!pids.has(health.pid));pids.add(health.pid);assert.equal(target.assertUnauthorizedRejected(),true);}finally{target.dispose();}}
  assert.equal(pids.size,20);
});
