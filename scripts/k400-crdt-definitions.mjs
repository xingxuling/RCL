import fs from 'node:fs';
import path from 'node:path';
import {ROOT,casesFrom} from './k400-genomes/shared.mjs';
export const CRDT_DIRECTORY='examples/universal-stress/crdt';
export const CRDT_ENVIRONMENTS=['windows','wasm-vm','linux','android','server','embedded-runtime','distributed-runtime','serverless','database','dataflow-runtime','simulation-runtime','automation-runtime','browser','gpu','rncs-runtime'];
export const CRDT_BASELINE={a:3,a_later:5,b:4,c:7,repeats:2,partition:2,reverse:false,heal:true,allowed:true,poison:true};
const valid=value=>Number.isSafeInteger(value)&&value>=0,safe=value=>valid(value)?value:0;

// Independent vector-clock join: message delivery accumulates a set of
// observed snapshots and joins each coordinate across that set.
export function crdtOracle(input){
  const initial=[[safe(safe(input.a)+safe(input.a_later)),0,0],[0,safe(input.b),0],[0,0,safe(input.c)]];
  const stale=[safe(input.a),0,0],messages=input.reverse?[[2,initial[2]],[1,initial[1]],[0,initial[0]],[0,stale]]:
    [[0,initial[0]],[1,initial[1]],[2,initial[2]],[0,stale]];
  if(input.poison)messages.push([99,[1000,1000,1000]]);
  const repetitions=valid(input.repeats)&&input.repeats<=4?input.repeats:0;
  const join=(value,at,width)=>{const observed=[value];if(repetitions)for(const[sender,payload]of messages){
    if(valid(sender)&&sender<3&&(sender===at||sender<width&&at<width))observed.push(payload);}
    return [0,1,2].map(index=>Math.max(...observed.map(item=>item[index])));};
  const partition=initial.map((value,index)=>join(value,index,input.partition)),planned=partition.map((value,index)=>input.heal?join(value,index,3):value);
  const requestValid=[input.a,input.a_later,input.b,input.c,input.a+input.a_later,input.repeats].every(valid)
    &&input.repeats<=4&&valid(input.partition)&&input.partition>=1&&input.partition<=3;
  const packet=input.packet_mode??false,current=[input.current_a??0,input.current_b??0,input.current_c??0],incoming=[input.incoming_a??0,input.incoming_b??0,input.incoming_c??0];
  const receiver=input.receiver??0,sender=input.sender??1,packetValid=valid(receiver)&&receiver<3&&valid(sender)&&sender<3&&[...current,...incoming].every(valid);
  const commit=requestValid&&input.allowed&&!packet,accept=packet&&packetValid&&input.allowed;
  return{state:{'local.a':initial[0],'local.stale_a':stale,'local.b':initial[1],'local.c':initial[2],'network.messages':messages,
    'partition.a':partition[0],'partition.b':partition[1],'partition.c':partition[2],
    'planned.a':planned[0],'planned.b':planned[1],'planned.c':planned[2],
    'law.idempotent':true,'law.commutative':true,'law.associative':true,
    'replicas.snapshot':commit?planned:initial,'replicas.committed':commit,'request.valid':requestValid,
    'packet.current':current,'packet.incoming':incoming,'packet.valid':packetValid,
    'packet.result':accept?current.map((value,index)=>Math.max(value,incoming[index])):current,'packet.accepted':accept},
    historyRules:commit?['commit_replicas']:accept?['receive_packet']:[]};
}
export const CRDT_PROFILE={id:'replicated-counter',file:'scripts/k400-crdt-definitions.mjs',sourcePath:'examples/distributed/replicated-counter.rcl',
  source:()=>fs.readFileSync(path.join(ROOT,'examples/distributed/replicated-counter.rcl'),'utf8'),families:['distributed'],environments:CRDT_ENVIRONMENTS,
  baseline:CRDT_BASELINE,oracle:crdtOracle,
  scope:'RCL-owned bounded three-replica grow-counter join with safe-integer components, stale/reordered/duplicate delivery, partitions/healing, invalid sender rejection and source-owned monotone commit; actual HTTP packet replay with isolated target instances; no cryptographic member identity, cross-host deployment or arbitrary distributed-system claim',
  cases:casesFrom(['a','a_later','b','c','repeats','partition','reverse','heal','allowed','poison'],[
    [0,0,0,0,1,3,false,true,true,false],[4,2,6,9,3,1,true,true,true,true],
    [8,1,3,5,2,2,false,false,true,true],[2,4,6,8,0,3,true,true,true,true],
    [10,20,30,40,4,3,true,true,true,true],[3,5,4,7,2,2,false,true,false,true],
    [-1,2,3,4,2,2,true,true,true,true],[1.5,2,3,4,1,3,false,true,true,false],
    [2,3,4,5,5,3,true,true,true,true],[1000000,7,11,13,1,1,true,false,true,false],
  ]),mutations:[
    {id:'join-maximum',good:'left > right, left, right',bad:'left < right, left, right',intent:'Join grow-counter snapshots by the maximum of each component, so duplicates and stale delivery never decrease a component and do not count increments twice.'},
    {id:'replica-membership',good:'sender < 3',bad:'sender <= 99',intent:'Only replica identifiers zero, one and two belong to this group; reject every other sender before merging its counter components.'},
    {id:'merge-warrant',good:'warrant replica.merge on replicas',bad:'warrant replica.inspect on replicas',intent:'The commit_replicas transition requires the replicator subject to hold replica.merge on replicas; retain the conditional current-input admission boundary.'},
  ]};
