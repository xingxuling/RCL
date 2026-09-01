import { tryCompileReality } from './compiler.mjs';

function quote(value) {
  return JSON.stringify(String(value));
}

function nestedChoose(values, fallback) {
  let expression = fallback;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    expression = `choose(index == ${index}, ${values[index]}, ${expression})`;
  }
  return expression;
}

export function linkedRecordPlanFromTypedCompiler(source, typeModuleSources, facetPath) {
  const compiled = tryCompileReality(source, { typeModuleSources });
  if (!compiled.ok) throw new Error(`RCL_LINKED_TYPED_SOURCE_INVALID:${JSON.stringify(compiled.diagnostics)}`);
  const facet = compiled.program.facets.find(item => item.path === facetPath);
  if (!facet || facet.value?.kind !== 'RecordConstructExpr') throw new Error('RCL_LINKED_RECORD_FACET_REQUIRED');
  const fields = facet.value.fields.map(field => {
    const expression = field.value ?? field.expression;
    if (expression.kind === 'LiteralExpr' && expression.valueType === 'Text') {
      return { name: field.name, kind: 'Text', value: expression.value };
    }
    if (expression.kind === 'LiteralExpr' && expression.valueType === 'Number') {
      return { name: field.name, kind: 'Number', value: Number(expression.value) };
    }
    if (expression.kind === 'CallExpr' && expression.name === 'empty_sequence' && expression.args.length === 0) {
      return { name: field.name, kind: 'EmptySequence' };
    }
    throw new Error(`RCL_LINKED_RECORD_FIELD_UNSUPPORTED:${field.name}:${expression.kind}`);
  });
  return Object.freeze({
    format: 'rcl.selfhost-linked-typed-record-plan.v0.1',
    program: compiled.program.name,
    sourceRoot: compiled.program.programRoot,
    facetPath,
    canonicalType: facet.value.canonicalType,
    fields: Object.freeze(fields),
    boundary: 'LINKED_TYPED_RECORD_PLAN_FROM_EXISTING_TYPE_GRAPH_NOT_RAW_RCLTYPE_SELFHOST_PARSER',
  });
}

