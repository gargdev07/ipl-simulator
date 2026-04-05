import { useState, useEffect, useRef, useCallback } from "react";
 
// ─── MARKOV CHAIN ENGINE (ported from markov.py / innings.py / match.py) ───
 
const OUTCOMES = [0, 1, 2, 3, 4, 6, "W"];
const OUTCOME_RUNS = [0, 1, 2, 3, 4, 6, 0];
 
const TEAM_PROFILES = {
  Aggressive: {
    Powerplay:    [0.28, 0.22, 0.08, 0.03, 0.19, 0.12, 0.08],
    Middle:       [0.30, 0.24, 0.09, 0.02, 0.17, 0.11, 0.07],
    Death:        [0.18, 0.14, 0.06, 0.02, 0.24, 0.24, 0.12],
  },
  Conservative: {
    Powerplay:    [0.38, 0.30, 0.10, 0.03, 0.12, 0.04, 0.03],
    Middle:       [0.40, 0.32, 0.10, 0.02, 0.10, 0.03, 0.03],
    Death:        [0.28, 0.24, 0.09, 0.02, 0.20, 0.12, 0.05],
  },
  Balanced: {
    Powerplay:    [0.33, 0.26, 0.09, 0.03, 0.16, 0.07, 0.06],
    Middle:       [0.35, 0.28, 0.10, 0.02, 0.14, 0.07, 0.04],
    Death:        [0.22, 0.18, 0.07, 0.02, 0.23, 0.18, 0.10],
  },
};
 
function getPhase(over) {
  if (over <= 6) return "Powerplay";
  if (over <= 15) return "Middle";
  return "Death";
}
 
// Seeded RNG (mulberry32)
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
 
function weightedChoice(probs, rng) {
  const r = rng();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (r < cum) return i;
  }
  return probs.length - 1;
}
 
function simulateInnings(profile, target = null, seed = 42) {
  const rng = makeRng(seed);
  let totalRuns = 0, wickets = 0, totalBalls = 0;
  const phaseRuns = { Powerplay: 0, Middle: 0, Death: 0 };
  const phaseWickets = { Powerplay: 0, Middle: 0, Death: 0 };
  const phaseBalls = { Powerplay: 0, Middle: 0, Death: 0 };
  const overByOver = [];
  const ballLog = [];
 
  for (let over = 1; over <= 20; over++) {
    const phase = getPhase(over);
    const probs = TEAM_PROFILES[profile][phase];
    let runsThisOver = 0;
 
    for (let ball = 1; ball <= 6; ball++) {
      const idx = weightedChoice(probs, rng);
      const outcome = OUTCOMES[idx];
      const runs = OUTCOME_RUNS[idx];
 
      totalRuns += runs;
      totalBalls++;
      runsThisOver += runs;
      phaseRuns[phase] += runs;
      phaseBalls[phase]++;
 
      if (outcome === "W") {
        wickets++;
        phaseWickets[phase]++;
      }
 
      const ballsSoFar = (over - 1) * 6 + ball;
      const runRate = (totalRuns / ballsSoFar) * 6;
 
      ballLog.push({
        over, ball, phase,
        outcome: String(outcome), runs,
        totalRuns, wickets,
        runRate: Math.round(runRate * 100) / 100,
      });
 
      if (wickets >= 10) {
        overByOver.push(runsThisOver);
        const oversStr = ball < 6 ? `${over - 1}.${ball}` : `${over}.0`;
        return { profile, totalRuns, wickets, balls: totalBalls, oversStr, runRate: Math.round(runRate * 100) / 100, phaseRuns, phaseWickets, phaseBalls, ballLog, overByOver, allOut: true };
      }
      if (target !== null && totalRuns >= target) {
        overByOver.push(runsThisOver);
        const oversStr = ball < 6 ? `${over - 1}.${ball}` : `${over}.0`;
        return { profile, totalRuns, wickets, balls: totalBalls, oversStr, runRate: Math.round(runRate * 100) / 100, phaseRuns, phaseWickets, phaseBalls, ballLog, overByOver, allOut: false };
      }
    }
    overByOver.push(runsThisOver);
  }
 
  const runRate = Math.round((totalRuns / 120) * 600) / 100;
  return { profile, totalRuns, wickets, balls: 120, oversStr: "20.0", runRate, phaseRuns, phaseWickets, phaseBalls, ballLog, overByOver, allOut: false };
}
 
