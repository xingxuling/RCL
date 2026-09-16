import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const number = value => ({ kind: 'LiteralExpr', valueType: 'Number', value });
const truth = value => ({ kind: 'LiteralExpr', valueType: 'Truth', value });
const path = value => ({ kind: 'PathExpr', path: value });
const binary = (operator, left, right) => ({ kind: 'BinaryExpr', operator, left, right });

function baseProgram() {
  return {
    name: 'LivingNativeSlice',
    facets: [
      { kind:'FacetDecl', path:'world.food', valueType:'Number', value:number(4) },
      { kind:'FacetDecl', path:'organism.foodSense', valueType:'Number', value:number(0) },
      { kind:'FacetDecl', path:'organism.energy', valueType:'Number', value:number(1) },
      { kind:'FacetDecl', path:'organism.health', valueType:'Number', value:number(1) },
    ],
    warrants: [], functions: [], rules: [], physicals: [], perceptions: [], neurals: [], genetics: [],
    livings: [{
      kind:'LivingDecl', name:'organism', body:'organism.body', facets:[], needs:['food'],
      senses:[{kind:'SenseDecl',path:'organism.foodSense',valueType:'Number',source:'world.food'}],
      maintains:[binary('>=',path('organism.health'),number(0))],
      cycles:[
        {kind:'LivingCycleDecl',name:'organism.feed',when:binary('>',path('organism.foodSense'),number(0)),changes:[{mode:'metabolize',target:'organism.energy',expression:binary('+',path('organism.energy'),path('organism.foodSense'))}],witnesses:['living:feed']},
        {kind:'LivingCycleDecl',name:'organism.heal',when:truth(true),changes:[{mode:'heal',target:'organism.health',expression:binary('+',path('organism.health'),number(1))}],witnesses:['living:heal']},
      ],
    }],
    quantitatives: [], knowledges: [], naturalLanguages: [], understandings: [], creations: [], spacetimes: [], accelerations: [], compressions: [], metaDomains: [], energies: [], elements: [], sciences: [], embodiments: [], spirits: [],
    directives:[{kind:'Live',name:'organism',count:number(2),dt:null}],
  };
}

test('bounded Live expands each step into sense sync followed by declared cycle order', () => {
  const result=lowerDeclaredFoundationToCore(baseProgram());
  assert.equal(result.summary.livingLoweredStepCount,2);
  assert.equal(result.summary.livingLoweredStageCount,6);
  assert.equal(result.program.livings.length,0);
  assert.deepEqual(result.program.directives,[
    {kind:'Realize',rule:'__rcl_foundation_living_organism_0_1_sense'},
    {kind:'Realize',rule:'__rcl_foundation_living_organism_feed_0_1_1'},
    {kind:'Realize',rule:'__rcl_foundation_living_organism_heal_0_1_2'},
    {kind:'Realize',rule:'__rcl_foundation_living_organism_0_2_sense'},
    {kind:'Realize',rule:'__rcl_foundation_living_organism_feed_0_2_1'},
    {kind:'Realize',rule:'__rcl_foundation_living_organism_heal_0_2_2'},
  ]);
  assert.deepEqual(result.lowered.map(item=>[item.stepIndex,item.stage,item.cycleIndex]),[[1,'sense',null],[1,'cycle',1],[1,'cycle',2],[2,'sense',null],[2,'cycle',1],[2,'cycle',2]]);
});

test('sense stage copies source state into sense facet before any cycle and does not check maintains', () => {
  const result=lowerDeclaredFoundationToCore(baseProgram());
  const sense=result.program.rules[0];
  assert.deepEqual(sense.alters,[{target:'organism.foodSense',expression:path('world.food')}]);
  assert.deepEqual(sense.preserves,[]);
  assert.deepEqual(sense.witnesses,['rcl:foundation:living:organism:step:1:sense']);
  assert.deepEqual(result.lowered[0].changeModes,['sense-sync']);
});

test('cycle condition and changes remain state-relative so they observe synced senses and prior cycles', () => {
  const source=baseProgram();
  const result=lowerDeclaredFoundationToCore(source);
  const feed=result.program.rules[1];
  assert.deepEqual(feed.when,source.livings[0].cycles[0].when);
  assert.deepEqual(feed.alters,source.livings[0].cycles[0].changes.map(change=>({target:change.target,expression:change.expression})));
  assert.deepEqual(feed.preserves,source.livings[0].maintains);
});