export function renderRclLinkedRecordLowerer(plan) {
  if (!plan || plan.format !== 'rcl.selfhost-linked-typed-record-plan.v0.1') throw new Error('RCL_LINKED_RECORD_PLAN_INVALID');
  const textFields = plan.fields.filter(field => field.kind === 'Text');
  const numberFields = plan.fields.filter(field => field.kind === 'Number');
  const fieldKinds = plan.fields.map(field => quote(field.kind));
  const fieldTextIndex = [];
  const fieldNumberIndex = [];
  let textIndex = 0;
  let numberIndex = 0;
  for (const field of plan.fields) {
    if (field.kind === 'Text') {
      fieldTextIndex.push(String(textIndex));
      fieldNumberIndex.push('-1');
      textIndex += 1;
    } else if (field.kind === 'Number') {
      fieldTextIndex.push('-1');
      fieldNumberIndex.push(String(numberIndex));
      numberIndex += 1;
    } else {
      fieldTextIndex.push('-1');
      fieldNumberIndex.push('-1');
    }
  }
  const textValues = textFields.map(field => quote(field.value));
  const numberValues = numberFields.map(field => String(field.value));
  const fieldNames = plan.fields.map(field => field.name).join('\n');

  return `reality RCLLinkedTypedRecordLowererV01 {
  facet linked.program : Text = ${quote(plan.program)}
  facet linked.root : Text = ${quote(plan.sourceRoot)}
  facet linked.canonical_type : Text = ${quote(plan.canonicalType)}
  facet linked.field_names : Text = ${quote(fieldNames)}
  facet linked.state_key : Text = ${quote(plan.facetPath)}
  facet linked.field_count : Number = ${plan.fields.length}
  facet linked.text_count : Number = ${textFields.length}
  facet linked.number_count : Number = ${numberFields.length}

  reckon field_kind(index : Number) -> Text = ${nestedChoose(fieldKinds, '"INVALID"')}
  reckon field_text_index(index : Number) -> Number = ${nestedChoose(fieldTextIndex, '-1')}
  reckon field_number_index(index : Number) -> Number = ${nestedChoose(fieldNumberIndex, '-1')}
  reckon text_value(index : Number) -> Text = ${nestedChoose(textValues, '""')}
  reckon number_value(index : Number) -> Number = ${nestedChoose(numberValues, '0')}

  reckon encode_string_record(value : Text) -> Sequence =
    sequence_concat(bytes_u32le(length(utf8_bytes(value))), utf8_bytes(value))
  reckon encode_string_pool(items : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(items), output,
      encode_string_pool(items, index + 1, sequence_concat(output, encode_string_record(sequence_get(items, index)))))
  reckon encode_number_pool(items : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(items), output,
      encode_number_pool(items, index + 1, sequence_concat(output, bytes_f64le(sequence_get(items, index)))))
  reckon encode_instruction(op : Number, a : Number, b : Number, c : Number) -> Sequence =
    sequence_concat(bytes_u8(op), sequence_concat(bytes_u8(0), sequence_concat(bytes_u16le(0), sequence_concat(bytes_i32le(a), sequence_concat(bytes_i32le(b), bytes_i32le(c))))))
  reckon encode_instruction_plan(ops : Sequence, av : Sequence, bv : Sequence, cv : Sequence, index : Number, output : Sequence) -> Sequence =
    choose(index >= length(ops), output,
      encode_instruction_plan(ops, av, bv, cv, index + 1,
        sequence_concat(output, encode_instruction(sequence_get(ops, index), sequence_get(av, index), sequence_get(bv, index), sequence_get(cv, index)))))

  reckon build_texts(index : Number, output : Sequence) -> Sequence =
    choose(index >= linked.text_count, output, build_texts(index + 1, sequence_append(output, text_value(index))))
  reckon strings() -> Sequence =
    sequence_append(sequence_append(sequence_append(build_texts(0, sequence_append(sequence_append(empty_sequence(), linked.program), linked.root)), linked.canonical_type), linked.field_names), linked.state_key)
  reckon build_numbers(index : Number, output : Sequence) -> Sequence =
    choose(index >= linked.number_count, output, build_numbers(index + 1, sequence_append(output, number_value(index))))
  reckon numbers() -> Sequence = build_numbers(0, empty_sequence())

  reckon text_string_pool_index(text_index : Number) -> Number = 2 + text_index
  reckon canonical_type_index() -> Number = 2 + linked.text_count
  reckon field_names_index() -> Number = canonical_type_index() + 1
  reckon state_key_index() -> Number = canonical_type_index() + 2
  reckon field_op(index : Number) -> Number =
    choose(field_kind(index) == "Text", 3,
      choose(field_kind(index) == "Number", 1,
        choose(field_kind(index) == "EmptySequence", 30, -1)))
  reckon field_a(index : Number) -> Number =
    choose(field_kind(index) == "Text", text_string_pool_index(field_text_index(index)),
      choose(field_kind(index) == "Number", field_number_index(index),
        choose(field_kind(index) == "EmptySequence", 12, -1)))
  reckon validate_fields(index : Number) -> Truth =
    choose(index >= linked.field_count, true,
      choose(semantic_assert(field_op(index) >= 0, "RCL_LINKED_RECORD_FIELD_KIND_UNSUPPORTED", field_kind(index), make_span(0, 1, 1, 0)),
        validate_fields(index + 1), false))
  reckon build_field_ops(index : Number, output : Sequence) -> Sequence =
    choose(index >= linked.field_count, output, build_field_ops(index + 1, sequence_append(output, field_op(index))))
  reckon build_field_a(index : Number, output : Sequence) -> Sequence =
    choose(index >= linked.field_count, output, build_field_a(index + 1, sequence_append(output, field_a(index))))
  reckon build_zeros(count : Number, index : Number, output : Sequence) -> Sequence =
    choose(index >= count, output, build_zeros(count, index + 1, sequence_append(output, 0)))

  reckon instruction_ops() -> Sequence =
    choose(validate_fields(0), sequence_append(sequence_append(build_field_ops(0, empty_sequence()), 36), 5), empty_sequence())
  reckon instruction_ops_final() -> Sequence = sequence_append(instruction_ops(), 31)
  reckon instruction_a() -> Sequence =
    sequence_append(sequence_append(sequence_append(build_field_a(0, empty_sequence()), canonical_type_index()), state_key_index()), 0)
  reckon instruction_b() -> Sequence =
    sequence_append(sequence_append(sequence_append(build_zeros(linked.field_count, 0, empty_sequence()), field_names_index()), 0), 0)
  reckon instruction_c() -> Sequence =
    sequence_append(sequence_append(sequence_append(build_zeros(linked.field_count, 0, empty_sequence()), linked.field_count), 0), 0)
  reckon header() -> Sequence =
    sequence_concat(utf8_bytes("RCLB"),
      sequence_concat(bytes_u16le(1),
        sequence_concat(bytes_u16le(1),
          sequence_concat(bytes_u32le(0),
            sequence_concat(bytes_u32le(0),
              sequence_concat(bytes_u32le(1),
                sequence_concat(bytes_u32le(length(target.strings)),
                  sequence_concat(bytes_u32le(length(target.numbers)),
                    sequence_concat(bytes_u32le(length(target.ops)), bytes_u32le(0))))))))))

  facet target.strings : Sequence = strings()
  facet target.numbers : Sequence = numbers()
  facet target.ops : Sequence = instruction_ops_final()
  facet target.a : Sequence = instruction_a()
  facet target.b : Sequence = instruction_b()
  facet target.c : Sequence = instruction_c()
  facet target.rbc_bytes : Sequence =
    sequence_concat(header(),
      sequence_concat(encode_string_pool(target.strings, 0, empty_sequence()),
        sequence_concat(encode_number_pool(target.numbers, 0, empty_sequence()),
          encode_instruction_plan(target.ops, target.a, target.b, target.c, 0, empty_sequence()))))
}`;
}
