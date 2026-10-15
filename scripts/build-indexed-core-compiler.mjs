import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {compileRealityToBytecode} from '../src/bytecode.mjs';
import {compileReality} from '../src/compiler.mjs';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex'),donor='selfhost/variants/utf16-columns/compiler.rcl';
const original=fs.readFileSync(donor,'utf8'),directory='selfhost/variants/indexed-core';fs.mkdirSync(directory,{recursive:true});
assert.equal(sha(original),'b3cb7816a2d447888c8620f7513a70db1564ed79afd11afc14b6f6bc29e63e82','Pinned complete donor changed');
const helpers=`
  reckon indexed_empty_buckets(n : Number, output : Sequence) -> Sequence =
    choose(n == 0, output, indexed_empty_buckets(n - 1, sequence_append(output, empty_sequence())))
  reckon indexed_bucket_replace(items : Sequence, position : Number, value : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(items), output,
      indexed_bucket_replace(items, position, value, index + 1,
        sequence_append(output, choose(index == position, value, sequence_get(items, index)))))
  reckon indexed_insert(items : Sequence, index : Number, buckets : Sequence) -> Sequence =
    choose(index >= length(items), buckets,
      indexed_insert(items, index + 1,
        indexed_bucket_replace(buckets, length(sequence_get(items, index)) % 64,
          sequence_append(sequence_get(buckets, length(sequence_get(items, index)) % 64),
            sequence_append(sequence_append(empty_sequence(), sequence_get(items, index)), index)),
          0, empty_sequence())))
  reckon indexed_bucket_find(items : Sequence, index : Number, value : Text) -> Number =
    choose(index >= length(items), -1,
      choose(sequence_get(sequence_get(items, index), 0) == value,
        sequence_get(sequence_get(items, index), 1), indexed_bucket_find(items, index + 1, value)))
  reckon indexed_pool_find(value : Text) -> Number =
    indexed_bucket_find(sequence_get(compiler.string_index, length(value) % 64), 0, value)
  reckon indexed_function_insert(items : Sequence, index : Number, address : Number, buckets : Sequence) -> Sequence =
    choose(index >= length(items), buckets,
      indexed_function_insert(items, index + 1, address + reckon_instruction_count(sequence_get(items, index)) + 1,
        indexed_bucket_replace(buckets, length(reckon_name(sequence_get(items, index))) % 64,
          sequence_append(sequence_get(buckets, length(reckon_name(sequence_get(items, index))) % 64),
            sequence_append(sequence_append(empty_sequence(), reckon_name(sequence_get(items, index))), address)),
          0, empty_sequence())))
  reckon indexed_function_find(name : Text) -> Number =
    indexed_bucket_find(sequence_get(compiler.function_index, length(name) % 64), 0, name)
  reckon indexed_names_insert(items : Sequence, index : Number, buckets : Sequence) -> Sequence =
    choose(index >= length(items), buckets,
      indexed_names_insert(items, index + 1,
        indexed_bucket_replace(buckets, length(reckon_name(sequence_get(items, index))) % 64,
          sequence_append(sequence_get(buckets, length(reckon_name(sequence_get(items, index))) % 64),
            sequence_append(sequence_append(empty_sequence(), reckon_name(sequence_get(items, index))), index)),
          0, empty_sequence())))
  reckon indexed_validation_find(name : Text) -> Number =
    indexed_bucket_find(sequence_get(compiler.validation_index, length(name) % 64), 0, name)
`;
let source=original.replace('  reckon one_instruction(op : Number',helpers+'\n  reckon one_instruction(op : Number');
const marker='  reckon emit_expression_array(';let start=source.indexOf(marker);if(start<0)start=source.indexOf('  reckon emit_literal_provider(');if(start<0)start=source.indexOf('  reckon emit_expression(');if(start<0)throw Error('Emission scope missing');
const before=source.slice(0,start),after=source.slice(start).replaceAll('find_text(strings, 0,','indexed_pool_find(')
  .replaceAll('function_address(reckons, expr_text(node), 0, main_count)','main_count + indexed_function_find(expr_text(node))');source=before+after;
