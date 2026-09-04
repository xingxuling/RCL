import React, { useEffect, useMemo, useState } from 'react';

import Arena from './Arena.jsx';
import { demoSnapshots } from './demoSnapshots.js';
import { demoTimeline } from './demoTimeline.js';
import { shortRoot } from './semanticMotion.js';

const REGIME_LABELS = {
  free: '自由间合',
  contact: '接触控制',
  close: '近域解决',
};

function groupByExchange(frames) {
  const groups = new Map();
  for (const frame of frames) {
    if (!groups.has(frame.exchange)) groups.set(frame.exchange, []);
    groups.get(frame.exchange).push(frame);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([exchange, items]) => ({ exchange, frames: items }));
}

function RootTriplet({ frame }) {
  return (
    <div className="roots">
      <span title={frame.actionRoot}>Action {shortRoot(frame.actionRoot)}</span>
      <span title={frame.bridgeRoot}>Bridge {shortRoot(frame.bridgeRoot)}</span>
      <span title={frame.planRoot}>Plan {shortRoot(frame.planRoot)}</span>
    </div>
  );
}

function FighterInspector({ frame, side }) {
  if (!frame) return null;
  const isWanFeng = frame.actorNode === 'fighter:wanfeng';
  return (
    <section className={`fighter-panel ${side}`}>
      <div className="fighter-heading">
        <div>
          <p className="eyebrow">{isWanFeng ? '万风剑士' : '对手剑士'}</p>
          <h2>{isWanFeng ? '万风剑道' : '剑道原型'}</h2>
        </div>
        <span className="route-badge">{frame.routeNameZh}</span>
      </div>
      <dl>
        <div><dt>路线</dt><dd>{frame.routeId}</dd></div>
        <div><dt>式</dt><dd>{frame.wanfengForm ?? '—'}</dd></div>
        <div><dt>运动</dt><dd>{frame.motion.direction} · {frame.motion.magnitudeMilli}/1000</dd></div>
        <div><dt>线路 / 接触</dt><dd>{frame.cue.lineMode} / {frame.cue.contactMode}</dd></div>
      </dl>
      <div className="tag-row">
        {frame.animationTags.map(tag => <span key={tag}>{tag}</span>)}
      </div>
      <RootTriplet frame={frame} />
    </section>
  );
}

export default function App() {
  const exchanges = useMemo(() => groupByExchange(demoTimeline.frames), []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [resetToken, setResetToken] = useState(0);

  const current = exchanges[index];
  const currentFrames = current?.frames ?? [];
  const currentSnapshot = demoSnapshots.find(snapshot => snapshot.exchange === current?.exchange) ?? null;
  const wanfeng = currentFrames.find(frame => frame.actorNode === 'fighter:wanfeng') ?? null;
  const opponent = currentFrames.find(frame => frame.actorNode === 'fighter:opponent') ?? null;
  const regime = currentFrames[0]?.regime ?? 'free';

  useEffect(() => {
    if (!playing) return undefined;
    const delay = 1500 / speed;
    const timer = window.setTimeout(() => {
      if (index >= exchanges.length - 1) {
        setPlaying(false);
        return;
      }
      setIndex(value => Math.min(exchanges.length - 1, value + 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, speed, index, exchanges.length]);

  function moveTo(nextIndex) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(exchanges.length - 1, nextIndex)));
  }

  function reset() {
    setPlaying(false);
    setIndex(0);
    setResetToken(value => value + 1);
  }

  function replayCurrent() {
    setPlaying(false);
    setResetToken(value => value + 1);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">UGIS × RCL × Three.js</p>
          <h1>3D 剑客竞技场 · 语义回放原型</h1>
          <p className="subtitle">UGIS 选路线，RCL 保持证据链，Three.js 按 Provider Snapshot 重放动作。</p>
        </div>
        <div className="status-cluster">
          <span className="status-dot" />
          <span>ActionRoot → BridgeRoot → PlanRoot → SnapshotRoot</span>
        </div>
      </header>

      <section className="workspace">
        <div className="arena-card">
          <div className="arena-toolbar">
            <div>
              <span className={`regime regime-${regime}`}>{REGIME_LABELS[regime]}</span>
              <strong>Exchange {current?.exchange ?? '—'}</strong>
            </div>
            <span className="projection-id" title={currentSnapshot?.root ?? ''}>
              Snapshot {shortRoot(currentSnapshot?.root)}
            </span>
          </div>
          <div className="canvas-wrap">
            <Arena
              frames={currentFrames}
              snapshot={currentSnapshot}
              sequenceToken={`${resetToken}:${index}`}
              resetToken={resetToken}
            />
            <div className="canvas-legend">
              <span><i className="legend-dot wanfeng" />万风剑道</span>
              <span><i className="legend-dot opponent" />Kendo-inspired（剑道原型）</span>
            </div>
          </div>

          <div className="controls">
            <button type="button" onClick={reset}>重置</button>
            <button type="button" onClick={() => moveTo(index - 1)} disabled={index === 0}>上一交换</button>
            <button type="button" className="primary" onClick={() => setPlaying(value => !value)}>
              {playing ? '暂停' : '播放'}
            </button>
            <button type="button" onClick={() => moveTo(index + 1)} disabled={index === exchanges.length - 1}>下一交换</button>
            <button type="button" onClick={replayCurrent}>重放当前</button>
            <label>
              速度
              <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
                <option value={0.75}>0.75×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </label>
          </div>

          <div className="timeline" aria-label="交换时间轴">
            {exchanges.map((group, groupIndex) => (
              <button
                type="button"
                key={group.exchange}
                className={`timeline-step ${groupIndex === index ? 'active' : ''} ${groupIndex < index ? 'complete' : ''}`}
                onClick={() => moveTo(groupIndex)}
              >
                <span>{REGIME_LABELS[group.frames[0]?.regime]}</span>
                <strong>{group.exchange}</strong>
              </button>
            ))}
          </div>
          <p className="forward-note">Provider Snapshot 已启用：跳转会先恢复目标 exchange 的 before 快照，再正向重放该动作；这不是倒放动画。</p>
        </div>

        <aside className="inspector">
          <div className="inspector-title">
            <div>
              <p className="eyebrow">Evidence Inspector / 证据检查器</p>
              <h2>当前交换</h2>
            </div>
            <span>{index + 1}/{exchanges.length}</span>
          </div>
          <section className="snapshot-card">
            <strong>Provider Snapshot</strong>
            <span title={currentSnapshot?.root ?? ''}>{shortRoot(currentSnapshot?.root)}</span>
            <small>before → after 状态连续，Root 由 RCL realityRoot 计算</small>
          </section>
          <FighterInspector frame={wanfeng} side="wanfeng-side" />
          <FighterInspector frame={opponent} side="opponent-side" />
          <section className="boundary-card">
            <strong>当前边界</strong>
            <span>仅安全竞技解决点</span>
            <span>无人体目标</span>
            <span>无伤害优化</span>
          </section>
        </aside>
      </section>
    </main>
  );
}
