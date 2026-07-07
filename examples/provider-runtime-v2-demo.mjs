import { runReality, createProviderRuntimeV2 } from '../src/index.mjs';

const source = `
reality ProviderRuntimeV2Bridge {
  facet machine.receipt : Text = "none"
  subject builder { warrant computer.invoke on console }
  host console { offers emit -> Text }
  emergence publish {
    cause builder
    when machine.receipt == "none"
    needs computer.invoke on console
    call console.emit("hello-from-rcl") -> machine.receipt
    preserve length(machine.receipt) > 0
    witness "provider-runtime-v2"
  }
  realize publish
}`;

const providerRuntime = createProviderRuntimeV2({
  policy: { subjects: { builder: ['console.emit@console', 'computer.invoke@console'] } },
  providers: [{
    id: 'console',
    version: '2.0.0-example',
    capabilities: [{ capability: 'emit', target: 'console', modes: ['realize', 'foresee'] }],
    async invoke(input) { return `receipt:${input.args[0]}`; },
    async simulate(input) { return `simulated:${input.args[0]}`; },
  }],
});

const result = await runReality(source, {
  hostAdapters: { console: providerRuntime.hostAdapter('console') },
});

console.log(JSON.stringify({
  state: result.state,
  history: result.history,
  providerReceipts: providerRuntime.getEventLog(),
}, null, 2));
