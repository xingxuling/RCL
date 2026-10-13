// ADAPT of src/portable-replica-target.mjs at SHA256 ea722580756f8eacb6073dee7b1bc0d455c98de7a2ae422010b3ecf1cd9ff2b3; atomic readiness publication.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createReadyHttpTarget as createPortableHttpTarget} from './ready-http-target.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Two actual local worker processes and HTTP transports; no multi-host claim. */
export function createReadyReplicaTarget(){
  const peers=[createPortableHttpTarget(),createPortableHttpTarget()];
  if(peers[0].binding.workerPid===peers[1].binding.workerPid)throw new Error('RCL_REPLICA_WORKERS_NOT_DISTINCT');
  const initialPids=peers.map(peer=>peer.binding.workerPid);let executions=0;
  return{environment:'distributed-runtime',binding:{...peers[0].binding,context:'distributed-runtime',execution:'Two independent native RCL workers with checked HTTP result quorum',
      transport:'TWO_HTTP_LOOPBACK_WORKERS',workerPids:initialPids,multiHostClaimed:false},
    compile(source,output){const started=performance.now(),left=peers[0].compile(source,output),right=peers[1].compile(source,output);
      if(!left.bytecode.equals(right.bytecode))throw new Error('RCL_REPLICA_COMPILER_DISAGREEMENT');fs.writeFileSync(output,left.bytecode);
      return{bytecode:left.bytecode,ms:performance.now()-started};},
    execute(file,sourceRoot){const started=performance.now(),results=peers.map(peer=>peer.execute(file,sourceRoot));
      if(results[0].result.stateRoot!==results[1].result.stateRoot||results[0].result.sourceRoot!==results[1].result.sourceRoot
        ||JSON.stringify(results[0].result.history)!==JSON.stringify(results[1].result.history)
        ||JSON.stringify(results[0].result.projections)!==JSON.stringify(results[1].result.projections))throw new Error('RCL_REPLICA_EXECUTION_DISAGREEMENT');
      executions++;return{result:results[0].result,ms:performance.now()-started,replicaPids:peers.map(peer=>peer.binding.workerPid),replicaExecutions:2};},
    verifyPeerRecovery(file,sourceRoot){const lost=peers[1].binding.workerPid;peers[1].dispose();let terminalObserved=false;
      try{peers[1].inspectHealth();}catch(error){terminalObserved=/PROTOCOL|fetch|connect|ECONN/u.test(error.message);}
      if(!terminalObserved)throw new Error('RCL_REPLICA_PEER_TERMINATION_NOT_OBSERVED');
      peers[1]=createPortableHttpTarget();if(peers[1].binding.workerPid===lost)throw new Error('RCL_REPLICA_NEW_PEER_ID_REQUIRED');
      const replay=this.execute(file,sourceRoot);return{status:'PASS',terminalObserved,lostPid:lost,newPid:peers[1].binding.workerPid,
        artifactHash:sha(fs.readFileSync(file)),stateRoot:replay.result.stateRoot,sourceRoot:replay.result.sourceRoot,replicaPids:replay.replicaPids};},
    inspectReplicas(){return{pids:peers.map(peer=>peer.binding.workerPid),executions,health:peers.map(peer=>peer.inspectHealth().ok)};},
    dispose(){for(const peer of peers)peer.dispose();},
  };
}