source=source.replace('  facet compiler.canonical : Text = canonical_program(compiler.program)',
  '  facet compiler.function_index : Sequence = indexed_function_insert(program_reckons(compiler.program), 0, 0, indexed_empty_buckets(64, empty_sequence()))\n  facet compiler.canonical : Text = canonical_program(compiler.program)');
source=source.replace('validated_program(state_node(parse_state)), state_node(parse_state))','state_node(parse_state), state_node(parse_state))');
source=source.replace('  facet compiler.program : Sequence = k337_validated_program(parse_program(compiler.tokens))',
  '  facet compiler.raw_program : Sequence = parse_program(compiler.tokens)\n  facet compiler.validation_index : Sequence = indexed_names_insert(program_reckons(compiler.raw_program), 0, indexed_empty_buckets(64, empty_sequence()))\n  facet compiler.program : Sequence = k337_validated_program(validated_program(compiler.raw_program))');
source=source.replace('find_reckon_index(reckons, 0, expr_text(node))','indexed_validation_find(expr_text(node))')
  .replace('find_reckon_index(reckons, 0, name)','indexed_validation_find(name)');
source=source.replace('  facet compiler.root : Text = program_root(compiler.program)',
  '  facet compiler.root : Text = sha256_text(compiler.canonical)');
const getters=new Map([...source.matchAll(/reckon (\w+)\((\w+) : Sequence\) -> \w+ = sequence_get\(\2, (\d+)\)/g)].map(m=>[m[1],{parameter:m[2],index:m[3]}]));
function inlineGetters(text){let out='',i=0;while(i<text.length){
 if(text[i]==='"'){let end=i+1;while(end<text.length){if(text[end]==='\\'){end+=2;continue;}if(text[end++]==='"')break;}out+=text.slice(i,end);i=end;continue;}
 if(text.slice(i,i+2)==='//'){let end=text.indexOf('\n',i);if(end<0)end=text.length;out+=text.slice(i,end);i=end;continue;}
 const word=/^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(i));if(word&&getters.has(word[0])){const open=i+word[0].length;if(text[open]==='('){let end=open+1,depth=1;while(end<text.length&&depth){if(text[end]===String.fromCharCode(34)){end++;while(end<text.length){if(text[end]===String.fromCharCode(92)){end+=2;continue;}if(text[end++]===String.fromCharCode(34))break;}continue;}if(text.slice(end,end+2)==='//'){const line=text.indexOf('\n',end);end=line<0?text.length:line;continue;}if(text[end]==='(')depth++;else if(text[end]===')')depth--;end++;}const argument=text.slice(open+1,end-1);if(!argument.includes(' : ')){out+='sequence_get('+inlineGetters(argument)+', '+getters.get(word[0]).index+')';i=end;continue;}}}
 if(word){out+=word[0];i+=word[0].length;}else out+=text[i++];
 }return out;}
source=inlineGetters(source);

