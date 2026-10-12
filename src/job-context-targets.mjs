import {createPortableServerlessTarget} from './portable-serverless-target.mjs';
import {createPortableDatabaseTarget} from './portable-database-target.mjs';
import {createPortableDataflowTarget} from './portable-dataflow-target.mjs';
export async function createJobContextTarget(environment){
  if(environment==='serverless')return createPortableServerlessTarget();
  if(environment==='database')return createPortableDatabaseTarget();
  if(environment==='dataflow-runtime')return createPortableDataflowTarget();
  throw new Error('RCL_JOB_CONTEXT_UNKNOWN:'+environment);
}
