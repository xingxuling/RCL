import {createPortableHttpTarget} from './portable-http-target.mjs';
import {createPortableEmbeddedTarget} from './portable-embedded-target.mjs';
import {createPortableReplicaTarget} from './portable-replica-target.mjs';
export function createExecutionContextTarget(environment){
  if(environment==='server')return createPortableHttpTarget();
  if(environment==='embedded-runtime')return createPortableEmbeddedTarget();
  if(environment==='distributed-runtime')return createPortableReplicaTarget();
  throw new Error('RCL_EXECUTION_CONTEXT_UNKNOWN:'+environment);
}
