import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='native/gpu-text-runtime/vendor/ryu',sha=b=>createHash('sha256').update(b).digest('hex');
const provenance=JSON.parse(fs.readFileSync(dir+'/PROVENANCE.json','utf8'));
assert.equal(provenance.commit,'4c0618b0e44f7ef027ebae05d2cc7812048f7c8f');
for(const file of provenance.files)assert.equal(sha(fs.readFileSync(file.path)),file.sha256);
function replaceFunction(source,signature,replacement){
 const start=source.indexOf(signature);assert.ok(start>=0,signature);const open=source.indexOf('{',start);let depth=1,end=open+1;
 while(depth){const c=source[end++];assert.ok(c!==undefined);if(c==='{')depth++;if(c==='}')depth--;}
 return source.slice(0,start)+replacement+source.slice(end);
}
const names=['common.h','digit_table.h','d2s_full_table.h','d2s_intrinsics.h','d2s.c','d2fixed_full_table.h','d2fixed.c'];
const pieces=names.map(name=>{
 let source=fs.readFileSync(dir+'/'+name,'utf8').replace(/^#include.*$/gmu,'');
 if(name==='common.h'){
  source=replaceFunction(source,'static inline uint32_t float_to_bits','static inline uint32_t float_to_bits(const float f) { return as_uint(f); }');
  source=replaceFunction(source,'static inline uint64_t double_to_bits','static inline uint64_t double_to_bits(const double d) { return as_ulong(d); }');
 }
 if(name==='d2s.c')source=source.slice(0,source.indexOf('char* d2s(double f)'));
 if(name==='d2fixed.c'){
  source=replaceFunction(source,'char* d2fixed(double d','');
  source=replaceFunction(source,'char* d2exp(double d','');
 }
 source=source.replace(/static const (u?int(?:8|16|32|64)_t)/gu,'__constant const $1').replaceAll('static const char','__constant const char').replaceAll('const uint64_t* const mul','__constant const uint64_t* const mul').replaceAll('const uint64_t* mul','__constant const uint64_t* mul').replaceAll('memcpy(','ryu_constant_copy(').replaceAll('memset(','ryu_private_fill(');
 return '\n// Adapted from pinned Ryu '+name+'; original notice follows.\n'+source;
});
const header=`// Device adaptation of Ryu binary64 formatting. Original licensed sources remain separate.
// No host-side numeric formatting or VM execution is used.
typedef ulong uint64_t;
typedef uint uint32_t;
typedef ushort uint16_t;
typedef int int32_t;
typedef uchar uint8_t;
#define RYU_ONLY_64_BIT_OPS
#define UINT64_C(x) x##UL
#define assert(x) ((void)0)
static inline void ryu_constant_copy(char* destination,__constant const char* source,uint count) {
  for(uint index=0;index<count;index++)destination[index]=source[index];
}
static inline void ryu_private_fill(char* destination,int value,uint count) {
  for(uint index=0;index<count;index++)destination[index]=(char)value;
}
`;
const source=header+pieces.join('\n');const output='native/gpu-text-runtime/ryu-opencl.cl';
fs.writeFileSync(output,source);
fs.writeFileSync('native/gpu-text-runtime/ryu-build.json',JSON.stringify({format:'rcl.gpu-ryu-adaptation.v1',vendorCommit:provenance.commit,vendorFiles:provenance.files,scriptSha256:sha(fs.readFileSync(import.meta.filename)),output:{path:output,sha256:sha(source)},changes:['OpenCL integer type aliases and explicit constant address spaces','Device bitcast intrinsics instead of host memcpy','Constant-to-private byte copies','Only bounded buffered formatting, no malloc API','Portable 64-bit integer implementation'],validation:'PENDING_ACTUAL_GPU_REPLAY'},null,2)+'\n');
console.log(JSON.stringify({path:output,sha256:sha(source),bytes:Buffer.byteLength(source)}));
