// RCL recognizes a smaller escape set than JSON. Other scalar characters are literal.
const textEscapes = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
function textLiteral(value) {
  if (/[\u0000\uD800-\uDFFF]/u.test(value)) {
    const code = 'RCL_NATIVE_DATA_TEXT_UNREPRESENTABLE';
    throw Object.assign(new Error(code), { code });
  }
  return '"' + value.replace(/["\\\n\r\t]/gu, (character) => textEscapes[character]) + '"';
}

// Exact finite binary64 data expressions and balanced RCL sequence literals.
export function nativeDataLiteral(value){
  if(typeof value==='string')return textLiteral(value);
  if(typeof value==='boolean')return String(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('RCL_NATIVE_DATA_NONFINITE');if(value===0)return Object.is(value,-0)?'-0':'0';
    const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);const bits=bytes.readBigUInt64BE(),e=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n),significand=(e?1n<<52n:0n)|fraction;
    return'binary_scale('+(bits>>63n?'-':'')+significand.toString()+', '+(e?e-1023-52:-1074)+')';
  }
  if(Array.isArray(value)){
    if(!value.length)return'empty_sequence()';if(value.length===1)return'sequence_append(empty_sequence(), '+nativeDataLiteral(value[0])+')';
    const middle=Math.floor(value.length/2);return'sequence_concat('+nativeDataLiteral(value.slice(0,middle))+', '+nativeDataLiteral(value.slice(middle))+')';
  }
  throw new Error('RCL_NATIVE_DATA_TYPE');
}
