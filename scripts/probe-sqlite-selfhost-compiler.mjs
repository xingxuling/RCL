import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSqliteCompilerTarget} from '../src/sqlite-compiler-target.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),directory='output/sqlite-selfhost-probe';fs.mkdirSync(directory,{recursive:true});
const target=await createSqliteCompilerTarget();
try{
  const compiler=path.resolve('selfhost/variants/utf16-columns/compiler.rbc'),source=path.resolve('selfhost/variants/utf16-columns/compiler.rcl'),result=target.compile(compiler,source);
  assert.deepEqual(result.bytecode,fs.readFileSync(compiler));const before=target.inspectJob(result.transaction.id),reopen=target.reopen(),after=target.inspectJob(result.transaction.id);assert.deepEqual(before,after);
  const report={status:'PASS_SQLITE_FULL_COMPILER_DIAGNOSTIC_NOT_K400',runtime:{environment:'database',compiler:target.binding.compiler,vm:target.binding.vm},binding:target.binding,
    generation:{outputHash:sha(result.bytecode),bytes:result.bytecode.length,nativeTrace:result.nativeTrace,transaction:result.transaction},reopen,persisted:{before,after}};
  fs.writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,artifactHash:report.generation.outputHash,ms:result.ms,sqlite:target.binding.sqliteVersion}));
}finally{target.dispose();}