function replaceReckon(name,definition){const start=source.indexOf('  reckon '+name+'(');if(start<0)throw Error('Missing '+name);const next=source.indexOf('\n  reckon ',start+1);if(next<0)throw Error('No successor '+name);source=source.slice(0,start)+definition+'\n'+source.slice(next);}
const scans=String.raw`
  reckon indexed_identifier_emit(source : Text, index : Number, end : Number, line : Number, column : Number, chunks : Sequence, chunk : Sequence) -> Sequence =
    tokenize_emit(source, end, line, column + end - index, chunks, chunk,
      make_token_node("IDENT", slice_text(source, index, end - index), line, column))
  reckon indexed_number_emit(source : Text, index : Number, end : Number, line : Number, column : Number, chunks : Sequence, chunk : Sequence) -> Sequence =
    tokenize_emit(source, end, line, column + end - index, chunks, chunk,
      make_token_node("NUMBER", slice_text(source, index, end - index), line, column))
  reckon indexed_comment_emit(source : Text, index : Number, end : Number, line : Number, column : Number, chunks : Sequence, chunk : Sequence) -> Sequence =
    tokenize_from(source, end, line, column + end - index, chunks, chunk)
  reckon indexed_string_position_emit(source : Text, index : Number, end : Number, line : Number, column : Number, position : Sequence, chunks : Sequence, chunk : Sequence) -> Sequence =
    tokenize_emit(source, end + 1, sequence_get(position, 0), sequence_get(position, 1), chunks, chunk,
      make_token_node("STRING", decode_string_from(source, index + 1, end, ""), line, column))
  reckon indexed_string_emit(source : Text, index : Number, end : Number, line : Number, column : Number, chunks : Sequence, chunk : Sequence) -> Sequence =
    indexed_string_position_emit(source, index, end, line, column, position_after(source, index, end + 1, line, column), chunks, chunk)
`;
source=source.replace('  reckon tokenize_from(',scans+'\n  reckon tokenize_from(');
source=source.replace('tokenize_from(source, scan_comment_end(source, index), line, column + scan_comment_end(source, index) - index, chunks, chunk)',
 'indexed_comment_emit(source, index, scan_comment_end(source, index), line, column, chunks, chunk)');
const identifier=source.slice(source.indexOf('            tokenize_emit(source, scan_identifier_end'),source.indexOf('            choose(is_digit',source.indexOf('            tokenize_emit(source, scan_identifier_end')));
if(!identifier.includes('make_token_node'))throw Error('Identifier emission missing');
source=source.replace(identifier,'            indexed_identifier_emit(source, index, scan_identifier_end(source, index + 1), line, column, chunks, chunk),\n');
const number=source.slice(source.indexOf('              tokenize_emit(source, scan_number_end'),source.indexOf('              choose(char_at',source.indexOf('              tokenize_emit(source, scan_number_end')));
if(!number.includes('make_token_node'))throw Error('Number emission missing');
source=source.replace(number,'              indexed_number_emit(source, index, scan_number_end(source, index + 1, false), line, column, chunks, chunk),\n');
const string=source.slice(source.indexOf('                tokenize_emit(source, scan_string_end'),source.indexOf('                choose(is_two_symbol',source.indexOf('                tokenize_emit(source, scan_string_end')));
if(!string.includes('make_token_node'))throw Error('String emission missing');
source=source.replace(string,'                indexed_string_emit(source, index, scan_string_end(source, index + 1, false), line, column, chunks, chunk),\n');
replaceReckon('json_escape_from',String.raw`  reckon json_escape_character(value : Text) -> Text =
    choose(value == quote_character(), slash_character() + quote_character(),
      choose(value == slash_character(), slash_character() + slash_character(),
        choose(value == "\n", slash_character() + "n",
          choose(value == "\r", slash_character() + "r",
            choose(value == "\t", slash_character() + "t", value)))))
  reckon json_escape_from(value : Text, index : Number, output : Text) -> Text =
    choose(index >= length(value), output,
      json_escape_from(value, index + 1, output + json_escape_character(char_at(value, index))))`);

source=source.replace('  facet compiler.numbers : Sequence = build_number_pool(compiler.program)',
  '  facet compiler.string_index : Sequence = indexed_insert(compiler.strings, 0, indexed_empty_buckets(64, empty_sequence()))\n  facet compiler.numbers : Sequence = build_number_pool(compiler.program)');

