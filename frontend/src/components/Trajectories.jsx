import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react'
import Plotly from 'plotly.js-dist-min'
import './Trajectories.css'

// ─── Plotly wrapper ───────────────────────────────────────────────────────────
const Plot = memo(function Plot({ data, layout, config, style }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    Plotly.react(ref.current, data, layout, { ...config, responsive: true })
  })
  useEffect(() => { const el = ref.current; return () => { if (el) Plotly.purge(el) } }, [])
  return <div ref={ref} style={style} />
})

// ─── Constants ────────────────────────────────────────────────────────────────
const GM  = 3.986e14   // m³/s²
const RE  = 6.371e6    // m
const g0  = 9.807      // m/s²
const AU  = 1.496e11   // m
const LEO = RE + 200e3 // m

const TARGETS = [
  { name: 'ISS',     r: RE+410e3,  color: '#4ade80', gm_t: GM },
  { name: 'Moon',    r: 3.844e8,   color: '#94a3b8', gm_t: 4.90e12 },
  { name: 'Mars',    r: 2.279e11,  color: '#f97316', gm_t: 4.28e13 },
  { name: 'Jupiter', r: 7.786e11,  color: '#d97706', gm_t: 1.267e17 },
  { name: 'Saturn',  r: 1.434e12,  color: '#ca8a04', gm_t: 3.793e16 },
]

const SHAPES = [
  { id: 'capsule',  name: 'Capsule',  desc: 'Blunt-body (Apollo/Crew Dragon style)' },
  { id: 'probe',    name: 'Probe',    desc: 'Streamlined robotic spacecraft' },
  { id: 'starship', name: 'Starship', desc: 'Heavy-lift reusable vehicle' },
  { id: 'cubesat',  name: 'CubeSat', desc: 'Miniature research satellite' },
]

const PHASE_COLORS = ['#f59e0b', '#22d3ee', '#4ade80', '#a78bfa', '#fb7185']

// Schematic display radii (not to scale — for clarity)
const DR_SURF   = 0.08
const DR_ATM    = 0.11
const DR_LEO    = 0.17
const DR_TARGET = 1.05