function theoreticalStats(profile) {
  const weight = { Powerplay: 36, Middle: 54, Death: 30 };
  const total = 120;
  let overallRpb = 0, overallWp = 0;
  const results = {};
  for (const phase of ["Powerplay", "Middle", "Death"]) {
    const probs = TEAM_PROFILES[profile][phase];
    const expRuns = probs.reduce((s, p, i) => s + OUTCOME_RUNS[i] * p, 0);
    const wicketP = probs[6];
    results[phase] = { expRunsPerBall: expRuns, wicketProb: wicketP, expRunRate: expRuns * 6 };
    overallRpb += expRuns * (weight[phase] / total);
    overallWp += wicketP * (weight[phase] / total);
  }
  results.Overall = { expRunsPerBall: overallRpb, wicketProb: overallWp, expTotalScore: overallRpb * 120, expWickets: overallWp * 120 };
  return results;
}
 
function winProbabilityVsTarget(targets, chasingProfile, nSims, baseSeed) {
  const result = {};
  for (const target of targets) {
    let wins = 0;
    for (let i = 0; i < nSims; i++) {
      const inn = simulateInnings(chasingProfile, target, baseSeed + i);
      if (inn.totalRuns >= target) wins++;
    }
    result[target] = wins / nSims;
  }
  return result;
}
 
// ─── COLOR PALETTE ───────────────────────────────────────────────────────────
 
const PROFILE_COLORS = { Aggressive: "#ff4d4d", Conservative: "#4da6ff", Balanced: "#4dff91" };
const PHASE_COLORS = { Powerplay: "#c084fc", Middle: "#34d399", Death: "#fb923c" };
 
// ─── MINI CHART COMPONENTS ───────────────────────────────────────────────────
 
function OverChart({ overByOver, target }) {
  const max = Math.max(...overByOver, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60, padding: "0 4px" }}>
      {overByOver.map((r, i) => {
        const phase = i < 6 ? "Powerplay" : i < 15 ? "Middle" : "Death";
        const h = Math.max(4, (r / max) * 56);
        return (
          <div key={i} title={`Over ${i + 1}: ${r} runs`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: "100%", height: h, background: PHASE_COLORS[phase], borderRadius: "2px 2px 0 0", opacity: 0.9, transition: "height 0.3s" }} />
          </div>
        );
      })}
    </div>
  );
}
 
function WinProbChart({ data }) {
  if (!data) return null;
  const targets = Object.keys(data).map(Number);
  const probs = Object.values(data);
  const w = 300, h = 120, pad = 30;
  const scaleX = (t) => pad + ((t - targets[0]) / (targets[targets.length - 1] - targets[0])) * (w - pad * 2);
  const scaleY = (p) => h - pad - p * (h - pad * 2);
  const pts = targets.map((t, i) => `${scaleX(t)},${scaleY(probs[i])}`).join(" ");
 
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="wpGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4dff91" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#4dff91" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${scaleX(targets[0])},${h - pad} ${pts} ${scaleX(targets[targets.length - 1])},${h - pad}`} fill="url(#wpGrad)" />
      <polyline points={pts} fill="none" stroke="#4dff91" strokeWidth="2.5" strokeLinejoin="round" />
      {targets.map((t, i) => (
        <circle key={t} cx={scaleX(t)} cy={scaleY(probs[i])} r="3" fill="#4dff91" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={pad} y1={scaleY(p)} x2={w - pad} y2={scaleY(p)} stroke="#ffffff15" strokeWidth="1" />
      ))}
      <text x={pad} y={h - 10} fill="#888" fontSize="9" fontFamily="monospace">{targets[0]}</text>
      <text x={w - pad} y={h - 10} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="end">{targets[targets.length - 1]}</text>
      <text x={pad - 6} y={scaleY(0.5) + 4} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="end">50%</text>
    </svg>
  );
}
 
