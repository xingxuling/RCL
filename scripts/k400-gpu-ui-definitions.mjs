import {UI_PROFILE as BASE,UI_EVENTS,uiVariant} from './k400-ui-definitions.mjs';
export {UI_EVENTS,uiVariant};
export const UI_DIRECTORY='examples/universal-stress/gpu-ui';
export const UI_PROFILE={...BASE,id:'gpu-text-counter',file:'scripts/k400-gpu-ui-definitions.mjs',environments:['gpu'],scope:'Actual Chromium GUI and authenticated loopback Web vertical slice backed by the separate AMD FP64 OpenCL RBC Text interpreter. GPU owns event state, predicates, warrants, transactions, dynamic text and derived render values; host hashes device values and transports projections. Frozen integer counter, cooperative in-memory state; no CPU execution fallback, native OS widget, public hosting or whole-UI-language claim.'};
