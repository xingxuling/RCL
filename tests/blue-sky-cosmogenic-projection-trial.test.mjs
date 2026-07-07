import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES,
  extractBlueSkyLoreAnchorMap,
  runBlueSkyCosmogenicProjectionTrial,
  createBlueSkyProjectionBlindDeck,
  measureBlueSkyProjectionLeakage,
  runBlueSkyProjectionPressure,
  runBlueSkyProjectionDropout,
  runBlueSkyCosmogenicProjectionDemo,
} from '../src/blue-sky-cosmogenic-projection-trial.mjs';

const BLUE_SKY_FIXTURE = Array(24).fill([
  '命序界 十二长生 绝 胎 养 承 帝旺 超序 长生轮盘 阶段 命城',
  '蓝天机 风云策 万变 DU-HENG DH–Ω 同位体 判断源',
  '判断 判断权 迟疑 停顿 慢下来 不确定 最优解 责任 承担 犯错 继续判断',
  '天策府 灰区 并行结构 有限否决权 判断接口 责任映射 系统沉默',
  '不可建模项 前提撤销 非必要最优 不可复现 延迟真相 灰区样本 无法被提前处理',
  '以太文明 帝级以太语言 前提层 超维白金文明 升维 命序跃迁 跨维 保护性不干预',
].join(' ')).join('\n');

const NEGATIVE_CONTROL = Array(24).fill('蓝色海洋 行星 恒星 轨道 大陆 资源 矿物 城市 飞船 星球 卫星').join('\n');

test('extractBlueSkyLoreAnchorMap finds Blue Sky corpus anchors', () => {
  const anchors = extractBlueSkyLoreAnchorMap(BLUE_SKY_FIXTURE);
  assert.equal(anchors.enoughCorpus, true);
  assert.ok(anchors.groups.orderCycle.count > 20);
  assert.ok(anchors.groups.judgmentEthic.count > 20);
  assert.ok(anchors.groups.institutionalLayer.count > 20);
  assert.ok(anchors.groups.personaContinuity.count > 20);
  assert.ok(anchors.groups.antiPrematureOptimization.count > 20);
});

test('redacted blind deck leaks no reveal names or candidate keys', () => {
  const deck = createBlueSkyProjectionBlindDeck({ corpusText: BLUE_SKY_FIXTURE });
  assert.equal(deck.leakageScore, 0);
  assert.equal(measureBlueSkyProjectionLeakage(deck.rows), 0);
  const payload = JSON.stringify(deck.rows);
  assert.equal(payload.includes('命序界'), false);
  assert.equal(payload.includes('Blue Sky'), false);
  assert.equal(payload.includes('blue_sky'), false);
  assert.equal(payload.includes('revealName'), false);
});

test('origin-only probe cannot select Blue Sky identity', () => {
  const { result } = runBlueSkyCosmogenicProjectionTrial({ corpusText: BLUE_SKY_FIXTURE, skipPressure: true, skipDropout: true });
  assert.equal(result.originOnlyProbe.canSelectBlueSkyByOriginOnly, false);
  assert.notEqual(result.originOnlyProbe.revealedTop.semanticKey, 'blue_sky_judgment_order_civilization');
  assert.equal(result.originOnlyProbe.revealedTop.type, 'planet');
});

test('lore + corrected cosmogenic parameters select civilization candidate and block planet claim', () => {
  const { result } = runBlueSkyCosmogenicProjectionTrial({ corpusText: BLUE_SKY_FIXTURE, pressureIterations: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.canClaimBlueSkyCivilizationCandidate, true);
  assert.equal(result.canClaimCanonicalPlanet, false);
  assert.equal(result.civilizationProbe.revealedTop.semanticKey, 'blue_sky_judgment_order_civilization');
  assert.equal(result.civilizationProbe.revealedTop.type, 'civilization');
  assert.ok(result.civilizationProbe.confidence >= 0.82);
  assert.ok(result.civilizationProbe.margin >= 0.08);
  assert.equal(result.planetProbe.planetRank > 1, true);
});

test('negative corpus does not claim Blue Sky civilization', () => {
  const { result } = runBlueSkyCosmogenicProjectionTrial({ corpusText: NEGATIVE_CONTROL, skipPressure: true, skipDropout: true });
  assert.equal(result.canClaimBlueSkyCivilizationCandidate, false);
  assert.equal(result.canClaimCanonicalPlanet, false);
});

test('anchor dropout lowers confidence enough to pass sensitivity gate', () => {
  const dropout = runBlueSkyProjectionDropout({ corpusText: BLUE_SKY_FIXTURE, skipPressure: true });
  assert.equal(dropout.passed, true);
  assert.ok(dropout.confidenceDrop >= 0.04);
});

test('blind shuffle pressure keeps selected semantic root stable', () => {
  const pressure = runBlueSkyProjectionPressure({ corpusText: BLUE_SKY_FIXTURE, pressureIterations: 16, skipDropout: true });
  assert.equal(pressure.passed, true);
  assert.equal(pressure.passRate, 1);
});

test('renaming reveal label does not change semantic selection', () => {
  const renamed = DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES.map(candidate => (
    candidate.key === 'blue_sky_judgment_order_civilization'
      ? { ...candidate, revealName: '香蕉星 / Banana Planet' }
      : candidate
  ));
  const { result } = runBlueSkyCosmogenicProjectionTrial({ corpusText: BLUE_SKY_FIXTURE, candidates: renamed, skipPressure: true, skipDropout: true });
  assert.equal(result.canClaimBlueSkyCivilizationCandidate, true);
  assert.equal(result.civilizationProbe.revealedTop.semanticKey, 'blue_sky_judgment_order_civilization');
  assert.equal(result.civilizationProbe.revealedTop.revealName, '香蕉星 / Banana Planet');
});

test('demo smoke test returns bounded result', () => {
  const demo = runBlueSkyCosmogenicProjectionDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.canClaimCanonicalPlanet, false);
  assert.equal(demo.originOnlyTop, '蓝色宜居行星 / Generic Habitable Blue Planet');
});
