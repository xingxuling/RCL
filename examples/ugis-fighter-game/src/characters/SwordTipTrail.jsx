import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { ATTACKS } from '../gameRules.js';

const WORLD = new THREE.Vector3();
const TRAIL_STYLE = Object.freeze({
  wanfeng:{ color:'#6de3ff', opacity:.66, width:.032, points:18 },
  kendo:{ color:'#ffd0a0', opacity:.58, width:.022, points:12 },
  epee:{ color:'#c9e5ff', opacity:.62, width:.016, points:14 },
  destreza:{ color:'#dfc2ff', opacity:.64, width:.020, points:17 },
  liechtenauer:{ color:'#c8e6a0', opacity:.62, width:.030, points:14 },
  fiore:{ color:'#f0c88b', opacity:.61, width:.031, points:13 },
  miaodao:{ color:'#ffe36d', opacity:.68, width:.040, points:19 },
});

export default function SwordTipTrail({ tipRef, logicRef, styleId = 'wanfeng' }) {
  const meshRef = useRef();
  const pointsRef = useRef([]);
  const actionRef = useRef(null);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const trail = TRAIL_STYLE[styleId] ?? TRAIL_STYLE.wanfeng;

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

    if (points.length > trail.points) points.splice(0, points.length - trail.points);
    if (points.length < 2) {
      mesh.visible = false;
      return;
    }

    const vertices = [];
    const indices = [];
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const fade = (i + 1) / points.length;
      const width = trail.width * (0.35 + fade * 0.9);
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
        color={trail.color}
        transparent
        opacity={trail.opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
