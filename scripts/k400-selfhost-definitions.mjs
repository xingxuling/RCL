import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
import {readSelfHostedCompilerSource} from '../src/selfhost-compiler.mjs';
export const SELFHOST_DIRECTORY='examples/universal-stress/selfhost-native';
export const SELFHOST_PROFILE={id:'general-compiler',environments:['windows','linux','wasm-vm','browser'],family:'self-hosting',source:readSelfHostedCompilerSource,
  scope:'Unchanged complete RCL native-core general compiler, twenty actual C0-to-C20 byte-identical self-compilation generations in each selected environment, ten sealed source programs and fresh independent compiler repairs; separate generic persistent Sequence runtime, no whole-runtime self-hosting or whole-language release claim',
  mutations:[
    {id:'addition-opcode',good:'choose(operator == "+", 6,',bad:'choose(operator == "+", 7,',intent:'Addition must emit the ADD instruction, distinct from SUB; retain all other compiler behavior.'},
    {id:'less-equal-opcode',good:'choose(operator == "<=", 13,',bad:'choose(operator == "<=", 12,',intent:'Less-than-or-equal must include equality, using its distinct LE instruction rather than LT.'},
    {id:'greater-equal-opcode',good:'choose(operator == ">=", 15, 44)',bad:'choose(operator == ">=", 14, 44)',intent:'Greater-than-or-equal must include equality, using GE rather than GT; preserve the existing modulo fallback.'},
  ],
};
export const SELFHOST_CASES=[
  ['addition','reality Add { facet result : Number = 9 + 2 }'],
  ['subtract-multiply','reality Arithmetic { facet result : Number = (9 - 2) * 3 }'],
  ['division-modulo','reality Division { facet quotient : Number = 24 / 3 facet rest : Number = 29 % 6 }'],
  ['comparison-boundary','reality Comparison { facet le : Truth = 1 <= 1 facet ge : Truth = 1 >= 1 facet lt : Truth = 1 < 1 facet gt : Truth = 1 > 1 }'],
  ['boolean-short-circuit','reality ShortCircuit { facet accepted : Truth = true or (1 / 0 == 0) facet rejected : Truth = false and (1 / 0 == 0) }'],
  ['recursive-gcd','reality Euclid { reckon gcd(a : Number, b : Number) -> Number = choose(b == 0, a, gcd(b, a % b)) facet result : Number = gcd(84, 30) }'],
  ['unicode-text','reality Unicode { facet source : Text = "中😀文" facet count : Number = length(source) facet first : Text = char_at(source, 0) facet label : Text = "计数：" + text(17) }'],
  ['persistent-sequence','reality SequenceCase { facet left : Sequence = sequence_append(empty_sequence(), 7) facet both : Sequence = sequence_concat(left, left) facet value : Number = sequence_get(both, 1) }'],
  ['conditional-warrant','reality Conditional { facet enabled : Truth = true facet count : Number = 0 subject actor { warrant counter.write on count while enabled } emergence add { cause actor when count == 0 needs counter.write on count alter count <- count + 2 preserve count == 2 witness "conditional:committed" } realize add }'],
  ['projection-commit',fs.readFileSync(path.join(ROOT,'examples/sequence-runtime/transactions.rcl'),'utf8')],
].map(([id,source],index)=>({index,id,source}));
