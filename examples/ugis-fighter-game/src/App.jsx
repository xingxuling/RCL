import React, { useEffect, useMemo, useState } from 'react';

import GameScene from './GameScene.jsx';
import { ATTACKS, GAME_LIMITS } from './gameRules.js';
import {
  AI_DIFFICULTIES,
  resetUgisAiMemory,
  setUgisAiDifficulty,
} from './ugisAi.js';

const REGIME_LABELS = {
  free: '自由间合',
  contact: '接触控制',
  close: '近域解决',
};

const INITIAL_HUD = {
  playerHp: GAME_LIMITS.maxHp,
  playerEnergy: 45,
  enemyHp: GAME_LIMITS.maxHp,
  enemyEnergy: 30,
  playerAction: '待机',
  enemyAction: '待机',
  aiRoute: 'hold_measure',
  aiRouteLabel: '守间合',
  regime: 'free',
  distance: 4.7,
  comboStep: 0,
  winner: null,
  ended: false,
  hitSerial: 0,
  lastDamage: 0,
};

function Meter({ value, max, className = '', label }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <div className={`meter ${className}`} aria-label={label}>
      <div className="meter-fill" style={{ transform: `scaleX(${ratio})` }} />
      <div className="meter-gloss" />
    </div>
  );
}

function Keycap({ children, accent = false }) {
  return <kbd className={accent ? 'keycap accent' : 'keycap'}>{children}</kbd>;
}

