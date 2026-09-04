import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import HumanoidFighter from './HumanoidFighter.jsx';
import { consumePressed, isDown, useKeyboardInput } from './input.js';
import {
  ATTACKS,
  GAME_LIMITS,
  ROUTE_LABELS,
  attackCanStart,
  createFighterLogic,
  observeRegime,
} from './gameRules.js';
import { chooseUgisRoute, directiveForRoute } from './ugisAi.js';

const PLAYER_START = new THREE.Vector3(-2.3, 0, 0.45);
const ENEMY_START = new THREE.Vector3(2.3, 0, -0.45);
const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_C = new THREE.Vector3();

function planarDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function arenaClamp(position) {
  const length = Math.hypot(position.x, position.z);
  if (length > GAME_LIMITS.arenaRadius) {
    const scale = GAME_LIMITS.arenaRadius / length;
    position.x *= scale;
    position.z *= scale;
  }
}

function faceEachOther(a, b) {
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  a.rotation.y = Math.atan2(dx, dz);
  b.rotation.y = Math.atan2(-dx, -dz);
}

function relativeBasis(actor, target) {
  const forward = TMP_A.set(target.position.x - actor.position.x, 0, target.position.z - actor.position.z);
  if (forward.lengthSq() < 1e-5) forward.set(0, 0, 1);
  forward.normalize();
  const right = TMP_B.set(-forward.z, 0, forward.x).normalize();
  return { forward: forward.clone(), right: right.clone() };
}

function startAttack(logic, attackId, direction) {
  if (!attackCanStart(logic, attackId)) return false;
  const attack = ATTACKS[attackId];
  logic.energy = Math.max(0, logic.energy - attack.energyCost);
  logic.action = attackId;
  logic.actionTime = 0;
  logic.actionDuration = attack.duration;
  logic.actionHit = false;
  logic.actionDirX = direction.x;
  logic.actionDirZ = direction.z;
  logic.guard = false;
  logic.lastActionLabel = attack.label;
  logic.route = attack.routeIntent;
  logic.routeLabel = ROUTE_LABELS[attack.routeIntent];
  return true;
}

function startDash(logic, direction) {
  if (logic.hitstun > 0 || logic.action || logic.dashCooldown > 0) return false;
  logic.action = 'dash';
  logic.actionTime = 0;
  logic.actionDuration = GAME_LIMITS.dashDuration;
  logic.actionHit = false;
  logic.actionDirX = direction.x;
  logic.actionDirZ = direction.z;
  logic.dashCooldown = GAME_LIMITS.dashCooldown;
  logic.invuln = 0.14;
  logic.guard = false;
  logic.lastActionLabel = '瞬步';
  return true;
}

function resetLogic(target, role) {
  Object.assign(target, createFighterLogic(role), {
    knockbackX: 0,
    knockbackZ: 0,
    aiGuardTimer: 0,
    actionDuration: 0,
  });
}

function updateTimers(logic, delta) {
  logic.hitstun = Math.max(0, logic.hitstun - delta);
  logic.invuln = Math.max(0, logic.invuln - delta);
  logic.dashCooldown = Math.max(0, logic.dashCooldown - delta);
  logic.comboTimer = Math.max(0, logic.comboTimer - delta);
  logic.flash = Math.max(0, logic.flash - delta);
  logic.aiGuardTimer = Math.max(0, (logic.aiGuardTimer || 0) - delta);
  if (logic.comboTimer <= 0 && !logic.action) logic.comboStep = 0;
}

function updateVertical(logic, root, delta) {
  if (!logic.grounded || logic.verticalVelocity !== 0) {
    logic.verticalVelocity -= GAME_LIMITS.gravity * delta;
    root.position.y += logic.verticalVelocity * delta;
    if (root.position.y <= 0) {
      root.position.y = 0;
      logic.verticalVelocity = 0;
      logic.grounded = true;
    }
  }
}

function updateKnockback(logic, root, delta) {
  const decay = Math.pow(0.035, delta);
  root.position.x += (logic.knockbackX || 0) * delta;
  root.position.z += (logic.knockbackZ || 0) * delta;
  logic.knockbackX = (logic.knockbackX || 0) * decay;
  logic.knockbackZ = (logic.knockbackZ || 0) * decay;
}

