import {createPortableServerlessTarget} from './portable-serverless-target.mjs';
import {createPortableDatabaseTarget} from './portable-database-target.mjs';
import {createPortableDataflowTarget} from './portable-dataflow-target.mjs';
let hostRuntime;
export async function createJobContextTarget(environment){
  const create=environment==='serverless'?createPortableServerlessTarget:environment==='database'?createPortableDatabaseTarget:
    environment==='dataflow-runtime'?createPortableDataflowTarget:undefined;
  if(!create)throw new Error('RCL_JOB_CONTEXT_UNKNOWN:'+environment);
  hostRuntime??={nodeVersion:process.version,binaryPath:process.execPath,sha256:createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')};
  const target=await create();target.binding.hostRuntime={...hostRuntime};return target;
}
import fs from 'node:fs';
import {createHash} from 'node:crypto';
