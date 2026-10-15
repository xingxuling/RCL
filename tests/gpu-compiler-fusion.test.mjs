import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuCompilerTarget} from '../src/gpu-compiler-target.mjs';
import {compileRealityToBytecode,decodeBytecode} from '../src/bytecode.mjs';
import {runNativeBytecode} from '../src/native-vm.mjs';

test('device fusion preserves original instructions across small quanta, control flow and shared values',async()=>{
  const directory=fs.mkdtempSync(path.resolve('output/gpu-fusion-boundaries-'));
  const cases=[
    ['numbers','reality Numbers { reckon calculate(a : Number, b : Number) -> Number = choose(a <= b, a + b, a - b) facet first : Number = calculate(9, 2) facet second : Number = calculate(2, 9) facet modulo : Number = 29 % 6 facet compare : Truth = 1 >= 1 }'],
    ['shared','reality Shared { reckon same(a : Sequence, b : Sequence) -> Truth = a == b reckon label(a : Text, b : Text) -> Text = a + b facet original : Sequence = sequence_append(empty_sequence(), 7) facet alias : Sequence = original facet equal : Truth = same(original, alias) facet text : Text = label("编号：", "十九") facet originalValue : Number = sequence_get(original, 0) }'],
    ['borrowed-builtins','reality Borrowed { reckon size(a : Sequence) -> Number = length(a) + length(a) reckon grow(a : Sequence, b : Number) -> Sequence = sequence_append(a, b) reckon first(a : Sequence) -> Number = sequence_get(a, 0) reckon join(a : Sequence, b : Sequence) -> Sequence = sequence_concat(a, b) reckon initial(a : Text) -> Text = char_at(a, 0) facet original : Sequence = sequence_append(empty_sequence(), 7) facet grown : Sequence = grow(original, 9) facet combined : Sequence = join(original, grown) facet originalSize : Number = size(original) facet grownSize : Number = size(grown) facet firstValue : Number = first(combined) facet letter : Text = initial("编译") facet ascii : Text = initial("compiler") }'],
    ['short-circuit','reality ShortCircuit { facet yes : Truth = true or (1 / 0 == 0) facet no : Truth = false and (1 / 0 == 0) facet boundary : Number = choose(1 <= 1, 20 + 22, 1 / 0) }'],
  ].map(([id,source])=>{const bytes=compileRealityToBytecode(source),file=path.join(directory,id+'.rbc');fs.writeFileSync(file,bytes);return{id,file,bytes,root:decodeBytecode(bytes).sourceRoot,expected:runNativeBytecode(bytes)};});
  // Raw-RBC control only: enter the second load of a possible triple.
  // This does not assert that the modified bytecode was compiled from source.
  const seed=compileRealityToBytecode('reality MiddleEntry { facet result : Number = 7 + 9 }'),decoded=decodeBytecode(seed),original=decoded.instructions;
  const ir=[original[0],{op:20,flags:0,a:3,b:0,c:0},original[0],original[1],original[2],original[3],original[4]];
  const prefix=Buffer.from(seed.subarray(0,seed.length-original.length*16));prefix.writeUInt32LE(ir.length,28);
  const body=Buffer.alloc(ir.length*16);ir.forEach((v,i)=>{const at=i*16;body.writeUInt8(v.op,at);body.writeUInt8(v.flags,at+1);body.writeInt32LE(v.a,at+4);body.writeInt32LE(v.b,at+8);body.writeInt32LE(v.c,at+12);});
  const raw=Buffer.concat([prefix,body]),rawFile=path.join(directory,'middle-entry.rbc');fs.writeFileSync(rawFile,raw);
  cases.push({id:'raw-middle-entry',file:rawFile,bytes:raw,root:decoded.sourceRoot,expected:runNativeBytecode(raw)});
  // A continuation longer than the initialization hint must use the complete
  // original tail-position scan, preserving execution across every quantum.
  const tailSeed=compileRealityToBytecode('reality LongContinuation { reckon inner(n : Number) -> Number = n + 1 reckon outer(n : Number) -> Number = inner(n) facet result : Number = outer(3) }'),tailDecoded=decodeBytecode(tailSeed);
  const insert=tailDecoded.instructions.findLastIndex(v=>v.op===33)+1;
  assert.equal(tailDecoded.instructions[insert].op,34);
  const tailIr=tailDecoded.instructions.map(v=>({...v,a:[20,21,33].includes(v.op)&&v.a>=insert?v.a+10:v.a}));
  tailIr.splice(insert,0,...Array.from({length:10},()=>({op:0,flags:0,a:0,b:0,c:0})));
  const tailPrefix=Buffer.from(tailSeed.subarray(0,tailSeed.length-tailDecoded.instructions.length*16)),tailBody=Buffer.alloc(tailIr.length*16);tailPrefix.writeUInt32LE(tailIr.length,28);
  tailIr.forEach((v,i)=>{const at=i*16;tailBody.writeUInt8(v.op,at);tailBody.writeUInt8(v.flags,at+1);tailBody.writeInt32LE(v.a,at+4);tailBody.writeInt32LE(v.b,at+8);tailBody.writeInt32LE(v.c,at+12);});
  const tailRaw=Buffer.concat([tailPrefix,tailBody]),tailFile=path.join(directory,'long-continuation.rbc');fs.writeFileSync(tailFile,tailRaw);
  cases.push({id:'raw-long-continuation',file:tailFile,bytes:tailRaw,root:tailDecoded.sourceRoot,expected:runNativeBytecode(tailRaw)});
  const receipts=[];
  for(const quantum of [1,2,3,4,5,200000]){
    const target=await createGpuCompilerTarget({pythonPath:process.env.RCL_GPU_PYTHON??'C:/Users/User/AppData/Local/Programs/Python/Python311/python.exe',quantum});
    try{
      for(const c of cases){const observed=await target.execute(c.file,c.root);assert.deepEqual(observed.result.state,c.expected.state);assert.equal(observed.result.stateRoot,c.expected.stateRoot);
        assert.equal(observed.gpuTrace.deviceOpcodeCounts.reduce((a,b)=>a+b,0),observed.gpuTrace.executedInstructions);
        assert.equal(observed.gpuTrace.batchCount,Math.ceil(observed.gpuTrace.executedInstructions/quantum));
        receipts.push({id:c.id,quantum,steps:observed.gpuTrace.executedInstructions,counts:observed.gpuTrace.deviceOpcodeCounts,stateRoot:observed.result.stateRoot,batches:observed.gpuTrace.batchCount,pairs:observed.gpuTrace.fusedPairs,triples:observed.gpuTrace.fusedTriples,sequenceGets:observed.gpuTrace.fusedSequenceGets});}
    }finally{await target.dispose();}
  }
  for(const c of cases){const variants=receipts.filter(r=>r.id===c.id);for(const r of variants){assert.equal(r.steps,variants[0].steps);assert.deepEqual(r.counts,variants[0].counts);}}
  assert.ok(receipts.some(r=>r.pairs>0));assert.ok(receipts.some(r=>r.triples>0));
  assert.ok(receipts.some(r=>r.sequenceGets>0));
  fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({status:'PASS_FUSION_BOUNDARIES_ONLY_NOT_K400',receipts},null,2)+'\n');
});
