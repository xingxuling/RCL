import { ATTACKS } from '../gameRules.js';

const D = Math.PI / 180;
const r = (x=0,y=0,z=0) => [x*D,y*D,z*D];
const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (a,b,t) => a + (b-a)*t;
const ease = t => { const x=clamp01(t); return x*x*(3-2*x); };

const BONES = Object.freeze([
  'pelvis','spine','chest','head','shoulderL','upperArmL','forearmL','handL',
  'shoulderR','upperArmR','forearmR','handR','thighL','shinL','footL','thighR','shinR','footR','swordGrip',
]);

const STYLE_ATTACK_IDS = Object.freeze({
  epee:['epee_light1','epee_light2','epee_light3','epee_heavy','epee_skill_u','epee_skill_i','epee_skill_o'],
  destreza:['destreza_light1','destreza_light2','destreza_light3','destreza_heavy','destreza_skill_u','destreza_skill_i','destreza_skill_o'],
  liechtenauer:['liech_light1','liech_light2','liech_light3','liech_heavy','liech_skill_u','liech_skill_i','liech_skill_o'],
  fiore:['fiore_light1','fiore_light2','fiore_light3','fiore_heavy','fiore_skill_u','fiore_skill_i','fiore_skill_o'],
  miaodao:['miaodao_light1','miaodao_light2','miaodao_light3','miaodao_heavy','miaodao_skill_u','miaodao_skill_i','miaodao_skill_o'],
});

export const EXPANDED_STYLE_VISUALS = Object.freeze({
  epee:Object.freeze({ weaponMode:'one-hand-thrust', actionFamily:'epee-linear', palette:['#27364d','#162236','#7494b8','#b7d7ff'], bladeLength:1.72, handleLength:.24, bladeWidth:.035, guardWidth:.42 }),
  destreza:Object.freeze({ weaponMode:'one-hand-circle', actionFamily:'destreza-angle', palette:['#342b49','#1d1730','#735c9c','#d7b6ff'], bladeLength:1.62, handleLength:.28, bladeWidth:.038, guardWidth:.48 }),
  liechtenauer:Object.freeze({ weaponMode:'two-hand-longsword', actionFamily:'longsword-winding', palette:['#293526','#182219','#5e7c50','#b9d88a'], bladeLength:1.72, handleLength:.52, bladeWidth:.065, guardWidth:.46 }),
  fiore:Object.freeze({ weaponMode:'two-hand-guard-switch', actionFamily:'fiore-guards', palette:['#403326','#251d16','#876944','#e8c07d'], bladeLength:1.68, handleLength:.50, bladeWidth:.067, guardWidth:.44 }),
  miaodao:Object.freeze({ weaponMode:'two-hand-longblade', actionFamily:'miaodao-long-arc', palette:['#39351d','#211f10','#8c812b','#f4d95d'], bladeLength:1.96, handleLength:.56, bladeWidth:.072, guardWidth:.28 }),
});

const basePose = styleId => {
  const common = {
    pelvis:r(), spine:r(-2), chest:r(-3), head:r(),
    shoulderL:r(-4,0,4), upperArmL:r(-42,0,14), forearmL:r(-64,0,-6), handL:r(),
    shoulderR:r(-4,0,-4), upperArmR:r(-48,0,-16), forearmR:r(-60,0,7), handR:r(),
    thighL:r(-3,0,2), shinL:r(6), footL:r(-2), thighR:r(3,0,-2), shinR:r(6), footR:r(-2),
    swordGrip:r(), bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0, visualYaw:0, swordGlow:0, guardFx:false,
    weaponMode:EXPANDED_STYLE_VISUALS[styleId].weaponMode, actionFamily:EXPANDED_STYLE_VISUALS[styleId].actionFamily,
  };
  if (styleId==='epee') return { ...common, visualYaw:-.28, pelvis:r(0,-10,0), chest:r(-4,-12,1), upperArmR:r(-72,-8,-8), forearmR:r(-54,0,4), upperArmL:r(-18,10,28), forearmL:r(-42,0,-8), thighL:r(-9), thighR:r(8) };
  if (styleId==='destreza') return { ...common, visualYaw:.22, pelvis:r(0,12,1), chest:r(-2,18,2), upperArmR:r(-66,8,-18), forearmR:r(-56,0,10), upperArmL:r(-20,-10,28), forearmL:r(-40,0,-6) };
  if (styleId==='liechtenauer') return { ...common, pelvis:r(0,5,0), chest:r(-4,6,0), upperArmR:r(-78,4,-20), forearmR:r(-72,0,10), upperArmL:r(-72,-4,20), forearmL:r(-74,0,-10) };
  if (styleId==='fiore') return { ...common, bodyOffsetY:-.035, visualYaw:-.10, pelvis:r(5,-6,0), chest:r(-8,-8,0), upperArmR:r(-70,-6,-26), forearmR:r(-70,0,12), upperArmL:r(-64,8,26), forearmL:r(-72,0,-12), thighL:r(-8), shinL:r(12), thighR:r(8), shinR:r(10) };
  return { ...common, visualYaw:.08, pelvis:r(2,4,0), chest:r(-5,6,0), upperArmR:r(-84,4,-20), forearmR:r(-76,0,8), upperArmL:r(-78,-4,20), forearmL:r(-78,0,-8), thighL:r(-6), thighR:r(6) };
};

