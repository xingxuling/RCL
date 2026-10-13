import {UI_PROFILE,UI_CASES,UI_EVENTS,UI_ENVIRONMENTS,uiVariant} from './k400-ui-definitions.mjs';
export const MOBILE_DIRECTORY='examples/universal-stress/mobile-native';
export const MOBILE_PROFILE={...UI_PROFILE,id:'native-counter',file:'scripts/k400-mobile-definitions.mjs',families:['mobile'],environments:UI_ENVIRONMENTS,
  sourcePath:UI_PROFILE.sourcePath,source:UI_PROFILE.source,cases:UI_CASES,events:UI_EVENTS,variant:uiVariant,
  scope:'Actual Android API35 x86_64 emulator native Views and real touch, activity recreation/process restart with target-owned RCL state/derived/render semantics through cooperative authenticated loopback transport; Android frontend with explicitly selected actual semantic backend; frozen integer counter scope, no WebView, physical-device/offline/durable-backend/full-mobile-platform/public-hosting claim'};