// ─── Physics ──────────────────────────────────────────────────────────────────
function computeMission({ target, dryMass_t, fuelMass_t, Isp }) {
  const m0 = (dryMass_t + fuelMass_t) * 1000
  const mf = dryMass_t * 1000
  const ve = Isp * g0

  const r1 = LEO
  const r2 = target.r

  const dv_total = ve * Math.log(m0 / mf)
  const v_leo    = Math.sqrt(GM / r1)
  const v_esc    = Math.sqrt(2 * GM / r1)

  const a_t   = (r1 + r2) / 2
  const e_t   = (r2 - r1) / (r2 + r1)
  const dv1   = v_leo * (Math.sqrt(2 * r2 / (r1 + r2)) - 1)
  const v_at_r2   = Math.sqrt(GM * (2 / r2 - 1 / a_t))
  const v_circ_r2 = Math.sqrt(GM / r2)
  const dv2   = Math.abs(v_circ_r2 - v_at_r2)
  const t_s   = Math.PI * Math.sqrt(a_t ** 3 / GM)
  const t_d   = t_s / 86400

  const fmtR = v => v >= 1e9 ? `${(v/AU).toFixed(2)} AU` : `${(v/1000).toFixed(0)} km`
  const fmtA = v => v >= 1e9 ? `${(v/AU).toFixed(3)} AU` : `${(v/1000).toFixed(0)} km`

  const phases = [
    {
      id: 'ascent', name: 'Ascent', color: PHASE_COLORS[0],
      desc: 'Engine burns to reach orbital altitude, fighting gravity and drag',
      equation: 'Δv = Isp · g₀ · ln(m₀ / mf)',
      computed: `Δv capacity = ${(dv_total/1000).toFixed(2)} km/s`,
      highlight: 'The rocket equation: mass ratio sets your speed budget. More fuel = more Δv, but heavier rockets need even more fuel.',
      vars: [
        ['Isp', `${Isp} s`,          'Specific impulse — how efficient the engine is'],
        ['g₀',  `${g0} m/s²`,       'Standard gravity constant'],
        ['m₀',  `${m0/1000} t`,      'Launch mass (dry + propellant)'],
        ['mf',  `${mf/1000} t`,      'Dry mass after all fuel is burned'],
        ['Δv',  `${(dv_total/1000).toFixed(2)} km/s`, 'Total velocity change available'],
      ],
    },
    {
      id: 'leo', name: 'LEO Orbit', color: PHASE_COLORS[1],
      desc: 'Spacecraft circles Earth at ~200 km, moving fast enough to continuously fall around the curve',
      equation: 'v_orbit = √(GM / r)',
      computed: `v_LEO = ${(v_leo/1000).toFixed(3)} km/s`,
      highlight: 'Going sideways fast enough that Earth\'s surface curves away as fast as you fall. No engine needed to stay up!',
      vars: [
        ['GM', '3.986×10¹⁴ m³/s²',   "Earth's gravitational parameter (G × mass)"],
        ['r',  `${(LEO/1000).toFixed(0)} km`,  'Orbital radius from Earth\'s center'],
        ['v',  `${(v_leo/1000).toFixed(3)} km/s`, 'Required speed for circular orbit'],
      ],
    },
    {
      id: 'burn1', name: 'Transfer Burn', color: PHASE_COLORS[2],
      desc: 'Short prograde burn at LEO to stretch the orbit into an ellipse reaching the target',
      equation: 'Δv₁ = v_LEO · (√(2r₂/(r₁+r₂)) − 1)',
      computed: `Δv₁ = ${(dv1/1000).toFixed(3)} km/s`,
      highlight: 'The Hohmann burn — the most fuel-efficient way to raise an orbit. You only burn for a short time but change your whole trajectory.',
      vars: [
        ['r₁', `${(r1/1000).toFixed(0)} km`,   'Departure orbit radius (LEO)'],
        ['r₂', fmtR(r2),                        'Target orbit radius'],
        ['Δv₁', `${(dv1/1000).toFixed(3)} km/s`, 'Speed increase to enter transfer orbit'],
      ],
    },
    {
      id: 'coast', name: 'Free Coast', color: PHASE_COLORS[3],
      desc: 'Engine off — spacecraft coasts along the ellipse. Pure gravity, Kepler\'s laws in action',
      equation: 'T_half = π · √(a³ / GM)',
      computed: `Coast time = ${t_d.toFixed(1)} days`,
      highlight: 'Kepler\'s 3rd Law: bigger orbits = slower speeds = longer travel times. Zero fuel spent during the whole coast!',
      vars: [
        ['a', fmtA(a_t),        'Semi-major axis of the transfer ellipse'],
        ['e', e_t.toFixed(4),   'Eccentricity (how stretched the ellipse is, 0=circle)'],
        ['T/2', `${t_d.toFixed(1)} days`, 'Time from Earth to target orbit'],
      ],
    },
    {
      id: 'arrival', name: 'Arrival Burn', color: PHASE_COLORS[4],
      desc: 'Retrograde burn to slow down and enter orbit around the target body',
      equation: 'Δv₂ = |v_circular − v_transfer|',
      computed: `Δv₂ = ${(dv2/1000).toFixed(3)} km/s`,
      highlight: 'Without this burn you\'d fly past the target! Slowing down "captures" you into a stable orbit.',
      vars: [
        ['v_circular',  `${(v_circ_r2/1000).toFixed(3)} km/s`, 'Speed needed to orbit the target'],
        ['v_transfer', `${(v_at_r2/1000).toFixed(3)} km/s`, 'Transfer orbit speed at arrival point'],
        ['Δv₂', `${(dv2/1000).toFixed(3)} km/s`, 'Braking burn to enter target orbit'],
      ],
    },
  ]

  return { phases, r1, r2, a_t, e_t, dv_total, dv1, dv2, t_d, v_leo, v_esc, v_at_r2, v_circ_r2 }
}

// ─── Trajectory geometry (schematic, fixed display coords) ────────────────────
// All segments are arrays of [x, y] display-coord points.
// Earth at (0,0), surface r=DR_SURF, LEO r=DR_LEO, target r=DR_TARGET
// Departure burn at (DR_LEO, 0); arrival at (-DR_TARGET, 0)

