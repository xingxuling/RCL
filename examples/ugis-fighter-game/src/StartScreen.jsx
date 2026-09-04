import React from 'react';

import { AI_DIFFICULTIES } from './ugisAi.js';
import { SWORD_STYLES } from './styles/swordStyles.js';

function StyleOption({ style, selected, onSelect, sideLabel }) {
  return (
    <button
      type="button"
      className={`style-option ${selected ? 'selected' : ''}`}
      style={{ '--style-accent': style.accent }}
      onClick={() => onSelect(style.id)}
      aria-pressed={selected}
    >
      <span className="style-option-dot" />
      <span className="style-option-copy">
        <b>{style.name}</b>
        <small>{style.tagline}</small>
      </span>
      <em>{sideLabel}</em>
    </button>
  );
}

function StyleChooser({ title, value, onChange, sideLabel }) {
  const selected = SWORD_STYLES[value];
  return (
    <section className="style-chooser" style={{ '--selected-accent': selected.accent }}>
      <header className="style-chooser-header">
        <span>{title}</span>
        <strong>{selected.name}</strong>
      </header>

      <div className="selected-style-summary">
        <div>
          <span>{selected.roman}</span>
          <strong>{selected.name}</strong>
        </div>
        <p>{selected.description}</p>
        <footer>
          <b>{selected.tagline}</b>
          <small>{selected.pathLabel}</small>
        </footer>
      </div>

      <div className="style-option-list" role="listbox" aria-label={title}>
        {Object.values(SWORD_STYLES).map(style => (
          <StyleOption
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
          <p>选择双方流派与 AI 难度。流派库现在拥有独立动作资源、步法与武器轮廓。</p>
        </header>

        <div className="selection-columns">
          <StyleChooser title="你的流派" value={playerStyleId} onChange={onPlayerStyleChange} sideLabel="PLAYER" />

          <div className="versus-column" aria-hidden="true">
            <span>VS</span>
            <small>{playerStyle.name}</small>
            <b>×</b>
            <small>{opponentStyle.name}</small>
          </div>

          <StyleChooser title="对手流派" value={opponentStyleId} onChange={onOpponentStyleChange} sideLabel="UGIS" />
        </div>

        <footer className="start-footer">
          <label className={`start-difficulty difficulty-${difficultyId}`} title={difficulty.summary}>
            <span>AI 难度</span>
            <select value={difficultyId} onChange={event => onDifficultyChange(event.target.value)}>
              {Object.values(AI_DIFFICULTIES).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
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
