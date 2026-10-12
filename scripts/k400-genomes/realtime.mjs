import { donorSource,inputFacets,edit,definition,casesFrom } from './shared.mjs';
const donor='examples/universal-stress/k331-compiler-realtime.rcl';
const baseline={current:0,target:4,budget:4};
function source(){return edit(inputFacets(donorSource(donor,'PortableLogicalEvents','k400-logical-events-v1'),baseline),
  'facet result.success : Sequence = advance_to(schedule.events, 0, 4, 4)',
  'facet result.success : Sequence = advance_to(schedule.events, input.current, input.target, input.budget)');}
function oracle(input){const events=[[30,4,0,1],[20,2,1,1],[10,2,0,1],[15,2,0,1],[40,6,0,1]];
  const sorted=[...events].sort((a,b)=>a[1]-b[1]||a[2]-b[2]||a[0]-b[0]);
  const advance=(current,target,budget)=>{if(target<current)return[-1,current,[]];const ids=sorted.filter(event=>event[3]===1&&event[1]<=target).map(event=>event[0]);return ids.length>budget?[-2,current,[]]:[1,target,ids];};
  return{state:{'schedule.sorted':sorted,'result.success':advance(input.current,input.target,input.budget),'result.budget_rejected':advance(0,4,3),
    'result.backward_rejected':advance(4,3,4),'result.invalid_rejected':[-5,0,[]],'result.external_unapproved':[-3,4,[]],'result.external_approved':[1,8,[]],
    'projection.normal':8,'projection.accelerated':2,'projection.invalid':-1},historyRules:[]};}
export default definition({id:'logical-events',donor,source,baseline,oracle,families:['realtime'],
  scope:'bounded deterministic logical event scheduling, total tie order and event-budget rejection; no physical clock, interrupt or hard real-time claim',
  cases:casesFrom(['current','target','budget'],[[0,0,0],[0,2,3],[0,2,2],[0,4,4],[0,6,5],[4,3,5],[0,8,5],[2,2,3],[0,1,0],[4,6,4]]),
  mutations:[
    {id:'tie-order',good:'event_priority(left) < event_priority(right)',bad:'event_priority(left) > event_priority(right)',intent:'Sort events by increasing time, then increasing priority value, then increasing identifier, using a total deterministic order.'},
    {id:'budget',good:'due_count(sort_events(events, 0, empty_sequence()), target, 0) > max_events',bad:'due_count(sort_events(events, 0, empty_sequence()), target, 0) < max_events',intent:'Reject an advance when the count of due active events exceeds the event budget; equality is allowed.'},
    {id:'time-authority',good:'temporal_commit_capability != 1',bad:'temporal_commit_capability == 1',intent:'An external time proposal requires temporal commit capability equal to one and cannot move logical time backwards.'},
  ]},'scripts/k400-genomes/realtime.mjs');