function resolveSeparation(playerRoot, enemyRoot) {
  const dx = enemyRoot.position.x - playerRoot.position.x;
  const dz = enemyRoot.position.z - playerRoot.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= GAME_LIMITS.minSeparation || distance < 1e-5) return;
  const missing = GAME_LIMITS.minSeparation - distance;
  const nx = dx / distance;
  const nz = dz / distance;
  playerRoot.position.x -= nx * missing * 0.5;
  playerRoot.position.z -= nz * missing * 0.5;
  enemyRoot.position.x += nx * missing * 0.5;
  enemyRoot.position.z += nz * missing * 0.5;
}

function ArenaEnvironment() {
  return (
    <>
      <color attach="background" args={['#050812']} />
      <fog attach="fog" args={['#050812', 11, 25]} />
      <ambientLight intensity={0.68} />
      <hemisphereLight intensity={0.9} color="#8eb8ff" groundColor="#18131e" />
      <directionalLight castShadow intensity={2.4} position={[5, 9, 4]} shadow-mapSize-width={1536} shadow-mapSize-height={1536} />
      <pointLight intensity={20} distance={10} position={[-4, 2.8, -1]} color="#3e8fff" />
      <pointLight intensity={15} distance={10} position={[4, 2.5, 1]} color="#ff8d45" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.7, 64]} />
        <meshStandardMaterial color="#111723" roughness={0.94} metalness={0.03} />
      </mesh>
      <gridHelper args={[12, 24, '#32435f', '#1c2636']} position={[0, 0.012, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[6.18, 6.27, 80]} />
        <meshBasicMaterial color="#416fa7" transparent opacity={0.42} side={THREE.DoubleSide} />
      </mesh>

      {[0, 1, 2, 3].map(index => {
        const angle = index * Math.PI * 0.5 + Math.PI * 0.25;
        const x = Math.cos(angle) * 8.2;
        const z = Math.sin(angle) * 8.2;
        return (
          <group key={index} position={[x, 0, z]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.42, 3, 10]} />
              <meshStandardMaterial color="#171e2a" roughness={0.88} />
            </mesh>
            <pointLight intensity={5} distance={5} position={[0, 2.7, 0]} color={index % 2 ? '#ff884e' : '#448dff'} />
          </group>
        );
      })}
    </>
  );
}

function HitSpark({ event }) {
  const group = useRef();
  const age = useRef(1);

  useEffect(() => {
    if (!event || !group.current) return;
    group.current.position.set(event.x, event.y, event.z);
    age.current = 0;
    group.current.visible = true;
  }, [event]);

  useFrame((_, delta) => {
    if (!group.current || age.current >= 1) return;
    age.current += delta * 5.5;
    const t = Math.min(1, age.current);
    group.current.scale.setScalar(0.42 + t * 1.9);
    group.current.rotation.z += delta * 4;
    group.current.visible = t < 1;
  });

  return (
    <group ref={group} visible={false}>
      <mesh>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial color={event?.guarded ? '#8acbff' : '#fff0a8'} transparent opacity={0.92} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.34, 18]} />
        <meshBasicMaterial color={event?.guarded ? '#70b6ff' : '#ffb45e'} transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ChaseCamera({ playerRoot, enemyRoot, matchRef }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const player = playerRoot.current;
    const enemy = enemyRoot.current;
    if (!player || !enemy) return;

    const dx = enemy.position.x - player.position.x;
    const dz = enemy.position.z - player.position.z;
    const distance = Math.max(1, Math.hypot(dx, dz));
    const inv = 1 / distance;
    const fx = dx * inv;
    const fz = dz * inv;
    const rx = -fz;
    const rz = fx;
    const back = 3.55 + Math.min(2.15, distance * 0.42);
    const side = 0.55;
    const shake = matchRef.current.cameraShake || 0;
    const jitterX = (Math.sin(performance.now() * 0.045) * shake);
    const jitterY = (Math.cos(performance.now() * 0.052) * shake * 0.7);

    desired.current.set(
      player.position.x - fx * back + rx * side + jitterX,
      2.75 + Math.min(0.55, distance * 0.08) + jitterY,
      player.position.z - fz * back + rz * side,
    );
    const lerp = 1 - Math.pow(0.0015, delta);
    camera.position.lerp(desired.current, lerp);
    lookAt.current.set(
      player.position.x * 0.58 + enemy.position.x * 0.42,
      1.18 + (player.position.y + enemy.position.y) * 0.25,
      player.position.z * 0.58 + enemy.position.z * 0.42,
    );
    camera.lookAt(lookAt.current);
    matchRef.current.cameraShake = Math.max(0, shake - delta * 0.85);
  });
  return null;
}

