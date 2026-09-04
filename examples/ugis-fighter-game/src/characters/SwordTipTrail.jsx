import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ATTACKS } from '../gameRules.js';

const WORLD = new THREE.Vector3();

export default function SwordTipTrail({ tipRef, logicRef, styleId = 'wanfeng' }) {
  const meshRef = useRef();
  const pointsRef = useRef([]);
  const actionRef = useRef(null);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame(() => {
    const logic = logicRef.current;
    const mesh = meshRef.current;
    const tip = tipRef.current;
    const attack = logic?.action ? ATTACKS[logic.action] : null;

    if (!mesh || !tip || !attack || logic.action === 'dash') {
      pointsRef.current = [];
      actionRef.current = null;
      if (mesh) mesh.visible = false;
      return;
    }

    if (actionRef.current !== logic.action) {
      pointsRef.current = [];
      actionRef.current = logic.action;
    }

    tip.getWorldPosition(WORLD);
    const local = WORLD.clone();
    mesh.parent.worldToLocal(local);
    const points = pointsRef.current;
    const previous = points.at(-1);
    if (!previous || previous.distanceToSquared(local) > 0.0005) points.push(local);

    const maxPoints = styleId === 'wanfeng' ? 18 : 12;
    if (points.length > maxPoints) points.splice(0, points.length - maxPoints);
    if (points.length < 2) {
      mesh.visible = false;
      return;
    }

    const vertices = [];
    const indices = [];
    const baseWidth = styleId === 'wanfeng' ? 0.032 : 0.022;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const fade = (i + 1) / points.length;
      const width = baseWidth * (0.35 + fade * 0.9);
      vertices.push(p.x, p.y + width, p.z, p.x, p.y - width, p.z);
      if (i < points.length - 1) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    mesh.visible = true;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} visible={false} frustumCulled={false}>
      <meshBasicMaterial
        color={styleId === 'wanfeng' ? '#6de3ff' : '#ffd0a0'}
        transparent
        opacity={styleId === 'wanfeng' ? 0.66 : 0.58}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
