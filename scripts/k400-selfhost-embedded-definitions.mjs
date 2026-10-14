import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-embedded';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-embedded',environments:['embedded-runtime'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete RCL-authored native-core compiler in a caller-owned resident native C ABI instance. Twenty byte-identical C0-to-C20 self-compilation generations reuse one live compiler instance; ten sealed programs run through actual caller-owned native C ABI VM instances, and three unchanged fresh independent repairs are replayed. Explicit rejection, reset, recovery and clean native exit checks; no JS compiler/execution fallback, microcontroller, hardware embedding or whole-language release claim.'};