function SkillChip({ keyName, title, cost, energy, tone }) {
  const ready = energy >= cost;
  return (
    <div className={`skill-chip ${tone} ${ready ? 'ready' : 'locked'}`}>
      <Keycap accent={ready}>{keyName}</Keycap>
      <div>
        <strong>{title}</strong>
        <span>{cost === 0 ? '无消耗' : `${cost} 风元`}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [hud, setHud] = useState(INITIAL_HUD);
  const [resetSignal, setResetSignal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [impactSerial, setImpactSerial] = useState(0);
  const [difficultyId, setDifficultyId] = useState('normal');

  const difficulty = AI_DIFFICULTIES[difficultyId];

  useEffect(() => {
    setUgisAiDifficulty(difficultyId);
  }, [difficultyId]);

  useEffect(() => {
    if (hud.hitSerial > impactSerial) setImpactSerial(hud.hitSerial);
  }, [hud.hitSerial, impactSerial]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHelp(false), 5200);
    return () => window.clearTimeout(timer);
  }, [resetSignal]);

  const playerHpPct = Math.round((hud.playerHp / GAME_LIMITS.maxHp) * 100);
  const enemyHpPct = Math.round((hud.enemyHp / GAME_LIMITS.maxHp) * 100);
  const regimeLabel = REGIME_LABELS[hud.regime] ?? hud.regime;
  const resultText = useMemo(() => {
    if (!hud.ended) return null;
    return hud.winner === 'player' ? '胜' : '败';
  }, [hud.ended, hud.winner]);

  function restart() {
    resetUgisAiMemory();
    setPaused(false);
    setHud(INITIAL_HUD);
    setShowHelp(true);
    setResetSignal(value => value + 1);
  }

  function changeDifficulty(event) {
    const next = event.target.value;
    setDifficultyId(next);
    setUgisAiDifficulty(next);
    setPaused(false);
    setHud(INITIAL_HUD);
    setShowHelp(true);
    setResetSignal(value => value + 1);
  }

  return (
    <main className="game-shell">
      <section className="viewport">
        <GameScene onHud={setHud} resetSignal={resetSignal} paused={paused} />

        <div className="cinema-vignette" />
        {impactSerial > 0 && <div key={impactSerial} className="impact-flash" />}

        <header className="battle-top">
          <div className="brand-block">
            <span>TAOWIND DUEL PROTOTYPE</span>
            <strong>万风剑道</strong>
          </div>

          <div className="enemy-status">
            <div className="name-row enemy-name-row">
              <span className="route-pill">UGIS · {hud.aiRouteLabel}</span>
              <strong>剑道原型</strong>
              <em>{enemyHpPct}%</em>
            </div>
            <Meter value={hud.enemyHp} max={GAME_LIMITS.maxHp} className="enemy-meter" label="敌方生命" />
            <div className="enemy-subline">
              <span>{hud.enemyAction}</span>
              <span>{difficulty.label} · {regimeLabel} · {hud.distance.toFixed(1)}m</span>
            </div>
          </div>

          <div className="top-actions">
            <label className={`difficulty-picker difficulty-${difficultyId}`} title={difficulty.summary}>
              <span>AI 难度</span>
              <select value={difficultyId} onChange={changeDifficulty}>
                {Object.values(AI_DIFFICULTIES).map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="pause-button" onClick={() => setPaused(value => !value)}>
              {paused ? '继续' : '暂停'}
            </button>
          </div>
        </header>

        <div className={`regime-banner regime-${hud.regime}`}>{regimeLabel}</div>

        <section className="player-hud">
          <div className="player-main">
            <div className="name-row">
              <strong>万风剑士</strong>
              <span>{playerHpPct}%</span>
            </div>
            <Meter value={hud.playerHp} max={GAME_LIMITS.maxHp} className="player-meter" label="玩家生命" />
            <div className="energy-row">
              <span>风元</span>
              <Meter value={hud.playerEnergy} max={GAME_LIMITS.maxEnergy} className="energy-meter" label="玩家风元" />
              <strong>{Math.round(hud.playerEnergy)}</strong>
            </div>
            <div className="action-line">
              <span>{hud.playerAction}</span>
              <span className="flow-tag">{hud.comboStep ? `剑流 ${hud.comboStep}/3` : '静动皆风'}</span>
            </div>
          </div>

          <div className="skill-rack">
            <SkillChip keyName="U" title={ATTACKS.skill_u.label} cost={ATTACKS.skill_u.energyCost} energy={hud.playerEnergy} tone="blue" />
            <SkillChip keyName="I" title={ATTACKS.skill_i.label} cost={ATTACKS.skill_i.energyCost} energy={hud.playerEnergy} tone="cyan" />
            <SkillChip keyName="O" title={ATTACKS.skill_o.label} cost={ATTACKS.skill_o.energyCost} energy={hud.playerEnergy} tone="gold" />
          </div>
        </section>

        <div className="quick-controls">
          <span><Keycap>WASD</Keycap> 移动</span>
          <span><Keycap accent>J</Keycap> 三段斩</span>
          <span><Keycap>H</Keycap> 重斩</span>
          <span><Keycap>K</Keycap> 跳</span>
          <span><Keycap>L</Keycap> 瞬步</span>
          <span><Keycap>F</Keycap> 格挡</span>
        </div>

        {showHelp && !hud.ended && (
          <div className="help-card" onClick={() => setShowHelp(false)} role="button" tabIndex={0}>
            <span>默认是「普通」：AI 不再读心，可以被假动作和节奏变化骗到。</span>
            <strong>WASD 移动 · J 连斩 · L 瞬步 · U/I/O 万风技</strong>
            <small>想找虐可以把右上角调到「天机」——那就是上一版的不讲武德研究 AI。</small>
          </div>
        )}

        {paused && !hud.ended && (
          <div className="pause-overlay">
            <strong>暂停</strong>
            <p className="difficulty-summary">当前：{difficulty.label} · {difficulty.summary}</p>
            <button type="button" onClick={() => setPaused(false)}>继续战斗</button>
            <button type="button" onClick={restart}>重新开始</button>
          </div>
        )}

        {hud.ended && (
          <div className={`result-overlay ${hud.winner === 'player' ? 'victory' : 'defeat'}`}>
            <span>{hud.winner === 'player' ? 'WANFENG' : 'KENDO-INSPIRED'}</span>
            <strong>{resultText}</strong>
            <p>{hud.winner === 'player' ? '万风仍在流动。' : '路线被截断，重新来。'}</p>
            <button type="button" onClick={restart}>再战一局</button>
          </div>
        )}
      </section>
    </main>
  );
}