function clonePose(pose){
  const out={};
  for(const bone of BONES) out[bone]=[...(pose[bone]??[0,0,0])];
  for(const key of ['bodyOffsetX','bodyOffsetY','bodyOffsetZ','visualYaw','swordGlow']) out[key]=pose[key]??0;
  out.guardFx=Boolean(pose.guardFx); out.weaponMode=pose.weaponMode; out.actionFamily=pose.actionFamily; return out;
}
function patch(base, extra){ const out=clonePose(base); for(const bone of BONES) if(extra[bone]) out[bone]=[...extra[bone]]; for(const k of ['bodyOffsetX','bodyOffsetY','bodyOffsetZ','visualYaw','swordGlow']) if(typeof extra[k]==='number') out[k]=extra[k]; if(typeof extra.guardFx==='boolean') out.guardFx=extra.guardFx; return out; }
function interpolate(a,b,t){ const k=ease(t),out={}; for(const bone of BONES) out[bone]=[0,1,2].map(i=>lerp(a[bone]?.[i]??0,b[bone]?.[i]??0,k)); for(const key of ['bodyOffsetX','bodyOffsetY','bodyOffsetZ','visualYaw','swordGlow']) out[key]=lerp(a[key]??0,b[key]??0,k); out.guardFx=k<.5?a.guardFx:b.guardFx; out.weaponMode=a.weaponMode; out.actionFamily=a.actionFamily; return out; }

function slotIndex(actionId){ if(actionId.includes('light1'))return 0; if(actionId.includes('light2'))return 1; if(actionId.includes('light3'))return 2; if(actionId.includes('heavy'))return 3; if(actionId.includes('skill_u'))return 4; if(actionId.includes('skill_i'))return 5; return 6; }
const powerFor = i => [1,.95,1.12,1.28,1.08,1.22,1.48][i];
const sideFor = i => [1,-1,1,-1,1,-1,1][i];

