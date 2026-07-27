import { realityRoot } from './canonical.mjs';
import { createRclRncsVisualIntent } from './rncs-visual-intent.mjs';

/**
 * Convert an RCL realized transition into the input expected by
 * @taowind/rncs-core-contract.newProposal without coupling the language kernel
 * to a specific RNCS contract implementation.
 */
export function toRncsProposalInput(program, transition, options = {}) {
  if (!transition || transition.status !== 'realized') {
    throw new TypeError('Only realized RCL transitions can become RNCS proposal inputs');
  }
  const realityId = options.realityId ?? `rcl:${program.name}`;
  const baseGeneration = Number(options.baseGeneration ?? 0);
  const baseGenerationRoot = options.baseGenerationRoot ?? '0'.repeat(64);
  const subjectId = transition.actor ?? options.subjectId ?? 'rcl:system';
  const visualIntent = options.visualIntent
    ? createRclRncsVisualIntent(options.visualIntent)
    : null;
  const providerCapabilities = transition.hostCalls?.map(call => ({ host: call.host ?? null, capability: call.capability, required: true })) ?? [];
  const evidenceRequirements = (transition.witnesses ?? []).map((witness, index) => ({ kind: 'rcl-witness', reference: witness, required: true, sequence: index + 1 }));
  const foundationGovernance = {
    explicitVariables: options.explicitVariables ?? [],
    uncertainty: options.uncertainty ?? { status: 'undeclared', variables: [] },
    providerCapabilities: { required: providerCapabilities, externalSideEffects: providerCapabilities.length > 0 },
    authorityRequirements: transition.authority?.needs ?? [],
    irreversibleEffects: options.irreversibleEffects ?? [{ classification: options.irreversibility ?? 'unknown', effects: [] }],
    invariants: options.invariants ?? [],
    adaptiveInvariantField: options.adaptiveInvariantField ?? { version: '0.1.0', mode: 'static-plus-runtime', active: [] },
    causalParents: options.causalParents ?? [{ kind: transition.ruleKind ?? 'transition', rule: transition.rule, beforeRoot: transition.beforeRoot }],
    evidenceRequirements: evidenceRequirements.length ? evidenceRequirements : [{ kind: 'rcl-transition-root', reference: transition.afterRoot, required: true }],
  };

  return {
    reality_id: realityId,
    base_generation: baseGeneration,
    base_generation_root: baseGenerationRoot,
    subject: {
      subject_id: subjectId,
      kind: options.subjectKind ?? 'rcl-subject',
      roles: options.roles ?? ['reality-program-actor'],
      responsibility_boundary: `rcl-rule:${transition.rule}`,
    },
    intent: {
      source: 'rcl.realize',
      goals: [{ rule: transition.rule, after_root: transition.afterRoot }],
      constraints: transition.authority?.needs ?? [],
      visual_intent_root: visualIntent?.root ?? null,
    },
    capability_plan: {
      capabilities: transition.authority?.activeWarrants ?? [],
      host_bindings: transition.hostCalls?.map(call => ({ host: call.host, capability: call.capability })) ?? [],
      required_scopes: (transition.authority?.needs ?? []).map(need => `${need.capability}@${need.target}`),
    },
    inputs: [
      { kind: 'rcl-program', program_root: program.programRoot },
      ...(visualIntent
        ? [{
          kind: 'rcl-rncs-visual-intent',
          source_asset_id: visualIntent.sourceAssetId,
          root: visualIntent.root,
        }]
        : []),
    ],
    provisional_delta: {
      operations: transition.changes.map(change => ({
        op: 'rcl.set-facet',
        path: change.target,
        before: change.before,
        after: change.after,
        source: change.source,
      })),
    },
    causal_basis: {
      events: [{ kind: transition.ruleKind, rule: transition.rule, actor: transition.actor }],
      rules: [{ language: 'RCL', version: program.languageVersion, rule: transition.rule }],
      simulation_refs: visualIntent ? [visualIntent.root] : [],
    },
    evidence: {
      nodes: (transition.witnesses ?? []).map((witness, index) => ({
        evidence_id: `rcl-evidence:${realityRoot({ witness, index, transition: transition.afterRoot }).slice(0, 24)}`,
        kind: 'rcl-witness',
        source: witness,
        transition_root: transition.afterRoot,
      })),
      edges: visualIntent
        ? [{
          from: visualIntent.root,
          to: transition.afterRoot,
          kind: 'visual-intent-input',
        }]
        : [],
    },
    foundation_governance: foundationGovernance,
    extensions: {
      rcl: {
        program: program.name,
        program_root: program.programRoot,
        before_root: transition.beforeRoot,
        after_root: transition.afterRoot,
        from_subject: transition.from,
        into_subject: transition.into,
        foundation_governance: foundationGovernance,
        visual_intent: visualIntent,
      },
    },
  };
}
