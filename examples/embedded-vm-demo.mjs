import { compileRealityToBytecode, EmbeddedNativeVm } from '../src/index.mjs';
const bytecode = compileRealityToBytecode('reality EmbeddedDemo {\nfacet world.ready : Truth = true\nfacet world.value : Number = 7\n}\n');
const vm = new EmbeddedNativeVm(bytecode);
const first = await vm.run({ resetState: true });
const repeated = [];
for (let i = 0; i < 5; i += 1) repeated.push(await vm.run());
await vm.close();
console.log(JSON.stringify({ first, repeated }, null, 2));
