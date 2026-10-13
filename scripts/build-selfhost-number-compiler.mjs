import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {runNativeCompiler} from '../src/native-vm.mjs';
import {ROOT,edit} from './k400-genomes/shared.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const donor=fs.readFileSync(path.join(ROOT,'selfhost/variants/utf16-columns/compiler.rcl'),'utf8');
assert.equal(sha(donor),'b3cb7816a2d447888c8620f7513a70db1564ed79afd11afc14b6f6bc29e63e82');
const old=`  reckon scan_number_end(source : Text, index : Number, seen_dot : Truth) -> Number =
    choose(index >= length(source), index,
      choose(is_digit(char_at(source, index)), scan_number_end(source, index + 1, seen_dot),
        choose(both(char_at(source, index) == char_at(".", 0), not seen_dot),
          scan_number_end(source, index + 1, true), index)))`;
const replacement=`  reckon scan_exponent_digits(source : Text, index : Number) -> Number =
    choose(index >= length(source), index,
      choose(is_digit(char_at(source, index)), scan_exponent_digits(source, index + 1), index))

  reckon scan_exponent_after_sign(source : Text, marker : Number, index : Number) -> Number =
    choose(index >= length(source), marker,
      choose(is_digit(char_at(source, index)), scan_exponent_digits(source, index + 1), marker))

  reckon scan_exponent_end(source : Text, marker : Number) -> Number =
    scan_exponent_after_sign(source, marker,
      choose(either(char_at(source, marker + 1) == "+", char_at(source, marker + 1) == minus_operator()), marker + 2, marker + 1))

  reckon scan_number_end(source : Text, index : Number, seen_dot : Truth) -> Number =
    choose(index >= length(source), index,
      choose(is_digit(char_at(source, index)), scan_number_end(source, index + 1, seen_dot),
        choose(both(char_at(source, index) == char_at(".", 0), not seen_dot),
          scan_number_end(source, index + 1, true),
          choose(either(char_at(source, index) == "e", char_at(source, index) == "E"), scan_exponent_end(source, index), index))))`;
const source=edit(donor,old,replacement),directory=path.join(ROOT,'selfhost/variants/scientific-numbers');fs.mkdirSync(directory,{recursive:true});
const sourcePath=path.join(directory,'compiler.rcl'),artifactPath=path.join(directory,'compiler.rbc'),c0=Buffer.from(compileRealityToBytecode(source));fs.writeFileSync(sourcePath,source);fs.writeFileSync(artifactPath,c0);
const out=path.join(ROOT,'output/scientific-number-compiler');fs.mkdirSync(out,{recursive:true});
const compilerPath=path.join(ROOT,'native/sequence-runtime/portable/windows/rclc.exe');
const first=runNativeCompiler(artifactPath,sourcePath,path.join(out,'c1.rbc'),{compilerPath,timeout:300000}),second=runNativeCompiler(path.join(out,'c1.rbc'),sourcePath,path.join(out,'c2.rbc'),{compilerPath,timeout:300000});
assert.deepEqual(first.bytecode,c0);assert.deepEqual(second.bytecode,c0);
const report={format:'rcl.selfhost-scientific-number-compiler.v1',status:'PASS_NATIVE_FIXED_POINT_CANDIDATE',donorSourceHash:sha(donor),sourceHash:sha(source),artifactHash:sha(c0),bytes:c0.length,patch:{old,replacement},executedInstructions:first.executedInstructions,generations:[sha(c0),sha(first.bytecode),sha(second.bytecode)],scope:'Separate RCL-authored general lexer extension for decimal exponent suffixes with optional sign and mandatory digits; retains UTF-16 column accounting. Original and previously frozen compiler variants remain unchanged.'};
fs.writeFileSync(path.join(directory,'build.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,sourceHash:report.sourceHash,artifactHash:report.artifactHash,bytes:report.bytes,executedInstructions:report.executedInstructions}));
