import { createNativeRealitySession, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from '../../src/index.mjs';

const source = `reality LiteralSpelling {
  facet values : Sequence = sequence_append(empty_sequence(), facet_ast("x", "Number", "Number", "1", make_span(0, 1, 1, 1)))
  subject actor { warrant world.write on values }
  emergence update {
    cause actor when true needs world.write on values
    alter values <- sequence_append(empty_sequence(), facet_ast("x", "Number", "Number", "01", make_span(0, 1, 1, 1)))
  }
}`;

const session = await createNativeRealitySession(source, {
  stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE,
  rejectProjectedAst: true,
});
try {
  const before = session.snapshot();
  const result = await session.invoke({ rule: 'update' });
  if (before.stateRoot === result.afterRoot || result.state.values[0].literalText !== '01') {
    throw new Error('Candidate root did not bind the changed literal spelling');
  }
  console.log(JSON.stringify({
    status: 'CANDIDATE', algorithm: before.stateRootAlgorithm,
    beforeRoot: before.stateRoot, afterRoot: result.afterRoot,
    literalText: result.state.values[0].literalText,
    boundary: 'Non-durable local session; no production or journal migration claim.',
  }, null, 2));
} finally {
  await session.close();
}
