import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Limb({ length, radius = 0.105, color }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <cylinderGeometry args={[radius * 0.92, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={0.66} />
    </mesh>
  );
}

function Sword({ bladeMaterialRef, side = 1 }) {
  return (
    <group position={[0, -0.51, 0.06]} rotation={[0.08, 0, side * -0.05]}>
      <mesh position={[0, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.052, 0.28, 10]} />
        <meshStandardMaterial color="#20242b" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0, 0.07]} castShadow>
        <boxGeometry args={[0.34, 0.055, 0.06]} />
        <meshStandardMaterial color="#b6bfca" metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.78]} castShadow>
        <boxGeometry args={[0.065, 0.055, 1.42]} />
        <meshStandardMaterial
          ref={bladeMaterialRef}
          color="#e7edf5"
          emissive="#58a6ff"
          emissiveIntensity={0.05}
          metalness={0.72}
          roughness={0.22}
        />
      </mesh>
    </group>
  );
}

function setRot(ref, x, y, z, blend = 1) {
  if (!ref.current) return;
  ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, x, blend);
  ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, y, blend);
  ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, z, blend);
}

export default function HumanoidFighter({ logicRef, rootRef, accent = '#4a91ff', enemy = false }) {
  const torsoRef = useRef();
  const torsoMatRef = useRef();
  const leftUpperArm = useRef();
  const leftLowerArm = useRef();
  const rightUpperArm = useRef();
  const rightLowerArm = useRef();
  const leftUpperLeg = useRef();
  const leftLowerLeg = useRef();
  const rightUpperLeg = useRef();
  const rightLowerLeg = useRef();
  const swordBladeMat = useRef();
  const guardFx = useRef();
  const elapsed = useRef(0);
  const clothColor = useMemo(() => new THREE.Color(accent).multiplyScalar(0.78).getStyle(), [accent]);

  useFrame((_, delta) => {
    const logic = logicRef.current;
    if (!logic) return;
    elapsed.current += delta;
    const action = logic.action;
    const defDuration = logic.actionDuration || 1;
    const p = Math.min(1, logic.actionTime / Math.max(0.001, defDuration));
    const swing = Math.sin(Math.PI * p);
    const blend = Math.min(1, delta * 12);
    const walk = Math.sin(elapsed.current * 9.2) * Math.min(1, logic.moveMagnitude || 0);

    let torsoY = enemy ? 0.08 : -0.08;
    let torsoZ = 0;
    let ruaX = -0.55;
    let ruaY = 0;
    let ruaZ = -0.16;
    let rlaX = -0.48;
    let rlaY = 0;
    let rlaZ = -0.08;
    let luaX = -0.18;
    let luaZ = 0.18;
    let llaX = -0.42;
    let llaZ = 0.08;

    if (logic.guard) {
      ruaX = -1.28; ruaZ = -0.52; rlaX = -0.88; rlaZ = 0.22;
      luaX = -1.12; luaZ = 0.5; llaX = -0.9; llaZ = -0.18;
      torsoZ = enemy ? 0.04 : -0.04;
    } else if (action === 'light1' || action === 'ai_thrust') {
      torsoY += (-0.42 + p * 0.72) * (enemy ? -1 : 1);
      ruaX = -0.88 + swing * 0.5; ruaZ = -0.85 + p * 1.55; rlaX = -0.32;
      luaX = -0.45; luaZ = 0.36;
    } else if (action === 'light2') {
      torsoY += (0.5 - p * 0.9) * (enemy ? -1 : 1);
      ruaX = -0.65; ruaZ = 0.78 - p * 1.55; rlaX = -0.55;
      luaZ = 0.42;
    } else if (action === 'light3' || action === 'skill_i') {
      torsoY += swing * 0.62 * (enemy ? -1 : 1);
      torsoZ = -0.08 * swing;
      ruaX = -1.02 + 0.3 * swing; ruaZ = -1.05 + p * 2.05; rlaX = -0.6;
      luaX = -0.72; luaZ = 0.48 - p * 0.55;
    } else if (action === 'heavy' || action === 'ai_heavy') {
      torsoY += (-0.35 + p * 0.68) * (enemy ? -1 : 1);
      ruaX = -2.35 + p * 2.05; ruaZ = -0.24; rlaX = -0.35;
      luaX = -1.1; luaZ = 0.42;
    } else if (action === 'skill_u') {
      torsoY += -0.28 * (enemy ? -1 : 1);
      ruaX = -0.65; ruaZ = -1.35 + p * 2.3; rlaX = -0.28;
      luaX = -0.95; luaZ = 0.35;
    } else if (action === 'skill_o') {
      torsoY += (-0.75 + p * 1.25) * (enemy ? -1 : 1);
      torsoZ = -0.16 * swing;
      ruaX = -2.15 + p * 2.1; ruaZ = -1.0 + p * 1.8; rlaX = -0.2;
      luaX = -1.5 + p * 0.9; luaZ = 0.58;
    } else if (action === 'dash') {
      torsoZ = enemy ? 0.17 : -0.17;
      ruaX = -0.78; luaX = 0.38;
    }

    if (logic.hitstun > 0) {
      torsoZ = enemy ? -0.16 : 0.16;
      torsoY += enemy ? -0.18 : 0.18;
      ruaX = -0.15; luaX = 0.2;
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.lerp(torsoRef.current.rotation.y, torsoY, blend);
      torsoRef.current.rotation.z = THREE.MathUtils.lerp(torsoRef.current.rotation.z, torsoZ, blend);
      torsoRef.current.position.y = THREE.MathUtils.lerp(
        torsoRef.current.position.y,
        logic.grounded ? 0 : -0.08 + 0.07 * Math.sin(p * Math.PI),
        blend,
      );
    }

    setRot(rightUpperArm, ruaX, ruaY, ruaZ, blend);
    setRot(rightLowerArm, rlaX, rlaY, rlaZ, blend);
    setRot(leftUpperArm, luaX, 0, luaZ, blend);
    setRot(leftLowerArm, llaX, 0, llaZ, blend);

    const legAmplitude = logic.grounded ? 0.55 * walk : 0;
    const jumpTuck = logic.grounded ? 0 : 0.5;
    setRot(leftUpperLeg, legAmplitude - jumpTuck, 0, 0.04, blend);
    setRot(rightUpperLeg, -legAmplitude - jumpTuck, 0, -0.04, blend);
    setRot(leftLowerLeg, Math.max(0, -legAmplitude) + jumpTuck * 0.7, 0, 0, blend);
    setRot(rightLowerLeg, Math.max(0, legAmplitude) + jumpTuck * 0.7, 0, 0, blend);

    if (guardFx.current) guardFx.current.visible = Boolean(logic.guard);
    if (torsoMatRef.current) {
      torsoMatRef.current.emissive.set(logic.flash > 0 ? '#ffffff' : accent);
      torsoMatRef.current.emissiveIntensity = logic.flash > 0 ? 0.72 : 0.035;
    }
    if (swordBladeMat.current) {
      const skill = Boolean(action && action.startsWith('skill_'));
      swordBladeMat.current.emissiveIntensity = skill ? 1.2 + 0.45 * swing : 0.05;
      swordBladeMat.current.emissive.set(skill ? (enemy ? '#ff9a52' : '#63c8ff') : '#58a6ff');
    }
  });

  return (
    <group ref={rootRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.44, 0.51, 28]} />
        <meshBasicMaterial color={enemy ? '#ff9b4a' : '#4a9cff'} transparent opacity={0.62} side={THREE.DoubleSide} />
      </mesh>

      <group ref={torsoRef}>
        <mesh position={[0, 1.36, 0]} castShadow>
          <boxGeometry args={[0.72, 0.88, 0.42]} />
          <meshStandardMaterial ref={torsoMatRef} color={accent} roughness={0.52} emissive={accent} emissiveIntensity={0.035} />
        </mesh>
        <mesh position={[0, 0.88, 0]} castShadow>
          <boxGeometry args={[0.58, 0.28, 0.38]} />
          <meshStandardMaterial color={clothColor} roughness={0.72} />
        </mesh>
        <mesh position={[0, 2.02, 0.02]} castShadow>
          <sphereGeometry args={[0.28, 18, 14]} />
          <meshStandardMaterial color="#d9c5b1" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.12, -0.06]} castShadow>
          <sphereGeometry args={[0.29, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          <meshStandardMaterial color={enemy ? '#4a2d22' : '#18283d'} roughness={0.8} />
        </mesh>

        <group ref={leftUpperArm} position={[-0.46, 1.69, 0]}>
          <Limb length={0.54} radius={0.105} color={clothColor} />
          <group ref={leftLowerArm} position={[0, -0.54, 0]}>
            <Limb length={0.5} radius={0.09} color="#c2ac99" />
          </group>
        </group>
        <group ref={rightUpperArm} position={[0.46, 1.69, 0]}>
          <Limb length={0.54} radius={0.105} color={clothColor} />
          <group ref={rightLowerArm} position={[0, -0.54, 0]}>
            <Limb length={0.5} radius={0.09} color="#c2ac99" />
            <Sword bladeMaterialRef={swordBladeMat} side={enemy ? -1 : 1} />
          </group>
        </group>

        <group ref={leftUpperLeg} position={[-0.19, 0.78, 0]}>
          <Limb length={0.62} radius={0.13} color="#252c38" />
          <group ref={leftLowerLeg} position={[0, -0.62, 0]}>
            <Limb length={0.58} radius={0.105} color="#191f29" />
            <mesh position={[0, -0.6, 0.08]} castShadow>
              <boxGeometry args={[0.22, 0.12, 0.4]} />
              <meshStandardMaterial color="#11161e" roughness={0.85} />
            </mesh>
          </group>
        </group>
        <group ref={rightUpperLeg} position={[0.19, 0.78, 0]}>
          <Limb length={0.62} radius={0.13} color="#252c38" />
          <group ref={rightLowerLeg} position={[0, -0.62, 0]}>
            <Limb length={0.58} radius={0.105} color="#191f29" />
            <mesh position={[0, -0.6, 0.08]} castShadow>
              <boxGeometry args={[0.22, 0.12, 0.4]} />
              <meshStandardMaterial color="#11161e" roughness={0.85} />
            </mesh>
          </group>
        </group>
      </group>

      <mesh ref={guardFx} position={[0, 1.25, 0.42]} visible={false}>
        <circleGeometry args={[0.72, 28]} />
        <meshBasicMaterial color={enemy ? '#ffb66c' : '#83c8ff'} transparent opacity={0.17} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
