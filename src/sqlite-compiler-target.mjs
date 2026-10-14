import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {verifyNativeSemanticStateRoot} from './semantic-state-root.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const SCHEMA=`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS artifacts(hash TEXT PRIMARY KEY,bytecode BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS sources(hash TEXT PRIMARY KEY,source TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('compile','execute')),
input_hash TEXT NOT NULL REFERENCES artifacts(hash),source_hash TEXT REFERENCES sources(hash),
output_hash TEXT REFERENCES artifacts(hash),source_root TEXT,state_root TEXT,result TEXT NOT NULL);`;
const COMPILE_SQL='SELECT rcl_compile(a.bytecode,s.source) AS bytecode FROM artifacts a JOIN sources s ON s.hash=? WHERE a.hash=?';
const EXECUTE_SQL='SELECT rcl_execute(bytecode,?) AS result FROM artifacts WHERE hash=?';

/** SQLite scalar functions own actual dynamic native compilation/execution inside transactions. */
export async function createSqliteCompilerTarget(){
  if(process.platform!=='win32')throw new Error('RCLC_SQLITE_WINDOWS_REQUIRED');
  const {DatabaseSync}=await import('node:sqlite'),build=JSON.parse(fs.readFileSync(path.join(ROOT,'native/sequence-compiler/build.json'),'utf8'));
  const compiler=path.join(ROOT,build.artifact.path),vm=path.join(ROOT,'native/rclvm.exe');
  if(sha(fs.readFileSync(compiler))!==build.artifact.sha256)throw new Error('RCLC_SQLITE_COMPILER_BINDING');
  for(const f of build.sourceBindings)if(sha(fs.readFileSync(path.join(ROOT,f.path)))!==f.sha256)throw new Error('RCLC_SQLITE_SOURCE_BINDING:'+f.path);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rcl-sqlite-compiler-')),database=path.join(directory,'runtime.sqlite'),session=randomUUID();
  let db,closed=false,lastNative,lastFailure,sqlInvocations=0;
  function guard(){if(closed)throw new Error('RCLC_SQLITE_CLOSED');}
  function cleanup(){if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('rcl-sqlite-compiler-'))throw new Error('RCLC_SQLITE_CLEANUP_SCOPE');fs.rmSync(directory,{recursive:true,force:true});}
  function native(command,args,input){
    const r=spawnSync(command,args,{input,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:32*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}});
    const trace={pid:r.pid,command,args,status:r.status,signal:r.signal,stdin:input??null,stdout:r.stdout??'',stderr:r.stderr??'',exitObservedBeforeSqlReturn:true};
    trace.stdoutHash=sha(trace.stdout);trace.stderrHash=sha(trace.stderr);trace.stdinHash=input===undefined?null:sha(input);return{trace,error:r.error};
  }
  function compileSql(bytes,source){
    sqlInvocations++;lastNative=undefined;lastFailure=undefined;
    try{
      const input=Buffer.from(bytes),compilerHash=sha(input),sourceHash=sha(source),token=randomUUID(),outputName=randomUUID()+'.rbc';
      const compilerName=compilerHash+'.rbc',sourceName=sourceHash+'.rcl',frame='COMPILE\t'+compilerName+'\t'+sourceName+'\t'+outputName;
      fs.writeFileSync(path.join(directory,compilerName),input);fs.writeFileSync(path.join(directory,sourceName),source);
      const {trace,error}=native(compiler,[directory,token],frame+'\nQUIT\n');lastNative={kind:'compile',...trace,frame,compilerHash,sourceHash,token};
      if(error||trace.status!==0||trace.signal!==null)throw error??new Error('RCLC_SQLITE_COMPILER_EXIT');
      const lines=trace.stdout.trim().split(/\r?\n/u);if(lines.length!==2)throw new Error('RCLC_SQLITE_COMPILER_PROTOCOL');
      const ready=JSON.parse(lines[0]),metrics=JSON.parse(lines[1]);Object.assign(lastNative,{readyReply:lines[0],replyLine:lines[1],ready,metrics});
      if(ready.status!=='ready'||ready.protocol!=='RCL_COMPILER_ABI_FILES_V1'||ready.pid!==trace.pid||ready.token!==token||metrics.pid!==trace.pid||metrics.token!==token||metrics.request!==1)throw new Error('RCLC_SQLITE_COMPILER_REPLY_BINDING');
      if(metrics.status!=='ok'){const e=new Error(metrics.code+':'+metrics.message);e.code=metrics.code;throw e;}
      if(metrics.output!==directory+'/'+outputName||metrics.instructionBudget!==300000000||!(metrics.executedInstructions>0)||!(metrics.instance>0))throw new Error('RCLC_SQLITE_COMPILER_METRICS');
      const output=fs.readFileSync(path.join(directory,outputName));if(output.length!==metrics.bytes)throw new Error('RCLC_SQLITE_COMPILER_BYTES');lastNative.artifactHash=sha(output);return output;
    }catch(error){lastFailure=error;throw error;}
  }
  function executeSql(bytes,sourceRoot){
    sqlInvocations++;lastNative=undefined;lastFailure=undefined;
    try{
      const input=Buffer.from(bytes),artifactHash=sha(input),file=path.join(directory,artifactHash+'.rbc');fs.writeFileSync(file,input);
      const {trace,error}=native(vm,[file]);lastNative={kind:'execute',...trace,artifactHash,sourceRoot};
      if(error||trace.status!==0||trace.signal!==null)throw error??new Error(trace.stdout+'\n'+trace.stderr);
      const result=verifyNativeSemanticStateRoot(JSON.parse(trace.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
      if(result.sourceRoot!==sourceRoot)throw new Error('RCLC_SQLITE_SOURCE_ROOT_MISMATCH');return JSON.stringify(result);
    }catch(error){lastFailure=error;throw error;}
  }
  function open(){db=new DatabaseSync(database);db.exec(SCHEMA);db.function('rcl_compile',compileSql);db.function('rcl_execute',executeSql);}
  try{open();}catch(error){db?.close();cleanup();throw error;}
  const binding={owner:'RCL_SQLITE_DYNAMIC_COMPILER',environment:'database',engine:'SQLite',sqliteVersion:db.prepare('SELECT sqlite_version() AS version').get().version,
    schemaHash:sha(SCHEMA),session,database,compiler:build.artifact,compilerSourceBindings:build.sourceBindings,
    vm:{path:'native/rclvm.exe',sha256:sha(fs.readFileSync(vm)),bytes:fs.statSync(vm).size},
    hostRuntime:{path:process.execPath,sha256:sha(fs.readFileSync(process.execPath)),version:process.version},
    transport:'SQL_SCALAR_FUNCTION_NATIVE_COMPILER_AND_VM',referenceCompilationUsed:false,referenceExecutionUsed:false,opaqueSqlSemanticDelegation:false,cloudDeploymentClaimed:false,securitySandboxClaimed:false};
  function stats(){return{...db.prepare('SELECT (SELECT count(*) FROM artifacts) AS artifacts,(SELECT count(*) FROM sources) AS sources,(SELECT count(*) FROM jobs) AS jobs').get(),isTransaction:db.isTransaction};}
  function putArtifact(bytes){db.prepare('INSERT OR IGNORE INTO artifacts(hash,bytecode) VALUES (?,?)').run(sha(bytes),bytes);}
  function row(id){const r=db.prepare('SELECT * FROM jobs WHERE id=?').get(id);if(!r)return null;return JSON.parse(JSON.stringify(r));}
  function persisted(r){
    const input=db.prepare('SELECT bytecode FROM artifacts WHERE hash=?').get(r.input_hash),source=r.source_hash?db.prepare('SELECT source FROM sources WHERE hash=?').get(r.source_hash):null,output=r.output_hash?db.prepare('SELECT bytecode FROM artifacts WHERE hash=?').get(r.output_hash):null;
    return{record:r,inputHash:sha(Buffer.from(input.bytecode)),sourceHash:source?sha(source.source):null,outputHash:output?sha(Buffer.from(output.bytecode)):null,resultHash:sha(r.result)};
  }
  function transaction(kind,input,source,sourceRoot,expectedArtifactHash){
    guard();const id=randomUUID(),before=stats(),beforeInvocations=sqlInvocations,inputHash=sha(input),sourceHash=source===null?null:sha(source);lastNative=undefined;lastFailure=undefined;
    const trace={id,kind,session,begin:'BEGIN IMMEDIATE',before,sqlFunction:kind==='compile'?'rcl_compile':'rcl_execute',sql:kind==='compile'?COMPILE_SQL:EXECUTE_SQL,inputHash,sourceHash,sourceRoot:sourceRoot??null,expectedArtifactHash:expectedArtifactHash??null};
    db.exec('BEGIN IMMEDIATE');
    try{
      putArtifact(input);let output,resultText;
      if(kind==='compile'){
        db.prepare('INSERT OR IGNORE INTO sources(hash,source) VALUES (?,?)').run(sourceHash,source);
        output=Buffer.from(db.prepare(COMPILE_SQL).get(sourceHash,inputHash).bytecode);putArtifact(output);
        if(expectedArtifactHash&&sha(output)!==expectedArtifactHash)throw new Error('RCLC_SQLITE_EXPECTED_ARTIFACT_MISMATCH');
        resultText=JSON.stringify({artifactHash:sha(output),bytes:output.length});
      }else resultText=db.prepare(EXECUTE_SQL).get(sourceRoot,inputHash).result;
      const result=JSON.parse(resultText),outputHash=output?sha(output):null;
      db.prepare('INSERT INTO jobs(id,kind,input_hash,source_hash,output_hash,source_root,state_root,result) VALUES (?,?,?,?,?,?,?,?)')
        .run(id,kind,inputHash,sourceHash,outputHash,kind==='execute'?result.sourceRoot:null,kind==='execute'?result.stateRoot:null,resultText);
      const staged=row(id);trace.stagedRecord=staged;trace.nativeCapturedBeforeCommit=!!lastNative;
      db.exec('COMMIT');trace.completion='COMMIT';trace.after=stats();trace.sqlInvocations=sqlInvocations-beforeInvocations;trace.persisted=persisted(row(id));
      if(trace.sqlInvocations!==1||!trace.nativeCapturedBeforeCommit||trace.after.isTransaction)throw new Error('RCLC_SQLITE_COMMIT_BINDING');
      // Return compiler artifacts read back from SQLite, after the commit.
      if(output)output=Buffer.from(db.prepare('SELECT bytecode FROM artifacts WHERE hash=?').get(outputHash).bytecode);
      return{bytecode:output,result:kind==='execute'?result:undefined,nativeTrace:structuredClone(lastNative),transaction:trace};
    }catch(error){
      if(trace.completion==='COMMIT'){error.nativeTrace=lastNative?structuredClone(lastNative):null;error.transaction=trace;throw error;}
      if(db.isTransaction)db.exec('ROLLBACK');trace.completion='ROLLBACK';trace.after=stats();trace.sqlInvocations=sqlInvocations-beforeInvocations;trace.persisted=row(id);
      const failure=lastFailure??error;failure.nativeTrace=lastNative?structuredClone(lastNative):null;failure.transaction=trace;throw failure;
    }
  }
  return{environment:'database',binding,
    compile(compilerFile,sourceFile,outputFile,options={}){
      const started=performance.now();if(options.expectedArtifactHash&&!/^[0-9a-f]{64}$/u.test(options.expectedArtifactHash))throw new Error('RCLC_SQLITE_EXPECTED_HASH_FORMAT');
      const result=transaction('compile',fs.readFileSync(compilerFile),fs.readFileSync(sourceFile,'utf8'),null,options.expectedArtifactHash);
      if(outputFile)fs.writeFileSync(outputFile,result.bytecode);return{...result,ms:performance.now()-started};
    },
    execute(file,sourceRoot){const started=performance.now();return{...transaction('execute',fs.readFileSync(file),null,sourceRoot),ms:performance.now()-started};},
    inspectJob(id){guard();const r=row(id);return r?persisted(r):null;},
    inspectCounts(){guard();return stats();},
    reopen(){guard();if(db.isTransaction)throw new Error('RCLC_SQLITE_REOPEN_TRANSACTION');const before=stats();db.close();open();const after=stats();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('RCLC_SQLITE_REOPEN_DRIFT');return{before,after,reopened:true,sqliteVersion:binding.sqliteVersion};},
    dispose(){if(closed)return;closed=true;try{db.close();}finally{cleanup();}},
  };
}
