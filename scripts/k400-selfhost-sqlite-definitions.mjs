import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {SELFHOST_PROFILE as BASE,SELFHOST_CASES} from './k400-selfhost-definitions.mjs';
export {SELFHOST_CASES};
export const SQLITE_ROLLBACK_SOURCE='reality SqliteRollbackProbe { facet fresh : Number = 47 }';
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-sqlite';
export const SELFHOST_PROFILE={...BASE,id:'general-compiler-sqlite',environments:['database'],source:()=>fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8'),scope:'Complete native-core RCL compiler invoked by actual SQLite scalar functions inside BEGIN IMMEDIATE transactions. Twenty byte-identical C0-to-C20 generations consume stored preceding compiler BLOBs and commit compiler artifacts/jobs; ten sealed programs run in SQL-invoked native VM processes. Three unchanged fresh independent repairs, actual native malformed/corrupt rejection, post-compilation and source-root rollback, durable full-generation job/artifact parity after database reopen, healthy full compilation recovery and clean native exits. No JS compiler/execution fallback, SQL delegation of RCL semantics, remote database, security sandbox or whole-language release claim.'};
