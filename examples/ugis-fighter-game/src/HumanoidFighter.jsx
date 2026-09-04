import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import FighterRig from './characters/FighterRig.jsx';
import { ATTACKS } from './gameRules.js';

function SwordPathCue({ logicRef, styleId }) {
  const group = useRef();
  const material = useRef();

  useFrame(() => {
    const logic = logicRef.current;
    const attack = logic?.action ? ATTACKS[logic.action] : null;
    if (!group.current || !material.current || !attack) {
      if (group.current) group.current.visible = false;
      return;
    }

    const p = Math.max(0, Math.min(1, logic.actionTime / Math.max(0.001, attack.duration)));
    const activeStart = attack.activeStart / attack.duration;
    const activeEnd = attack.activeEnd / attack.duration;
    const windowPad = 0.09;
    const visible = p >= Math.max(0, activeStart - windowPad) && p <= Math.min(1, activeEnd + windowPad);
    group.current.visible = visible;
    if (!visible) return;

    const local = Math.max(0, Math.min(1, (p - activeStart + windowPad) / Math.max(0.001, activeEnd - activeStart + windowPad * 2)));
    const pulse = Math.sin(Math.PI * local);
    material.current.opacity = 0.14 + pulse * 0.58;

    if (styleId === 'wanfeng') {
      group.current.rotation.z = -0.7 + local * 1.35;
      group.current.scale.setScalar(0.78 + pulse * 0.28);
    } else {
      group.current.rotation.z = 0;
      group.current.scale.set(1, 1, 0.82 + pulse * 0.42);
    }
  });

  if (styleId === 'wanfeng') {
    return (
      <group ref={group} position={[0, 1.38, 0.28]} visible={false} rotation={[0, 0, -0.6]}>
        <mesh>
          <ringGeometry args={[0.88, 0.96, 48, 1, -Math.PI * 0.78, Math.PI * 1.42]} />
          <meshBasicMaterial
            ref={material}
            color="#67d3ff"
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={group} position={[0, 1.33, 1.05]} visible={false}>
      <mesh>
        <boxGeometry args={[0.055, 0.055, 2.15]} />
        <meshBasicMaterial
          ref={material}
          color="#ffd2a3"
          transparent
          opacity={0.48}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * Compatibility shell kept so GameScene does not own presentation details.
 * v0.3-B decouples visual style from player/enemy slot and adds a presentation-only
 * sword-path cue: WanFeng uses arcs; Kendo-inspired uses the center line.
 */
export default function HumanoidFighter({ styleId = 'wanfeng', enemy = false, logicRef, rootRef, ...props }) {
  const kendoPresentation = styleId === 'kendo';
  return (
    <group ref={rootRef}>
      <FighterRig {...props} logicRef={logicRef} enemy={kendoPresentation} />
      <SwordPathCue logicRef={logicRef} styleId={styleId} />
    </group>
  );
}
