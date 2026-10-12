import { donorSource,inputFacets,edit,definition,casesFrom } from './shared.mjs';
const donor='examples/universal-stress/k337-k338-compiler-governance-reactive.rcl';
const baseline={valid:true,phase:0,audit:0};
function source(){let text=inputFacets(donorSource(donor,'PortableGovernance','k400-governance-reactive-v1'),baseline);
  text=edit(text,'facet request.valid : Truth = true','facet request.valid : Truth = input.valid');
  text=edit(text,'facet compiler.phase : Number = 0','facet compiler.phase : Number = input.phase');
  text=edit(text,'facet compiler.audit_count : Number = 0','facet compiler.audit_count : Number = input.audit');
  text=edit(text,'preserve compiler.audit_count == 1','preserve compiler.audit_count == input.audit + 1');
  return edit(text,'preserve compiler.audit_count == 2','preserve compiler.audit_count == input.audit + 2');}
function oracle(input){const ran=input.valid&&input.phase===0;
  return{state:{'request.valid':input.valid,'compiler.phase':ran?2:input.phase,'compiler.accepted':ran,'compiler.emitted':ran,'compiler.audit_count':input.audit+(ran?2:0)},
    historyRules:ran?['authorize_candidate','emit_candidate']:[],historyActors:ran?['maintainer','maintainer']:[]};}
export default definition({id:'governance-reactive',donor,source,baseline,oracle,families:['security-sensitive','reactive'],
  scope:'bounded source-declared warrants, two guarded transactions, invariants, witnesses and state-triggered rule order; no operating-system security or external key custody claim',
  cases:casesFrom(['valid','phase','audit'],[[false,0,0],[true,0,1],[true,0,10],[false,0,10],[true,1,0],[true,2,0],[false,2,20],[true,0,100],[true,3,7],[true,0,1000]]),
  mutations:[
    {id:'inspect-warrant',good:'warrant compiler.inspect on source',bad:'warrant compiler.no_inspect on source',intent:'The maintainer needs the exact compiler.inspect warrant on source to authorize the candidate; do not change rule requirements or grant unrelated permissions.'},
    {id:'emit-trigger',good:'when compiler.accepted == true and compiler.phase == 1',bad:'when compiler.accepted == true and compiler.phase == 2',intent:'After candidate authorization sets phase one and accepted true, emission must trigger once and advance the phase to two.'},
    {id:'audit-increment',good:'alter compiler.audit_count <- compiler.audit_count + 1\n    preserve compiler.accepted',bad:'alter compiler.audit_count <- compiler.audit_count + 2\n    preserve compiler.accepted',intent:'Each successful transaction increments the audit counter by exactly one, while its projected-state invariant must remain satisfied.'},
  ]},'scripts/k400-genomes/governance.mjs');
