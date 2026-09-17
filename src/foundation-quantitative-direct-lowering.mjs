import { quantityConstructorTypes } from './quantity.mjs';

export const FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_FORMAT = 'taowind.rcl-foundation-quantitative-direct-lowering.v0.1';
export const FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_VERSION = '0.1.0';

const MEASUREMENT_RECORD_TYPE = 'taowind.rcl.native.Measurement.v0.1';
const QUANTITY_CONSTRUCTOR_BY_TYPE = new Map(
  Object.entries(quantityConstructorTypes).map(([name, type]) => [type, name]),
);

function array(value) { return Array.isArray(value) ? value : []; }
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function literal(valueType, value) { return { kind: 'LiteralExpr', valueType, value }; }
function pathExpression(path) { return { kind: 'PathExpr', path }; }
function field(object, name) { return { kind: 'FieldAccessExpr', object, field: name }; }
function trueExpression() { return literal('Truth', true); }
function sanitizeName(value) { return String(value ?? 'unnamed').replace(/[^A-Za-z0-9_]+/g, '_'); }
function diagnostic(code, message, details = {}) { return { code, message, details }; }

function allocateSyntheticRuleName(baseRuleName, reservedNames) {
  let ruleName = baseRuleName;
  let suffix = 0;
  while (reservedNames.has(ruleName)) { suffix += 1; ruleName = `${baseRuleName}_${suffix}`; }
  reservedNames.add(ruleName);
  return { ruleName, baseRuleName, renamed: ruleName !== baseRuleName };
}

function defaultUncertainty(baseType) {
  const constructor = QUANTITY_CONSTRUCTOR_BY_TYPE.get(baseType);
  if (constructor) return { kind: 'CallExpr', name: constructor, args: [literal('Number', 0)] };
  return literal('Number', 0);
}

function canonicalEvidenceText(evidence) {
  return JSON.stringify(array(evidence).map(String));
}

function measurementRecord(measure) {
  return {
    kind: 'RecordConstructExpr',
    canonicalType: MEASUREMENT_RECORD_TYPE,
    fields: [
      { name: 'kind', value: literal('Text', 'Measurement') },
      { name: 'baseType', value: literal('Text', measure.baseType) },
      { name: 'value', value: clone(measure.value) },
      { name: 'uncertainty', value: clone(measure.uncertainty ?? defaultUncertainty(measure.baseType)) },
      { name: 'confidence', value: clone(measure.confidence ?? literal('Number', 1)) },
      { name: 'unit', value: literal('Text', measure.unit ?? '') },
      { name: 'scale', value: literal('Text', measure.scale ?? 'ratio') },
      { name: 'evidence', value: literal('Text', canonicalEvidenceText(measure.evidence)) },
      { name: 'calibratedBy', value: literal('Text', measure.calibratedBy ?? '') },
      { name: 'hasUnit', value: literal('Truth', measure.unit != null) },
      { name: 'hasCalibration', value: literal('Truth', measure.calibratedBy != null) },
    ],
  };
}

function measurementPath(expr, measurementPaths) {
  return expr?.kind === 'PathExpr' && measurementPaths.has(expr.path);
}

function rewriteMeasurementAccessors(value, measurementPaths) {
  if (Array.isArray(value)) return value.map(item => rewriteMeasurementAccessors(item, measurementPaths));
  if (!value || typeof value !== 'object') return value;

  if (value.kind === 'CallExpr' && array(value.args).length === 1 && measurementPath(value.args[0], measurementPaths)) {
    const target = rewriteMeasurementAccessors(value.args[0], measurementPaths);
    if (value.name === 'measure_value') return field(target, 'value');
    if (value.name === 'confidence') return field(target, 'confidence');
    if (value.name === 'uncertainty' || value.name === 'measure_uncertainty') return field(target, 'uncertainty');
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, rewriteMeasurementAccessors(item, measurementPaths)]),
  );
}

function quantitativeRule(quantitative, facets, ruleName) {
  const facetByPath = new Map(facets.map(item => [item.path, item]));
  const measurePaths = array(quantitative.measures).map(item => item.path);
  const derivePaths = array(quantitative.derives).map(item => item.path);
  const stateTargets = [...measurePaths, ...derivePaths];
  const alters = stateTargets.map(target => ({
    target,
    expression: clone(facetByPath.get(target)?.value),
  }));
  const witness = `rcl:foundation:quantitative:${quantitative.name}`;
  return {
    rule: {
      kind: 'Emergence',
      name: ruleName,
      cause: `quantitative.${quantitative.name}`,
      when: trueExpression(),
      needs: [],
      alters,
      calls: [],
      preserves: array(quantitative.preserves).map(clone),
      witnesses: [witness],
    },
    metadata: {
      domain: 'quantitative',
      declaration: quantitative.name,
      directive: 'Quantify',
      syntheticRule: ruleName,
      stateTargets,
      preserveCount: array(quantitative.preserves).length,
      witness,
      authorityClass: 'measurement',
      sourceReality: quantitative.name,
      measurementCount: measurePaths.length,
      derivedCount: derivePaths.length,
      measurementPaths: measurePaths,
      derivedPaths: derivePaths,
      evidenceCount: array(quantitative.measures).reduce((sum, measure) => sum + array(measure.evidence).length, 0),
    },
  };
}

