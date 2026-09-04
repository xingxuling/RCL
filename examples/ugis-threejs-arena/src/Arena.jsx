import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  clampArena,
  motionDistance,
  preserveSeparation,
  resolveSemanticMotion,
  swordPoseForRoute,
} from './semanticMotion.js';

const WANFENG_START = new THREE.Vector3(-2.15, 0, 0.35);
const OPPONENT_START = new THREE.Vector3(2.15, 0, -0.35);

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 4.9, 7.8);
    camera.fov = 48;
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame(() => camera.lookAt(0, 0.9, 0));
  return null;
}

function TrainingSword({ swordRef }) {
  return (
    <group ref={swordRef} position={[0.48, 1.0, 0]} rotation={[0.05, 0, -0.18]}>
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[0.065, 1.18, 0.035]} />
        <meshStandardMaterial color="#e8edf4" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.08, 0]} castShadow>
        <cylinderGeometry args={[0.065, 0.075, 0.34, 12]} />
        <meshStandardMaterial color="#272b31" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[0.34, 0.055, 0.07]} />
        <meshStandardMaterial color="#b7bec8" metalness={0.45} roughness={0.38} />
      </mesh>
    </group>
  );
}

function FighterBody({ accent, swordRef, bodyRef }) {
  return (
    <group ref={bodyRef}>
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.38, 1.16, 18]} />
        <meshStandardMaterial color={accent} roughness={0.56} />
      </mesh>
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.31, 20, 16]} />
        <meshStandardMaterial color="#d8c5b2" roughness={0.72} />
      </mesh>
      <mesh position={[-0.2, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.56, 10]} />
        <meshStandardMaterial color="#252b34" />
      </mesh>
      <mesh position={[0.2, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.56, 10]} />
        <meshStandardMaterial color="#252b34" />
      </mesh>
      <TrainingSword swordRef={swordRef} />
    </group>
  );
}

function Fighter({
  nodeId,
  frame,
  initialPosition,
  targetRef,
  sideSign,
  accent,
  sequenceToken,
}) {
  const groupRef = useRef();
  const swordRef = useRef();
  const bodyRef = useRef();
  const motion = useRef({
    from: initialPosition.clone(),
    to: initialPosition.clone(),
    progress: 1,
    duration: 0.9,
  });
  const poseTarget = useRef(new THREE.Vector3(0.05, 0, -0.18));
  const elapsed = useRef(0);

  useEffect(() => {
    const actor = groupRef.current;
    const target = targetRef.current;
    if (!actor || !target || !frame) return;

    const from = actor.position.clone();
    const direction = resolveSemanticMotion(
      frame.motion.direction,
      from,
      target.position,
      sideSign,
    );
    const distance = motionDistance(frame.motion.magnitudeMilli);
    let to = from.clone().addScaledVector(direction, distance);
    to = preserveSeparation(to, target.position);
    to = clampArena(to);

    motion.current = {
      from,
      to,
      progress: 0,
      duration: 0.72 + Math.min(0.42, distance * 0.22),
    };
    poseTarget.current.set(...swordPoseForRoute(frame.routeId));
    elapsed.current = 0;
  }, [frame, sequenceToken, sideSign, targetRef]);

  useFrame((_, delta) => {
    const actor = groupRef.current;
    const target = targetRef.current;
    if (!actor) return;

    if (target) {
      const look = target.position.clone();
      look.y = actor.position.y + 0.95;
      actor.lookAt(look);
    }

    const state = motion.current;
    if (state.progress < 1) {
      state.progress = Math.min(1, state.progress + delta / state.duration);
      const t = state.progress * state.progress * (3 - 2 * state.progress);
      actor.position.lerpVectors(state.from, state.to, t);
    }

    elapsed.current += delta;
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(elapsed.current * 7.5) * 0.018;
    }
    if (swordRef.current) {
      swordRef.current.rotation.x = THREE.MathUtils.lerp(
        swordRef.current.rotation.x,
        poseTarget.current.x,
        Math.min(1, delta * 7),
      );
      swordRef.current.rotation.y = THREE.MathUtils.lerp(
        swordRef.current.rotation.y,
        poseTarget.current.y,
        Math.min(1, delta * 7),
      );
      swordRef.current.rotation.z = THREE.MathUtils.lerp(
        swordRef.current.rotation.z,
        poseTarget.current.z,
        Math.min(1, delta * 7),
      );
    }
  });

  return (
    <group ref={groupRef} name={nodeId} position={initialPosition.toArray()}>
      <FighterBody accent={accent} swordRef={swordRef} bodyRef={bodyRef} />
    </group>
  );
}