function buildSegments() {
  // Segment 0: Ascent — Bezier curve from (0, DR_SURF) to (DR_LEO, 0) with pitch-over
  const ascent = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    // Quadratic Bezier P0=(0,DR_SURF) P1=(0.04,0.22) P2=(DR_LEO,0)
    const bx = (1-t)**2*0       + 2*(1-t)*t*0.04    + t**2*DR_LEO
    const by = (1-t)**2*DR_SURF + 2*(1-t)*t*0.23    + t**2*0
    ascent.push([bx, by])
  }

  // Segment 1: LEO orbit arc — counterclockwise from 0° (DR_LEO,0) to 0°+270°=(0,-DR_LEO)
  // We'll show 270° of orbit (3/4 of a circle) to demonstrate we're really in orbit
  // End of arc should give us a nice departure point back at 0°
  // Start at 0°, go CCW: 0° → 270° (we end at 270° = (0, -DR_LEO))
  // But then transfer goes from there, which complicates geometry.
  //
  // Better: start at 0° (DR_LEO, 0), show 270° CCW arc, end at 0° again (one full 3/4 orbit)
  // then the burn happens back at 0° for the transfer. For visual clarity,
  // show ~1.25 orbits then do the transfer burn.
  //
  // Simplest: just show 270° arc from 0° to 270°, then transfer starts at 270°=(0,-DR_LEO)
  // Transfer from (0, -DR_LEO) going upper half: center at (0, -(DR_LEO+DR_TARGET)/2)
  // Hmm, that's more complex. Let me keep departure at (DR_LEO, 0).
  //
  // LEO arc: 0° → 360° (full orbit) then we're back at (DR_LEO, 0) for departure.
  const leo = []
  for (let i = 0; i <= 48; i++) {
    const theta = 0 + (2 * Math.PI) * (i / 48)  // 0° to 360° (full circle)
    leo.push([DR_LEO * Math.cos(theta), DR_LEO * Math.sin(theta)])
  }

  // Segment 2: Transfer ellipse (upper half) — from (DR_LEO, 0) to (-DR_TARGET, 0)
  const r1d = DR_LEO, r2d = DR_TARGET
  const ad  = (r1d + r2d) / 2
  const cd  = ad - r1d  // focus to center distance
  const bd  = Math.sqrt(ad * ad - cd * cd)
  const cx_ell = -cd  // ellipse center x (Earth is at right focus)

  const transfer = []
  for (let i = 0; i <= 60; i++) {
    const param = (i / 60) * Math.PI  // 0 → π (upper half)
    // param=0: x = cx_ell + ad = DR_LEO, y = 0 ✓
    // param=π: x = cx_ell - ad = -DR_TARGET, y = 0 ✓
    transfer.push([cx_ell + ad * Math.cos(param), bd * Math.sin(param)])
  }

  // Segment 3: Target orbit arc (counterclockwise from (-DR_TARGET, 0))
  const target_arc = []
  for (let i = 0; i <= 30; i++) {
    const theta = Math.PI + (Math.PI / 2) * (i / 30)  // 180° to 270°
    target_arc.push([DR_TARGET * Math.cos(theta), DR_TARGET * Math.sin(theta)])
  }

  return { ascent, leo, transfer, target_arc }
}

// Step thresholds for each phase
// Segment 0 (ascent):    steps 0-20   → phase 0
// Segment 1 (leo):       steps 21-68  → phase 1
// Segment 2 (transfer):  steps 69-73  → phase 2 (burn), 74-128 → phase 3 (coast)
// Segment 3 (arrival):   steps 129-158 → phase 4
const SEG_STARTS = [0, 21, 69, 129]  // cumulative
const TOTAL_STEPS = 159

function getPhase(step) {
  if (step < 21)  return 0
  if (step < 69)  return 1
  if (step < 74)  return 2  // brief burn phase
  if (step < 129) return 3
  return 4
}