export function lowerDeclaredQuantitativeToCore(program) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object is required');
  }

  const quantitatives = array(program.quantitatives);
  const quantitativeByName = new Map(quantitatives.map(item => [item.name, item]));
  const diagnostics = [];
  const consumed = new Set();
  const consumedDirectiveIndexes = new Set();
  const targetNames = new Set();

  array(program.directives).forEach((directive, index) => {
    if (directive?.kind !== 'Quantify') return;
    const quantitative = quantitativeByName.get(directive.name);
    if (!quantitative) {
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_TARGET_UNKNOWN',
        `Quantify target '${directive.name}' is not a declared quantitative reality`,
        { directiveIndex: index, domain: 'quantitative', target: directive.name },
      ));
      return;
    }
    consumed.add(quantitative.name);
    consumedDirectiveIndexes.add(index);
    targetNames.add(quantitative.name);
  });

  const measurementPaths = new Set(
    quantitatives
      .filter(item => targetNames.has(item.name))
      .flatMap(item => array(item.measures).map(measure => measure.path)),
  );

  let transformed = rewriteMeasurementAccessors(clone(program), measurementPaths);
  const rewrittenQuantitatives = array(transformed.quantitatives);
  const transformedByName = new Map(rewrittenQuantitatives.map(item => [item.name, item]));

  transformed.facets = array(transformed.facets).map(facet => {
    if (!facet?.measure || !consumed.has(facet.owner)) return facet;
    return {
      ...facet,
      value: measurementRecord(facet.measure),
      nativeMeasurementRecordType: MEASUREMENT_RECORD_TYPE,
      nativeMeasurementMetadataRetained: true,
    };
  });

  const reservedRuleNames = new Set(array(transformed.rules).map(rule => rule?.name).filter(Boolean));
  const syntheticRules = [];
  const lowered = [];
  let renamedSyntheticRuleCount = 0;

  const rewrittenDirectives = array(transformed.directives).flatMap((directive, index) => {
    if (directive?.kind !== 'Quantify' || !consumedDirectiveIndexes.has(index)) return [directive];
    const quantitative = transformedByName.get(directive.name);
    const allocation = allocateSyntheticRuleName(
      `__rcl_foundation_quantitative_${sanitizeName(quantitative.name)}_${index}`,
      reservedRuleNames,
    );
    if (allocation.renamed) {
      renamedSyntheticRuleCount += 1;
      diagnostics.push(diagnostic(
        'RCL_FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_RULE_NAME_COLLISION_AVOIDED',
        `Synthetic quantitative rule '${allocation.baseRuleName}' would collide with an existing rule; allocated '${allocation.ruleName}' instead`,
        {
          directiveIndex: index,
          domain: 'quantitative',
          declaration: quantitative.name,
          requestedRuleName: allocation.baseRuleName,
          allocatedRuleName: allocation.ruleName,
        },
      ));
    }
    const staged = quantitativeRule(quantitative, transformed.facets, allocation.ruleName);
    syntheticRules.push(staged.rule);
    lowered.push({ ...staged.metadata, directiveIndex: index });
    return [{ kind: 'Realize', rule: allocation.ruleName }];
  });

  const remainingQuantitatives = rewrittenQuantitatives.filter(item => !consumed.has(item.name));
  for (const quantitative of remainingQuantitatives) {
    diagnostics.push(diagnostic(
      'RCL_FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_DECLARATION_UNCONSUMED',
      `Quantitative reality '${quantitative.name}' remains declared because no Quantify directive consumed it`,
      { domain: 'quantitative', declaration: quantitative.name },
    ));
  }

  transformed = {
    ...transformed,
    quantitatives: remainingQuantitatives,
    rules: [...array(transformed.rules), ...syntheticRules],
    directives: rewrittenDirectives,
  };

  return {
    format: FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_FORMAT,
    version: FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_VERSION,
    program: transformed,
    lowered,
    diagnostics,
    summary: {
      loweredCount: lowered.length,
      quantitativeLoweredDeclarationCount: consumed.size,
      consumedDirectiveCount: consumedDirectiveIndexes.size,
      syntheticRuleCount: syntheticRules.length,
      remainingQuantitativeCount: remainingQuantitatives.length,
      measurementRecordCount: transformed.facets.filter(item => item?.nativeMeasurementMetadataRetained === true).length,
      rewrittenMeasurementAccessorPaths: [...measurementPaths].sort(),
      renamedSyntheticRuleCount,
    },
    truthBoundary: {
      declaredQuantitativeDirectLoweringImplemented: consumed.size > 0,
      declaredQuantitativeDirectLoweringVerified: false,
      nativeMeasurementRecordType: MEASUREMENT_RECORD_TYPE,
      measurementValueUncertaintyConfidenceUnitScaleRetained: true,
      measurementEvidenceRetainedAsCanonicalJsonText: true,
      measurementCalibrationIdentityRetained: true,
      measurementAccessorsLoweredToTypedRecordFields: true,
      quantitativeDomainReceiptParityClaimed: false,
      referenceRuntimeParityClaimed: false,
      deploymentHealthBound: false,
      providerBridgeRemovedGlobally: false,
      allFoundationDomainsNativeClaimed: false,
    },
  };
}