function ArenaScene({ frames, sequenceToken, resetToken }) {
  const wanfengRef = useRef();
  const opponentRef = useRef();
  const wanfengFrame = frames.find(frame => frame.actorNode === 'fighter:wanfeng') ?? null;
  const opponentFrame = frames.find(frame => frame.actorNode === 'fighter:opponent') ?? null;

  return (
    <>
      <color attach="background" args={['#0a0f18']} />
      <fog attach="fog" args={['#0a0f18', 8.5, 17]} />
      <ambientLight intensity={0.8} />
      <directionalLight
        castShadow
        intensity={2.1}
        position={[4, 8, 4]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight intensity={14} distance={9} position={[-4, 2.4, -2]} color="#7db8ff" />
      <pointLight intensity={11} distance={9} position={[4, 2.2, 2]} color="#ffbf7a" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#151b25" roughness={0.93} metalness={0.02} />
      </mesh>
      <gridHelper args={[10, 20, '#465368', '#263142']} position={[0, 0.006, 0]} />

      <Fighter
        key={`wanfeng-${resetToken}`}
        nodeId="fighter:wanfeng"
        frame={wanfengFrame}
        initialPosition={WANFENG_START}
        targetRef={opponentRef}
        sideSign={1}
        accent="#4a91ff"
        sequenceToken={sequenceToken}
        ref={wanfengRef}
      />
      <group ref={wanfengRef} visible={false} />

      <FighterProxy
        key={`opponent-${resetToken}`}
        externalRef={opponentRef}
        frame={opponentFrame}
        initialPosition={OPPONENT_START}
        targetRef={wanfengRef}
        sequenceToken={sequenceToken}
      />
      <CameraRig />
    </>
  );
}

function FighterProxy({ externalRef, frame, initialPosition, targetRef, sequenceToken }) {
  return (
    <group ref={externalRef} name="fighter:opponent" position={initialPosition.toArray()}>
      <ProxyAnimatedBody
        frame={frame}
        targetRef={targetRef}
        sequenceToken={sequenceToken}
        externalRef={externalRef}
      />
    </group>
  );
}

function ProxyAnimatedBody({ frame, targetRef, sequenceToken, externalRef }) {
  const swordRef = useRef();
  const bodyRef = useRef();
  const motion = useRef({ from: OPPONENT_START.clone(), to: OPPONENT_START.clone(), progress: 1, duration: 0.9 });
  const poseTarget = useRef(new THREE.Vector3());
  const elapsed = useRef(0);

  useEffect(() => {
    const actor = externalRef.current;
    const target = targetRef.current;
    if (!actor || !target || !frame) return;
    const from = actor.position.clone();
    const direction = resolveSemanticMotion(frame.motion.direction, from, target.position, -1);
    const distance = motionDistance(frame.motion.magnitudeMilli);
    let to = clampArena(preserveSeparation(from.clone().addScaledVector(direction, distance), target.position));
    motion.current = { from, to, progress: 0, duration: 0.72 + Math.min(0.42, distance * 0.22) };
    poseTarget.current.set(...swordPoseForRoute(frame.routeId));
    elapsed.current = 0;
  }, [frame, sequenceToken, targetRef, externalRef]);

  useFrame((_, delta) => {
    const actor = externalRef.current;
    const target = targetRef.current;
    if (!actor) return;
    if (target) actor.lookAt(target.position.x, actor.position.y + 0.95, target.position.z);
    const state = motion.current;
    if (state.progress < 1) {
      state.progress = Math.min(1, state.progress + delta / state.duration);
      const t = state.progress * state.progress * (3 - 2 * state.progress);
      actor.position.lerpVectors(state.from, state.to, t);
    }
    elapsed.current += delta;
    if (bodyRef.current) bodyRef.current.position.y = Math.sin(elapsed.current * 7.1 + 1) * 0.018;
    if (swordRef.current) {
      swordRef.current.rotation.x = THREE.MathUtils.lerp(swordRef.current.rotation.x, poseTarget.current.x, Math.min(1, delta * 7));
      swordRef.current.rotation.y = THREE.MathUtils.lerp(swordRef.current.rotation.y, poseTarget.current.y, Math.min(1, delta * 7));
      swordRef.current.rotation.z = THREE.MathUtils.lerp(swordRef.current.rotation.z, poseTarget.current.z, Math.min(1, delta * 7));
    }
  });

  return <FighterBody accent="#e29a4b" swordRef={swordRef} bodyRef={bodyRef} />;
}

export default function Arena({ frames, sequenceToken, resetToken }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 4.9, 7.8], fov: 48, near: 0.1, far: 50 }}
      gl={{ antialias: true }}
    >
      <ArenaScene frames={frames} sequenceToken={sequenceToken} resetToken={resetToken} />
    </Canvas>
  );
}
