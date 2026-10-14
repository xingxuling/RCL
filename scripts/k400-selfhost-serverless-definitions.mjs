import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-serverless';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-serverless',environments:['serverless'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete native-core RCL compiler in fresh local authenticated HTTP handlers. Each compile or execute creates its own separate worker and native compiler and returns only after observed clean worker/compiler exits. Twenty byte-identical C0-to-C20 generations supply the preceding compiler artifact; ten sealed programs run in actual native VM processes. Three unchanged fresh independent repairs, unauthorized denial, malformed/corrupt rejection and fresh handler recovery. No warm reuse, JS compiler/execution fallback, cloud FaaS deployment, security sandbox or whole-language release claim.'};
