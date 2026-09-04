import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ATTACKS, createFighterLogic } from '../examples/ugis-fighter-game/src/gameRules.js';
import {
  EXPANDED_AUTHORED_ACTIONS,
  EXPANDED_STYLE_VISUALS,
  STYLE_ATTACK_IDS,
  sampleExpandedStylePose,
} from '../examples/ugis-fighter-game/src/motion/expandedStyleAnimations.js';
import { SWORD_STYLE_IDS, SWORD_STYLES } from '../examples/ugis-fighter-game/src/styles/swordStyles.js';
import { STYLE_BEHAVIOR, shapeMovement } from '../examples/ugis-fighter-game/src/styles/styleBehavior.js';

const EXPANDED = ['epee','destreza','liechtenauer','fiore','miaodao'];

test('v0.4 expands the roster from two to seven styles', () => {
  assert.equal(SWORD_STYLE_IDS.length, 7);
  for (const id of EXPANDED) {
    assert.ok(SWORD_STYLES[id], id);
    assert.ok(STYLE_BEHAVIOR[id], id);
    assert.ok(EXPANDED_STYLE_VISUALS[id], id);
  }
});

test('every expanded style owns seven playable attacks and seven authored animation resources', () => {
  for (const styleId of EXPANDED) {
    const ids = STYLE_ATTACK_IDS[styleId];
    assert.equal(ids.length, 7, styleId);
    for (const id of ids) {
      assert.ok(ATTACKS[id], id);
      const clip = EXPANDED_AUTHORED_ACTIONS[id];
      assert.ok(clip, id);
      assert.equal(clip.styleId, styleId, id);
      assert.equal(clip.source, 'taowind-authored-v0.4', id);
      assert.ok(Math.abs(clip.active[0] - ATTACKS[id].activeStart / ATTACKS[id].duration) < 1e-9, `${id} activeStart`);
      assert.ok(Math.abs(clip.active[1] - ATTACKS[id].activeEnd / ATTACKS[id].duration) < 1e-9, `${id} activeEnd`);
      assert.equal(clip.keyframes[0].t, 0, id);
      assert.equal(clip.keyframes.at(-1).t, 1, id);
    }
  }
});

test('expanded styles expose distinct weapon and action families instead of one shared sword swing', () => {
  const weaponModes = new Set(EXPANDED.map(id => EXPANDED_STYLE_VISUALS[id].weaponMode));
  const actionFamilies = new Set(EXPANDED.map(id => EXPANDED_STYLE_VISUALS[id].actionFamily));
  assert.ok(weaponModes.size >= 5);
  assert.equal(actionFamilies.size, 5);
  assert.ok(EXPANDED_STYLE_VISUALS.epee.bladeWidth < EXPANDED_STYLE_VISUALS.liechtenauer.bladeWidth);
  assert.ok(EXPANDED_STYLE_VISUALS.miaodao.bladeLength > EXPANDED_STYLE_VISUALS.epee.bladeLength);
  assert.ok(EXPANDED_STYLE_VISUALS.liechtenauer.handleLength > EXPANDED_STYLE_VISUALS.epee.handleLength);
});

test('representative attacks have visibly different authored silhouettes', () => {
  const sample = (styleId, attackId, fraction) => {
    const logic = createFighterLogic('player');
    logic.action = attackId;
    logic.actionDuration = ATTACKS[attackId].duration;
    logic.actionTime = logic.actionDuration * fraction;
    return sampleExpandedStylePose({ styleId, logic, elapsed: 1 });
  };

  const epee = sample('epee', 'epee_light1', .44);
  const destreza = sample('destreza', 'destreza_light1', .45);
  const liech = sample('liechtenauer', 'liech_light1', .48);
  const fiore = sample('fiore', 'fiore_light1', .50);
  const miaodao = sample('miaodao', 'miaodao_light1', .52);

  assert.ok(Math.abs(epee.visualYaw) > .20, 'epee should remain side-on');
  assert.ok(Math.abs(epee.forearmR[0]) < .25, 'epee strike arm should extend');
  assert.ok(Math.abs(destreza.bodyOffsetX) > .08, 'destreza should move off-axis');
  assert.ok(Math.abs(destreza.visualYaw) > Math.abs(epee.visualYaw), 'destreza should rotate around the angle more than epee');
  assert.ok(Math.abs(liech.upperArmL[0]) > .7 && Math.abs(liech.upperArmR[0]) > .7, 'longsword should recruit both arms');
  assert.ok(fiore.bodyOffsetY < -.02, 'fiore should settle lower through guard transition');
  assert.ok(Math.abs(miaodao.visualYaw) > .20, 'miaodao should show a broad body turn');
});

test('expanded locomotion profiles remain distinct at the game-runtime lowering layer', () => {
  const epee = shapeMovement('epee', { forward:1, lateral:0, flowSide:1 });
  const destreza = shapeMovement('destreza', { forward:1, lateral:0, flowSide:1 });
  const miaodao = shapeMovement('miaodao', { forward:0, lateral:1, flowSide:1 });
  assert.equal(epee.lateral, 0);
  assert.ok(Math.abs(destreza.lateral) > .20);
  assert.ok(miaodao.speedScale < STYLE_BEHAVIOR.destreza.locomotion.strafeScale);
});

test('start screen remains viewport-safe even with seven styles per side', async () => {
  const [screen, css] = await Promise.all([
    readFile(new URL('../examples/ugis-fighter-game/src/StartScreen.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/styleSelect.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(screen.includes('style-option-list'));
  assert.ok(screen.includes('selected-style-summary'));
  assert.ok(css.includes('height: 100dvh'));
  assert.ok(css.includes('height:min(900px,calc(100dvh - 24px))'));
  assert.ok(css.includes('overflow-y:auto'));
  assert.ok(css.includes('minmax(0,1fr)'));
});

test('expanded presentation uses real sword-tip trails and keeps rule ownership out of the rig', async () => {
  const [rig, trail] = await Promise.all([
    readFile(new URL('../examples/ugis-fighter-game/src/characters/ExpandedStyleRig.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/characters/SwordTipTrail.jsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(rig.includes('SwordTipTrail'));
  assert.ok(trail.includes('tip.getWorldPosition'));
  for (const forbidden of ['chooseUgisRoute', '.hp =', '.energy =', 'applyDamage']) assert.equal(rig.includes(forbidden), false, forbidden);
});
