import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-replica';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-replica',environments:['distributed-runtime'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete native-core RCL compiler in two actual local authenticated HTTP/native peers. Both peers consume the supplied preceding compiler artifacts for twenty byte-identical C0-to-C20 generations and agree on ten sealed native program results. Three unchanged fresh independent repairs, malformed/corrupt rejection, fail-closed two-peer publication after an observed clean peer termination, actual replacement peer and healthy full generation recovery, identical replay and clean server/compiler/program exits. Same implementation on distinct local processes; no multi-host network, independent implementation, Byzantine consensus, JS compiler/execution fallback, security sandbox or whole-language release claim.'};