test('living cycle metadata binds body needs modes witnesses and intrinsic authority', () => {
  const result=lowerDeclaredFoundationToCore(baseProgram());
  const meta=result.lowered[1];
  assert.equal(meta.authorityClass,'intrinsic-life-cycle');
  assert.equal(meta.sourceReality,'organism');
  assert.equal(meta.cycleName,'organism.feed');
  assert.equal(meta.body,'organism.body');
  assert.deepEqual(meta.livingNeeds,['food']);
  assert.deepEqual(meta.changeModes,['metabolize']);
  assert.deepEqual(meta.originalWitnesses,['living:feed']);
  assert.deepEqual(result.program.rules[1].witnesses,['living:feed','rcl:foundation:living:organism.feed:step:1:cycle:1']);
});

test('dynamic Live step count fails closed and keeps living provider-domain semantics', () => {
  const source=baseProgram(); source.directives[0].count=path('organism.steps');
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.livings.length,1);
  assert.deepEqual(result.program.directives,source.directives);
  assert.equal(result.summary.livingLoweredStepCount,0);
  assert.ok(result.diagnostics.some(item=>item.code==='RCL_FOUNDATION_DIRECT_LOWERING_LIVING_DYNAMIC_STEPS_UNSUPPORTED'));
});

test('oversized Live expansion is rejected to keep staged lowering bounded', () => {
  const source=baseProgram(); source.directives[0].count=number(257);
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.livings.length,1);
  assert.equal(result.summary.livingLoweredStageCount,0);
});

test('unknown Live target is retained and diagnosed', () => {
  const source=baseProgram(); source.directives[0].name='missing';
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.livings.length,1);
  assert.deepEqual(result.program.directives,source.directives);
  assert.ok(result.diagnostics.some(item=>item.code==='RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN'&&item.details.domain==='living'));
});

test('living synthetic identities cannot shadow user core rules', () => {
  const source=baseProgram(); const reserved='__rcl_foundation_living_organism_0_1_sense';
  source.rules.push({kind:'Emergence',name:reserved,cause:'user',when:truth(true),needs:[],alters:[],calls:[],preserves:[],witnesses:['user']});
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.rules[0].name,reserved);
  assert.equal(result.program.rules[1].name,`${reserved}_1`);
  assert.equal(result.lowered[0].syntheticRule,`${reserved}_1`);
  assert.equal(result.summary.renamedSyntheticRuleCount,1);
});

test('unconsumed second living reality remains fail-closed', () => {
  const source=baseProgram();
  source.livings.push({kind:'LivingDecl',name:'unused',body:null,facets:[],needs:[],senses:[],maintains:[],cycles:[]});
  const result=lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.livings.map(item=>item.name),['unused']);
  assert.ok(result.diagnostics.some(item=>item.code==='RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED'&&item.details.domain==='living'));
});

test('domain selection can leave living semantics untouched', () => {
  const source=baseProgram();
  const result=lowerDeclaredFoundationToCore(source,{domains:['perception','physical','neural','genetic']});
  assert.equal(result.program.livings.length,1);
  assert.deepEqual(result.program.directives,source.directives);
  assert.deepEqual(result.truthBoundary.directDomains,['perception','physical','neural','genetic']);
});

test('living without senses emits only ordered cycle stages', () => {
  const source=baseProgram(); source.livings[0].senses=[]; source.directives[0].count=number(1);
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.summary.livingLoweredStageCount,2);
  assert.deepEqual(result.lowered.map(item=>[item.stage,item.stageIndex,item.stageCount]),[['cycle',1,2],['cycle',2,2]]);
  assert.equal(result.program.directives[0].rule,'__rcl_foundation_living_organism_feed_0_1_1');
});

test('sense-only living still persists sense synchronization for every bounded step', () => {
  const source=baseProgram(); source.livings[0].cycles=[];
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.summary.livingLoweredStepCount,2);
  assert.equal(result.summary.livingLoweredStageCount,2);
  assert.ok(result.lowered.every(item=>item.stage==='sense'&&item.stageCount===1));
});

test('empty living declaration consumes a bounded Live with no fake transactions', () => {
  const source=baseProgram(); source.livings[0].senses=[]; source.livings[0].cycles=[];
  const result=lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.livings.length,0);
  assert.deepEqual(result.program.directives,[]);
  assert.equal(result.summary.livingLoweredStepCount,2);
  assert.equal(result.summary.livingLoweredStageCount,0);
  assert.equal(result.truthBoundary.livingDomainReceiptParityClaimed,false);
});
