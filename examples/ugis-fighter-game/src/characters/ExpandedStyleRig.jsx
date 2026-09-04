import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { EXPANDED_STYLE_VISUALS, sampleExpandedStylePose } from '../motion/expandedStyleAnimations.js';
import SwordTipTrail from './SwordTipTrail.jsx';

const applyRotation=(ref,rotation,blend)=>{ if(!ref.current||!rotation)return; ref.current.rotation.x=THREE.MathUtils.lerp(ref.current.rotation.x,rotation[0],blend); ref.current.rotation.y=THREE.MathUtils.lerp(ref.current.rotation.y,rotation[1],blend); ref.current.rotation.z=THREE.MathUtils.lerp(ref.current.rotation.z,rotation[2],blend); };

function Limb({length,radius,color}){ return <mesh position={[0,-length/2,0]} castShadow><cylinderGeometry args={[radius*.88,radius,length,9]}/><meshStandardMaterial color={color} roughness={.68}/></mesh>; }
function Hand({color}){ return <mesh position={[0,-.06,0]} castShadow><boxGeometry args={[.14,.16,.12]}/><meshStandardMaterial color={color} roughness={.7}/></mesh>; }
function Foot({color,long=false}){ return <mesh position={[0,-.055,.09]} castShadow><boxGeometry args={[.23,.12,long?.44:.39]}/><meshStandardMaterial color={color} roughness={.84}/></mesh>; }

function Weapon({profile,bladeMaterialRef,tipRef}){
  const longBlade=profile.bladeLength>1.8;
  return <group position={[0,-.10,.04]} rotation={[Math.PI/2,0,0]}>
    <mesh position={[0,-profile.handleLength*.42,0]} castShadow><cylinderGeometry args={[.042,.049,profile.handleLength,10]}/><meshStandardMaterial color="#241d18" roughness={.76}/></mesh>
    <mesh position={[0,.035,0]} castShadow><boxGeometry args={[profile.guardWidth,.052,.062]}/><meshStandardMaterial color={profile.palette[2]} metalness={.5} roughness={.32}/></mesh>
    <mesh position={[0,profile.bladeLength*.52,0]} castShadow><boxGeometry args={[profile.bladeWidth,profile.bladeLength,longBlade?.06:.05]}/><meshStandardMaterial ref={bladeMaterialRef} color="#eef5fb" emissive={profile.palette[3]} emissiveIntensity={.05} metalness={.74} roughness={.2}/></mesh>
    <group ref={tipRef} position={[0,profile.bladeLength+.10,0]}/>
  </group>;
}

