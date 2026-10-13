import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadyServerlessTarget} from '../src/ready-serverless-target.mjs';
import {compileReality} from '../src/compiler.mjs';

test('cold handlers use complete readiness publications and terminate after real native RCL requests',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-ready-serverless-test-'));
  const target=createReadyServerlessTarget();
  try{
    const source='reality ColdHandler { facet result : Number = 9 + 2 }',input=path.join(directory,'input.rcl'),output=path.join(directory,'input.rbc');fs.writeFileSync(input,source);
    const compiled=target.compile(input,output),executed=target.execute(output,compileReality(source).programRoot);
    assert.equal(executed.result.state.result,11);assert.notEqual(compiled.handlerPid,executed.handlerPid);
    assert.equal(compiled.processExited,true);assert.equal(executed.processExited,true);assert.equal(compiled.terminationObserved,true);assert.equal(executed.terminationObserved,true);
    assert.equal(target.binding.hostRuntime.binaryPath,process.execPath);
    const control=target.verifyColdStart(output,compileReality(source).programRoot);assert.equal(control.freshHandlers,true);assert.equal(control.terminationObserved,true);assert.equal(control.processExited,true);
  }finally{
    target.dispose();const absolute=path.resolve(directory);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('rcl-ready-serverless-test-'));fs.rmSync(absolute,{recursive:true,force:true});
  }
});
