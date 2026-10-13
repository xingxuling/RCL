import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=[];
for(const name of ['lexer','parser','compiler']){
 const donor='src/'+name+'.mjs',output='src/scientific-'+name+'.mjs';let source=fs.readFileSync(donor,'utf8');const donorHash=sha(source);
 if(name==='lexer'){
  const anchor="      push('NUMBER', raw, startLine, startColumn);";assert.equal(source.split(anchor).length,2);
  source=source.replace(anchor,`      if(source[i]==='e'||source[i]==='E'){
        raw+=advance();if(source[i]==='+'||source[i]==='-')raw+=advance();
        if(!isDigit(source[i]))throw new RCLSyntaxError('Decimal exponent requires digits',{line:startLine,column:startColumn,value:raw});
        while(isDigit(source[i]))raw+=advance();
      }
${anchor}`);
 }else if(name==='parser')source=source.replace("'./lexer.mjs'","'./scientific-lexer.mjs'");
 else source=source.replace("'./parser.mjs'","'./scientific-parser.mjs'");
 source='// ADAPT of '+donor+' at SHA256 '+donorHash+'; isolated scientific-number reference, original pipeline preserved.\n'+source;
 fs.writeFileSync(output,source);files.push({donor,donorHash,output,sha256:sha(source)});
}
fs.mkdirSync('selfhost/variants/scientific-numbers',{recursive:true});
fs.writeFileSync('selfhost/variants/scientific-numbers/reference-build.json',JSON.stringify({format:'rcl.scientific-reference-build.v1',files,scope:'Separate decimal exponent lexer plus unchanged parser/compiler algorithms; existing bytecode serializer accepts the resulting program object. This reference is an oracle, not native runtime ownership or a default-pipeline replacement.'},null,2)+'\n');
console.log(JSON.stringify({files:files.map(f=>f.output)}));