export default function ExpandedStyleRig({logicRef,accent='#b7d7ff',styleId='epee'}){
  const profile=EXPANDED_STYLE_VISUALS[styleId]??EXPANDED_STYLE_VISUALS.epee;
  const visualRoot=useRef(); const swordTip=useRef(); const bladeMat=useRef(); const torsoMat=useRef(); const guardFx=useRef(); const elapsed=useRef(0);
  const refs={ pelvis:useRef(),spine:useRef(),chest:useRef(),head:useRef(),shoulderL:useRef(),upperArmL:useRef(),forearmL:useRef(),handL:useRef(),shoulderR:useRef(),upperArmR:useRef(),forearmR:useRef(),handR:useRef(),thighL:useRef(),shinL:useRef(),footL:useRef(),thighR:useRef(),shinR:useRef(),footR:useRef(),swordGrip:useRef() };
  const palette=useMemo(()=>({ cloth:profile.palette[0],cloth2:profile.palette[1],armor:profile.palette[2],accent:profile.palette[3]||accent,skin:'#d1baa6',hair:'#201b1a' }),[profile,accent]);
  const twoHand=profile.weaponMode.startsWith('two-hand'); const longWeapon=profile.bladeLength>1.8;

  useFrame((_,delta)=>{
    const logic=logicRef.current; if(!logic)return; elapsed.current+=delta; const pose=sampleExpandedStylePose({styleId,logic,elapsed:elapsed.current}); const blend=Math.min(1,delta*(logic.hitstun>0?24:18));
    for(const [bone,ref] of Object.entries(refs))applyRotation(ref,pose[bone],blend);
    if(visualRoot.current){ visualRoot.current.position.x=THREE.MathUtils.lerp(visualRoot.current.position.x,pose.bodyOffsetX||0,blend); visualRoot.current.position.y=THREE.MathUtils.lerp(visualRoot.current.position.y,pose.bodyOffsetY||0,blend); visualRoot.current.position.z=THREE.MathUtils.lerp(visualRoot.current.position.z,pose.bodyOffsetZ||0,blend); visualRoot.current.rotation.y=THREE.MathUtils.lerp(visualRoot.current.rotation.y,pose.visualYaw||0,blend); }
    if(guardFx.current)guardFx.current.visible=Boolean(pose.guardFx);
    if(torsoMat.current){ torsoMat.current.emissive.set(logic.flash>0?'#ffffff':palette.accent); torsoMat.current.emissiveIntensity=logic.flash>0?.72:.025; }
    if(bladeMat.current){ bladeMat.current.emissive.set(palette.accent); bladeMat.current.emissiveIntensity=.04+(pose.swordGlow||0); }
  });

  const chestWidth=twoHand?.74:.62; const shoulderWidth=twoHand?.45:.40;
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><ringGeometry args={[.43,.50,30]}/><meshBasicMaterial color={palette.accent} transparent opacity={.46} side={THREE.DoubleSide}/></mesh>
    <group ref={visualRoot}>
      <group ref={refs.pelvis} position={[0,1.12,0]}>
        <mesh castShadow><boxGeometry args={[twoHand?.60:.54,.28,twoHand?.40:.34]}/><meshStandardMaterial color={palette.cloth2} roughness={.74}/></mesh>
        <group ref={refs.spine} position={[0,.25,0]}>
          <mesh position={[0,.16,0]} castShadow><boxGeometry args={[twoHand?.58:.50,.40,twoHand?.37:.31]}/><meshStandardMaterial color={palette.cloth} roughness={.62}/></mesh>
          <group ref={refs.chest} position={[0,.36,0]}>
            <mesh castShadow><boxGeometry args={[chestWidth,.43,twoHand?.40:.34]}/><meshStandardMaterial ref={torsoMat} color={palette.armor} emissive={palette.accent} emissiveIntensity={.025} roughness={.48}/></mesh>
            <group ref={refs.head} position={[0,.52,0]}><mesh castShadow><sphereGeometry args={[.275,16,12]}/><meshStandardMaterial color={palette.skin} roughness={.72}/></mesh><mesh position={[0,.10,-.05]} castShadow><sphereGeometry args={[.282,14,10,0,Math.PI*2,0,Math.PI*.5]}/><meshStandardMaterial color={palette.hair} roughness={.82}/></mesh></group>
            <group ref={refs.shoulderL} position={[-shoulderWidth,.10,0]}><mesh castShadow><sphereGeometry args={[twoHand?.135:.12,10,8]}/><meshStandardMaterial color={palette.armor} roughness={.54}/></mesh><group ref={refs.upperArmL} position={[0,-.03,0]}><Limb length={.48} radius={twoHand?.102:.092} color={palette.cloth}/><group ref={refs.forearmL} position={[0,-.48,0]}><Limb length={.43} radius={twoHand?.088:.08} color={palette.skin}/><group ref={refs.handL} position={[0,-.43,0]}><Hand color={palette.skin}/></group></group></group></group>
            <group ref={refs.shoulderR} position={[shoulderWidth,.10,0]}><mesh castShadow><sphereGeometry args={[twoHand?.135:.12,10,8]}/><meshStandardMaterial color={palette.armor} roughness={.54}/></mesh><group ref={refs.upperArmR} position={[0,-.03,0]}><Limb length={.48} radius={twoHand?.102:.092} color={palette.cloth}/><group ref={refs.forearmR} position={[0,-.48,0]}><Limb length={.43} radius={twoHand?.088:.08} color={palette.skin}/><group ref={refs.handR} position={[0,-.43,0]}><Hand color={palette.skin}/><group ref={refs.swordGrip} position={[0,-.02,0]}><Weapon profile={profile} bladeMaterialRef={bladeMat} tipRef={swordTip}/></group></group></group></group></group>
          </group>
        </group>
        <group ref={refs.thighL} position={[-.19,-.12,0]}><Limb length={.53} radius={twoHand?.135:.122} color={palette.cloth2}/><group ref={refs.shinL} position={[0,-.53,0]}><Limb length={.50} radius={twoHand?.112:.102} color={palette.cloth2}/><group ref={refs.footL} position={[0,-.50,0]}><Foot color={palette.cloth2} long={longWeapon}/></group></group></group>
        <group ref={refs.thighR} position={[.19,-.12,0]}><Limb length={.53} radius={twoHand?.135:.122} color={palette.cloth2}/><group ref={refs.shinR} position={[0,-.53,0]}><Limb length={.50} radius={twoHand?.112:.102} color={palette.cloth2}/><group ref={refs.footR} position={[0,-.50,0]}><Foot color={palette.cloth2} long={longWeapon}/></group></group></group>
        {styleId==='destreza'&&<mesh position={[0,-.18,-.02]} rotation={[0,0,.12]} castShadow><boxGeometry args={[.64,.06,.38]}/><meshStandardMaterial color={palette.accent} roughness={.6}/></mesh>}
        {styleId==='miaodao'&&<mesh position={[0,-.24,-.02]} castShadow><boxGeometry args={[.66,.34,.40]}/><meshStandardMaterial color={palette.cloth} roughness={.74}/></mesh>}
      </group>
    </group>
    <mesh ref={guardFx} position={[0,1.38,.46]} visible={false}><circleGeometry args={[.74,30]}/><meshBasicMaterial color={palette.accent} transparent opacity={.12} side={THREE.DoubleSide} depthWrite={false}/></mesh>
    <SwordTipTrail tipRef={swordTip} logicRef={logicRef} styleId={styleId}/>
  </group>;
}
