import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPortableNativeTarget} from './portable-native-vm.mjs';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** SQLite invokes the native RCL VM as a scalar SQL function, within a checked commit/rollback boundary. */
export async function createPortableDatabaseTarget(){
  const {DatabaseSync}=await import('node:sqlite'),target=createPortableNativeTarget('windows');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-database-target-')),database=path.join(directory,'runtime.sqlite');let db,lastNativeError,sqlInvocations=0;
  function open(){
    db=new DatabaseSync(database);
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS artifacts (hash TEXT PRIMARY KEY, bytecode BLOB NOT NULL); CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, artifact_hash TEXT NOT NULL, source_root TEXT NOT NULL, state_root TEXT NOT NULL, result TEXT NOT NULL);');
    db.function('rcl_execute',(bytes,sourceRoot)=>{
      sqlInvocations++;
      const file=path.join(directory,'incoming.rbc');fs.writeFileSync(file,bytes);
      try{return JSON.stringify(target.execute(file,sourceRoot||undefined).result);}
      catch(error){lastNativeError=error;throw error;}
    });
  }
  open();const sqliteVersion=db.prepare('SELECT sqlite_version() AS version').get().version;
  function execute(file,sourceRoot){
    const started=performance.now(),bytes=fs.readFileSync(file),artifactHash=sha(bytes),runId=randomUUID(),beforeInvocations=sqlInvocations;lastNativeError=undefined;
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('INSERT OR IGNORE INTO artifacts(hash,bytecode) VALUES (?,?)').run(artifactHash,bytes);
      const row=db.prepare('SELECT rcl_execute(bytecode, ?) AS result FROM artifacts WHERE hash=?').get(sourceRoot??'',artifactHash);
      const result=verifyNativeSemanticStateRoot(JSON.parse(row.result),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(sourceRoot&&result.sourceRoot!==sourceRoot)throw new Error('RCL_DATABASE_SOURCE_ROOT_MISMATCH');
      db.prepare('INSERT INTO runs(id,artifact_hash,source_root,state_root,result) VALUES (?,?,?,?,?)').run(runId,artifactHash,result.sourceRoot,result.stateRoot,row.result);
      db.exec('COMMIT');return{result,ms:performance.now()-started,runId,sqliteVersion,committed:true,sqlFunction:'rcl_execute',sqlInvocations:sqlInvocations-beforeInvocations};
    }catch(error){db.exec('ROLLBACK');throw lastNativeError??error;}
  }
  return{environment:'database',binding:{...target.binding,context:'database',execution:'SQLite scalar-function native RCL execution with persisted result transactions',
    sqliteVersion,nodeVersion:process.version,engine:'SQLite',opaqueSqlSemanticDelegation:false},
    compile(source,output){return target.compile(source,output);},execute,
    verifyRecovery(file,sourceRoot){
      const first=execute(file,sourceRoot);db.close();open();
      const persisted=db.prepare('SELECT * FROM runs WHERE id=?').get(first.runId);
      const result=verifyNativeSemanticStateRoot(JSON.parse(persisted.result),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(persisted.artifact_hash!==sha(fs.readFileSync(file))||persisted.state_root!==result.stateRoot||persisted.source_root!==sourceRoot)throw new Error('RCL_DATABASE_RECOVERY_BINDING');
      const replay=execute(file,sourceRoot);if(replay.result.stateRoot!==result.stateRoot)throw new Error('RCL_DATABASE_REPLAY_DRIFT');
      return{status:'PASS',reopened:true,persistedRunId:first.runId,replayRunId:replay.runId,stateRoot:result.stateRoot,sourceRoot:result.sourceRoot};
    },
    verifyRollback(file,sourceRoot){
      const before=db.prepare('SELECT count(*) AS n FROM runs').get().n;let wrongRootRejected=false;
      try{execute(file,'0'.repeat(64));}catch(error){if(/SOURCE_ROOT_MISMATCH/u.test(error.message))wrongRootRejected=true;else throw error;}
      const after=db.prepare('SELECT count(*) AS n FROM runs').get().n;
      if(!wrongRootRejected||before!==after||db.isTransaction)throw new Error('RCL_DATABASE_ROLLBACK_FAILED');
      return{status:'PASS',wrongRootRejected,before,after,sourceRoot};
    },
    dispose(){db.close();target.dispose();const resolved=path.resolve(directory);
      if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('rcl-database-target-'))throw new Error('RCL_DATABASE_TEMP_PATH');
      fs.rmSync(resolved,{recursive:true,force:true});},
  };
}