function epeeFrames(id){
  const i=slotIndex(id), p=powerFor(i), side=sideFor(i), lunge=i===3||i===5||i===6;
  return [
    {t:0,pose:{}},
    {t:.22,pose:{ visualYaw:-.36, bodyOffsetZ:-.04, pelvis:r(4,-16,0), chest:r(-8,-20,0), upperArmR:r(-82,-8,-6), forearmR:r(-72,0,3), upperArmL:r(-8,18*side,36), forearmL:r(-34,0,-8), thighL:r(-12), thighR:r(11) }},
    {t:.44,pose:{ visualYaw:-.30, bodyOffsetZ:(lunge?.24:.14)*p, bodyOffsetY:lunge?-.05:-.02, pelvis:r(-8,-10,0), chest:r(10,-8,0), upperArmR:r(-92,0,0), forearmR:r(-4,0,0), handR:r(0,0,0), upperArmL:r(12,24*side,42), forearmL:r(-20,0,-4), thighL:r(34*p), shinL:r(16), thighR:r(-18*p), swordGrip:r(4,0,0), swordGlow:.75 }},
    {t:.70,pose:{ visualYaw:-.34, bodyOffsetZ:.08, upperArmR:r(-82,-4,-2), forearmR:r(-26,0,2), thighL:r(12), thighR:r(-7) }},
    {t:1,pose:{}},
  ];
}
function destrezaFrames(id){
  const i=slotIndex(id), p=powerFor(i), side=sideFor(i), wide=i>=4;
  return [
    {t:0,pose:{}},
    {t:.20,pose:{ visualYaw:.34*side, bodyOffsetX:.10*side, pelvis:r(2,24*side,2), chest:r(-4,34*side,4), upperArmR:r(-72,18*side,-28*side), forearmR:r(-58,0,12*side), upperArmL:r(-18,-18*side,30), thighL:r(-10,0,3), thighR:r(9,0,-3) }},
    {t:.45,pose:{ visualYaw:-.48*side, bodyOffsetX:-.15*side*p, bodyOffsetZ:.10*p, pelvis:r(-6,-32*side,-3), chest:r(8,-52*side,-6), upperArmR:r(-86,-20*side,30*side), forearmR:r(-12,0,-6*side), upperArmL:r(-12,24*side,34), thighL:r(22*p,0,3), thighR:r(-14*p,0,-3), swordGrip:r(2,-8*side,0), swordGlow:.8 }},
    {t:.70,pose:{ visualYaw:(wide?.36:.20)*side, bodyOffsetX:.07*side, chest:r(2,24*side,3), upperArmR:r(-70,10*side,-22*side), forearmR:r(-34,0,8*side) }},
    {t:1,pose:{}},
  ];
}
function liechFrames(id){
  const i=slotIndex(id), p=powerFor(i), side=sideFor(i);
  return [
    {t:0,pose:{}},
    {t:.24,pose:{ visualYaw:.12*side, bodyOffsetY:-.03, pelvis:r(7,8*side,0), chest:r(-12,14*side,0), upperArmR:r(-126,8*side,-28*side), forearmR:r(-70,0,8*side), upperArmL:r(-116,-8*side,30*side), forearmL:r(-74,0,-8*side), swordGrip:r(-6,4*side,0) }},
    {t:.48,pose:{ visualYaw:-.16*side, bodyOffsetZ:.13*p, pelvis:r(-10,-14*side,0), chest:r(16,-22*side,0), upperArmR:r(-54,-12*side,38*side), forearmR:r(-16,0,-6*side), upperArmL:r(-58,12*side,-36*side), forearmL:r(-22,0,6*side), thighL:r(26*p), shinL:r(13), thighR:r(-16*p), swordGlow:.8 }},
    {t:.72,pose:{ visualYaw:.08*side, bodyOffsetZ:.05, chest:r(4,8*side,0), upperArmR:r(-72,6*side,18*side), forearmR:r(-38,0,-4*side), upperArmL:r(-70,-6*side,-18*side), forearmL:r(-40,0,4*side) }},
    {t:1,pose:{}},
  ];
}
function fioreFrames(id){
  const i=slotIndex(id), p=powerFor(i), side=sideFor(i), low=i===0||i===4;
  return [
    {t:0,pose:{}},
    {t:.24,pose:{ visualYaw:-.18*side, bodyOffsetY:low?-.10:-.06, bodyOffsetX:-.05*side, pelvis:r(12,-12*side,-3), chest:r(-16,-18*side,-3), upperArmR:r(low?-52:-112,-10*side,-34*side), forearmR:r(-76,0,12*side), upperArmL:r(low?-44:-104,10*side,32*side), forearmL:r(-78,0,-12*side), thighL:r(-16,0,4), shinL:r(22), thighR:r(12,0,-4) }},
    {t:.50,pose:{ visualYaw:.22*side, bodyOffsetY:-.04, bodyOffsetZ:.12*p, bodyOffsetX:.06*side, pelvis:r(-12,18*side,3), chest:r(18,28*side,4), upperArmR:r(-56,14*side,38*side), forearmR:r(-18,0,-8*side), upperArmL:r(-60,-14*side,-36*side), forearmL:r(-24,0,8*side), thighL:r(24*p,0,3), shinL:r(15), thighR:r(-15*p,0,-3), swordGlow:.82 }},
    {t:.74,pose:{ visualYaw:-.08*side, bodyOffsetY:-.03, chest:r(5,-8*side,0), upperArmR:r(-74,-4*side,-14*side), forearmR:r(-42,0,6*side), upperArmL:r(-72,4*side,14*side), forearmL:r(-44,0,-6*side) }},
    {t:1,pose:{}},
  ];
}
function miaodaoFrames(id){
  const i=slotIndex(id), p=powerFor(i), side=sideFor(i), huge=i===3||i===6;
  return [
    {t:0,pose:{}},
    {t:.26,pose:{ visualYaw:-.30*side, bodyOffsetY:-.07, bodyOffsetX:-.07*side, pelvis:r(10,-20*side,-4), chest:r(-18,-34*side,-6), upperArmR:r(-142,-10*side,-46*side), forearmR:r(-76,0,-8*side), upperArmL:r(-132,10*side,46*side), forearmL:r(-80,0,8*side), thighL:r(-20,0,5), thighR:r(14,0,-5) }},
    {t:.52,pose:{ visualYaw:.42*side, bodyOffsetZ:(huge?.22:.16)*p, bodyOffsetX:.10*side, pelvis:r(-16,30*side,6), chest:r(24,50*side,9), upperArmR:r(-42,18*side,58*side), forearmR:r(-12,0,-8*side), upperArmL:r(-48,-18*side,-54*side), forearmL:r(-18,0,8*side), thighL:r(30*p,0,4), shinL:r(18), thighR:r(-20*p,0,-4), swordGlow:.88 }},
    {t:.76,pose:{ visualYaw:.18*side, bodyOffsetZ:.07, chest:r(8,22*side,4), upperArmR:r(-62,8*side,32*side), forearmR:r(-32,0,-6*side), upperArmL:r(-64,-8*side,-30*side), forearmL:r(-36,0,6*side) }},
    {t:1,pose:{}},
  ];
}

