import fs from 'node:fs';
import {createNativeUiWebBridge} from '../../src/ui/native-web-bridge.mjs';
import {createPortableNativeTarget} from '../../src/portable-native-vm.mjs';
const environment=process.argv[2]??'windows';
if(!['windows','wasm-vm','linux','android'].includes(environment))throw new Error('UI_DEMO_TARGET_UNKNOWN');
const source=fs.readFileSync(new URL('./governed-counter.rcl',import.meta.url),'utf8');
const bridge=await createNativeUiWebBridge(source,{factory:()=>createPortableNativeTarget(environment)});
console.log(JSON.stringify({url:bridge.url,environment,uiRoot:bridge.runtime.ui.semanticRoot,scope:'Loopback browser UI; native target owns event/state/render projection; cooperative in-memory state'}));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await bridge.dispose();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
