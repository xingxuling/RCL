import assert from 'node:assert/strict';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
// An independent structural oracle for the three public opcode-table faults.
// It changes instruction bytes, without executing a candidate compiler.
export function expectedMutantArtifact(source,index){
  const artifact=Buffer.from(compileRealityToBytecode(source));let offset=36;
  for(let i=0;i<artifact.readUInt32LE(20);i++){const size=artifact.readUInt32LE(offset);offset+=4+size;}
  offset+=artifact.readUInt32LE(24)*8;
  const[good,bad]=[[6,7],[13,12],[15,14]][index];let changed=0;
  for(let i=0;i<artifact.readUInt32LE(28);i++){const at=offset+i*16;if(artifact[at]===good){artifact[at]=bad;changed++;}}
  assert.ok(changed>0,'A frozen probe must exercise the selected opcode');return artifact;
}