function buildTraces(segs, step, target) {
  const { ascent, leo, transfer, target_arc } = segs
  const allSegs   = [ascent, leo, transfer, target_arc]
  const segStarts = SEG_STARTS
  const segLens   = [21, 48, 60, 30]
  const segPhase  = [0, 1, 3, 4]   // dominant phase color per segment

  const pc = PHASE_COLORS
  const traces = []

  // Earth fill circle
  const circPts = 100
  traces.push({
    type: 'scatter',
    x: Array.from({length: circPts+1}, (_, i) => DR_SURF * Math.cos(2*Math.PI*i/circPts)),
    y: Array.from({length: circPts+1}, (_, i) => DR_SURF * Math.sin(2*Math.PI*i/circPts)),
    mode: 'lines', fill: 'toself', fillcolor: '#0d2a5e',
    line: { color: '#3b82f6', width: 1.5 },
    name: 'Earth', hoverinfo: 'skip', showlegend: false,
  })

  // Atmosphere ring
  const mkRing = (r, color, dash, width) => {
    const n = 100
    return {
      type: 'scatter',
      x: Array.from({length: n+1}, (_, i) => r * Math.cos(2*Math.PI*i/n)),
      y: Array.from({length: n+1}, (_, i) => r * Math.sin(2*Math.PI*i/n)),
      mode: 'lines', line: { color, width, dash },
      hoverinfo: 'skip', showlegend: false,
    }
  }
  traces.push(mkRing(DR_ATM,    'rgba(96,165,250,0.18)', 'dot',  1))
  traces.push(mkRing(DR_LEO,    '#1e3a8a',               'dot',  1))
  traces.push(mkRing(DR_TARGET, target.color + '22',     'dot',  1))

  // Draw completed path segments
  allSegs.forEach((seg, si) => {
    const start = segStarts[si]
    const end   = start + segLens[si]
    if (step < start) return

    const nPts = Math.min(step - start + 1, segLens[si] + 1)
    const pts  = seg.slice(0, nPts)
    const col  = pc[segPhase[si]]

    // Split transfer segment: first 5 pts = burn (phase 2 color), rest = coast
    if (si === 2 && pts.length > 5) {
      traces.push({
        type: 'scatter',
        x: pts.slice(0, 5).map(p => p[0]),
        y: pts.slice(0, 5).map(p => p[1]),
        mode: 'lines', line: { color: pc[2], width: 3 },
        hoverinfo: 'skip', showlegend: false,
      })
      traces.push({
        type: 'scatter',
        x: pts.slice(4).map(p => p[0]),
        y: pts.slice(4).map(p => p[1]),
        mode: 'lines', line: { color: pc[3], width: 2 },
        hoverinfo: 'skip', showlegend: false,
      })
    } else {
      traces.push({
        type: 'scatter',
        x: pts.map(p => p[0]),
        y: pts.map(p => p[1]),
        mode: 'lines', line: { color: col, width: si === 2 ? 3 : 2 },
        hoverinfo: 'skip', showlegend: false,
      })
    }
  })

  // Spacecraft position
  let curX = 0, curY = DR_SURF
  for (let si = 0; si < allSegs.length; si++) {
    const start = segStarts[si]
    const end   = start + segLens[si]
    if (step >= end) {
      const last = allSegs[si][allSegs[si].length - 1]
      curX = last[0]; curY = last[1]
    } else if (step >= start) {
      const idx = Math.min(step - start, allSegs[si].length - 1)
      curX = allSegs[si][idx][0]
      curY = allSegs[si][idx][1]
      break
    }
  }

  const ph = getPhase(step)
  traces.push({
    type: 'scatter', x: [curX], y: [curY], mode: 'markers',
    marker: { color: pc[ph], size: 9, symbol: 'triangle-up', line: { color: '#f8fafc', width: 1 } },
    name: 'Spacecraft', hoverinfo: 'skip', showlegend: false,
  })

  // Burn flash at LEO departure
  if (step >= 69 && step < 80) {
    traces.push({
      type: 'scatter', x: [DR_LEO], y: [0], mode: 'markers',
      marker: { color: pc[2], size: 18, opacity: Math.max(0, 1 - (step-69)/11), symbol: 'circle' },
      hoverinfo: 'skip', showlegend: false,
    })
  }

  // Labels
  traces.push({
    type: 'scatter', x: [0], y: [0], mode: 'text',
    text: ['🌍'], textposition: 'middle center', textfont: { size: 16 },
    hoverinfo: 'skip', showlegend: false,
  })
  traces.push({
    type: 'scatter', x: [-DR_TARGET], y: [0], mode: 'markers+text',
    marker: { color: target.color, size: 10, symbol: 'circle' },
    text: [target.name], textposition: 'middle left',
    textfont: { color: target.color, size: 11, family: 'ui-sans-serif, sans-serif' },
    hoverinfo: 'skip', showlegend: false,
  })

  // Orbit labels
  traces.push({
    type: 'scatter',
    x: [DR_LEO * Math.cos(Math.PI * 0.35)],
    y: [DR_LEO * Math.sin(Math.PI * 0.35)],
    mode: 'text', text: ['LEO'],
    textfont: { color: '#1e3a8a', size: 9 },
    hoverinfo: 'skip', showlegend: false,
  })

  return { traces, currentPhase: ph }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TrajectoriesSection() {
  const [targetIdx, setTargetIdx] = useState(1)   // Moon
  const [shapeIdx,  setShapeIdx]  = useState(0)
  const [dryMass,   setDryMass]   = useState(5)    // tonnes
  const [fuelMass,  setFuelMass]  = useState(20)   // tonnes
  const [Isp,       setIsp]       = useState(350)
  const [animStep,  setAnimStep]  = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [speed,     setSpeed]     = useState(1)
  const intervalRef = useRef(null)

  const target  = TARGETS[targetIdx]
  const mission = useMemo(
    () => computeMission({ target, dryMass_t: dryMass, fuelMass_t: fuelMass, Isp }),
    [targetIdx, dryMass, fuelMass, Isp]
  )
  const segs = useMemo(() => buildSegments(), [])

  const { traces, currentPhase } = useMemo(
    () => buildTraces(segs, animStep, target),
    [segs, animStep, targetIdx]
  )

  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const play = useCallback(() => {
    stopInterval()
    setPlaying(true)
    intervalRef.current = setInterval(() => {
      setAnimStep(s => {
        const next = s + speed
        if (next >= TOTAL_STEPS) {
          stopInterval()
          setPlaying(false)
          return TOTAL_STEPS
        }
        return next
      })
    }, 50)
  }, [speed, stopInterval])

  const pause  = useCallback(() => { stopInterval(); setPlaying(false) }, [stopInterval])
  const reset  = useCallback(() => { pause(); setAnimStep(0) }, [pause])

  useEffect(() => () => stopInterval(), [stopInterval])

  const layout = useMemo(() => ({
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    margin: { t: 10, b: 10, l: 10, r: 10 },
    xaxis: { range: [-1.45, 1.45], showgrid: false, zeroline: false, showticklabels: false, scaleanchor: 'y', scaleratio: 1 },
    yaxis: { range: [-1.45, 1.45], showgrid: false, zeroline: false, showticklabels: false },
    showlegend: false,
    dragmode: false,
  }), [])

  const massFrac = (fuelMass / (dryMass + fuelMass) * 100).toFixed(0)

  return (
    <div className="traj-root">
      {/* Sidebar */}
      <div className="traj-sidebar">
        <div className="la-label">Destination</div>
        <div className="traj-options">
          {TARGETS.map((t, i) => (
            <button key={t.name}
              className={`traj-opt-btn ${targetIdx===i?'active':''}`}
              style={targetIdx===i ? { borderColor: t.color, color: t.color } : {}}
              onClick={() => { setTargetIdx(i); reset() }}>
              {t.name}
            </button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>Spacecraft</div>
        <div className="traj-options">
          {SHAPES.map((s, i) => (
            <button key={s.id}
              className={`traj-opt-btn ${shapeIdx===i?'active':''}`}
              onClick={() => setShapeIdx(i)}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>Mass</div>
        <div className="traj-mass-row">
          <div className="traj-mass-item">
            <span className="traj-mass-label">Dry (t)</span>
            <input className="la-input" type="number" min="1" max="500" value={dryMass}
              onChange={e => { setDryMass(+e.target.value||1); reset() }} />
          </div>
          <div className="traj-mass-item">
            <span className="traj-mass-label">Fuel (t)</span>
            <input className="la-input" type="number" min="1" max="2000" value={fuelMass}
              onChange={e => { setFuelMass(+e.target.value||1); reset() }} />
          </div>
        </div>
        <div style={{fontSize:10, color:'#334155', marginTop:2}}>Fuel = {massFrac}% of total mass</div>

        <div className="la-label" style={{marginTop:8}}>Engine Isp — {Isp} s</div>
        <input type="range" min="200" max="480" step="10" value={Isp}
          onChange={e => { setIsp(+e.target.value); reset() }}
          style={{width:'100%', accentColor:'#3b82f6'}} />
        <div className="traj-isp-hint"><span>200s</span><span>Kerosene → Hydrogen</span><span>480s</span></div>

        <div className="traj-controls">
          <button className="la-btn" style={{flex:1}}
            onClick={playing ? pause : (animStep >= TOTAL_STEPS ? reset : play)}>
            {playing ? '⏸ Pause' : animStep >= TOTAL_STEPS ? '↺ Replay' : '▶ Launch'}
          </button>
          <button className="la-btn secondary" onClick={reset}>↺</button>
        </div>

        <div className="la-label" style={{marginTop:6}}>Speed — {speed}×</div>
        <input type="range" min="1" max="6" step="1" value={speed}
          onChange={e => setSpeed(+e.target.value)}
          style={{width:'100%', accentColor:'#3b82f6'}} />

        <div className="traj-summary">
          <div className="traj-sum-row"><span className="traj-sum-k">Δv budget</span>
            <span className="traj-sum-v">{(mission.dv_total/1000).toFixed(2)} km/s</span></div>
          <div className="traj-sum-row"><span className="traj-sum-k">Mass ratio</span>
            <span className="traj-sum-v">{((dryMass+fuelMass)/dryMass).toFixed(2)}:1</span></div>
          <div className="traj-sum-row"><span className="traj-sum-k">LEO speed</span>
            <span className="traj-sum-v">{(mission.v_leo/1000).toFixed(2)} km/s</span></div>
          <div className="traj-sum-row"><span className="traj-sum-k">Burn 1 (Δv₁)</span>
            <span className="traj-sum-v">{(mission.dv1/1000).toFixed(3)} km/s</span></div>
          <div className="traj-sum-row"><span className="traj-sum-k">Coast time</span>
            <span className="traj-sum-v">{mission.t_d.toFixed(1)} days</span></div>
          <div className="traj-sum-row"><span className="traj-sum-k">Burn 2 (Δv₂)</span>
            <span className="traj-sum-v">{(mission.dv2/1000).toFixed(3)} km/s</span></div>
        </div>
      </div>

      {/* Main: plot + math cards */}
      <div className="traj-main">
        <div className="traj-plot-area">
          <Plot
            data={traces}
            layout={layout}
            config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'], responsive: true }}
            style={{ width: '100%', height: '100%' }}
          />
          {/* Phase progress chips */}
          <div className="traj-phase-bar">
            {mission.phases.map((p, i) => (
              <div key={p.id}
                className={`traj-phase-chip ${currentPhase===i?'active':''} ${currentPhase>i?'done':''}`}
                style={currentPhase===i
                  ? { background: p.color, color: '#030712', borderColor: 'transparent' }
                  : currentPhase > i
                  ? { color: p.color, background: p.color + '22', borderColor: p.color + '44' }
                  : {}}>
                {i+1}. {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Math step cards */}
        <div className="traj-math-panel">
          {mission.phases.map((p, i) => {
            const isActive = currentPhase === i
            const isDone   = currentPhase > i
            return (
              <div key={p.id}
                className={`traj-math-card ${isActive?'active':''} ${isDone?'done':''}`}
                style={{ '--phase-color': p.color }}>
                <div className="tmc-header">
                  <span className="tmc-num" style={{ background: p.color, color: '#030712' }}>{i+1}</span>
                  <span className="tmc-name" style={{ color: (isActive||isDone) ? p.color : undefined }}>{p.name}</span>
                  <span className="tmc-desc">{p.desc}</span>
                </div>
                <div className="tmc-eq">{p.equation}</div>
                <div className="tmc-result" style={{ color: (isActive||isDone) ? p.color : '#334155' }}>{p.computed}</div>
                {(isActive || isDone) && (
                  <div className="tmc-vars">
                    {p.vars.map(([k, v, d]) => (
                      <div key={k} className="tmc-var-row">
                        <span className="tmc-var-k">{k}</span>
                        <span className="tmc-var-eq">=</span>
                        <span className="tmc-var-v">{v}</span>
                        <span className="tmc-var-d">{d}</span>
                      </div>
                    ))}
                    <div className="tmc-highlight">{p.highlight}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