const BUILDERS={ epee:epeeFrames, destreza:destrezaFrames, liechtenauer:liechFrames, fiore:fioreFrames, miaodao:miaodaoFrames };
const clip=(styleId,id)=>Object.freeze({ id, styleId, source:'taowind-authored-v0.4', weaponMode:EXPANDED_STYLE_VISUALS[styleId].weaponMode, actionFamily:EXPANDED_STYLE_VISUALS[styleId].actionFamily, active:Object.freeze([ATTACKS[id].activeStart/ATTACKS[id].duration,ATTACKS[id].activeEnd/ATTACKS[id].duration]), keyframes:Object.freeze(BUILDERS[styleId](id)) });

export const EXPANDED_AUTHORED_ACTIONS = Object.freeze(Object.fromEntries(
  Object.entries(STYLE_ATTACK_IDS).flatMap(([styleId,ids])=>ids.map(id=>[id,clip(styleId,id)])),
));

const guardPatch = styleId => {
  if(styleId==='epee') return { visualYaw:-.34, upperArmR:r(-76,-6,-8), forearmR:r(-58,0,4), upperArmL:r(-10,18,34), forearmL:r(-38), swordGrip:r(3), guardFx:true };
  if(styleId==='destreza') return { visualYaw:.28, bodyOffsetX:.04, chest:r(-3,24,3), upperArmR:r(-68,12,-22), forearmR:r(-58,0,10), upperArmL:r(-16,-18,30), guardFx:true };
  if(styleId==='liechtenauer') return { visualYaw:.08, upperArmR:r(-88,4,-28), forearmR:r(-76,0,12), upperArmL:r(-82,-4,30), forearmL:r(-78,0,-12), swordGrip:r(-4), guardFx:true };
  if(styleId==='fiore') return { visualYaw:-.14, bodyOffsetY:-.06, pelvis:r(8,-8,-2), chest:r(-10,-12,-2), upperArmR:r(-62,-8,-30), forearmR:r(-76,0,14), upperArmL:r(-56,8,30), forearmL:r(-78,0,-14), guardFx:true };
  return { visualYaw:.08, bodyOffsetY:-.04, upperArmR:r(-94,4,-24), forearmR:r(-82,0,10), upperArmL:r(-88,-4,24), forearmL:r(-84,0,-10), guardFx:true };
};

function sampleFrames(styleId, clipDef, normalized){
  const base=basePose(styleId); if(!clipDef)return base; const t=clamp01(normalized); let a=clipDef.keyframes[0],b=clipDef.keyframes.at(-1); for(let i=0;i<clipDef.keyframes.length-1;i++){ if(t>=clipDef.keyframes[i].t&&t<=clipDef.keyframes[i+1].t){a=clipDef.keyframes[i];b=clipDef.keyframes[i+1];break;} } const span=Math.max(.0001,b.t-a.t); const out=interpolate(patch(base,a.pose),patch(base,b.pose),(t-a.t)/span); out.weaponMode=clipDef.weaponMode; out.actionFamily=clipDef.actionFamily; const [activeA,activeB]=clipDef.active; out.swordGlow=t>=activeA&&t<=activeB?1:.08; return out;
}

export function sampleExpandedStylePose({ styleId, logic, elapsed=0 }){
  const base=basePose(styleId);
  if(logic.guard) return patch(base,{...guardPatch(styleId),swordGlow:.15});
  if(logic.hitstun>0) return patch(base,{ bodyOffsetY:-.04, visualYaw:.12, chest:r(10,18,-5), head:r(8,12,-4), upperArmR:r(-20,10,24), upperArmL:r(-16,-8,-20) });
  if(logic.action==='dash') return patch(base,{ bodyOffsetY:-.04, bodyOffsetZ:.08, chest:r(-10), thighL:r(22), thighR:r(-18), swordGlow:.18 });
  const clipDef=logic.action?EXPANDED_AUTHORED_ACTIONS[logic.action]:null;
  if(clipDef) return sampleFrames(styleId,clipDef,logic.actionTime/Math.max(.001,logic.actionDuration||1));
  const breath=Math.sin(elapsed*(styleId==='miaodao'?1.5:1.9)); base.chest[0]+=breath*.008; base.bodyOffsetY+=Math.abs(breath)*-.008; return base;
}

export { STYLE_ATTACK_IDS };
