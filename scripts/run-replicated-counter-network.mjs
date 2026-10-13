import {runReplicatedCounterNetwork} from '../src/replicated-counter-network.mjs';
import {createCrdtTarget} from './k400-crdt-targets.mjs';
const environment=process.argv[2]??'windows';
const result=await runReplicatedCounterNetwork({factory:()=>createCrdtTarget(environment)});
console.log(JSON.stringify({status:result.status,environment,transport:result.transport,
  initial:result.initialVectors,partition:result.partitionVectors,converged:result.convergedVectors,
  packetStatuses:result.packets.map(packet=>packet.httpStatus),sourceOwnsMerge:result.sourceOwnsMerge,multiHostClaimed:result.multiHostClaimed},null,2));
