import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function verifyAndroidTransport(report,contract){
  const binding=report.binding;assert.equal(binding.environment,'android');assert.equal(binding.compilerLocation,'ANDROID_TARGET_NATIVE_C_ABI_RCL_COMPILER_RBC');assert.equal(binding.hostCompilationFallback,false);assert.equal(binding.physicalDeviceClaimed,false);assert.equal(binding.mobileUiClaimed,false);assert.deepEqual(binding.device,contract.devicePolicy);
  assert.equal(binding.device.serial,contract.deviceSerial);assert.equal(binding.adb.sha256,sha(fs.readFileSync(binding.adb.path)));assert.equal(binding.remoteRoot,'/data/local/tmp/rcl-selfhost-'+binding.session);
  const commands=report.adbCommands;assert.ok(Array.isArray(commands)&&commands.length>10);
  for(const [index,command] of commands.entries()){
    assert.equal(command.index,index);assert.equal(command.command,binding.adb.path);assert.deepEqual(command.args.slice(0,2),['-s',contract.deviceSerial]);assert.ok(Number.isInteger(command.pid)&&command.pid>0);assert.equal(command.stdoutHash,sha(command.stdout));assert.equal(command.stderrHash,sha(command.stderr));assert.ok(command.ended>=command.started);assert.equal(command.signal,null);assert.ok(Number.isInteger(command.status));
  }
  function checkedTransfer(localHash,remotePath,range){
    const transferred=range.find(c=>c.args[2]==='push'&&c.args[4]===remotePath);assert.ok(transferred,'Actual Android input transfer required');assert.equal(transferred.status,0);
    const check=range.find(c=>JSON.stringify(c.args.slice(2))===JSON.stringify(['shell','sha256sum',remotePath]));assert.ok(check);assert.equal(check.status,0);assert.equal(check.stdout.slice(0,64),localHash);
  }
  for(const runtime of [['rclvm',binding.runtime.vm],['rclc',binding.runtime.compiler]])checkedTransfer(runtime[1].sha256,binding.remoteRoot+'/'+runtime[0],commands.slice(0,report.ledger[0].adbRange.start));
  let previousEnd=report.ledger[0].adbRange.start;
  for(const trace of report.ledger){
    assert.equal(trace.adbRange.start,previousEnd);assert.ok(trace.adbRange.end>trace.adbRange.start);previousEnd=trace.adbRange.end;
    const range=commands.slice(trace.adbRange.start,trace.adbRange.end),invocation=commands[trace.invocationIndex];assert.ok(range.includes(invocation));assert.equal(trace.command,binding.adb.path);assert.deepEqual(trace.args,invocation.args);assert.equal(trace.hostProcessPid,invocation.pid);assert.equal(trace.status,invocation.status);assert.equal(trace.stdout,invocation.stdout);assert.equal(trace.stderr,invocation.stderr);assert.equal(trace.exitObserved,true);assert.equal(trace.signal,null);assert.equal(trace.pid,Number(/^RCL_TARGET_PID:([0-9]+)\r?$/mu.exec(invocation.stderr)?.[1]));assert.ok(Number.isInteger(trace.pid)&&trace.pid>0);
    const prefix='printf \'RCL_TARGET_PID:%s\\n\' "$$" >&2; exec env RCL_SEMANTIC_STATE_ROOT_ALGORITHM=rcl.semantic-state-root.v2 RCLC_OUTPUT_STATE=compiler.output ';
    let expected;
    if(trace.kind==='compile'){
      const input=binding.remoteRoot+'/'+trace.inputCompilerHash+'.rbc',source=binding.remoteRoot+'/'+trace.sourceHash+'.rcl',output=binding.remoteRoot+'/'+trace.nonce+'.rbc';checkedTransfer(trace.inputCompilerHash,input,range);checkedTransfer(trace.sourceHash,source,range);expected=prefix+binding.remoteRoot+'/rclc '+input+' '+source+' '+output;
      if(!trace.error){assert.equal(trace.metrics.output,output);assert.equal(trace.remoteOutputHash,trace.outputHash);assert.ok(range.some(c=>c.status===0&&c.args[2]==='pull'&&c.args[3]===output));const check=range.find(c=>JSON.stringify(c.args.slice(2))===JSON.stringify(['shell','sha256sum',output]));assert.equal(check.stdout.slice(0,64),trace.outputHash);}
    }else{const input=binding.remoteRoot+'/'+trace.artifactHash+'.rbc';checkedTransfer(trace.artifactHash,input,range);expected=prefix+binding.remoteRoot+'/rclvm '+input;}
    assert.deepEqual(invocation.args,['-s',contract.deviceSerial,'shell',expected]);assert.equal(invocation.status,trace.error?1:0);
  }
  assert.equal(previousEnd,commands.length);return true;
}
