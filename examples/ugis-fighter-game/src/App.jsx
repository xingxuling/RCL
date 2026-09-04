import React, { useEffect, useMemo, useState } from 'react';

import GameScene from './GameScene.jsx';
import StartScreen from './StartScreen.jsx';
import { sfx } from './audio/sfx.js';
import { ATTACKS, GAME_LIMITS } from './gameRules.js';
import { getSwordStyle } from './styles/swordStyles.js';
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

function SkillChip({ keyName, attack, energy, tone }) {
  const ready = energy >= attack.energyCost;
  return (
    <div className={`skill-chip ${tone} ${ready ? 'ready' : 'locked'}`}>
      <Keycap accent={ready}>{keyName}</Keycap>
      <div>
        <strong>{attack.label}</strong>
        <span>{attack.energyCost === 0 ? '无消耗' : `${attack.energyCost} 能量`}</span>
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
  const [playerStyleId, setPlayerStyleId] = useState('wanfeng');
  const [opponentStyleId, setOpponentStyleId] = useState('kendo');
  const [gameStarted, setGameStarted] = useState(false);

  const difficulty = AI_DIFFICULTIES[difficultyId];
  const playerStyle = getSwordStyle(playerStyleId);
  const opponentStyle = getSwordStyle(opponentStyleId);
  const playerSkills = playerStyle.skills.map(id => ATTACKS[id]);

  useEffect(() => {
    setUgisAiDifficulty(difficultyId);
  }, [difficultyId]);

  useEffect(() => {
    if (hud.hitSerial > impactSerial) setImpactSerial(hud.hitSerial);
  }, [hud.hitSerial, impactSerial]);

  useEffect(() => {
    if (!gameStarted) return undefined;
    const timer = window.setTimeout(() => setShowHelp(false), 5200);
    return () => window.clearTimeout(timer);
  }, [resetSignal, gameStarted]);

  const playerHpPct = Math.round((hud.playerHp / GAME_LIMITS.maxHp) * 100);
  const enemyHpPct = Math.round((hud.enemyHp / GAME_LIMITS.maxHp) * 100);
  const regimeLabel = REGIME_LABELS[hud.regime] ?? hud.regime;
  const resultText = useMemo(() => {
    if (!hud.ended) return null;
    return hud.winner === 'player' ? '胜' : '败';
  }, [hud.ended, hud.winner]);

  function resetBattle() {
    resetUgisAiMemory();
    setUgisAiDifficulty(difficultyId);
    setPaused(false);
    setHud(INITIAL_HUD);
    setShowHelp(true);
    setResetSignal(value => value + 1);
  }

  function startGame() {
    sfx.unlock();
    resetBattle();
    setGameStarted(true);
  }

  function restart() {
    sfx.unlock();
    resetBattle();
  }

  function returnToSelection() {
    setPaused(false);
    setGameStarted(false);
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

  if (!gameStarted) {
    return (
      <StartScreen
        playerStyleId={playerStyleId}
        opponentStyleId={opponentStyleId}
        difficultyId={difficultyId}
        onPlayerStyleChange={setPlayerStyleId}
        onOpponentStyleChange={setOpponentStyleId}
        onDifficultyChange={setDifficultyId}
        onStart={startGame}
      />
    );
  }

  return (
    <main className="game-shell">
      <section className="viewport">
        <GameScene
          onHud={setHud}
          resetSignal={resetSignal}
          paused={paused}
          playerStyleId={playerStyleId}
          opponentStyleId={opponentStyleId}
        />

        <div className="cinema-vignette" />
        {impactSerial > 0 && <div key={impactSerial} className="impact-flash" />}

        <header className="battle-top">
          <div className="brand-block">
            <span>TAOWIND DUEL PROTOTYPE</span>
            <strong>{playerStyle.name}</strong>
          </div>

          <div className="enemy-status">
            <div className="name-row enemy-name-row">
              <span className="route-pill">UGIS · {hud.aiRouteLabel}</span>
              <strong>{opponentStyle.fighterName}</strong>
              <em>{enemyHpPct}%</em>
            </div>
            <Meter value={hud.enemyHp} max={GAME_LIMITS.maxHp} className="enemy-meter" label="敌方生命" />
            <div className="enemy-subline">
              <span>{hud.enemyAction}</span>
              <span>{opponentStyle.pathLabel} · {difficulty.label} · {regimeLabel} · {hud.distance.toFixed(1)}m</span>
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
              <strong>{playerStyle.fighterName}</strong>
              <span>{playerHpPct}%</span>
            </div>
            <Meter value={hud.playerHp} max={GAME_LIMITS.maxHp} className="player-meter" label="玩家生命" />
            <div className="energy-row">
              <span>{playerStyleId === 'wanfeng' ? '风元' : '气势'}</span>
              <Meter value={hud.playerEnergy} max={GAME_LIMITS.maxEnergy} className="energy-meter" label="玩家能量" />
              <strong>{Math.round(hud.playerEnergy)}</strong>
            </div>
            <div className="action-line">
              <span>{hud.playerAction}</span>
              <span className="flow-tag">{hud.comboStep ? `${playerStyle.pathLabel} ${hud.comboStep}/3` : playerStyle.guardLabel}</span>
            </div>
          </div>

          <div className="skill-rack">
            <SkillChip keyName="U" attack={playerSkills[0]} energy={hud.playerEnergy} tone={playerStyle.tone === 'orange' ? 'gold' : 'blue'} />
            <SkillChip keyName="I" attack={playerSkills[1]} energy={hud.playerEnergy} tone={playerStyle.tone === 'orange' ? 'gold' : 'cyan'} />
            <SkillChip keyName="O" attack={playerSkills[2]} energy={hud.playerEnergy} tone="gold" />
          </div>
        </section>

        <div className="quick-controls">
          <span><Keycap>WASD</Keycap> 移动</span>
          <span><Keycap accent>J</Keycap> {playerStyle.name}连段</span>
          <span><Keycap>H</Keycap> 重斩</span>
          <span><Keycap>K</Keycap> 跳</span>
          <span><Keycap>L</Keycap> 瞬步</span>
          <span><Keycap>F</Keycap> 格挡</span>
        </div>

        {showHelp && !hud.ended && (
          <div className="help-card" onClick={() => setShowHelp(false)} role="button" tabIndex={0}>
            <span>{playerStyle.name}：{playerStyle.tagline}</span>
            <strong>WASD 移动 · J 连斩 · H 重斩 · U/I/O 流派技</strong>
            <small>观察剑路：万风更偏弧线变向；剑道原型更偏中心直入与短促收束。</small>
          </div>
        )}

        {paused && !hud.ended && (
          <div className="pause-overlay">
            <strong>暂停</strong>
            <p className="difficulty-summary">{playerStyle.name} VS {opponentStyle.name} · {difficulty.label}</p>
            <button type="button" onClick={() => setPaused(false)}>继续战斗</button>
            <button type="button" onClick={restart}>重新开始</button>
            <button type="button" onClick={returnToSelection}>返回流派选择</button>
          </div>
        )}

        {hud.ended && (
          <div className={`result-overlay ${hud.winner === 'player' ? 'victory' : 'defeat'}`}>
            <span>{hud.winner === 'player' ? playerStyle.roman : opponentStyle.roman}</span>
            <strong>{resultText}</strong>
            <p>
              {hud.winner === 'player'
                ? `${playerStyle.name}取得这一局。`
                : `${opponentStyle.name}截断了这一局。`}
            </p>
            <button type="button" onClick={restart}>再战一局</button>
            <button type="button" onClick={returnToSelection}>重新选流派</button>
          </div>
        )}
      </section>
    </main>
  );
}
