import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-http';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-http',environments:['server'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete native-core RCL compiler behind a separate authenticated loopback HTTP worker. Twenty byte-identical C0-to-C20 generations supply the preceding compiler artifact and reuse one actual resident native compiler C ABI instance; ten sealed programs execute in actual native VM processes. Three unchanged fresh independent compiler repairs, rejected unauthorized requests, malformed/corrupt recovery, fresh native program processes and clean worker/compiler exits; no JS compiler/execution fallback, public hosting, distributed runtime, security sandbox or whole-language release claim.'};
