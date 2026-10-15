import fs from 'node:fs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-gpu';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-gpu',environments:['gpu'],
  source:()=>fs.readFileSync('selfhost/variants/indexed-core/compiler.rcl','utf8'),
  scope:'Complete native-core RCL compiler with generic immutable symbol indexes, scan reuse and canonical-text reuse; every original compiler language feature/validation retained. Actual supplied RBC artifacts execute on AMD FP64 OpenCL for twenty byte-identical C0-to-C20 generations, ten unchanged original sealed programs and three fresh independent opcode repairs. Original 300000000 semantic-instruction and 50000/5000 ms P95 limits retained. Generic device instruction fusion counts every original RBC operation; immutable length and ASCII Text caches preserve values. Actual GPU cancellation/timeout exits, source snapshots, backpressure, reset, fresh full generation recovery, malformed/corrupt rejection and replay. Host owns transport and hashes returned device values; no CPU compiler/execution fallback, parallel throughput, independent runtime implementation, security sandbox, whole-runtime self-hosting or whole-language release claim.'};
