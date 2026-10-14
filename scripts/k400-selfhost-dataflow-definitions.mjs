import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-dataflow';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-dataflow',environments:['dataflow-runtime'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete native-core RCL compiler in an actual two-worker-thread compiler-to-VM dataflow graph. Twenty byte-identical C0-to-C20 generations supply preceding compiler artifacts inside the compiler-stage resident native C ABI; ten sealed programs and broken repair probes transfer actual generated artifacts directly into a distinct VM-stage native process. Three unchanged fresh independent repairs, input binding rejection before native invocation, bounded flow backpressure, malformed/corrupt recovery and clean stage/compiler/program exits. No JS compiler/execution fallback, external stream, multi-host runtime, security sandbox or whole-language release claim.'};
