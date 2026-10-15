import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createGpuCompilerTarget} from '../src/gpu-compiler-target.mjs';
import {compileRealityToBytecode,decodeBytecode} from '../src/bytecode.mjs';
import {verifyNativeSemanticStateRoot} from '../src/semantic-state-root.mjs';

test('actual resumable GPU compiler owns emission, values, transactions, rejection and fresh recovery',async()=>{
  const directory=fs.mkdtempSync(path.resolve('output/gpu-compiler-api-'));let target;
  const sourceFile=path.join(directory,'source.rcl'),artifactFile=path.join(directory,'result.rbc'),seed=path.resolve('selfhost/variants/utf16-columns/compiler.rbc');
  const checks=[];
  async function run(source,id){
    fs.writeFileSync(sourceFile,source);const oracleBytes=compileRealityToBytecode(source),decoded=decodeBytecode(oracleBytes);
    const compiled=await target.compile(seed,sourceFile,artifactFile);assert.deepEqual(compiled.bytecode,oracleBytes);
    assert.equal(compiled.compilerTrace.compilationOwner,'RCL_COMPILER_RBC_GPU');assert.equal(compiled.compilerTrace.cpuExecutionFallback,false);
    assert.equal(compiled.compilerTrace.providerCalls,1);assert.ok(compiled.compilerTrace.openclCalls.clEnqueueNDRangeKernel>=compiled.compilerTrace.batchCount);
    const executed=await target.execute(artifactFile,decoded.sourceRoot);
    const native=spawnSync(path.resolve('native/rclvm.exe'),[artifactFile],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,RCL_SEMANTIC_STATE_ROOT_ALGORITHM:'rcl.semantic-state-root.v2'}});
    assert.equal(native.status,0,native.stderr);const expected=verifyNativeSemanticStateRoot(JSON.parse(native.stdout),{requireNativeRoot:true,expectedAlgorithm:'rcl.semantic-state-root.v2'});
    assert.deepEqual(executed.result.state,expected.state);assert.equal(executed.result.stateRoot,expected.stateRoot);
    assert.deepEqual(executed.result.history,expected.history);assert.deepEqual(executed.result.projections,expected.projections);
    checks.push({id,compiledMs:compiled.ms,executedMs:executed.ms,steps:compiled.compilerTrace.executedInstructions,stateRoot:executed.result.stateRoot});
    return{compiled,executed,decoded};
  }
  try{
    target=await createGpuCompilerTarget({pythonPath:process.env.RCL_GPU_PYTHON??'C:/Users/User/AppData/Local/Programs/Python/Python311/python.exe'});
    await run('reality Unicode { facet full : Text = "中😀文𐐀" facet n : Number = length(full) facet one : Text = char_at(full, 1) facet view : Text = slice_text(full, 1, 2) facet count : Number = length(view) facet nested : Text = char_at(view, 1) facet tail : Text = split_after(full, "😀") facet missing : Text = char_at(full, -1) }','utf8-views');
    await run('reality TemporaryViews { facet clipped : Text = char_at(split_after("前::中😀文", "::"), 1) facet later : Text = char_at(clipped, 0) facet large : Text = sha256_text("缓存生命周期") facet final : Number = length(clipped) }','temporary-cache-owner');
    await run('reality TextRope { reckon repeat(part : Text, n : Number, output : Text) -> Text = choose(n == 0, output, repeat(part, n - 1, output + part)) facet original : Text = repeat("中😀", 500, "") facet joined : Text = original + "尾" facet size : Number = length(joined) facet end : Truth = ends_with(joined, original + "尾") facet hash : Text = sha256_text(joined) facet bytes : Sequence = utf8_bytes(joined) facet nested : Text = char_at(slice_text(joined, 998, 3), 1) }','immutable-text-rope');
    await run('reality Bytes { facet u8 : Sequence = bytes_u8(255) facet u16 : Sequence = bytes_u16le(65535) facet u32 : Sequence = bytes_u32le(4294967295) facet i32 : Sequence = bytes_i32le(-2147483648) facet f64 : Sequence = bytes_f64le(1.5) facet utf : Sequence = utf8_bytes("中😀") facet hex : Sequence = hex_bytes("00ff7F") facet empty : Text = sha256_text("") facet short : Text = sha256_text("abc") facet multi : Text = sha256_text("'+ 'abcd'.repeat(40)+'") }','device-bytes-sha256');
    await run('reality Decimals { facet a : Number = number_from_text(" -1.25e+2 ") facet b : Number = number_from_text("+0.1") facet c : Number = number_from_text("9007199254740991") facet d : Number = number_from_text("") facet e : Number = number_from_text("1e-300") }','device-decimal');
    const decimalRejections=[];
    for(const text of ['.','-','+','-.','1e','1e+','1e-','1e-999','1e-308']){
      const bytes=compileRealityToBytecode('reality InvalidDecimal { facet result : Number = number_from_text(split_after('+JSON.stringify('value::'+text)+', "::")) }'),file=path.join(directory,'invalid-decimal.rbc');fs.writeFileSync(file,bytes);
      const native=spawnSync(path.resolve('native/rclvm.exe'),[file],{encoding:'utf8',windowsHide:true});assert.notEqual(native.status,0);assert.match(native.stderr,/RCL_TEXT_NUMBER_INVALID/);
      await assert.rejects(()=>target.execute(file,decodeBytecode(bytes).sourceRoot),caught=>caught.code==='RCL_NUMBER_FROM_TEXT');decimalRejections.push(text);
    }
    await run(fs.readFileSync('examples/sequence-runtime/transactions.rcl','utf8'),'sequence-transaction');
    await run('reality Equality { reckon fill(n : Number, out : Sequence) -> Sequence = choose(n == 0, out, fill(n - 1, sequence_append(out, n))) facet left : Sequence = fill(200, empty_sequence()) facet right : Sequence = fill(200, empty_sequence()) facet same : Truth = left == right facet different : Truth = sequence_append(left, 1) == sequence_append(right, 2) facet nested : Truth = sequence_append(empty_sequence(), left) == sequence_append(empty_sequence(), right) }','deep-device-equality');
    await run('reality LengthCache { reckon text_count(s : Text) -> Number = length(s) + length(s) reckon seq_count(s : Sequence) -> Number = length(s) + length(s) facet original : Sequence = sequence_append(empty_sequence(), "中😀") facet alias : Sequence = original facet cached : Number = seq_count(original) facet text : Number = text_count("中😀文") facet temporary : Number = seq_count(sequence_concat(original, original)) facet grown : Sequence = sequence_append(alias, "尾") facet grownLength : Number = length(grown) facet oldLength : Number = length(original) facet temporaryText : Number = text_count("中" + "😀") }','retained-length-cache');
    await run('reality SequenceHead { reckon fill(n : Number, out : Sequence) -> Sequence = choose(n == 0, out, fill(n - 1, sequence_append(out, n))) reckon head(items : Sequence) -> Number = sequence_get(items, 0) facet original : Sequence = fill(140, empty_sequence()) facet first : Number = head(original) facet joined : Sequence = sequence_concat(original, sequence_append(empty_sequence(), 9)) facet joinedFirst : Number = head(joined) facet last : Number = sequence_get(joined, 140) facet bytes : Sequence = sequence_append(bytes_u8(0), 255) facet byteFirst : Number = head(bytes) facet temporary : Number = head(sequence_append(empty_sequence(), 17)) facet originalLength : Number = length(original) }','borrowed-sequence-head');
    for(const [id,source,code] of [
      ['text-bound','reality TextBound { reckon grow(s : Text, n : Number) -> Text = choose(n == 0, s, grow(s + s, n - 1)) facet result : Text = grow("x", 27) }','RCL_GPU_TEXT_LIMIT'],
      ['sequence-bound','reality SequenceBound { reckon grow(s : Sequence, n : Number) -> Sequence = choose(n == 0, s, grow(sequence_concat(s, s), n - 1)) facet result : Sequence = grow(sequence_append(empty_sequence(), 1), 22) }','RCL_GPU_VALUE_LIMIT'],
    ]){const bytes=compileRealityToBytecode(source),file=path.join(directory,id+'.rbc');fs.writeFileSync(file,bytes);await assert.rejects(()=>target.execute(file,decodeBytecode(bytes).sourceRoot),caught=>caught.code===code);}
    const healthy=await run('reality Tail { reckon sum(n : Number, total : Number) -> Number = choose(n <= 0, total, sum(n - 1, total + n)) facet result : Number = sum(3000, 0) }','resumable-tail');
    const previous=fs.readFileSync(artifactFile);fs.writeFileSync(sourceFile,'realty Broken { facet result : Number = 1 }');
    await assert.rejects(()=>target.compile(seed,sourceFile,artifactFile),caught=>caught.code==='RCL_REALITY_HEADER_REQUIRED'&&/reality at/.test(caught.message));assert.deepEqual(fs.readFileSync(artifactFile),previous);
    await assert.rejects(()=>target.execute(artifactFile,'0'.repeat(64)),caught=>caught.code==='RCL_GPU_SOURCE_ROOT_MISMATCH');
    const corrupt=path.join(directory,'corrupt.rbc');fs.writeFileSync(corrupt,'RCLB');assert.throws(()=>target.compile(corrupt,sourceFile,artifactFile),caught=>caught.code==='RCL_GPU_BYTECODE_INVALID');assert.deepEqual(fs.readFileSync(artifactFile),previous);
    fs.writeFileSync(sourceFile,'reality Snapshot { facet result : Number = 42 }');const captured=target.compile(seed,sourceFile,artifactFile);fs.writeFileSync(sourceFile,'realty overwritten');
    assert.throws(()=>target.execute(artifactFile,healthy.decoded.sourceRoot),caught=>caught.code==='RCL_GPU_BACKPRESSURE');
    assert.equal((await captured).compilerTrace.providerCalls,1);const snapshot=decodeBytecode(fs.readFileSync(artifactFile));assert.equal((await target.execute(artifactFile,snapshot.sourceRoot)).result.state.result,42);
    const reset=await target.reset();assert.equal(reset.exit.code,0);assert.notEqual(reset.before.contextToken,reset.after.contextToken);
    assert.equal((await target.execute(artifactFile,snapshot.sourceRoot)).gpuTrace.instance,1);
    const controller=new AbortController();fs.writeFileSync(sourceFile,fs.readFileSync('selfhost/variants/utf16-columns/compiler.rcl'));
    const cancel=target.compile(seed,sourceFile,artifactFile,{signal:controller.signal});setTimeout(()=>controller.abort(),50);let cancellation;
    await assert.rejects(()=>cancel,caught=>{cancellation={code:caught.code,exit:caught.gpuProcessExit};return caught.code==='RCL_GPU_CANCELLED'&&caught.gpuProcessExit.exitObserved===true;});
    assert.equal((await target.execute(artifactFile,snapshot.sourceRoot)).result.state.result,42);
    const shutdown=await target.dispose();
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({status:'PASS_FOCUSED_API_ONLY_NO_K400_CREDIT',binding:target.binding,checks,decimalRejections,reset,cancellation,shutdown},null,2)+'\n');
  }finally{await target?.dispose();}
});
