import { donorSource, inputFacets, edit, definition, casesFrom } from './shared.mjs';
const donor = 'examples/universal-stress/k334-compiler-agent.rcl';
const baseline = { capability:1,budget:5,max_risk:3,approval:1,kill:0,observe:0 };
function source() {
  let text = inputFacets(donorSource(donor,'PortableAgent','k400-agent-v1'),baseline);
  return edit(text,'facet result.success : Sequence = run_agent(actions.success, 1, 5, 3, 1, 0, 0)',
    'facet result.success : Sequence = run_agent(actions.success, input.capability, input.budget, input.max_risk, input.approval, input.kill, input.observe)');
}
function run(actions,capability,budget,maxRisk,approval,kill,observe) {
  if (kill===1) return [-4,0,0,0,[-4],0];
  let best=null, bestScore=-1000, rejection=0; const memory=[];
  for (const action of actions) {
    const [id,cap,utility,evidence,risk,cost,needsApproval]=action;
    const code = cap!==capability?-1:cost>budget?-2:needsApproval===1&&approval===0?-3:risk>maxRisk?-5:1;
    memory.push(code===1?id:-id);
    if(code!==1){rejection=code;continue;}
    const score=utility+evidence-risk-cost;
    if(score>bestScore){best=action;bestScore=score;}
  }
  return !best?[rejection,0,0,0,memory,0]:observe===1?[2,best[0],bestScore,0,memory,0]:[1,best[0],bestScore,best[5],memory,1];
}
function oracle(input) {
  const success=[[10,1,7,4,1,2,0],[20,1,10,6,2,3,1]];
  return {state:{'result.success':run(success,input.capability,input.budget,input.max_risk,input.approval,input.kill,input.observe),
    'result.observe_only':run(success,1,5,3,1,0,1),'result.capability_denied':run([[30,2,9,5,1,2,0]],1,5,3,1,0,0),
    'result.budget_denied':run([[40,1,9,5,1,8,0]],1,5,3,1,0,0),'result.risk_denied':run([[50,1,12,5,7,2,0]],1,5,3,1,0,0),
    'result.unapproved':run([[20,1,10,6,2,3,1]],1,5,3,0,0,0),'result.kill_switch':run(success,1,5,3,1,1,0)},historyRules:[]};
}
export default definition({id:'agent',donor,source,baseline,oracle,families:['agent'],
  scope:'bounded deterministic action deliberation with capability, budget, risk, approval, kill-switch and memory; no LLM/tool I/O or external effects claim',
  cases:casesFrom(['capability','budget','max_risk','approval','kill','observe'],[[1,5,3,0,0,0],[1,2,3,1,0,0],[1,1,3,1,0,0],[2,5,3,1,0,0],[1,5,0,1,0,0],[1,5,3,1,1,0],[1,5,3,1,0,1],[1,0,0,0,0,0],[1,3,1,1,0,0],[1,100,100,1,0,0]]),
  mutations:[
    {id:'capability',good:'action_capability(action) != granted_capability',bad:'action_capability(action) == granted_capability',intent:'Reject an action whose required capability does not equal the granted capability; all other eligibility checks still apply.'},
    {id:'budget',good:'action_cost(action) > budget',bad:'action_cost(action) < budget',intent:'Reject actions whose cost exceeds the available budget; equal cost is permitted if all other checks pass.'},
    {id:'approval',good:'action_requires_approval(action) == 1 and human_approval == 0',bad:'action_requires_approval(action) == 1 and human_approval == 1',intent:'An action requiring human approval must be rejected while approval is absent and may be considered when approval is present.'},
  ]},'scripts/k400-genomes/agent.mjs');
