import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-android';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-android',environments:['android'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete RCL-authored native-core general compiler executing on actual Android API35 x86_64 native Linux ABI processes in a dedicated read-only emulator; twenty C0-to-C20 byte-identical self-compilation generations, ten sealed native source programs and three unchanged fresh independent compiler repairs. Uses the pinned separate generic persistent Sequence runtime and UTF-16 source-column variant; no host compilation/execution fallback, physical-device or UI/pixel/whole-runtime self-hosting/whole-language release claim.'};
