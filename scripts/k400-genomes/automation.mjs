import { donorSource,inputFacets,edit,definition,casesFrom } from './shared.mjs';
const donor='examples/universal-stress/k336-compiler-automation.rcl';
const baseline={failures:1,attempts:2,approval:1,kill:0};
function source(){let text=inputFacets(donorSource(donor,'PortableWorkflow','k400-workflow-v1'),baseline);
  text=edit(text,'make_task(30, 1, 1, 2, 1, 1)','make_task(30, 1, input.failures, input.attempts, 1, 1)');
  return edit(text,'facet result.success : Sequence = run_workflow(workflow.success_tasks, 0, 0, 0, empty_sequence(), 1, 0)',
    'facet result.success : Sequence = run_workflow(workflow.success_tasks, 0, 0, 0, empty_sequence(), input.approval, input.kill)');}
function workflow(tasks,approval,kill){let attempts=0,completed=0;const audit=[];
  const rollback=()=>tasks.slice(0,completed).reduce((sum,task)=>sum+task[5],0);
  if(kill===1)return[-4,0,0,0,[-4],0];
  for(const[id,dependency,failures,max,needsApproval]of tasks){
    if(dependency>=completed)return[-3,attempts,completed,rollback(),[...audit,-id],0];
    if(needsApproval===1&&approval===0)return[-2,attempts,completed,rollback(),[...audit,-id],0];
    if(failures>=max)return[-1,attempts+max,completed,rollback(),[...audit,-id],0];
    attempts+=failures+1;completed++;audit.push(id);
  }return[1,attempts,completed,0,audit,1];}
function oracle(input){const tasks=[[10,-1,0,1,0,1],[20,0,1,2,0,1],[30,1,input.failures,input.attempts,1,1]];
  return{state:{'result.success':workflow(tasks,input.approval,input.kill),'result.retry_failure':workflow([[10,-1,0,1,0,1],[20,0,1,2,0,1],[30,1,2,2,1,1]],1,0),
    'result.unapproved':workflow(tasks,0,0),'result.kill_switch':workflow(tasks,1,1),'result.invalid_dependency':workflow([[10,0,0,1,0,1]],1,0),
    'result.dry_run':[2,0,3,0,[],0]},historyRules:[]};}
export default definition({id:'automation',donor,source,baseline,oracle,families:['automation'],
  scope:'bounded deterministic dependency/retry/approval/kill-switch/compensation workflow; no external action runner or actual tool-side rollback claim',
  cases:casesFrom(['failures','attempts','approval','kill'],[[0,1,1,0],[1,1,1,0],[2,2,1,0],[2,3,1,0],[3,4,1,0],[1,2,0,0],[1,2,1,1],[0,0,1,0],[4,5,0,0],[4,5,1,0]]),
  mutations:[
    {id:'dependency',good:'task_dependency(task) >= completed',bad:'task_dependency(task) > completed',intent:'A task dependency names a previously completed task index; reject a dependency at or beyond the number of completed tasks.'},
    {id:'retry',good:'task_failures_before_success(sequence_get(tasks, cursor)) < task_max_attempts(sequence_get(tasks, cursor))',bad:'task_failures_before_success(sequence_get(tasks, cursor)) <= task_max_attempts(sequence_get(tasks, cursor))',intent:'Success requires one additional attempt after all planned failures; reject when failures consume the entire attempt budget.'},
    {id:'approval',good:'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 0',bad:'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 1',intent:'Stop a workflow before an approval-required task if human approval is absent; approved tasks may proceed if dependencies and retries permit.'},
  ]},'scripts/k400-genomes/automation.mjs');