{
const poolNames=[...source.matchAll(/  reckon (collect_\w*strings\w*)\(/g)].map(m=>m[1]);
const replacePoolCalls=text=>{for(const name of poolNames)text=text.replaceAll(name+'(', 'indexed_'+name+'(');return text.replaceAll('append_unique_text(', 'indexed_unique_text(');};
let poolHelpers=String.raw`
  reckon indexed_text_state(items : Sequence, buckets : Sequence) -> Sequence =
    sequence_append(sequence_append(empty_sequence(), items), buckets)
  reckon indexed_unique_text_add(state : Sequence, value : Text, bucket : Number) -> Sequence =
    indexed_text_state(sequence_append(sequence_get(state, 0), value),
      indexed_bucket_replace(sequence_get(state, 1), bucket,
        sequence_append(sequence_get(sequence_get(state, 1), bucket),
          sequence_append(sequence_append(empty_sequence(), value), length(sequence_get(state, 0)))), 0, empty_sequence()))
  reckon indexed_unique_text(state : Sequence, value : Text) -> Sequence =
    choose(indexed_bucket_find(sequence_get(sequence_get(state, 1), length(value) % 64), 0, value) >= 0, state,
      indexed_unique_text_add(state, value, length(value) % 64))
`;
for(const name of poolNames){const start=source.indexOf('  reckon '+name+'('),end=source.indexOf('\n  reckon ',start+1);poolHelpers+='\n'+replacePoolCalls(source.slice(start,end));}
const start=source.indexOf('  reckon build_string_pool('),end=source.indexOf('\n  reckon ',start+1);
let pool=replacePoolCalls(source.slice(start,end)).replace('reckon build_string_pool(', 'reckon indexed_build_string_pool(');
pool=pool.replaceAll('indexed_unique_text(indexed_unique_text(empty_sequence(),', 'indexed_unique_text(indexed_unique_text(indexed_text_state(empty_sequence(), indexed_empty_buckets(64, empty_sequence())),');
const equal=pool.indexOf(' -> Sequence =');if(equal<0)throw Error('Pool signature');const head=pool.slice(0,equal+' -> Sequence ='.length),body=pool.slice(equal+' -> Sequence ='.length).trim();pool=head+'\n    sequence_get('+body+', 0)';
source=source.replace('  reckon one_instruction(',poolHelpers+'\n'+pool+'\n\n  reckon one_instruction(');
source=source.replace('facet compiler.strings : Sequence = build_string_pool(', 'facet compiler.strings : Sequence = indexed_build_string_pool(');

}

replaceReckon('indexed_empty_buckets',String.raw`  reckon indexed_pair(left : Sequence, right : Sequence) -> Sequence =
    sequence_append(sequence_append(empty_sequence(), left), right)
  reckon indexed_empty_buckets(n : Number, output : Sequence) -> Sequence =
    choose(n <= 1, empty_sequence(), indexed_pair(indexed_empty_buckets(n / 2, output), indexed_empty_buckets(n / 2, output)))
  reckon indexed_bucket_at(items : Sequence, position : Number, span : Number) -> Sequence =
    choose(span <= 1, items,
      choose(position < span / 2, indexed_bucket_at(sequence_get(items, 0), position, span / 2),
        indexed_bucket_at(sequence_get(items, 1), position - span / 2, span / 2)))
  reckon indexed_bucket_set(items : Sequence, position : Number, value : Sequence, span : Number) -> Sequence =
    choose(span <= 1, value,
      choose(position < span / 2,
        indexed_pair(indexed_bucket_set(sequence_get(items, 0), position, value, span / 2), sequence_get(items, 1)),
        indexed_pair(sequence_get(items, 0), indexed_bucket_set(sequence_get(items, 1), position - span / 2, value, span / 2))))`);
replaceReckon('indexed_bucket_replace',String.raw`  reckon indexed_bucket_replace(items : Sequence, position : Number, value : Sequence, index : Number, output : Sequence) -> Sequence =
    indexed_bucket_set(items, position, value, 64)`);
for(const [a,c] of [
 ['sequence_get(buckets, length(sequence_get(items, index)) % 64)','indexed_bucket_at(buckets, length(sequence_get(items, index)) % 64, 64)'],
 ['sequence_get(buckets, length(sequence_get(sequence_get(items, index), 0)) % 64)', 'indexed_bucket_at(buckets, length(sequence_get(sequence_get(items, index), 0)) % 64, 64)'],
 ['sequence_get(buckets, length(reckon_name(sequence_get(items, index))) % 64)','indexed_bucket_at(buckets, length(reckon_name(sequence_get(items, index))) % 64, 64)'],
 ['sequence_get(compiler.string_index, length(value) % 64)','indexed_bucket_at(compiler.string_index, length(value) % 64, 64)'],
 ['sequence_get(compiler.function_index, length(name) % 64)','indexed_bucket_at(compiler.function_index, length(name) % 64, 64)'],
 ['sequence_get(compiler.validation_index, length(name) % 64)','indexed_bucket_at(compiler.validation_index, length(name) % 64, 64)'],
 ['sequence_get(sequence_get(state, 1), bucket)','indexed_bucket_at(sequence_get(state, 1), bucket, 64)'],
 ['sequence_get(sequence_get(state, 1), length(value) % 64)','indexed_bucket_at(sequence_get(state, 1), length(value) % 64, 64)']
])source=source.replaceAll(a,c);
replaceReckon('json_escape_character',String.raw`  reckon json_escape_character(value : Text) -> Text =
    choose(contains("\"\\\n\r\t", value),
      choose(value == quote_character(), slash_character() + quote_character(),
        choose(value == slash_character(), slash_character() + slash_character(),
          choose(value == "\n", slash_character() + "n", choose(value == "\r", slash_character() + "r", slash_character() + "t")))), value)`);


replaceReckon('json_quote',String.raw`  reckon json_quote(value : Text) -> Text =
    quote_character() + choose(contains(value, quote_character()) or contains(value, slash_character())
      or contains(value, "\n") or contains(value, "\r") or contains(value, "\t"),
      json_escape_from(value, 0, ""), value) + quote_character()`);
{
 const start=original.indexOf('  reckon builtin_id('),end=original.indexOf('\n  reckon ',start+1),table=[...original.slice(start,end).matchAll(/choose\(name == "([^"]+)", (\d+),/g)].map(m=>({name:m[1],id:Number(m[2])}));if(table.length!==70)throw Error('Complete builtin table changed');
 const groups=new Map();for(const item of table){if(!groups.has(item.name.length))groups.set(item.name.length,[]);groups.get(item.name.length).push(item);}
 const keys=[...groups.keys()].sort((a,c)=>a-c);
 const leaf=n=>groups.get(n).reduceRight((tail,item)=>'choose(name == '+JSON.stringify(item.name)+', '+item.id+', '+tail+')','0');
 const tree=list=>{if(list.length===1)return leaf(list[0]);const middle=Math.floor(list.length/2);return 'choose(size < '+list[middle]+', '+tree(list.slice(0,middle))+', '+tree(list.slice(middle))+')';};
 replaceReckon('builtin_id', '  reckon indexed_builtin_length(name : Text, size : Number) -> Number =\n    '+tree(keys)+'\n\n  reckon builtin_id(name : Text) -> Number = indexed_builtin_length(name, length(name))');
}


replaceReckon('is_two_symbol',String.raw`  reckon is_two_symbol(value : Text) -> Truth =
    value == "<-" or value == "->" or value == "==" or value == "!=" or value == "<=" or value == ">="`);
replaceReckon('binary_precedence',String.raw`  reckon binary_precedence(operator : Text) -> Number =
    choose(operator == "or", 1,
      choose(operator == "and", 2,
        choose(operator == "==" or operator == "!=", 3,
          choose(operator == "<" or operator == "<=" or operator == ">" or operator == ">=", 4,
            choose(operator == "+" or operator == minus_operator(), 5,
              choose(operator == "*" or operator == "/" or operator == "%", 6, 0))))))`);
{
const start=source.indexOf('  reckon tokenize_from('),end=source.indexOf('\n  reckon ',start+1),body=source.slice(start,end),marker='      choose(is_whitespace(char_at(source, index)),';
const split=body.indexOf(marker);if(split<0)throw Error('Character selector missing');const inner=body.slice(split).trim();if(!inner.endsWith(')'))throw Error('Unexpected tokenizer ending');
const prefix=body.slice(0,split),cached='  reckon indexed_tokenize_character(source : Text, index : Number, line : Number, column : Number, chunks : Sequence, chunk : Sequence, character : Text) -> Sequence =\n    '+inner.slice(0,-1).replaceAll('char_at(source, index)','character');
source=source.slice(0,start)+prefix+'      indexed_tokenize_character(source, index, line, column, chunks, chunk, char_at(source, index)))\n\n'+cached+'\n'+source.slice(end);
}

// Cache pure AST size metadata during construction. Existing expression fields
// and their canonical/validation consumers retain their original positions.
{
 const start=source.indexOf('  reckon expression_count('),end=source.indexOf('\n  reckon ',start+1);
 const body=source.slice(start,end).replace('reckon expression_count(', 'reckon indexed_expression_count_uncached(');
 replaceReckon('expression_count',body+String.raw`
  reckon indexed_expression_count_cached(node : Sequence) -> Number = sequence_get(node, length(node) - 1)
  reckon indexed_expression_count_dispatch(node : Sequence, count : Number) -> Number =
    choose(count < 0, indexed_expression_count_uncached(node), count)
  reckon expression_count(node : Sequence) -> Number =
    indexed_expression_count_dispatch(node, indexed_expression_count_cached(node))
  reckon indexed_count_sum(items : Sequence, index : Number, count : Number) -> Number =
    choose(count < 0, -1, choose(index >= length(items), count,
      indexed_count_sum_next(items, index, count, indexed_expression_count_cached(sequence_get(items, index)))))
  reckon indexed_count_sum_next(items : Sequence, index : Number, count : Number, next : Number) -> Number =
    choose(next < 0, -1, indexed_count_sum(items, index + 1, count + next))
  reckon indexed_count_add(count : Number, extra : Number) -> Number = choose(count < 0, -1, count + extra)
  reckon indexed_count_binary(left : Number, right : Number, extra : Number) -> Number =
    choose(left < 0 or right < 0, -1, left + right + extra)
  reckon indexed_call_count(node : Sequence) -> Number =
    choose(sequence_get(node, 1) == "choose",
      choose(length(sequence_get(node, 2)) != 3, -1, indexed_count_add(indexed_count_sum(sequence_get(node, 2), 0, 0), 2)),
      choose(sequence_get(node, 1) == "provider_call" and provider_literal_arguments(node), 1,
        indexed_count_add(indexed_count_sum(sequence_get(node, 2), 0, 0), 1)))
  reckon indexed_count_safe(node : Sequence) -> Number =
    choose(sequence_get(node, 0) == "LiteralExpr" or sequence_get(node, 0) == "PathExpr", 1,
      choose(sequence_get(node, 0) == "UnaryExpr", indexed_count_add(indexed_expression_count_cached(sequence_get(node, 2)), 1),
        choose(sequence_get(node, 0) == "BinaryExpr",
          indexed_count_binary(indexed_expression_count_cached(sequence_get(node, 2)), indexed_expression_count_cached(sequence_get(node, 3)),
            choose(sequence_get(node, 1) == "and" or sequence_get(node, 1) == "or", 5, 1)), indexed_call_count(node))))
  reckon indexed_counted_node(node : Sequence) -> Sequence = sequence_append(node, indexed_count_safe(node))
`);
 for(const name of ['literal_node','path_node','unary_node','binary_node','call_node']){
  const at=source.indexOf('  reckon '+name+'('),last=source.indexOf('\n  reckon ',at+1),definition=source.slice(at,last),marker=' -> Sequence =',split=definition.indexOf(marker);
  if(split<0)throw Error('Expression constructor signature '+name);
  replaceReckon(name,definition.slice(0,split+marker.length)+'\n    indexed_counted_node('+definition.slice(split+marker.length).trim()+')');
 }
}
replaceReckon('append_all',`  reckon append_all(items : Sequence, output : Sequence) -> Sequence = sequence_concat(output, items)`);
{
 const at=source.indexOf('  reckon parse_binary_tail('),last=source.indexOf('\n  reckon ',at+1),definition=source.slice(at,last);
 const condition='either(binary_precedence(token_text_at(tokens, index)) < minimum, binary_precedence(token_text_at(tokens, index)) == 0)';
 if(!definition.includes(condition))throw Error('Precedence decision missing');
 const helper=definition.replace('reckon parse_binary_tail(', 'reckon indexed_parse_binary_tail(').replace('minimum : Number) -> Sequence', 'minimum : Number, precedence : Number) -> Sequence').replace(condition,'precedence < minimum or precedence == 0').replaceAll('binary_precedence(token_text_at(tokens, index))','precedence');
 replaceReckon('parse_binary_tail',`  reckon parse_binary_tail(tokens : Sequence, left : Sequence, index : Number, minimum : Number) -> Sequence =\n    indexed_parse_binary_tail(tokens, left, index, minimum, binary_precedence(token_text_at(tokens, index)))\n\n`+helper);
}
// Inline the four pure token selectors. Each argument is still evaluated once;
// strings, comments and typed definitions are retained verbatim.
{
 const selectors=new Map([['token_kind_at',0],['token_text_at',1],['token_line_at',2],['token_column_at',3]]);
 function inlineTokenSelectors(text){let out='',i=0;while(i<text.length){
  if(text[i]==='"'){let end=i+1;while(end<text.length){if(text[end]==='\\'){end+=2;continue;}if(text[end++]==='"')break;}out+=text.slice(i,end);i=end;continue;}
  if(text.slice(i,i+2)==='//'){let end=text.indexOf('\n',i);if(end<0)end=text.length;out+=text.slice(i,end);i=end;continue;}
  const word=/^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(i));
  if(word&&selectors.has(word[0])&&text[i+word[0].length]==='('){const open=i+word[0].length;let end=open+1,depth=1,split=-1;
   while(end<text.length&&depth){if(text[end]==='"'){end++;while(end<text.length){if(text[end]==='\\'){end+=2;continue;}if(text[end++]==='"')break;}continue;}
    if(text.slice(end,end+2)==='//'){const line=text.indexOf('\n',end);end=line<0?text.length:line;continue;}
    if(text[end]==='(')depth++;else if(text[end]===')')depth--;else if(text[end]===','&&depth===1)split=end;end++;
   }
   if(depth!==0)throw Error('Unclosed token selector '+word[0]);
   const args=text.slice(open+1,end-1);
   if(!args.includes(' : ')){if(split<0)throw Error('Token selector arity '+word[0]);const left=inlineTokenSelectors(text.slice(open+1,split)),right=inlineTokenSelectors(text.slice(split+1,end-1));out+='sequence_get(sequence_get('+left+', '+right+'), '+selectors.get(word[0])+')';i=end;continue;}
  }
  if(word){out+=word[0];i+=word[0].length;}else out+=text[i++];
 }return out;}
 source=inlineTokenSelectors(source);
}
{
 const at=source.indexOf('  reckon emit_call('),last=source.indexOf('\n  reckon ',at+1),definition=source.slice(at,last).trimEnd(),marker='        append_all(one_instruction(';
 const split=definition.indexOf(marker);if(split<0||!definition.endsWith('))))'))throw Error('Call emission shape');
 const tail=definition.slice(split).trim().slice(0,-2).replaceAll('builtin_id(sequence_get(node, 1))','builtin');
 const signature='node : Sequence, locals : Sequence, reckons : Sequence, strings : Sequence, numbers : Sequence, main_count : Number, start : Number';
 replaceReckon('emit_call',definition.slice(0,split)+'        indexed_emit_call_builtin(node, locals, reckons, strings, numbers, main_count, start, builtin_id(sequence_get(node, 1)))))\n\n  reckon indexed_emit_call_builtin('+signature+', builtin : Number) -> Sequence =\n    '+tail);
}
{
 const at=source.indexOf('  reckon emit_expression('),last=source.indexOf('\n  reckon ',at+1),definition=source.slice(at,last),old=String.raw`        choose(find_text(locals, 0, sequence_get(node, 1)) >= 0,
          one_instruction(32, find_text(locals, 0, sequence_get(node, 1)), 0, 0),
          one_instruction(4, indexed_pool_find( sequence_get(node, 1)), 0, 0))`;
 if(!definition.includes(old))throw Error('Path emission lookup shape');
 replaceReckon('emit_expression',definition.replace(old,'        indexed_emit_path_index(sequence_get(node, 1), find_text(locals, 0, sequence_get(node, 1)))')+String.raw`
  reckon indexed_emit_path_index(name : Text, index : Number) -> Sequence =
    choose(index >= 0, one_instruction(32, index, 0, 0), one_instruction(4, indexed_pool_find(name), 0, 0))`);
}
// Prune only internal implementation helpers unreachable from the compiler's
// complete main program. The user-program emitter still emits every supplied
// reckon, including unused user functions; its output policy is unchanged.
const expandedSourceHash=sha(source),program=compileReality(source),definitions=new Map(program.reckons.map(r=>[r.name,r])),reachable=new Set(),pending=[];
function collectCalls(node){if(!node||typeof node!=='object')return;if(node.kind==='CallExpr'&&definitions.has(node.name)&&!reachable.has(node.name)){reachable.add(node.name);pending.push(node.name);}for(const value of Object.values(node))if(value&&typeof value==='object')collectCalls(value);}
collectCalls({...program,reckons:[]});while(pending.length)collectCalls(definitions.get(pending.pop()).expression);
const starts=program.reckons.map(r=>source.indexOf('  reckon '+r.name+'('));assert.ok(starts.every((n,i)=>n>=0&&(i===0||n>starts[i-1])));
const removedInternalHelpers=[];for(let i=program.reckons.length-1;i>=0;i--){const name=program.reckons[i].name;if(reachable.has(name))continue;const start=starts[i],facet=source.indexOf('\n  facet ',start),end=Math.min(starts[i+1]??source.length,facet<0?source.length:facet);assert.ok(end>start);source=source.slice(0,start)+source.slice(end);removedInternalHelpers.unshift(name);}
const pruned=compileReality(source);assert.equal(pruned.reckons.length,reachable.size);assert.deepEqual(pruned.facets,program.facets.map(f=>({...f,location:pruned.facets.find(p=>p.path===f.path).location})));
fs.writeFileSync(directory+'/compiler.rcl',source);const bytecode=compileRealityToBytecode(source);fs.writeFileSync(directory+'/compiler.rbc',bytecode);
fs.writeFileSync(directory+'/build.json',JSON.stringify({format:'rcl.indexed-core-compiler-build.v1',status:'BOOTSTRAP_ONLY_RUNTIME_VERIFICATION_SEPARATE',builder:'scripts/build-indexed-core-compiler.mjs',builderHash:sha(fs.readFileSync('scripts/build-indexed-core-compiler.mjs')),donor,donorHash:sha(original),sourceHash:sha(source),compilerHash:sha(bytecode),sourceBytes:Buffer.byteLength(source),compilerBytes:bytecode.length,expandedSourceHash,retainedFunctionCount:reachable.size,removedInternalHelpers,algorithms:['ordered immutable indexed string-pool construction','length-bucket lookup of functions and strings','persistent binary bucket trees','scan endpoints and string source positions computed once','canonical text reused for its SHA256 root','pure record getter call inlining inside the compiler implementation','all 70 builtin IDs retained with length-based dispatch','plain JSON text reuse with exact escaping fallback','single character read per tokenizer decision','short-circuit pure operator comparisons','immutable bottom-up AST instruction-count metadata','persistent sequence concatenation for emitted instruction lists','single precedence calculation per parser decision','two-argument pure token selector inlining','one builtin-id resolution per emitted call','one local-slot lookup per emitted path','static reachability of internal implementation helpers only'],scope:'Separate complete native-core donor variant. Original language features and reachable validation owners retained; unreachable implementation helpers removed; generic compiler algorithms changed. Bootstrap construction alone proves no native/GPU fixed point or K400 acceptance.'},null,2)+'\n');
console.log(JSON.stringify({sourceBytes:Buffer.byteLength(source),compilerBytes:bytecode.length,compilerHash:sha(bytecode)}));