function PhaseBar({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginBottom: 3 }}>
        <span>{label}</span><span style={{ color }}>{value}</span>
      </div>
      <div style={{ height: 5, background: "#ffffff10", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
 
// ─── BALL EVENT DISPLAY ───────────────────────────────────────────────────────
 
function BallBadge({ outcome }) {
  const styles = {
    "W": { bg: "#ff4444", color: "#fff", text: "W" },
    "6": { bg: "#c084fc", color: "#fff", text: "6" },
    "4": { bg: "#34d399", color: "#000", text: "4" },
    "0": { bg: "#333", color: "#666", text: "·" },
  };
  const s = styles[outcome] || { bg: "#2a2a3a", color: "#ddd", text: outcome };
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
      justifyContent: "center", background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, fontFamily: "monospace", flexShrink: 0,
    }}>{s.text}</div>
  );
}
 
// ─── SCORECARD ────────────────────────────────────────────────────────────────
 
function Scorecard({ innings, label, isChasing, target }) {
  if (!innings) return null;
  const won = isChasing && innings.totalRuns >= target;
  const lost = isChasing && !won && innings.balls >= 120 || (innings.allOut && isChasing);
 
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f0f1a 0%, #141428 100%)",
      border: "1px solid #ffffff15",
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: "#fff", lineHeight: 1 }}>
            {innings.totalRuns}<span style={{ fontSize: 20, color: "#555" }}>/{innings.wickets}</span>
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {innings.oversStr} ov &nbsp;·&nbsp; RR: <span style={{ color: "#ccc" }}>{innings.runRate}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: PROFILE_COLORS[innings.profile] + "22",
            color: PROFILE_COLORS[innings.profile],
            border: `1px solid ${PROFILE_COLORS[innings.profile]}44`,
          }}>{innings.profile}</div>
          {isChasing && (
            <div style={{ marginTop: 8, fontSize: 12, color: won ? "#4dff91" : "#ff4d4d", fontWeight: 700 }}>
              {won ? "✓ CHASE SUCCESSFUL" : "✗ CHASE FAILED"}
            </div>
          )}
        </div>
      </div>
 
      <OverChart overByOver={innings.overByOver} />
 
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {["Powerplay", "Middle", "Death"].map(phase => (
          <div key={phase} style={{ background: "#ffffff06", borderRadius: 10, padding: 10, borderLeft: `3px solid ${PHASE_COLORS[phase]}` }}>
            <div style={{ fontSize: 10, color: PHASE_COLORS[phase], fontWeight: 700, marginBottom: 4 }}>{phase.toUpperCase()}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
              {innings.phaseRuns[phase]}<span style={{ fontSize: 12, color: "#555" }}>/{innings.phaseWickets[phase]}w</span>
            </div>
            <div style={{ fontSize: 10, color: "#666" }}>{innings.phaseBalls[phase]} balls</div>
          </div>
        ))}
      </div>
 
      {/* Last 12 balls */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 6, letterSpacing: 1 }}>LAST 12 BALLS</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {innings.ballLog.slice(-12).map((b, i) => <BallBadge key={i} outcome={b.outcome} />)}
        </div>
      </div>
    </div>
  );
}
 
// ─── LIVE BALL ANIMATOR ───────────────────────────────────────────────────────
 
