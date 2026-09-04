import React from 'react';

import { AI_DIFFICULTIES } from './ugisAi.js';
import { SWORD_STYLES } from './styles/swordStyles.js';

function StyleCard({ style, selected, onSelect, sideLabel }) {
  return (
    <button
      type="button"
      className={`style-card style-${style.id} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(style.id)}
      aria-pressed={selected}
    >
      <div className="style-card-topline">
        <span>{sideLabel}</span>
        <em>{style.roman}</em>
      </div>
      <strong>{style.name}</strong>
      <p>{style.description}</p>
      <div className="style-path-language">
        <span>剑路语言</span>
        <b>{style.tagline}</b>
      </div>
      <small>{style.pathLabel}</small>
    </button>
  );
}

function StyleChooser({ title, value, onChange, sideLabel }) {
  return (
    <section className="style-chooser">
      <header>
        <span>{title}</span>
        <strong>{SWORD_STYLES[value]?.name}</strong>
      </header>
      <div className="style-card-grid">
        {Object.values(SWORD_STYLES).map(style => (
          <StyleCard
            key={style.id}
            style={style}
            selected={value === style.id}
            onSelect={onChange}
            sideLabel={sideLabel}
          />
        ))}
      </div>
    </section>
  );
}

export default function StartScreen({
  playerStyleId,
  opponentStyleId,
  difficultyId,
  onPlayerStyleChange,
  onOpponentStyleChange,
  onDifficultyChange,
  onStart,
}) {
  const playerStyle = SWORD_STYLES[playerStyleId];
  const opponentStyle = SWORD_STYLES[opponentStyleId];
  const difficulty = AI_DIFFICULTIES[difficultyId];

  return (
    <main className="start-screen">
      <div className="start-backdrop" />
      <section className="start-panel">
        <header className="start-hero">
          <span>TAOWIND DUEL PROTOTYPE · UGIS</span>
          <h1>剑客竞技场</h1>
          <p>先选流派，再开战。现在“万风”和“剑道原型”不只是换颜色，而是各自拥有独立剑路与动作语言。</p>
        </header>

        <div className="selection-columns">
          <StyleChooser
            title="你的流派"
            value={playerStyleId}
            onChange={onPlayerStyleChange}
            sideLabel="PLAYER"
          />

          <div className="versus-column" aria-hidden="true">
            <span>VS</span>
            <small>{playerStyle.name}</small>
            <b>×</b>
            <small>{opponentStyle.name}</small>
          </div>

          <StyleChooser
            title="对手流派"
            value={opponentStyleId}
            onChange={onOpponentStyleChange}
            sideLabel="UGIS AI"
          />
        </div>

        <footer className="start-footer">
          <label className={`start-difficulty difficulty-${difficultyId}`} title={difficulty.summary}>
            <span>AI 难度</span>
            <select value={difficultyId} onChange={event => onDifficultyChange(event.target.value)}>
              {Object.values(AI_DIFFICULTIES).map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <small>{difficulty.summary}</small>
          </label>

          <button type="button" className="start-battle-button" onClick={onStart}>
            <span>开始游戏</span>
            <strong>{playerStyle.name} VS {opponentStyle.name}</strong>
          </button>
        </footer>
      </section>
    </main>
  );
}
