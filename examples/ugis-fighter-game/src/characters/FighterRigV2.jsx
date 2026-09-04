import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { sampleFighterPose } from '../motion/motionRuntime.js';
import SwordTipTrail from './SwordTipTrail.jsx';

function applyRotation(ref, rotation, blend) {
  if (!ref.current || !rotation) return;
  ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, rotation[0], blend);
  ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, rotation[1], blend);
  ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, rotation[2], blend);
}

function Limb({ length, radius, color, roughness = 0.68 }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <cylinderGeometry args={[radius * 0.9, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function Hand({ color }) {
  return (
    <mesh position={[0, -0.06, 0]} castShadow>
      <boxGeometry args={[0.14, 0.16, 0.12]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function Foot({ kendo }) {
  return (
    <mesh position={[0, -0.055, 0.09]} castShadow>
      <boxGeometry args={[kendo ? 0.24 : 0.22, 0.12, kendo ? 0.42 : 0.39]} />
      <meshStandardMaterial color={kendo ? '#17130f' : '#101923'} roughness={0.84} />
    </mesh>
  );
}

function StyleSword({ bladeMaterialRef, tipRef, kendo }) {
  const handleLength = kendo ? 0.46 : 0.30;
  const bladeLength = kendo ? 1.58 : 1.48;
  const bladeWidth = kendo ? 0.068 : 0.058;
  return (
    <group position={[0, -0.10, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, -handleLength * 0.42, 0]} castShadow>
        <cylinderGeometry args={[kendo ? 0.043 : 0.045, kendo ? 0.047 : 0.05, handleLength, 10]} />
        <meshStandardMaterial color={kendo ? '#2b2019' : '#162436'} roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.035, 0]} castShadow>
        <boxGeometry args={[kendo ? 0.22 : 0.34, 0.05, 0.06]} />
        <meshStandardMaterial color={kendo ? '#8d6749' : '#aebfce'} metalness={0.52} roughness={0.3} />
      </mesh>
      <mesh position={[0, bladeLength * 0.52, 0]} castShadow>
        <boxGeometry args={[bladeWidth, bladeLength, kendo ? 0.055 : 0.048]} />
        <meshStandardMaterial
          ref={bladeMaterialRef}
          color={kendo ? '#e2d6c8' : '#edf7ff'}
          emissive={kendo ? '#ff9347' : '#5fc8ff'}
          emissiveIntensity={0.04}
          metalness={0.74}
          roughness={0.2}
        />
      </mesh>
      {!kendo && (
        <mesh position={[0, bladeLength + 0.05, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.05]} />
          <meshStandardMaterial color="#edf7ff" metalness={0.76} roughness={0.2} />
        </mesh>
      )}
      <group ref={tipRef} position={[0, bladeLength + 0.12, 0]} />
    </group>
  );
}

function WanFengAccessories({ elapsed }) {
  const a = useRef();
  const b = useRef();
  useFrame(() => {
    if (a.current) a.current.rotation.x = 0.18 + Math.sin(elapsed.current * 3.1) * 0.09;
    if (b.current) b.current.rotation.x = 0.30 + Math.sin(elapsed.current * 2.6 + 1.3) * 0.11;
  });
  return (
    <group position={[-0.25, -0.18, -0.08]}>
      <group ref={a} rotation={[0.18, 0.12, -0.12]}>
        <mesh position={[0, -0.33, 0]} castShadow>
          <boxGeometry args={[0.10, 0.66, 0.035]} />
          <meshStandardMaterial color="#62c8ff" emissive="#2b8bcb" emissiveIntensity={0.1} roughness={0.58} />
        </mesh>
      </group>
      <group ref={b} position={[0.16, 0, 0.03]} rotation={[0.30, -0.12, 0.10]}>
        <mesh position={[0, -0.27, 0]} castShadow>
          <boxGeometry args={[0.085, 0.54, 0.03]} />
          <meshStandardMaterial color="#dcefff" roughness={0.62} />
        </mesh>
      </group>
    </group>
  );
}

export default function FighterRigV2({ logicRef, accent = '#3b92ff', styleId = 'wanfeng' }) {
  const kendo = styleId === 'kendo';
  const visualRoot = useRef();
  const swordTip = useRef();
  const refs = {
    pelvis: useRef(), spine: useRef(), chest: useRef(), head: useRef(),
    shoulderL: useRef(), upperArmL: useRef(), forearmL: useRef(), handL: useRef(),
    shoulderR: useRef(), upperArmR: useRef(), forearmR: useRef(), handR: useRef(),
    thighL: useRef(), shinL: useRef(), footL: useRef(),
    thighR: useRef(), shinR: useRef(), footR: useRef(), swordGrip: useRef(),
  };
  const torsoMat = useRef();
  const bladeMat = useRef();
  const guardFx = useRef();
  const elapsed = useRef(0);

  const palette = useMemo(() => kendo
    ? { cloth:'#2b241e', cloth2:'#171412', armor:'#5a3927', accent:'#df7c36', skin:'#ccb39d', hair:'#2b1c17' }
    : { cloth:'#16345b', cloth2:'#0f223a', armor:'#2c72b8', accent, skin:'#d5c0ae', hair:'#17263c' },
  [accent, kendo]);

  useFrame((_, delta) => {
    const logic = logicRef.current;
    if (!logic) return;
    elapsed.current += delta;
    const pose = sampleFighterPose({ logic, elapsed: elapsed.current, enemy: kendo, styleId });
    const blend = Math.min(1, delta * (logic.hitstun > 0 ? 24 : 18));

    for (const [bone, ref] of Object.entries(refs)) applyRotation(ref, pose[bone], blend);
    if (visualRoot.current) {
      visualRoot.current.position.x = THREE.MathUtils.lerp(visualRoot.current.position.x, pose.bodyOffsetX || 0, blend);
      visualRoot.current.position.y = THREE.MathUtils.lerp(visualRoot.current.position.y, pose.bodyOffsetY || 0, blend);
      visualRoot.current.position.z = THREE.MathUtils.lerp(visualRoot.current.position.z, pose.bodyOffsetZ || 0, blend);
      visualRoot.current.rotation.y = THREE.MathUtils.lerp(visualRoot.current.rotation.y, pose.visualYaw || 0, blend);
    }
    if (guardFx.current) guardFx.current.visible = Boolean(pose.guardFx);
    if (torsoMat.current) {
      torsoMat.current.emissive.set(logic.flash > 0 ? '#ffffff' : palette.accent);
      torsoMat.current.emissiveIntensity = logic.flash > 0 ? 0.72 : 0.025;
    }
    if (bladeMat.current) {
      bladeMat.current.emissive.set(kendo ? '#ff8b43' : '#63c8ff');
      bladeMat.current.emissiveIntensity = 0.04 + (pose.swordGlow || 0) * (kendo ? 0.8 : 1.15);
    }
  });

  const chestWidth = kendo ? 0.78 : 0.68;
  const shoulderWidth = kendo ? 0.47 : 0.42;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.43, 0.50, 30]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      <group ref={visualRoot}>
        <group ref={refs.pelvis} position={[0, 1.12, 0]}>
          <mesh castShadow>
            <boxGeometry args={[kendo ? 0.62 : 0.56, 0.28, kendo ? 0.42 : 0.36]} />
            <meshStandardMaterial color={palette.cloth2} roughness={0.74} />
          </mesh>

          <group ref={refs.spine} position={[0, 0.25, 0]}>
            <mesh position={[0, 0.16, 0]} castShadow>
              <boxGeometry args={[kendo ? 0.60 : 0.52, 0.40, kendo ? 0.38 : 0.32]} />
              <meshStandardMaterial color={palette.cloth} roughness={0.62} />
            </mesh>

            <group ref={refs.chest} position={[0, 0.36, 0]}>
              <mesh castShadow>
                <boxGeometry args={[chestWidth, kendo ? 0.44 : 0.42, kendo ? 0.43 : 0.36]} />
                <meshStandardMaterial ref={torsoMat} color={palette.armor} emissive={palette.accent} emissiveIntensity={0.025} roughness={0.48} />
              </mesh>

              {kendo ? (
                <>
                  <mesh position={[-0.38,0.12,0]} rotation={[0,0,0.10]} castShadow><boxGeometry args={[0.18,0.18,0.48]} /><meshStandardMaterial color="#3b281e" roughness={0.7} /></mesh>
                  <mesh position={[0.38,0.12,0]} rotation={[0,0,-0.10]} castShadow><boxGeometry args={[0.18,0.18,0.48]} /><meshStandardMaterial color="#3b281e" roughness={0.7} /></mesh>
                </>
              ) : (
                <mesh position={[0.19,0.09,0.20]} rotation={[0,0,-0.28]} castShadow><boxGeometry args={[0.22,0.12,0.08]} /><meshStandardMaterial color="#d8eeff" roughness={0.5} /></mesh>
              )}

              <group ref={refs.head} position={[0,0.52,0]}>
                <mesh castShadow><sphereGeometry args={[kendo ? 0.285 : 0.27,16,12]} /><meshStandardMaterial color={palette.skin} roughness={0.72} /></mesh>
                <mesh position={[0,0.10,-0.05]} castShadow><sphereGeometry args={[kendo ? 0.292 : 0.278,14,10,0,Math.PI*2,0,Math.PI*0.5]} /><meshStandardMaterial color={palette.hair} roughness={0.82} /></mesh>
              </group>

              <group ref={refs.shoulderL} position={[-shoulderWidth,0.10,0]}>
                <mesh castShadow><sphereGeometry args={[kendo ? 0.14 : 0.12,10,8]} /><meshStandardMaterial color={palette.armor} roughness={0.54} /></mesh>
                <group ref={refs.upperArmL} position={[0,-0.03,0]}>
                  <Limb length={0.48} radius={kendo ? 0.105 : 0.095} color={palette.cloth} />
                  <group ref={refs.forearmL} position={[0,-0.48,0]}>
                    <Limb length={0.43} radius={kendo ? 0.09 : 0.082} color={palette.skin} />
                    <group ref={refs.handL} position={[0,-0.43,0]}><Hand color={palette.skin} /></group>
                  </group>
                </group>
              </group>

              <group ref={refs.shoulderR} position={[shoulderWidth,0.10,0]}>
                <mesh castShadow><sphereGeometry args={[kendo ? 0.14 : 0.12,10,8]} /><meshStandardMaterial color={palette.armor} roughness={0.54} /></mesh>
                <group ref={refs.upperArmR} position={[0,-0.03,0]}>
                  <Limb length={0.48} radius={kendo ? 0.105 : 0.095} color={palette.cloth} />
                  <group ref={refs.forearmR} position={[0,-0.48,0]}>
                    <Limb length={0.43} radius={kendo ? 0.09 : 0.082} color={palette.skin} />
                    <group ref={refs.handR} position={[0,-0.43,0]}>
                      <Hand color={palette.skin} />
                      <group ref={refs.swordGrip} position={[0,-0.02,0]}>
                        <StyleSword bladeMaterialRef={bladeMat} tipRef={swordTip} kendo={kendo} />
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>

          <group ref={refs.thighL} position={[-0.19,-0.12,0]}>
            <Limb length={0.53} radius={kendo ? 0.14 : 0.125} color={kendo ? '#24201c' : '#17253a'} />
            <group ref={refs.shinL} position={[0,-0.53,0]}><Limb length={0.50} radius={kendo ? 0.115 : 0.105} color={kendo ? '#171512' : '#101a29'} /><group ref={refs.footL} position={[0,-0.50,0]}><Foot kendo={kendo} /></group></group>
          </group>
          <group ref={refs.thighR} position={[0.19,-0.12,0]}>
            <Limb length={0.53} radius={kendo ? 0.14 : 0.125} color={kendo ? '#24201c' : '#17253a'} />
            <group ref={refs.shinR} position={[0,-0.53,0]}><Limb length={0.50} radius={kendo ? 0.115 : 0.105} color={kendo ? '#171512' : '#101a29'} /><group ref={refs.footR} position={[0,-0.50,0]}><Foot kendo={kendo} /></group></group>
          </group>

          {!kendo && <WanFengAccessories elapsed={elapsed} />}
          {kendo && <mesh position={[0,-0.23,-0.02]} castShadow><boxGeometry args={[0.68,0.34,0.42]} /><meshStandardMaterial color="#1d1916" roughness={0.76} /></mesh>}
        </group>
      </group>

      <mesh ref={guardFx} position={[0,1.38,0.46]} visible={false}>
        <circleGeometry args={[0.74,30]} />
        <meshBasicMaterial color={kendo ? '#ffb56d' : '#7bcaff'} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <SwordTipTrail tipRef={swordTip} logicRef={logicRef} styleId={styleId} />
    </group>
  );
}