function LiveSimulator({ profileA, profileB }) {
  const [state, setState] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [currentInn, setCurrentInn] = useState(1);
  const [seed, setSeed] = useState(42);
  const ballIdx = useRef(0);
  const timerRef = useRef(null);
  const innings1 = useRef(null);
 
  const startSim = useCallback(() => {
    if (animating) return;
    const inn1 = simulateInnings(profileA, null, seed);
    innings1.current = inn1;
    const target = inn1.totalRuns + 1;
    const inn2 = simulateInnings(profileB, target, seed + 1000);
 
    ballIdx.current = 0;
    setCurrentInn(1);
    setAnimating(true);
    setState({ inn1: null, inn2: null, inn1Full: inn1, inn2Full: inn2, target, live: null, phase: "inn1" });
 
    const allBalls1 = inn1.ballLog;
    const allBalls2 = inn2.ballLog;
    let phase = "inn1";
    let idx = 0;
 
    const tick = () => {
      if (phase === "inn1") {
        if (idx < allBalls1.length) {
          const slicedLog = allBalls1.slice(0, idx + 1);
          const partial = buildPartial(inn1, slicedLog);
          setState(s => ({ ...s, inn1: partial, live: allBalls1[idx] }));
          idx++;
          timerRef.current = setTimeout(tick, 35);
        } else {
          phase = "inn2";
          idx = 0;
          setCurrentInn(2);
          setState(s => ({ ...s, inn1: inn1, phase: "inn2" }));
          timerRef.current = setTimeout(tick, 600);
        }
      } else {
        if (idx < allBalls2.length) {
          const slicedLog = allBalls2.slice(0, idx + 1);
          const partial = buildPartial(inn2, slicedLog);
          setState(s => ({ ...s, inn2: partial, live: allBalls2[idx] }));
          idx++;
          timerRef.current = setTimeout(tick, 35);
        } else {
          setState(s => ({ ...s, inn2: inn2, live: null }));
          setAnimating(false);
        }
      }
    };
    timerRef.current = setTimeout(tick, 200);
  }, [profileA, profileB, seed, animating]);
 
  useEffect(() => () => clearTimeout(timerRef.current), []);
 
  function buildPartial(full, log) {
    const last = log[log.length - 1];
    const pr = { Powerplay: 0, Middle: 0, Death: 0 };
    const pw = { Powerplay: 0, Middle: 0, Death: 0 };
    const pb = { Powerplay: 0, Middle: 0, Death: 0 };
    const obo = [];
    let cur = -1, overRuns = 0;
    for (const b of log) {
      if (b.over !== cur) { if (cur !== -1) obo.push(overRuns); overRuns = 0; cur = b.over; }
      overRuns += b.runs;
      pr[b.phase] += b.runs;
      pb[b.phase]++;
      if (b.outcome === "W") pw[b.phase]++;
    }
    obo.push(overRuns);
    const balls = log.length;
    const oversStr = `${last.over - (last.ball < 6 ? 1 : 0)}.${last.ball < 6 ? last.ball : 0}`;
    return { ...full, totalRuns: last.totalRuns, wickets: last.wickets, balls, oversStr, runRate: last.runRate, phaseRuns: pr, phaseWickets: pw, phaseBalls: pb, ballLog: log, overByOver: obo };
  }
 
  const live = state?.live;
  const isChasing = currentInn === 2;
  const target = state?.target;
 
  const outcomeLabel = live ? (live.outcome === "W" ? "WICKET!" : live.outcome === "6" ? "SIX!" : live.outcome === "4" ? "FOUR!" : live.outcome === "0" ? "Dot" : `${live.outcome} run${live.outcome !== "1" ? "s" : ""}`) : null;
 
  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={startSim} disabled={animating} style={{
          padding: "12px 28px", borderRadius: 999, border: "none", cursor: animating ? "not-allowed" : "pointer",
          background: animating ? "#333" : "linear-gradient(135deg, #4dff91, #00cc66)",
          color: animating ? "#666" : "#000", fontWeight: 800, fontSize: 14, letterSpacing: 1,
          transition: "all 0.2s",
        }}>
          {animating ? "⚡ SIMULATING..." : "▶ SIMULATE MATCH"}
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: 12 }}>Seed:</span>
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} disabled={animating}
            style={{ width: 70, padding: "8px 10px", background: "#0f0f1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 13 }} />
        </div>
        {state && !animating && (
          <div style={{ fontSize: 13, color: state.inn2Full?.totalRuns >= target ? "#4dff91" : "#ff4d4d", fontWeight: 700 }}>
            {state.inn2Full?.totalRuns >= target ? `🏆 ${profileB} wins by ${10 - state.inn2Full.wickets} wickets` : `🏆 ${profileA} wins by ${target - 1 - state.inn2Full.totalRuns} runs`}
          </div>
        )}
      </div>
 
      {/* Live ball event */}
      {live && animating && (
        <div style={{
          marginBottom: 16, padding: "12px 20px", borderRadius: 12,
          background: live.outcome === "W" ? "#ff444420" : live.outcome === "6" ? "#c084fc20" : live.outcome === "4" ? "#34d39920" : "#ffffff08",
          border: `1px solid ${live.outcome === "W" ? "#ff4444" : live.outcome === "6" ? "#c084fc" : live.outcome === "4" ? "#34d399" : "#333"}`,
          display: "flex", alignItems: "center", gap: 16, animation: "pop 0.15s ease",
        }}>
          <BallBadge outcome={live.outcome} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{outcomeLabel}</div>
            <div style={{ fontSize: 11, color: "#666" }}>Over {live.over}.{live.ball} · {live.phase} · {isChasing ? "Chase" : "1st Innings"}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: "#fff" }}>{live.totalRuns}/{live.wickets}</div>
            <div style={{ fontSize: 11, color: "#666" }}>RR: {live.runRate}</div>
          </div>
          {isChasing && target && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#aaa" }}>Need</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: live.totalRuns >= target ? "#4dff91" : "#fff" }}>
                {Math.max(0, target - live.totalRuns)}
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>off {120 - ((live.over - 1) * 6 + live.ball)} balls</div>
            </div>
          )}
        </div>
      )}
 
      {/* Scorecards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Scorecard innings={state?.inn1} label={`1st Innings · ${profileA}`} isChasing={false} />
        <Scorecard innings={state?.inn2} label={`2nd Innings · ${profileB} · Target: ${target}`} isChasing={true} target={target} />
      </div>
    </div>
  );
}
 
// ─── THEORY TAB ──────────────────────────────────────────────────────────────
 
function TheoryPanel() {
  const [profile, setProfile] = useState("Balanced");
  const stats = theoreticalStats(profile);
 
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["Aggressive", "Conservative", "Balanced"].map(p => (
          <button key={p} onClick={() => setProfile(p)} style={{
            padding: "8px 18px", borderRadius: 999, border: `1px solid ${profile === p ? PROFILE_COLORS[p] : "#333"}`,
            background: profile === p ? PROFILE_COLORS[p] + "22" : "transparent",
            color: profile === p ? PROFILE_COLORS[p] : "#666", fontWeight: 700, fontSize: 12, cursor: "pointer", letterSpacing: 0.5,
          }}>{p}</button>
        ))}
      </div>
 
      {/* Overall stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Expected Total Score", value: stats.Overall.expTotalScore.toFixed(1), unit: "runs" },
          { label: "Expected Wickets", value: stats.Overall.expWickets.toFixed(1), unit: "wickets" },
          { label: "Overall Run Rate", value: (stats.Overall.expRunsPerBall * 6).toFixed(2), unit: "per over" },
          { label: "Wicket Prob / Ball", value: (stats.Overall.wicketProb * 100).toFixed(2), unit: "%" },
        ].map(item => (
          <div key={item.label} style={{ background: "#0f0f1a", borderRadius: 12, padding: 16, border: "1px solid #ffffff0a" }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: PROFILE_COLORS[profile] }}>
              {item.value}<span style={{ fontSize: 13, color: "#555", marginLeft: 4 }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
 
      {/* Per-phase breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {["Powerplay", "Middle", "Death"].map(phase => {
          const s = stats[phase];
          const probs = TEAM_PROFILES[profile][phase];
          const labels = ["Dot", "1", "2", "3", "4", "6", "W"];
          return (
            <div key={phase} style={{ background: "#0f0f1a", borderRadius: 12, padding: 16, border: `1px solid ${PHASE_COLORS[phase]}22` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: PHASE_COLORS[phase], marginBottom: 12, letterSpacing: 1 }}>{phase.toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "#fff", marginBottom: 4 }}>
                {(s.expRunsPerBall * 6).toFixed(2)} <span style={{ fontSize: 11, color: "#555", fontWeight: 400 }}>RPO</span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>Wicket P: {(s.wicketProb * 100).toFixed(1)}% / ball</div>
              <div style={{ display: "flex", gap: 3 }}>
                {probs.map((p, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ height: 40, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: `${p * 100 * 2.5}px`, background: i === 6 ? "#ff4d4d" : PHASE_COLORS[phase], opacity: 0.8, borderRadius: "2px 2px 0 0", minHeight: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: "#555" }}>{labels[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
 
      {/* Absorbing chain */}
      <div style={{ background: "#0f0f1a", borderRadius: 12, padding: 16, border: "1px solid #ffffff0a" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Absorbing Chain — Expected Partnership (balls & runs before wicket)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {["Powerplay", "Middle", "Death"].map(phase => {
            const p = TEAM_PROFILES[profile][phase][6];
            const expBalls = p > 0 ? (1 / p).toFixed(1) : "∞";
            const nonWicketProbs = TEAM_PROFILES[profile][phase].slice(0, 6);
            const nonWicketTotal = nonWicketProbs.reduce((s, x) => s + x, 0);
            const expRunsPerBall = nonWicketProbs.reduce((s, x, i) => s + x * OUTCOME_RUNS[i], 0) / (nonWicketTotal || 1);
            const expRuns = p > 0 ? (expRunsPerBall / p).toFixed(1) : "∞";
            return (
              <div key={phase} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: PHASE_COLORS[phase], marginBottom: 8, fontWeight: 700 }}>{phase}</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#fff" }}>{expBalls}</div>
                <div style={{ fontSize: 11, color: "#555" }}>balls/wkt</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "#aaa", marginTop: 4 }}>{expRuns}</div>
                <div style={{ fontSize: 11, color: "#555" }}>runs/wkt</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
 
// ─── WIN PROBABILITY TAB ─────────────────────────────────────────────────────
 
function WinProbPanel() {
  const [chasingProfile, setChasingProfile] = useState("Balanced");
  const [nSims, setNSims] = useState(500);
  const [computing, setComputing] = useState(false);
  const [data, setData] = useState(null);
 
  const compute = useCallback(() => {
    setComputing(true);
    setTimeout(() => {
      const targets = [];
      for (let t = 140; t <= 210; t += 5) targets.push(t);
      const result = winProbabilityVsTarget(targets, chasingProfile, nSims, 0);
      setData(result);
      setComputing(false);
    }, 50);
  }, [chasingProfile, nSims]);
 
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["Aggressive", "Conservative", "Balanced"].map(p => (
            <button key={p} onClick={() => setChasingProfile(p)} style={{
              padding: "8px 16px", borderRadius: 999, border: `1px solid ${chasingProfile === p ? PROFILE_COLORS[p] : "#333"}`,
              background: chasingProfile === p ? PROFILE_COLORS[p] + "22" : "transparent",
              color: chasingProfile === p ? PROFILE_COLORS[p] : "#666", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: 12 }}>Simulations:</span>
          <select value={nSims} onChange={e => setNSims(Number(e.target.value))} style={{
            background: "#0f0f1a", border: "1px solid #333", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12
          }}>
            <option value={200}>200 (fast)</option>
            <option value={500}>500</option>
            <option value={1000}>1000 (slow)</option>
          </select>
        </div>
        <button onClick={compute} disabled={computing} style={{
          padding: "10px 24px", borderRadius: 999, border: "none", cursor: computing ? "not-allowed" : "pointer",
          background: computing ? "#333" : "linear-gradient(135deg, #c084fc, #818cf8)",
          color: computing ? "#666" : "#fff", fontWeight: 800, fontSize: 13,
        }}>
          {computing ? "Computing..." : "Run Analysis"}
        </button>
      </div>
 
      {data ? (
        <div>
          <div style={{ background: "#0f0f1a", borderRadius: 16, padding: 20, border: "1px solid #ffffff0a", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Win Probability vs Target Score · {chasingProfile} Profile · {nSims} sims each</div>
            <WinProbChart data={data} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
            {Object.entries(data).map(([target, prob]) => (
              <div key={target} style={{
                background: "#0f0f1a", borderRadius: 10, padding: 12, textAlign: "center",
                border: `1px solid ${prob > 0.5 ? "#4dff9122" : "#ff4d4d22"}`,
              }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>T:{target}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: prob > 0.5 ? "#4dff91" : "#ff4d4d" }}>
                  {(prob * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#333" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14 }}>Select a profile and run the analysis</div>
        </div>
      )}
    </div>
  );
}
 
// ─── EXPERIMENT 2 TAB ────────────────────────────────────────────────────────
 
function ProfileComparePanel() {
  const [results, setResults] = useState(null);
  const [computing, setComputing] = useState(false);
  const [nSims, setNSims] = useState(300);
 
  const run = useCallback(() => {
    setComputing(true);
    setTimeout(() => {
      const out = {};
      for (const profile of ["Aggressive", "Conservative", "Balanced"]) {
        const innings = [];
        for (let i = 0; i < nSims; i++) innings.push(simulateInnings(profile, null, 500 + i));
        const scores = innings.map(r => r.totalRuns);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const std = Math.sqrt(scores.map(s => (s - mean) ** 2).reduce((a, b) => a + b, 0) / scores.length);
        const phaseStats = {};
        for (const phase of ["Powerplay", "Middle", "Death"]) {
          phaseStats[phase] = {
            meanRuns: innings.map(r => r.phaseRuns[phase]).reduce((a, b) => a + b, 0) / nSims,
            meanWickets: innings.map(r => r.phaseWickets[phase]).reduce((a, b) => a + b, 0) / nSims,
          };
        }
        out[profile] = {
          mean: mean.toFixed(1), std: std.toFixed(1),
          p160: (100 * scores.filter(s => s >= 160).length / scores.length).toFixed(1),
          p180: (100 * scores.filter(s => s >= 180).length / scores.length).toFixed(1),
          p200: (100 * scores.filter(s => s >= 200).length / scores.length).toFixed(1),
          allOut: (100 * innings.filter(r => r.allOut).length / innings.length).toFixed(1),
          phaseStats,
          scores,
        };
      }
      setResults(out);
      setComputing(false);
    }, 50);
  }, [nSims]);
 
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: 12 }}>Simulations per profile:</span>
          <select value={nSims} onChange={e => setNSims(Number(e.target.value))} style={{
            background: "#0f0f1a", border: "1px solid #333", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12
          }}>
            <option value={200}>200</option>
            <option value={300}>300</option>
            <option value={500}>500</option>
          </select>
        </div>
        <button onClick={run} disabled={computing} style={{
          padding: "10px 24px", borderRadius: 999, border: "none", cursor: computing ? "not-allowed" : "pointer",
          background: computing ? "#333" : "linear-gradient(135deg, #fb923c, #f59e0b)",
          color: computing ? "#666" : "#000", fontWeight: 800, fontSize: 13,
        }}>
          {computing ? "Running..." : "Compare Profiles"}
        </button>
      </div>
 
      {results ? (
        <div>
          {/* Summary grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            {["Aggressive", "Conservative", "Balanced"].map(profile => {
              const r = results[profile];
              const col = PROFILE_COLORS[profile];
              const maxMean = Math.max(...Object.values(results).map(x => Number(x.mean)));
              return (
                <div key={profile} style={{ background: "#0f0f1a", borderRadius: 16, padding: 20, border: `1px solid ${col}33` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: col, marginBottom: 12, letterSpacing: 1 }}>{profile.toUpperCase()}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "monospace", color: "#fff" }}>
                    {r.mean}<span style={{ fontSize: 14, color: "#555" }}>±{r.std}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>Mean score ± σ</div>
                  <div style={{ height: 4, background: "#ffffff10", borderRadius: 2, marginBottom: 16 }}>
                    <div style={{ height: "100%", width: `${(Number(r.mean) / maxMean) * 100}%`, background: col, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[["160+", r.p160], ["180+", r.p180], ["200+", r.p200], ["All-out", r.allOut]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: col }}>{val}%</div>
                        <div style={{ fontSize: 10, color: "#555" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Phase bars */}
                  <div style={{ marginTop: 16 }}>
                    {["Powerplay", "Middle", "Death"].map(phase => (
                      <PhaseBar key={phase} label={phase} value={Number(r.phaseStats[phase].meanRuns.toFixed(1))} max={70} color={PHASE_COLORS[phase]} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#333" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏏</div>
          <div style={{ fontSize: 14 }}>Run the comparison to see profile analysis</div>
        </div>
      )}
    </div>
  );
}
 
// ─── MAIN APP ────────────────────────────────────────────────────────────────
 
const TABS = [
  { id: "sim", label: "⚡ Live Simulator" },
  { id: "theory", label: "📐 Theory" },
  { id: "winprob", label: "📊 Win Probability" },
  { id: "compare", label: "🏏 Profile Comparison" },
];
 
export default function App() {
  const [tab, setTab] = useState("sim");
  const [profileA, setProfileA] = useState("Aggressive");
  const [profileB, setProfileB] = useState("Balanced");
 
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080810",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#fff",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800;900&family=DM+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; transition: all 0.15s; }
        button:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        @keyframes pop { from { transform: scale(0.95); opacity: 0.7; } to { transform: scale(1); opacity: 1; } }
        input:focus, select:focus { outline: 1px solid #4dff91; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0f0f1a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
 
      {/* Header */}
      <div style={{
        background: "linear-gradient(180deg, #0d0d1f 0%, #080810 100%)",
        borderBottom: "1px solid #ffffff0a",
        padding: "20px 24px 0",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #4dff91, #00cc66)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0,
            }}>🏏</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>IPL Match Simulator</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 3, letterSpacing: 1 }}>STOCHASTIC PROCESSES · MARKOV CHAIN MODEL</div>
            </div>
 
            {tab === "sim" && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#555" }}>Team A:</span>
                  {["Aggressive", "Conservative", "Balanced"].map(p => (
                    <button key={p} onClick={() => setProfileA(p)} style={{
                      padding: "5px 12px", borderRadius: 999, border: `1px solid ${profileA === p ? PROFILE_COLORS[p] : "#333"}`,
                      background: profileA === p ? PROFILE_COLORS[p] + "22" : "transparent",
                      color: profileA === p ? PROFILE_COLORS[p] : "#555", fontSize: 11, cursor: "pointer", fontWeight: 700,
                    }}>{p}</button>
                  ))}
                </div>
                <span style={{ color: "#333" }}>vs</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#555" }}>Team B:</span>
                  {["Aggressive", "Conservative", "Balanced"].map(p => (
                    <button key={p} onClick={() => setProfileB(p)} style={{
                      padding: "5px 12px", borderRadius: 999, border: `1px solid ${profileB === p ? PROFILE_COLORS[p] : "#333"}`,
                      background: profileB === p ? PROFILE_COLORS[p] + "22" : "transparent",
                      color: profileB === p ? PROFILE_COLORS[p] : "#555", fontSize: 11, cursor: "pointer", fontWeight: 700,
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
 
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 18px", borderRadius: "10px 10px 0 0", border: "none",
                background: tab === t.id ? "#0f0f1a" : "transparent",
                color: tab === t.id ? "#fff" : "#555",
                fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer",
                borderBottom: tab === t.id ? "2px solid #4dff91" : "2px solid transparent",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>
 
      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {tab === "sim" && <LiveSimulator profileA={profileA} profileB={profileB} key={profileA + profileB} />}
        {tab === "theory" && <TheoryPanel />}
        {tab === "winprob" && <WinProbPanel />}
        {tab === "compare" && <ProfileComparePanel />}
      </div>
 
      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #ffffff08", color: "#333", fontSize: 11 }}>
        IPL Match Simulator · Markov Chain Ball-by-Ball Model · Stochastic Processes Project
      </div>
    </div>
  );
}
 