export function predicateSource(predicate, reckons = 'reckon eligible(value : Number) -> Truth = value > 0') {
  return `reality WarrantPredicate {
    facet enabled : Truth = true
    facet count : Number = 1
    facet label : Text = "allowed"
    facet items : Sequence = sequence_append(empty_sequence(), true)
    facet state : Number = 0
    ${reckons}
    subject worker { warrant state.write on state while ${predicate} }
    emergence increment {
      cause worker when true needs state.write on state
      alter state <- state + 1 preserve state <= 10 witness "predicate:increment"
    }
  }`;
}

export const invalidPredicates = [
  ['unknown path', 'missing.enabled', 'RCL_SEMANTIC_UNKNOWN_PATH'],
  ['unknown call', 'missing_predicate()', 'RCL_SEMANTIC_UNKNOWN_CALL'],
  ['nested unknown path', 'true or missing.enabled', 'RCL_SEMANTIC_UNKNOWN_PATH'],
  ['literal number', '1', 'RCL_WARRANT_CONDITION_TYPE'],
  ['literal text', '"yes"', 'RCL_WARRANT_CONDITION_TYPE'],
  ['numeric facet', 'count', 'RCL_WARRANT_CONDITION_TYPE'],
  ['sequence result', 'empty_sequence()', 'RCL_WARRANT_CONDITION_TYPE'],
  ['invalid unary', 'not count', 'RCL_TYPE_UNARY'],
  ['invalid logic', 'enabled and count', 'RCL_TYPE_LOGIC'],
  ['invalid arithmetic', '(count + enabled) > 0', 'RCL_TYPE_BINARY'],
  ['mixed equality', 'count == label', 'RCL_TYPE_BINARY'],
  ['text ordering', 'label > "a"', 'RCL_TYPE_BINARY'],
  ['builtin arity', 'starts_with(label)', 'RCL_CALL_ARITY'],
  ['builtin argument type', 'starts_with(count, "a")', 'RCL_CALL_TYPE'],
  ['nested builtin argument', 'length(count) > 0', 'RCL_CALL_TYPE'],
  ['choose condition', 'choose(count, true, false)', 'RCL_TYPE_CHOOSE'],
  ['choose branches', 'choose(enabled, true, count)', 'RCL_TYPE_CHOOSE'],
  ['user call argument', 'eligible(label)', 'RCL_CALL_TYPE'],
  ['user call arity', 'eligible()', 'RCL_SEMANTIC_CALL_ARITY'],
  ['user predicate body', 'eligible(count)', 'RCL_RECKON_RETURN_TYPE', 'reckon eligible(value : Number) -> Truth = value'],
  ['nested user predicate body', 'eligible(count)', 'RCL_RECKON_RETURN_TYPE', 'reckon other(value : Number) -> Truth = value\n reckon eligible(value : Number) -> Truth = other(value)'],
  ['user predicate operand', 'eligible(count)', 'RCL_TYPE_LOGIC', 'reckon eligible(value : Number) -> Truth = value and true'],
  ['declared numeric return with dynamic body', 'eligible(items)', 'RCL_WARRANT_CONDITION_TYPE', 'reckon eligible(values : Sequence) -> Number = sequence_get(values, 0)'],
];

export const validPredicates = [
  ['truth literal', 'true', true],
  ['truth facet', 'enabled', true],
  ['false condition', 'not enabled', false],
  ['numeric comparison', 'count * 2 >= 2', true],
  ['mixed predicate', 'enabled and count > 0 and starts_with(label, "allow")', true],
  ['text equality', 'label == "allowed"', true],
  ['text conversion', 'contains(text(count), "1")', true],
  ['typed builtin chain', 'length(upper_text(label)) == 7', true],
  ['choose truth', 'choose(enabled, true, false)', true],
  ['dynamic sequence value', 'sequence_get(items, 0)', true],
  ['choose dynamic value', 'choose(enabled, sequence_get(items, 0), false)', true],
  ['typed user predicate', 'eligible(count)', true],
  ['recursive user predicate', 'eligible(count)', true, 'reckon eligible(value : Number) -> Truth = choose(value <= 0, true, eligible(value - 1))'],
  ['mutually recursive predicates', 'eligible(count)', true, 'reckon other(value : Number) -> Truth = choose(value <= 0, true, eligible(value - 1))\n reckon eligible(value : Number) -> Truth = choose(value <= 0, true, other(value - 1))'],
  ['span builtin', 'span_line(make_span(0, 1, 1, 0)) == 1', true],
  ['token builtin', 'token_text(make_token("name", label, make_span(0, 1, 1, 1))) == label', true],
  ['byte sequence builtin', 'length(utf8_bytes(label)) == 7', true],
  ['hash builtin', 'length(sha256_text(label)) == 64', true],
];
