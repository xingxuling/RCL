import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './k400-genomes/shared.mjs';
export const UI_DIRECTORY='examples/universal-stress/ui-native';
export const UI_SOURCE='examples/native-ui/governed-counter.rcl';
export const UI_ENVIRONMENTS=['windows','wasm-vm','linux','android','server','embedded-runtime','distributed-runtime','serverless','database','dataflow-runtime','simulation-runtime','automation-runtime','browser','rncs-runtime','realtime-runtime','game-runtime','scientific-runtime','ai-runtime','compiler-runtime'];
export const UI_EVENTS=[{nodeId:'IncrementButton',type:'activate',payload:{}},{nodeId:'IncrementButton',type:'activate',payload:{}},{nodeId:'ResetButton',type:'activate',payload:{}},{nodeId:'IncrementButton',type:'activate',payload:{}}];
export const UI_BASELINE={initial:0,step:1};
export const UI_CASES=[[0,1],[5,2],[-3,1],[0,-1],[100,0],[-7,-3],[23,4],[1,128],[1000,-8],[0,16]].map(([initial,step])=>({initial,step}));
export function uiVariant(source,{initial,step}){return source.replace(/state initial : Number = [-0-9.]+/u,'state initial : Number = '+initial).replace(/state count : Number = [-0-9.]+/u,'state count : Number = '+initial).replace(/state step : Number = [-0-9.]+/u,'state step : Number = '+step);}
export const UI_PROFILE={id:'governed-counter',file:'scripts/k400-ui-definitions.mjs',sourcePath:UI_SOURCE,source:()=>fs.readFileSync(path.join(ROOT,UI_SOURCE),'utf8'),families:['gui','web'],environments:UI_ENVIRONMENTS,baseline:UI_BASELINE,cases:UI_CASES,
  scope:'Actual target-backed browser GUI and loopback Web vertical slice; existing UI IR lowered into native RCL event/derived/render semantics, cooperative in-memory state and authenticated/stale-root transport; desktop/mobile-sized browser rendering, no native OS widget, mobile-family, public hosting or whole-UI-language claim',
  mutations:[
    {id:'increment-step',good:'set count <- count + step',bad:'set count <- count - step',intent:'The increment action adds the configured step to the current count, including negative and zero steps.'},
    {id:'derived-label',good:'"计数：" + count',bad:'"计数：" + step',intent:'The count label displays the current committed count after actions, rather than the configured step.'},
    {id:'reset-initial',good:'set count <- initial',bad:'set count <- step',intent:'Reset restores the configured initial count; it must not replace the count with the increment step.'},
  ]};
