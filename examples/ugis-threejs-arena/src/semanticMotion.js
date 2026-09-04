import * as THREE from 'three';

const FORWARD_ANGLE = 0.34;

export function resolveSemanticMotion(direction, actorPosition, targetPosition, sideSign = 1) {
  const forward = targetPosition.clone().sub(actorPosition);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();

  const right = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(sideSign);
  switch (direction) {
    case 'forward':
      return forward;
    case 'forward-angle':
      return forward.clone().addScaledVector(right, FORWARD_ANGLE).normalize();
    case 'backward':
      return forward.clone().multiplyScalar(-1);
    case 'backward-then-forward':
      return forward.clone().multiplyScalar(-0.35).addScaledVector(right, 0.18).normalize();
    case 'lateral':
      return right;
    case 'adaptive':
      return forward.clone().multiplyScalar(0.45).addScaledVector(right, 0.55).normalize();
    case 'variable':
      return right.clone().multiplyScalar(0.7).addScaledVector(forward, 0.3).normalize();
    case 'track':
    case 'neutral':
    default:
      return new THREE.Vector3(0, 0, 0);
  }
}

export function motionDistance(magnitudeMilli) {
  return THREE.MathUtils.clamp(magnitudeMilli / 1000, 0, 1.2) * 1.55;
}

export function clampArena(position) {
  position.x = THREE.MathUtils.clamp(position.x, -4.7, 4.7);
  position.z = THREE.MathUtils.clamp(position.z, -3.6, 3.6);
  return position;
}

export function preserveSeparation(nextPosition, targetPosition, minimum = 1.12) {
  const delta = nextPosition.clone().sub(targetPosition);
  delta.y = 0;
  const distance = delta.length();
  if (distance >= minimum || distance < 1e-6) return nextPosition;
  return targetPosition.clone().add(delta.normalize().multiplyScalar(minimum));
}

export function swordPoseForRoute(routeId) {
  const poses = {
    hold_measure: [0.05, 0.0, -0.18],
    take_line: [-0.55, 0.12, -0.62],
    intercept_route: [-0.28, -0.18, 0.68],
    contact_control: [-0.12, 0.08, 0.18],
    enter_close: [-0.72, 0.16, -0.74],
    close_resolution: [-0.92, 0.24, -0.88],
    disengage_reentry: [0.48, -0.18, 0.62],
    recover_axis: [0.08, 0.0, 0.02],
    regenerate_route: [0.26, 0.34, 0.5],
    change_rhythm: [0.34, -0.24, -0.28],
    flow_route: [-0.38, 0.22, 0.2],
  };
  return poses[routeId] ?? [0, 0, 0];
}

export function shortRoot(root) {
  if (!root) return '—';
  return `${root.slice(0, 8)}…${root.slice(-6)}`;
}