function GameWorld({ onHud, resetSignal = 0, paused = false }) {
  const keyboard = useKeyboardInput();
  const playerRoot = useRef();
  const enemyRoot = useRef();
  const player = useRef(createFighterLogic('player'));
  const enemy = useRef(createFighterLogic('enemy'));
  const match = useRef({
    hitstop: 0,
    cameraShake: 0,
    aiTimer: 0,
    aiTick: 0,
    aiDirective: { movement: 'hold', action: 'hold', commitment: 0 },
    hudTimer: 0,
    ended: false,
    winner: null,
    hitSerial: 0,
  });
  const [spark, setSpark] = useState(null);

  const publishHud = () => {
    const p = player.current;
    const e = enemy.current;
    const pRoot = playerRoot.current;
    const eRoot = enemyRoot.current;
    const distance = pRoot && eRoot ? planarDistance(pRoot.position, eRoot.position) : 0;
    onHud?.({
      playerHp: p.hp,
      playerEnergy: p.energy,
      enemyHp: e.hp,
      enemyEnergy: e.energy,
      playerAction: p.lastActionLabel,
      enemyAction: e.lastActionLabel,
      aiRoute: e.route,
      aiRouteLabel: e.routeLabel,
      regime: observeRegime(distance),
      distance,
      comboStep: p.comboStep,
      winner: match.current.winner,
      ended: match.current.ended,
      hitSerial: match.current.hitSerial,
      lastDamage: e.lastDamage,
    });
  };

  useEffect(() => {
    resetLogic(player.current, 'player');
    resetLogic(enemy.current, 'enemy');
    Object.assign(match.current, {
      hitstop: 0,
      cameraShake: 0,
      aiTimer: 0,
      aiTick: 0,
      aiDirective: { movement: 'hold', action: 'hold', commitment: 0 },
      hudTimer: 0,
      ended: false,
      winner: null,
      hitSerial: 0,
    });
    if (playerRoot.current) {
      playerRoot.current.position.copy(PLAYER_START);
      playerRoot.current.rotation.set(0, 0, 0);
    }
    if (enemyRoot.current) {
      enemyRoot.current.position.copy(ENEMY_START);
      enemyRoot.current.rotation.set(0, 0, 0);
    }
    publishHud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  function applyMovement(logic, root, direction, speed, delta) {
    if (!root || logic.hitstun > 0 || logic.action) return;
    root.position.x += direction.x * speed * delta;
    root.position.z += direction.z * speed * delta;
    logic.moveMagnitude = Math.min(1, direction.length());
  }

  function tryHit(attacker, attackerRoot, defender, defenderRoot, attack) {
    if (attacker.actionHit || defender.invuln > 0 || !attackerRoot || !defenderRoot) return;
    const distance = planarDistance(attackerRoot.position, defenderRoot.position);
    if (distance > attack.range || Math.abs(attackerRoot.position.y - defenderRoot.position.y) > 1.3) return;

    const guarded = defender.guard;
    const damage = Math.round(attack.damage * (guarded ? GAME_LIMITS.guardDamageScale : 1));
    defender.hp = Math.max(0, defender.hp - damage);
    defender.lastDamage = damage;
    defender.flash = guarded ? 0.06 : 0.14;
    defender.hitstun = Math.max(
      defender.hitstun,
      attack.hitstun * (guarded ? 0.32 : 1),
    );
    attacker.energy = Math.min(GAME_LIMITS.maxEnergy, attacker.energy + attack.energyGain);
    if (guarded) defender.energy = Math.min(GAME_LIMITS.maxEnergy, defender.energy + GAME_LIMITS.guardEnergyGain);

    const dx = defenderRoot.position.x - attackerRoot.position.x;
    const dz = defenderRoot.position.z - attackerRoot.position.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const force = attack.knockback * (guarded ? GAME_LIMITS.guardKnockbackScale : 1) * 5.2;
    defender.knockbackX = (dx / length) * force;
    defender.knockbackZ = (dz / length) * force;
    attacker.actionHit = true;
    match.current.hitstop = attack.hitstop;
    match.current.cameraShake = guarded ? 0.025 : Math.min(0.12, 0.035 + attack.damage / 1800);
    match.current.hitSerial += 1;

    const hitX = (attackerRoot.position.x + defenderRoot.position.x) * 0.5;
    const hitZ = (attackerRoot.position.z + defenderRoot.position.z) * 0.5;
    setSpark({ id: match.current.hitSerial, x: hitX, y: 1.35 + defenderRoot.position.y, z: hitZ, guarded });

    if (defender.hp <= 0) {
      match.current.ended = true;
      match.current.winner = attacker.role === 'player' ? 'player' : 'enemy';
      defender.hitstun = 2;
    }
  }

  function updateAction(logic, root, otherLogic, otherRoot, delta) {
    if (!logic.action) return;

    if (logic.action === 'dash') {
      logic.actionTime += delta;
      const speed = GAME_LIMITS.dashDistance / GAME_LIMITS.dashDuration;
      root.position.x += logic.actionDirX * speed * delta;
      root.position.z += logic.actionDirZ * speed * delta;
      logic.moveMagnitude = 1;
      if (logic.actionTime >= GAME_LIMITS.dashDuration) {
        logic.action = null;
        logic.actionTime = 0;
        logic.moveMagnitude = 0;
      }
      return;
    }

    const attack = ATTACKS[logic.action];
    if (!attack) {
      logic.action = null;
      return;
    }
    logic.actionTime += delta;
    logic.moveMagnitude = attack.move > 0 ? 0.55 : 0;
    const moveWindow = Math.min(1, logic.actionTime / Math.max(0.08, attack.activeStart));
    if (logic.actionTime <= attack.activeEnd) {
      const stepSpeed = attack.move / Math.max(0.1, attack.activeEnd);
      root.position.x += logic.actionDirX * stepSpeed * delta * (0.55 + 0.45 * moveWindow);
      root.position.z += logic.actionDirZ * stepSpeed * delta * (0.55 + 0.45 * moveWindow);
    }
    if (logic.actionTime >= attack.activeStart && logic.actionTime <= attack.activeEnd) {
      tryHit(logic, root, otherLogic, otherRoot, attack);
    }
    if (logic.actionTime >= attack.duration) {
      logic.action = null;
      logic.actionTime = 0;
      logic.actionDuration = 0;
      logic.actionHit = false;
      logic.moveMagnitude = 0;
    }
  }

  useFrame((_, deltaRaw) => {
    const pRoot = playerRoot.current;
    const eRoot = enemyRoot.current;
    if (!pRoot || !eRoot) return;
    const p = player.current;
    const e = enemy.current;
    const m = match.current;
    const delta = Math.min(0.035, deltaRaw);

    faceEachOther(pRoot, eRoot);
    updateTimers(p, delta);
    updateTimers(e, delta);
    updateVertical(p, pRoot, delta);
    updateVertical(e, eRoot, delta);
    updateKnockback(p, pRoot, delta);
    updateKnockback(e, eRoot, delta);

    if (paused || m.ended) {
      p.moveMagnitude = 0;
      e.moveMagnitude = 0;
      m.hudTimer += delta;
      if (m.hudTimer > 0.08) {
        m.hudTimer = 0;
        publishHud();
      }
      return;
    }

    if (m.hitstop > 0) {
      m.hitstop = Math.max(0, m.hitstop - delta);
      return;
    }

    const pBasis = relativeBasis(pRoot, eRoot);
    const playerMove = TMP_C.set(0, 0, 0);
    if (isDown(keyboard, 'KeyW')) playerMove.add(pBasis.forward);
    if (isDown(keyboard, 'KeyS')) playerMove.sub(pBasis.forward);
    if (isDown(keyboard, 'KeyD')) playerMove.add(pBasis.right);
    if (isDown(keyboard, 'KeyA')) playerMove.sub(pBasis.right);
    if (playerMove.lengthSq() > 0) playerMove.normalize();

    p.guard = (isDown(keyboard, 'KeyF') || isDown(keyboard, 'ShiftLeft') || isDown(keyboard, 'ShiftRight'))
      && !p.action && p.hitstun <= 0;

    if (consumePressed(keyboard, 'KeyK') && p.grounded && p.hitstun <= 0) {
      p.verticalVelocity = GAME_LIMITS.jumpVelocity;
      p.grounded = false;
      p.guard = false;
      p.lastActionLabel = '跳跃';
    }

    if (consumePressed(keyboard, 'KeyL')) {
      const dashDir = playerMove.lengthSq() > 0 ? playerMove.clone() : pBasis.forward.clone();
      if (startDash(p, dashDir)) {
        p.route = 'disengage_reentry';
        p.routeLabel = ROUTE_LABELS.disengage_reentry;
      }
    }

    if (consumePressed(keyboard, 'KeyJ')) {
      const combo = ['light1', 'light2', 'light3'];
      const attackId = combo[p.comboTimer > 0 ? p.comboStep % 3 : 0];
      if (startAttack(p, attackId, pBasis.forward)) {
        p.comboStep = (p.comboStep + 1) % 3;
        p.comboTimer = 0.72;
      }
    }
    if (consumePressed(keyboard, 'KeyH')) startAttack(p, 'heavy', pBasis.forward);
    if (consumePressed(keyboard, 'KeyU')) startAttack(p, 'skill_u', pBasis.forward);
    if (consumePressed(keyboard, 'KeyI')) startAttack(p, 'skill_i', pBasis.forward);
    if (consumePressed(keyboard, 'KeyO')) startAttack(p, 'skill_o', pBasis.forward);

    if (!p.action && p.hitstun <= 0) {
      const speed = (Math.abs(playerMove.dot(pBasis.right)) > 0.6 ? GAME_LIMITS.strafeSpeed : GAME_LIMITS.moveSpeed);
      applyMovement(p, pRoot, playerMove, speed, delta);
    }

    const distance = planarDistance(pRoot.position, eRoot.position);
    m.aiTimer -= delta;
    if (m.aiTimer <= 0) {
      m.aiTimer = 0.17;
      m.aiTick += 1;
      const route = chooseUgisRoute({
        distance,
        selfHp: e.hp,
        selfEnergy: e.energy,
        opponentAction: p.action,
        opponentGuard: p.guard,
        ownHitstun: e.hitstun,
        tick: m.aiTick,
      });
      e.route = route;
      e.routeLabel = ROUTE_LABELS[route];
      m.aiDirective = directiveForRoute(route, { distance });
      if (m.aiDirective.action === 'guard') e.aiGuardTimer = 0.28 + m.aiDirective.commitment * 0.28;
    }

    const eBasis = relativeBasis(eRoot, pRoot);
    const directive = m.aiDirective;
    const aiMove = TMP_C.set(0, 0, 0);
    if (directive.movement === 'approach') aiMove.add(eBasis.forward);
    else if (directive.movement === 'retreat') aiMove.sub(eBasis.forward);
    else if (directive.movement === 'strafe') aiMove.addScaledVector(eBasis.right, m.aiTick % 2 ? 1 : -1);
    if (aiMove.lengthSq() > 0) aiMove.normalize();

    e.guard = e.aiGuardTimer > 0 && !e.action && e.hitstun <= 0;
    if (!e.action && e.hitstun <= 0) {
      if (directive.action === 'dash' && e.dashCooldown <= 0) startDash(e, eBasis.forward);
      else if (directive.action === 'dash-back' && e.dashCooldown <= 0) startDash(e, eBasis.forward.clone().multiplyScalar(-1));
      else if (directive.action === 'thrust' && distance < 2.45) startAttack(e, 'ai_thrust', eBasis.forward);
      else if (directive.action === 'heavy' && distance < 2.2) startAttack(e, 'ai_heavy', eBasis.forward);
      else applyMovement(e, eRoot, aiMove, GAME_LIMITS.moveSpeed * 0.92, delta);
    }

    updateAction(p, pRoot, e, eRoot, delta);
    updateAction(e, eRoot, p, pRoot, delta);

    arenaClamp(pRoot.position);
    arenaClamp(eRoot.position);
    resolveSeparation(pRoot, eRoot);
    faceEachOther(pRoot, eRoot);

    m.hudTimer += delta;
    if (m.hudTimer >= 0.065) {
      m.hudTimer = 0;
      publishHud();
    }
  });

  return (
    <>
      <ArenaEnvironment />
      <HumanoidFighter logicRef={player} rootRef={playerRoot} accent="#3b92ff" />
      <HumanoidFighter logicRef={enemy} rootRef={enemyRoot} accent="#df7c36" enemy />
      <HitSpark event={spark} />
      <ChaseCamera playerRoot={playerRoot} enemyRoot={enemyRoot} matchRef={match} />
    </>
  );
}

export default function GameScene({ onHud, resetSignal, paused }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [-5, 3, 6], fov: 50, near: 0.1, far: 45 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <GameWorld onHud={onHud} resetSignal={resetSignal} paused={paused} />
    </Canvas>
  );
}
