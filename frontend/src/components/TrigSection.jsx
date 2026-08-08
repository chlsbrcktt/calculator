import { useState, useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './TrigSection.css'

// ─── KaTeX helper ─────────────────────────────────────────────────────────────
function rk(math, display = false) {
  try { return katex.renderToString(math, { throwOnError: false, displayMode: display }) }
  catch { return `<span style="color:red">${math}</span>` }
}
function M({ latex, display = false }) {
  return (
    <span
      className={display ? 'katex-block-wrap' : 'katex-inline-wrap'}
      dangerouslySetInnerHTML={{ __html: rk(latex, display) }}
    />
  )
}

// ─── Math utilities ────────────────────────────────────────────────────────────
const PI = Math.PI
const toRad = d => d * PI / 180
const toDeg = r => r * 180 / PI
const S2 = Math.sqrt(2), S3 = Math.sqrt(3), S5 = Math.sqrt(5)

function gcd(a, b) {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b))
  return b ? gcd(b, a % b) : a || 1
}

function fmt(n, d = 4) {
  if (!isFinite(n)) return '—'
  const r = parseFloat(n.toFixed(d))
  return String(r)
}

const EXACT_MAP = [
  [0, '0'], [1, '1'], [-1, '-1'], [2, '2'], [-2, '-2'],
  [0.5, '\\dfrac{1}{2}'], [-0.5, '-\\dfrac{1}{2}'],
  [S2 / 2, '\\dfrac{\\sqrt{2}}{2}'], [-S2 / 2, '-\\dfrac{\\sqrt{2}}{2}'],
  [S3 / 2, '\\dfrac{\\sqrt{3}}{2}'], [-S3 / 2, '-\\dfrac{\\sqrt{3}}{2}'],
  [1 / S3, '\\dfrac{1}{\\sqrt{3}}'], [-1 / S3, '-\\dfrac{1}{\\sqrt{3}}'],
  [S3 / 3, '\\dfrac{\\sqrt{3}}{3}'], [-S3 / 3, '-\\dfrac{\\sqrt{3}}{3}'],
  [S3, '\\sqrt{3}'], [-S3, '-\\sqrt{3}'],
  [2 * S3 / 3, '\\dfrac{2\\sqrt{3}}{3}'], [-2 * S3 / 3, '-\\dfrac{2\\sqrt{3}}{3}'],
  [S5 / 5, '\\dfrac{\\sqrt{5}}{5}'], [-S5 / 5, '-\\dfrac{\\sqrt{5}}{5}'],
  [2 * S5 / 5, '\\dfrac{2\\sqrt{5}}{5}'], [-2 * S5 / 5, '-\\dfrac{2\\sqrt{5}}{5}'],
  [1 / S5, '\\dfrac{1}{\\sqrt{5}}'], [-1 / S5, '-\\dfrac{1}{\\sqrt{5}}'],
  [2 / S5, '\\dfrac{2}{\\sqrt{5}}'], [-2 / S5, '-\\dfrac{2}{\\sqrt{5}}'],
]

function exact(val) {
  if (!isFinite(val)) return val > 0 ? '\\infty' : '-\\infty'
  for (const [v, s] of EXACT_MAP) {
    if (Math.abs(val - v) < 1e-9) return s
  }
  return fmt(val)
}

function radLatex(rad) {
  if (Math.abs(rad) < 1e-12) return '0'
  const sign = rad < 0 ? '-' : ''
  const r = Math.abs(rad)
  for (let den = 1; den <= 24; den++) {
    const num = Math.round(r * den / PI)
    if (num > 0 && Math.abs(num * PI / den - r) < 1e-9) {
      if (den === 1) return `${sign}${num === 1 ? '' : num}\\pi`
      const g = gcd(num, den)
      const n2 = num / g, d2 = den / g
      return `${sign}\\dfrac{${n2 === 1 ? '' : n2}\\pi}{${d2}}`
    }
  }
  return fmt(rad)
}

function refAngleDeg(deg) {
  let d = ((deg % 360) + 360) % 360
  if (d <= 90) return d
  if (d <= 180) return 180 - d
  if (d <= 270) return d - 180
  return 360 - d
}

function quadrant(deg) {
  const d = ((deg % 360) + 360) % 360
  if (d === 0 || d === 90 || d === 180 || d === 270) return 0
  if (d < 90) return 1
  if (d < 180) return 2
  if (d < 270) return 3
  return 4
}

function quadrantSigns(q) {
  // returns {sin, cos, tan} sign +1 or -1
  if (q === 1) return { sin: 1, cos: 1, tan: 1 }
  if (q === 2) return { sin: 1, cos: -1, tan: -1 }
  if (q === 3) return { sin: -1, cos: -1, tan: 1 }
  return { sin: -1, cos: 1, tan: -1 }
}

const SPECIAL_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]

function trigExact(fn, deg) {
  const ref = refAngleDeg(deg)
  const q = quadrant(deg)
  const signs = q > 0 ? quadrantSigns(q) : { sin: 1, cos: 1, tan: 1 }
  const r = toRad(ref)
  const rawSin = Math.sin(r), rawCos = Math.cos(r)
  let val
  switch (fn) {
    case 'sin': val = signs.sin * rawSin; break
    case 'cos': val = signs.cos * rawCos; break
    case 'tan': val = signs.sin * rawSin / (signs.cos * rawCos); break
    case 'csc': val = 1 / (signs.sin * rawSin); break
    case 'sec': val = 1 / (signs.cos * rawCos); break
    case 'cot': val = (signs.cos * rawCos) / (signs.sin * rawSin); break
    default: val = NaN
  }
  // edge cases for 90/270
  if (!isFinite(val)) return { val, latex: fn === 'csc' || fn === 'sec' || fn === 'tan' || fn === 'cot' ? '\\text{undefined}' : exact(val) }
  return { val, latex: exact(val) }
}

function rationalize(num, den) {
  // Returns LaTeX for num/den rationalized
  // Check if den contains a square root
  const sq = Math.round(den * den)
  const g = gcd(Math.abs(Math.round(num)), sq)
  const n = Math.round(num * den) / g
  const d = sq / g
  if (d === 1) return `${Math.round(n)}`
  return `\\dfrac{${Math.round(n)}}{${Math.round(d)}}`
}

function fracLatex(num, den) {
  if (den === 0) return '\\text{undef}'
  if (num === 0) return '0'
  const g = gcd(Math.abs(num), Math.abs(den))
  let n = num / g, d = den / g
  if (d < 0) { n = -n; d = -d }
  if (d === 1) return `${n}`
  return `\\dfrac{${n}}{${d}}`
}

// ─── SVG Components ────────────────────────────────────────────────────────────

function UnitCircleSVG({ angleDeg, showPoint = true, solutions = null }) {
  const cx = 120, cy = 120, r = 85
  const a = toRad(angleDeg || 0)
  const px = cx + r * Math.cos(a)
  const py = cy - r * Math.sin(a)

  const arcPath = () => {
    const arcR = 28
    if (solutions) return null
    const x1 = cx + arcR
    const x2 = cx + arcR * Math.cos(a)
    const y2 = cy - arcR * Math.sin(a)
    const largeArc = (((angleDeg % 360) + 360) % 360) > 180 ? 1 : 0
    const sweep = 0
    if (Math.abs((angleDeg % 360 + 360) % 360) < 0.5) return null
    return `M ${x1} ${cy} A ${arcR} ${arcR} 0 ${largeArc} ${sweep} ${x2} ${y2}`
  }

  const pts = solutions || (showPoint ? [{ deg: angleDeg, color: '#059669' }] : [])

  return (
    <svg viewBox="0 0 240 240" className="trig-diagram">
      {/* axes */}
      <line x1="20" y1={cy} x2="220" y2={cy} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={cx} y1="20" x2={cx} y2="220" stroke="#94a3b8" strokeWidth="1.5" />
      <text x="215" y={cy + 4} fontSize="11" fill="#94a3b8">x</text>
      <text x={cx + 4} y="18" fontSize="11" fill="#94a3b8">y</text>
      {/* circle */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* arc */}
      {arcPath() && <path d={arcPath()} fill="none" stroke="#3b82f6" strokeWidth="2" />}
      {/* terminal ray */}
      {showPoint && (
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#2563eb" strokeWidth="2" />
      )}
      {/* solutions */}
      {pts.map((p, i) => {
        const pa = toRad(p.deg)
        const spx = cx + r * Math.cos(pa)
        const spy = cy - r * Math.sin(pa)
        return <circle key={i} cx={spx} cy={spy} r={5} fill={p.color || '#059669'} />
      })}
      {/* point coordinates */}
      {showPoint && (
        <>
          <line x1={px} y1={py} x2={px} y2={cy} stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
          <circle cx={px} cy={py} r={5} fill="#2563eb" />
          <text x={px + 7} y={py - 5} fontSize="10" fill="#1e293b">({exact(Math.cos(a))}, {exact(Math.sin(a))})</text>
        </>
      )}
      {/* +1 labels */}
      <text x={cx + r + 3} y={cy - 3} fontSize="9" fill="#94a3b8">1</text>
      <text x={cx + 3} y={cy - r - 2} fontSize="9" fill="#94a3b8">1</text>
    </svg>
  )
}

function RightTriangleSVG({ opp, adj, hyp, label = 'θ' }) {
  const W = 240, H = 180
  const bx = 30, by = H - 30 // bottom-left (angle θ)
  const rx = W - 50, ry = H - 30 // bottom-right (right angle)
  const tx = W - 50, ty = 30 // top-right (opposite)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trig-diagram">
      <polygon points={`${bx},${by} ${rx},${ry} ${tx},${ty}`} fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
      {/* right angle box */}
      <rect x={rx - 14} y={ry - 14} width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="1.5" />
      {/* angle arc */}
      <path d={`M ${bx + 25} ${by} A 25 25 0 0 0 ${bx + 18} ${by - 18}`} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      {/* labels */}
      <text x={bx + 5} y={by - 22} fontSize="12" fill="#7c3aed" fontWeight="bold">{label}</text>
      {/* sides */}
      <text x={(rx + tx) / 2 + 6} y={(ry + ty) / 2} fontSize="12" fill="#059669">
        {opp != null ? `opp=${fmt(opp)}` : 'opp'}
      </text>
      <text x={(bx + rx) / 2 - 10} y={by + 16} fontSize="12" fill="#d97706">
        {adj != null ? `adj=${fmt(adj)}` : 'adj'}
      </text>
      <text x={(bx + tx) / 2 - 38} y={(by + ty) / 2 - 5} fontSize="12" fill="#dc2626">
        {hyp != null ? `hyp=${fmt(hyp)}` : 'hyp'}
      </text>
    </svg>
  )
}

function ObliqueTriangleSVG({ a, b, c, A, B, C }) {
  const W = 240, H = 180
  // Fixed triangle shape, label with knowns
  const px = [40, 200, 120]
  const py = [150, 150, 30]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trig-diagram">
      <polygon points={`${px[0]},${py[0]} ${px[1]},${py[1]} ${px[2]},${py[2]}`}
        fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
      {/* vertex labels */}
      <text x={px[0] - 16} y={py[0] + 5} fontSize="13" fill="#7c3aed" fontWeight="bold">A</text>
      <text x={px[1] + 6} y={py[1] + 5} fontSize="13" fill="#7c3aed" fontWeight="bold">B</text>
      <text x={px[2] - 4} y={py[2] - 8} fontSize="13" fill="#7c3aed" fontWeight="bold">C</text>
      {/* side labels: a opp A (right side), b opp B (left side), c opp C (bottom) */}
      <text x={(px[1] + px[2]) / 2 + 6} y={(py[1] + py[2]) / 2} fontSize="11" fill="#059669">
        {a != null ? `a=${fmt(a)}` : 'a'}
      </text>
      <text x={(px[0] + px[2]) / 2 - 38} y={(py[0] + py[2]) / 2} fontSize="11" fill="#d97706">
        {b != null ? `b=${fmt(b)}` : 'b'}
      </text>
      <text x={(px[0] + px[1]) / 2 - 12} y={(py[0] + py[1]) / 2 + 16} fontSize="11" fill="#dc2626">
        {c != null ? `c=${fmt(c)}` : 'c'}
      </text>
      {/* angle values */}
      {A != null && <text x={px[0] + 10} y={py[0] - 4} fontSize="10" fill="#475569">{fmt(A)}°</text>}
      {B != null && <text x={px[1] - 36} y={py[1] - 4} fontSize="10" fill="#475569">{fmt(B)}°</text>}
      {C != null && <text x={px[2] + 4} y={py[2] + 16} fontSize="10" fill="#475569">{fmt(C)}°</text>}
    </svg>
  )
}

function SineGraphSVG({ A = 1, B = 1, fnType = 'sin' }) {
  const W = 260, H = 160
  const cx = 130, cy = 80
  const scaleX = 60, scaleY = 50
  const period = (2 * PI) / Math.abs(B || 1)
  const amp = Math.abs(A || 1)
  const pts = []
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * period
    const y = A * (fnType === 'sin' ? Math.sin(B * t) : Math.cos(B * t))
    const sx = cx - scaleX * 0.5 + (i / 200) * scaleX * 2
    const sy = cy - y * (scaleY / Math.max(amp, 0.01))
    pts.push(`${sx},${sy}`)
  }
  const ampY = cy - scaleY
  const ampYn = cy + scaleY
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trig-diagram">
      {/* axes */}
      <line x1="15" y1={cy} x2={W - 10} y2={cy} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={cx - scaleX * 0.5} y1="10" x2={cx - scaleX * 0.5} y2={H - 10} stroke="#94a3b8" strokeWidth="1" />
      {/* amplitude dashed lines */}
      <line x1="15" y1={ampY} x2={W - 10} y2={ampY} stroke="#10b981" strokeWidth="1" strokeDasharray="5 3" />
      <line x1="15" y1={ampYn} x2={W - 10} y2={ampYn} stroke="#10b981" strokeWidth="1" strokeDasharray="5 3" />
      <text x="18" y={ampY - 3} fontSize="10" fill="#059669">A={fmt(amp)}</text>
      <text x="18" y={ampYn + 12} fontSize="10" fill="#059669">-A={fmt(-amp)}</text>
      {/* curve */}
      <polyline points={pts.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      {/* period arrow */}
      <line x1={cx - scaleX * 0.5} y1={H - 18} x2={cx - scaleX * 0.5 + scaleX * 2} y2={H - 18}
        stroke="#7c3aed" strokeWidth="1.5" markerEnd="url(#arr)" />
      <text x={cx + 10} y={H - 8} fontSize="10" fill="#7c3aed">T={fmt(period, 3)}</text>
    </svg>
  )
}

// ─── Shared step components ────────────────────────────────────────────────────

function Step({ num, title, children }) {
  return (
    <div className="trig-step">
      <div className="trig-step-num">Step {num}</div>
      <div className="trig-step-body">
        {title && <div className="trig-step-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}

function Line({ latex }) { return <div className="trig-step-line"><M latex={latex} /></div> }
function Note({ text }) { return <div className="trig-step-note">{text}</div> }
function AnswerBox({ latex }) {
  return <div className="trig-answer-box"><M latex={latex} /></div>
}

function Explain({ text }) {
  return <div className="trig-explain">{text}</div>
}

function SixGrid({ sinV, cosV, tanV, cscV, secV, cotV }) {
  const cells = [
    ['\\sin\\theta', sinV], ['\\cos\\theta', cosV], ['\\tan\\theta', tanV],
    ['\\csc\\theta', cscV], ['\\sec\\theta', secV], ['\\cot\\theta', cotV],
  ]
  return (
    <div className="trig-six-grid">
      {cells.map(([label, val]) => (
        <div key={label} className="trig-six-cell">
          <span className="trig-six-label"><M latex={label} /></span>
          <span className="trig-six-val"><M latex={val ?? '—'} /></span>
        </div>
      ))}
    </div>
  )
}

// ─── Solvers ──────────────────────────────────────────────────────────────────

function DegRadConverter() {
  const [val, setVal] = useState('120')
  const [unit, setUnit] = useState('deg')
  const num = parseFloat(val)
  const valid = isFinite(num)

  let steps = null
  let angleDeg = 0
  if (valid) {
    if (unit === 'deg') {
      angleDeg = num
      const rad = num * PI / 180
      const g = gcd(Math.abs(Math.round(num)), 180)
      const n = Math.round(num) / g, d = 180 / g
      steps = (
        <>
          <Step num={1} title="Multiply degrees by π/180">
            <Line latex={`${num}^\\circ \\cdot \\dfrac{\\pi}{180}`} />
            <Line latex={`= \\dfrac{${Math.round(num)}\\pi}{180}`} />
            {g > 1 && <Line latex={`= ${radLatex(rad)}`} />}
            <Line latex={`\\approx ${fmt(rad, 4)} \\text{ rad}`} />
          </Step>
          <AnswerBox latex={`${num}^\\circ = ${radLatex(rad)} \\approx ${fmt(rad, 4)} \\text{ rad}`} />
        </>
      )
    } else {
      const deg = num * 180 / PI
      angleDeg = deg
      steps = (
        <>
          <Step num={1} title="Multiply radians by 180/π">
            <Line latex={`${val} \\cdot \\dfrac{180}{\\pi}`} />
            <Line latex={`= \\dfrac{${val} \\cdot 180}{\\pi}`} />
            <Line latex={`\\approx ${fmt(deg, 4)}^\\circ`} />
          </Step>
          <AnswerBox latex={`${val} \\text{ rad} = ${fmt(deg, 4)}^\\circ`} />
        </>
      )
    }
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Degree ↔ Radian Conversion</h2>
      <Explain text="Degrees and radians are two ways to measure the same angles. Degrees split a full turn into 360 equal parts; radians measure arc length on a unit circle. Converting between them is essential for using trig in calculus." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Angle</label>
              <input className="trig-input" value={val} onChange={e => setVal(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Given in</label>
              <select className="trig-select" value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="deg">Degrees</option>
                <option value="rad">Radians</option>
              </select>
            </div>
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <UnitCircleSVG angleDeg={angleDeg} />
      </div>
    </div>
  )
}

function StandardPosition() {
  const [val, setVal] = useState('-120')
  const [unit, setUnit] = useState('deg')
  const num = parseFloat(val)
  const valid = isFinite(num)
  const angleDeg = valid ? (unit === 'deg' ? num : toDeg(num)) : 0

  const q = quadrant(angleDeg)
  const refA = refAngleDeg(angleDeg)
  const normalized = ((angleDeg % 360) + 360) % 360

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Angle in Standard Position</h2>
      <Explain text="Standard position means the angle's vertex is at the origin and its initial side lies along the positive x-axis. The terminal side rotates counterclockwise (positive) or clockwise (negative). Identifying the quadrant and reference angle lets you evaluate trig functions." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Angle</label>
              <input className="trig-input" value={val} onChange={e => setVal(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Unit</label>
              <select className="trig-select" value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="deg">Degrees</option>
                <option value="rad">Radians</option>
              </select>
            </div>
          </div>
          {valid && (
            <div className="trig-steps">
              <Step num={1} title="Normalize to [0°, 360°)">
                <Line latex={`${fmt(angleDeg, 2)}^\\circ \\to ${fmt(normalized, 2)}^\\circ`} />
                <Note text="Add or subtract multiples of 360° until the angle is in [0°, 360°)." />
              </Step>
              <Step num={2} title="Identify quadrant">
                <Note text={
                  q === 0 ? `The angle lands on an axis (${fmt(normalized, 1)}°).`
                    : `The terminal side is in Quadrant ${['', 'I', 'II', 'III', 'IV'][q]}.`
                } />
                <Note text="Quadrant I: 0°–90°  •  II: 90°–180°  •  III: 180°–270°  •  IV: 270°–360°" />
              </Step>
              <Step num={3} title="Find reference angle">
                <Line latex={`\\theta_R = ${fmt(refA, 2)}^\\circ = ${radLatex(toRad(refA))}`} />
                <Note text="The reference angle is the acute angle between the terminal side and the x-axis." />
              </Step>
              <AnswerBox latex={`\\text{Quadrant } ${q === 0 ? '\\text{axis}' : ['', 'I', 'II', 'III', 'IV'][q]},\\quad \\theta_R = ${fmt(refA, 2)}^\\circ`} />
            </div>
          )}
        </div>
        <UnitCircleSVG angleDeg={angleDeg} />
      </div>
    </div>
  )
}

function FindSixFunctions() {
  const [known, setKnown] = useState('oa') // opp+adj, oh, ah
  const [v1, setV1] = useState('1')
  const [v2, setV2] = useState('2')

  const n1 = parseFloat(v1), n2 = parseFloat(v2)
  const valid = isFinite(n1) && isFinite(n2) && n1 > 0 && n2 > 0

  let opp, adj, hyp, steps = null
  if (valid) {
    if (known === 'oa') { opp = n1; adj = n2; hyp = Math.sqrt(opp * opp + adj * adj) }
    else if (known === 'oh') { opp = n1; hyp = n2; adj = Math.sqrt(hyp * hyp - opp * opp) }
    else { adj = n1; hyp = n2; opp = Math.sqrt(hyp * hyp - adj * adj) }

    const hypSq = Math.round(hyp * hyp)
    const isSurd = !Number.isInteger(hyp)

    const sinL = isSurd ? `\\dfrac{${fmt(opp)}}{\\sqrt{${hypSq}}} = ${exact(opp / hyp)}` : exact(opp / hyp)
    const cosL = isSurd ? `\\dfrac{${fmt(adj)}}{\\sqrt{${hypSq}}} = ${exact(adj / hyp)}` : exact(adj / hyp)

    steps = (
      <>
        <Step num={1} title="Find the missing side using the Pythagorean Theorem">
          {known === 'oa' && <Line latex={`hyp = \\sqrt{${fmt(opp)}^2 + ${fmt(adj)}^2} = \\sqrt{${fmt(opp * opp + adj * adj)}} = ${exact(hyp)}`} />}
          {known === 'oh' && <Line latex={`adj = \\sqrt{${fmt(hyp)}^2 - ${fmt(opp)}^2} = \\sqrt{${fmt(hyp * hyp - opp * opp)}} = ${exact(adj)}`} />}
          {known === 'ah' && <Line latex={`opp = \\sqrt{${fmt(hyp)}^2 - ${fmt(adj)}^2} = \\sqrt{${fmt(hyp * hyp - adj * adj)}} = ${exact(opp)}`} />}
        </Step>
        <Step num={2} title="Write all six trig functions">
          <Note text="SOH-CAH-TOA: sin=opp/hyp, cos=adj/hyp, tan=opp/adj. The reciprocals give csc, sec, cot." />
          <SixGrid
            sinV={exact(opp / hyp)}
            cosV={exact(adj / hyp)}
            tanV={exact(opp / adj)}
            cscV={exact(hyp / opp)}
            secV={exact(hyp / adj)}
            cotV={exact(adj / opp)}
          />
        </Step>
      </>
    )
  }

  const labels = { oa: ['Opposite', 'Adjacent'], oh: ['Opposite', 'Hypotenuse'], ah: ['Adjacent', 'Hypotenuse'] }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Find All 6 Trig Functions</h2>
      <Explain text="Given any two sides of a right triangle, you can find all six trig functions for angle θ. SOH-CAH-TOA gives sin, cos, tan; their reciprocals give csc, sec, cot. Remember to rationalize any square roots in the denominator." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Known sides</label>
              <select className="trig-select" value={known} onChange={e => setKnown(e.target.value)}>
                <option value="oa">Opposite + Adjacent</option>
                <option value="oh">Opposite + Hypotenuse</option>
                <option value="ah">Adjacent + Hypotenuse</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>{labels[known][0]}</label>
              <input className="trig-input" value={v1} onChange={e => setV1(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>{labels[known][1]}</label>
              <input className="trig-input" value={v2} onChange={e => setV2(e.target.value)} />
            </div>
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <RightTriangleSVG opp={valid ? opp : null} adj={valid ? adj : null} hyp={valid ? hyp : null} />
      </div>
    </div>
  )
}

function FromValueAndQuadrant() {
  const [fn, setFn] = useState('cos')
  const [num, setNum] = useState('3')
  const [den, setDen] = useState('5')
  const [quad, setQuad] = useState('4')

  const n = parseFloat(num), d = parseFloat(den)
  const valid = isFinite(n) && isFinite(d) && d !== 0
  const q = parseInt(quad)

  let opp, adj, hyp, steps = null
  let sinV, cosV, tanV, cscV, secV, cotV

  if (valid) {
    const ratio = n / d
    const signs = quadrantSigns(q)

    if (fn === 'sin') { opp = n; hyp = d; adj = Math.sqrt(d * d - n * n) }
    else if (fn === 'cos') { adj = n; hyp = d; opp = Math.sqrt(d * d - n * n) }
    else if (fn === 'tan') { opp = n; adj = d; hyp = Math.sqrt(n * n + d * d) }
    else if (fn === 'csc') { hyp = n; opp = d; adj = Math.sqrt(n * n - d * d) }
    else if (fn === 'sec') { hyp = n; adj = d; opp = Math.sqrt(n * n - d * d) }
    else { adj = n; opp = d; hyp = Math.sqrt(n * n + d * d) }

    const sgnNames = q === 1 ? 'All positive' : q === 2 ? 'Sin+, Cos−, Tan−' : q === 3 ? 'Sin−, Cos−, Tan+' : 'Sin−, Cos+, Tan−'

    sinV = exact(signs.sin * opp / hyp)
    cosV = exact(signs.cos * adj / hyp)
    tanV = exact(signs.tan * opp / adj)
    cscV = exact(signs.sin * hyp / opp)
    secV = exact(signs.cos * hyp / adj)
    cotV = exact(signs.tan * adj / opp)

    steps = (
      <>
        <Step num={1} title="Identify the right triangle">
          <Line latex={`\\${fn}\\theta = \\dfrac{${Math.round(n)}}{${Math.round(d)}}`} />
          <Note text={`This gives us two sides of the reference triangle.`} />
        </Step>
        <Step num={2} title="Find the third side (Pythagorean Theorem)">
          {fn === 'sin' && <Line latex={`adj = \\sqrt{${Math.round(d)}^2 - ${Math.round(n)}^2} = \\sqrt{${Math.round(d*d - n*n)}} = ${exact(adj)}`} />}
          {fn === 'cos' && <Line latex={`opp = \\sqrt{${Math.round(d)}^2 - ${Math.round(n)}^2} = \\sqrt{${Math.round(d*d - n*n)}} = ${exact(opp)}`} />}
          {fn === 'tan' && <Line latex={`hyp = \\sqrt{${Math.round(n)}^2 + ${Math.round(d)}^2} = \\sqrt{${Math.round(n*n + d*d)}} = ${exact(hyp)}`} />}
          {fn === 'csc' && <Line latex={`adj = \\sqrt{${Math.round(n)}^2 - ${Math.round(d)}^2} = \\sqrt{${Math.round(n*n - d*d)}} = ${exact(adj)}`} />}
          {fn === 'sec' && <Line latex={`opp = \\sqrt{${Math.round(n)}^2 - ${Math.round(d)}^2} = \\sqrt{${Math.round(n*n - d*d)}} = ${exact(opp)}`} />}
          {fn === 'cot' && <Line latex={`hyp = \\sqrt{${Math.round(n)}^2 + ${Math.round(d)}^2} = \\sqrt{${Math.round(n*n + d*d)}} = ${exact(hyp)}`} />}
        </Step>
        <Step num={3} title={`Apply quadrant signs (Quadrant ${['', 'I', 'II', 'III', 'IV'][q]})`}>
          <Note text={`In Quadrant ${['', 'I', 'II', 'III', 'IV'][q]}: ${sgnNames}. (All Students Take Calculus)`} />
          <SixGrid sinV={sinV} cosV={cosV} tanV={tanV} cscV={cscV} secV={secV} cotV={cotV} />
        </Step>
      </>
    )
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">All 6 Functions from One Value + Quadrant</h2>
      <Explain text="If you know one trig ratio and which quadrant the angle is in, you can find all six trig functions. Build the reference triangle from the known ratio, use the Pythagorean theorem for the missing side, then apply the ASTC sign rule." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Function</label>
              <select className="trig-select" value={fn} onChange={e => setFn(e.target.value)}>
                {['sin','cos','tan','csc','sec','cot'].map(f => <option key={f} value={f}>{f} θ =</option>)}
              </select>
            </div>
            <div className="trig-input-group">
              <label>Numerator</label>
              <input className="trig-input" value={num} onChange={e => setNum(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Denominator</label>
              <input className="trig-input" value={den} onChange={e => setDen(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Quadrant</label>
              <select className="trig-select" value={quad} onChange={e => setQuad(e.target.value)}>
                <option value="1">QI</option><option value="2">QII</option>
                <option value="3">QIII</option><option value="4">QIV</option>
              </select>
            </div>
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <RightTriangleSVG opp={valid ? opp : null} adj={valid ? adj : null} hyp={valid ? hyp : null} />
      </div>
    </div>
  )
}

function EvaluateExact() {
  const [fn, setFn] = useState('sin')
  const [val, setVal] = useState('45')
  const [unit, setUnit] = useState('deg')

  const num = parseFloat(val)
  const valid = isFinite(num)
  const angleDeg = valid ? (unit === 'deg' ? num : toDeg(num)) : 0
  const normalized = ((angleDeg % 360) + 360) % 360
  const refA = refAngleDeg(angleDeg)
  const q = quadrant(angleDeg)
  const signs = q > 0 ? quadrantSigns(q) : { sin: 1, cos: 1, tan: 1 }

  const { val: result, latex: resultLatex } = valid ? trigExact(fn, angleDeg) : { val: 0, latex: '?' }

  const cotermDiff = normalized - angleDeg
  const qLabel = q === 0 ? 'an axis' : `Quadrant ${['', 'I', 'II', 'III', 'IV'][q]}`
  const signNote = {
    sin: q === 1 || q === 2 ? 'positive in this quadrant' : 'negative in this quadrant',
    cos: q === 1 || q === 4 ? 'positive in this quadrant' : 'negative in this quadrant',
    tan: q === 1 || q === 3 ? 'positive in this quadrant' : 'negative in this quadrant',
    csc: q === 1 || q === 2 ? 'positive in this quadrant' : 'negative in this quadrant',
    sec: q === 1 || q === 4 ? 'positive in this quadrant' : 'negative in this quadrant',
    cot: q === 1 || q === 3 ? 'positive in this quadrant' : 'negative in this quadrant',
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Evaluate Exact Trig Values</h2>
      <Explain text="For special angles (multiples of 30° and 45°), trig functions have exact values like √2/2 or √3/2. The reference angle trick lets you reduce any angle to one of these, then apply the ASTC sign rule based on the quadrant." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Function</label>
              <select className="trig-select" value={fn} onChange={e => setFn(e.target.value)}>
                {['sin','cos','tan','csc','sec','cot'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="trig-input-group">
              <label>Angle</label>
              <input className="trig-input" value={val} onChange={e => setVal(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Unit</label>
              <select className="trig-select" value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="deg">°</option><option value="rad">rad</option>
              </select>
            </div>
          </div>
          {valid && (
            <div className="trig-steps">
              {Math.abs(cotermDiff) > 0.01 && (
                <Step num={1} title="Find coterminal angle in [0°, 360°)">
                  <Line latex={`${fmt(angleDeg, 2)}^\\circ \\xrightarrow{\\pm 360^\\circ} ${fmt(normalized, 2)}^\\circ`} />
                  <Note text="Add or subtract 360° until you land in [0°, 360°)." />
                </Step>
              )}
              <Step num={Math.abs(cotermDiff) > 0.01 ? 2 : 1} title={`Identify quadrant and reference angle`}>
                <Line latex={`\\text{Terminal side in } ${qLabel}`} />
                <Line latex={`\\theta_R = ${fmt(refA, 2)}^\\circ = ${radLatex(toRad(refA))}`} />
              </Step>
              <Step num={Math.abs(cotermDiff) > 0.01 ? 3 : 2} title="Apply ASTC sign rule">
                <Note text="All Students Take Calculus: QI=All+, QII=Sin+, QIII=Tan+, QIV=Cos+" />
                <Note text={`${fn} is ${signNote[fn] ?? ''}.`} />
                <Line latex={`\\${fn}(${fmt(refA, 2)}^\\circ) = ${exact(Math.abs(result))}`} />
                <Line latex={`\\${fn}(${fmt(normalized, 2)}^\\circ) = ${resultLatex}`} />
              </Step>
              <AnswerBox latex={'\\' + fn + '(' + (unit === 'deg' ? val + '^{\\circ}' : val + '\\,\\text{rad}') + ') = ' + resultLatex} />
            </div>
          )}
        </div>
        <UnitCircleSVG angleDeg={angleDeg} />
      </div>
    </div>
  )
}

function AmpPeriod() {
  const [fnType, setFnType] = useState('sin')
  const [A, setA] = useState('-3')
  const [B, setB] = useState('2')
  const [C, setC] = useState('0')
  const [D, setD] = useState('0')

  const a = parseFloat(A), b = parseFloat(B), c = parseFloat(C), d = parseFloat(D)
  const valid = isFinite(a) && isFinite(b) && b !== 0

  const amp = Math.abs(a)
  const period = (2 * PI) / Math.abs(b)
  const phaseShift = isFinite(c) && c !== 0 ? -c / b : null
  const vertShift = isFinite(d) && d !== 0 ? d : null

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Amplitude & Period</h2>
      <Explain text="For y = A·sin(Bx + C) + D, the amplitude is how tall the wave gets and the period is how long one full cycle takes. These two numbers completely describe the shape of a sinusoidal wave." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Type</label>
              <select className="trig-select" value={fnType} onChange={e => setFnType(e.target.value)}>
                <option value="sin">sin</option><option value="cos">cos</option>
              </select>
            </div>
            <div className="trig-input-group"><label>A</label><input className="trig-input" value={A} onChange={e => setA(e.target.value)} /></div>
            <div className="trig-input-group"><label>B</label><input className="trig-input" value={B} onChange={e => setB(e.target.value)} /></div>
            <div className="trig-input-group"><label>C</label><input className="trig-input" value={C} onChange={e => setC(e.target.value)} /></div>
            <div className="trig-input-group"><label>D</label><input className="trig-input" value={D} onChange={e => setD(e.target.value)} /></div>
          </div>
          {valid && (
            <div className="trig-steps">
              <Step num={1} title="Identify Amplitude">
                <Line latex={`\\text{Amplitude} = |A| = |${a}| = ${amp}`} />
                <Note text={`The wave peaks at y = ${amp} and troughs at y = ${-amp}. The ${a < 0 ? 'negative A means the wave is reflected (flipped upside-down).' : 'wave opens normally.'}`} />
              </Step>
              <Step num={2} title="Find Period">
                <Line latex={`T = \\dfrac{2\\pi}{|B|} = \\dfrac{2\\pi}{|${b}|} = \\dfrac{2\\pi}{${Math.abs(b)}} = ${radLatex(period)}`} />
                <Note text={`One full cycle completes every ${fmt(period, 4)} units along the x-axis.`} />
              </Step>
              {phaseShift !== null && (
                <Step num={3} title="Phase Shift">
                  <Line latex={`\\text{Phase Shift} = -\\dfrac{C}{B} = -\\dfrac{${c}}{${b}} = ${fmt(phaseShift, 4)}`} />
                  <Note text={`The wave shifts ${Math.abs(phaseShift).toFixed(4)} units ${phaseShift > 0 ? 'right' : 'left'}.`} />
                </Step>
              )}
              {vertShift !== null && (
                <Step num={(phaseShift !== null ? 4 : 3)} title="Vertical Shift">
                  <Line latex={`\\text{Vertical Shift} = D = ${d}`} />
                  <Note text={`The midline shifts to y = ${d}.`} />
                </Step>
              )}
              <AnswerBox latex={`\\text{Amplitude} = ${amp}, \\quad T = ${radLatex(period)} \\approx ${fmt(period, 4)}`} />
            </div>
          )}
        </div>
        <SineGraphSVG A={valid ? a : 1} B={valid ? b : 1} fnType={fnType} />
      </div>
    </div>
  )
}

function InverseTrig() {
  const [fn, setFn] = useState('arcsin')
  const [valStr, setValStr] = useState('-\\sqrt{2}/2')
  // Map display values to numbers
  const presets = [
    { label: '0', val: 0 }, { label: '1/2', val: 0.5 }, { label: '-1/2', val: -0.5 },
    { label: '√2/2', val: S2/2 }, { label: '-√2/2', val: -S2/2 },
    { label: '√3/2', val: S3/2 }, { label: '-√3/2', val: -S3/2 },
    { label: '1', val: 1 }, { label: '-1', val: -1 },
    { label: '√3/3', val: S3/3 }, { label: '-√3/3', val: -S3/3 },
    { label: '√3', val: S3 }, { label: '-√3', val: -S3 },
  ]
  const [presetIdx, setPresetIdx] = useState(3)
  const inputVal = presets[presetIdx]?.val ?? 0
  const inputLatex = presets[presetIdx]?.label ?? '?'

  const ranges = {
    arcsin: { lo: -PI / 2, hi: PI / 2, latex: '\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]' },
    arccos: { lo: 0, hi: PI, latex: '[0, \\pi]' },
    arctan: { lo: -PI / 2, hi: PI / 2, latex: '\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)' },
  }
  const range = ranges[fn]
  const fnNames = { arcsin: '\\sin^{-1}', arccos: '\\cos^{-1}', arctan: '\\tan^{-1}' }

  let result = null, resultDeg = null
  if (fn === 'arcsin') result = Math.asin(inputVal)
  else if (fn === 'arccos') result = Math.acos(inputVal)
  else result = Math.atan(inputVal)

  resultDeg = toDeg(result)
  const resultLatex = radLatex(result)
  const absVal = Math.abs(inputVal)
  const refAngleResult = Math.abs(result)

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Inverse Trig Functions</h2>
      <Explain text="Inverse trig functions answer: 'what angle has this trig value?' Each function has a restricted range so the answer is unique. arcsin and arctan return angles in [−π/2, π/2]; arccos returns angles in [0, π]." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Function</label>
              <select className="trig-select" value={fn} onChange={e => setFn(e.target.value)}>
                <option value="arcsin">arcsin (sin⁻¹)</option>
                <option value="arccos">arccos (cos⁻¹)</option>
                <option value="arctan">arctan (tan⁻¹)</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>Value</label>
              <select className="trig-select" value={presetIdx} onChange={e => setPresetIdx(parseInt(e.target.value))}>
                {presets.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="trig-steps">
            <Step num={1} title="State the problem">
              <Line latex={`\\text{Find } \\theta = ${fnNames[fn]}\\!\\left(${inputLatex}\\right)`} />
              <Note text={`We want the angle θ such that ${fn.replace('arc','')}(θ) = ${inputLatex}.`} />
            </Step>
            <Step num={2} title="Apply the range restriction">
              <Line latex={`\\text{Range of } ${fnNames[fn]}: ${range.latex}`} />
              <Note text={`The answer must fall in this interval — this is what makes the inverse unique.`} />
            </Step>
            <Step num={3} title="Find the reference angle from the unit circle">
              <Line latex={'\\' + fn.replace('arc', '') + '\\!\\left(' + exact(absVal) + '\\right) = ' + radLatex(refAngleResult)} />
            </Step>
            <Step num={4} title="Apply sign based on range">
              <Line latex={`\\theta = ${resultLatex} = ${fmt(result, 4)} \\text{ rad} \\approx ${fmt(resultDeg, 2)}^\\circ`} />
            </Step>
            <AnswerBox latex={`${fnNames[fn]}\\!\\left(${inputLatex}\\right) = ${resultLatex}`} />
          </div>
        </div>
        <UnitCircleSVG angleDeg={resultDeg} />
      </div>
    </div>
  )
}

function CompositeTrig() {
  const [outer, setOuter] = useState('tan')
  const [inner, setInner] = useState('arcsin')
  const [presetIdx, setPresetIdx] = useState(4)

  const presets = [
    { label: '1/2', val: 0.5 }, { label: '-1/2', val: -0.5 },
    { label: '√2/2', val: S2/2 }, { label: '-√2/2', val: -S2/2 },
    { label: '√3/2', val: S3/2 }, { label: '-√3/2', val: -S3/2 },
    { label: '1', val: 1 }, { label: '-1', val: -1 },
    { label: '√3/3', val: S3/3 }, { label: '-√3/3', val: -S3/3 },
  ]
  const pval = presets[presetIdx]?.val ?? 0
  const plab = presets[presetIdx]?.label ?? '?'

  let theta = null
  if (inner === 'arcsin') theta = Math.asin(pval)
  else if (inner === 'arccos') theta = Math.acos(pval)
  else theta = Math.atan(pval)

  const thetaDeg = toDeg(theta)
  // Build triangle from inner value
  let opp, adj, hyp
  if (inner === 'arcsin') { opp = pval; hyp = 1; adj = Math.sqrt(1 - pval * pval) }
  else if (inner === 'arccos') { adj = pval; hyp = 1; opp = Math.sqrt(1 - pval * pval) }
  else { opp = pval; adj = 1; hyp = Math.sqrt(1 + pval * pval) }
  // Sign of opp based on theta quadrant
  const cosTheta = Math.cos(theta), sinTheta = Math.sin(theta)
  let result
  if (outer === 'sin') result = sinTheta
  else if (outer === 'cos') result = cosTheta
  else if (outer === 'tan') result = sinTheta / cosTheta
  else if (outer === 'csc') result = 1 / sinTheta
  else if (outer === 'sec') result = 1 / cosTheta
  else result = cosTheta / sinTheta

  const innerNames = { arcsin: '\\sin^{-1}', arccos: '\\cos^{-1}', arctan: '\\tan^{-1}' }
  const innerFn = inner.replace('arc', '')
  const ranges = { arcsin: '[-\\pi/2,\\, \\pi/2]', arccos: '[0,\\, \\pi]', arctan: '(-\\pi/2,\\, \\pi/2)' }
  const qNum = theta < 0 ? (outer === 'arcsin' || outer === 'arctan' ? 4 : 3) : 1
  const qLabel = theta < 0 ? 'Quadrant IV (negative angle, range restriction)' : 'Quadrant I'

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Composite Trig Expressions</h2>
      <Explain text="Expressions like tan(sin⁻¹(x)) combine an outer trig function with an inverse trig function. The trick: let θ be the inverse trig value, build a right triangle from that definition, then read off the outer function from the triangle sides." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Outer</label>
              <select className="trig-select" value={outer} onChange={e => setOuter(e.target.value)}>
                {['sin','cos','tan','csc','sec','cot'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="trig-input-group">
              <label>Inner</label>
              <select className="trig-select" value={inner} onChange={e => setInner(e.target.value)}>
                <option value="arcsin">sin⁻¹</option>
                <option value="arccos">cos⁻¹</option>
                <option value="arctan">tan⁻¹</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>Value</label>
              <select className="trig-select" value={presetIdx} onChange={e => setPresetIdx(parseInt(e.target.value))}>
                {presets.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="trig-steps">
            <Step num={1} title="Let θ equal the inner expression">
              <Line latex={`\\theta = ${innerNames[inner]}(${plab}), \\text{ so } ${innerFn}(\\theta) = ${plab}`} />
              <Line latex={`\\text{Range: } ${ranges[inner]}`} />
            </Step>
            <Step num={2} title="Build the reference triangle">
              {inner === 'arcsin' && <Line latex={`opp = ${exact(pval)},\\ hyp = 1,\\ adj = \\sqrt{1 - (${exact(pval)})^2} = ${exact(adj)}`} />}
              {inner === 'arccos' && <Line latex={`adj = ${exact(pval)},\\ hyp = 1,\\ opp = \\sqrt{1 - (${exact(pval)})^2} = ${exact(opp)}`} />}
              {inner === 'arctan' && <Line latex={`opp = ${exact(pval)},\\ adj = 1,\\ hyp = \\sqrt{1 + (${exact(pval)})^2} = ${exact(hyp)}`} />}
              <Note text={`Since the range puts θ in ${qLabel}, signs are assigned accordingly.`} />
            </Step>
            <Step num={3} title={`Evaluate ${outer}(θ) from the triangle`}>
              <Line latex={`\\${outer}(\\theta) = ${exact(result)}`} />
            </Step>
            <AnswerBox latex={`\\${outer}\\!\\left(${innerNames[inner]}(${plab})\\right) = ${exact(result)}`} />
          </div>
        </div>
        <RightTriangleSVG opp={Math.abs(opp)} adj={Math.abs(adj)} hyp={Math.abs(hyp)} />
      </div>
    </div>
  )
}

function TrigEquations() {
  const PRESETS = [
    {
      label: 'cos θ + 1 = 0',
      solve: () => {
        return {
          steps: [
            { title: 'Isolate cos θ', lines: ['\\cos\\theta + 1 = 0', '\\cos\\theta = -1'], note: 'Subtract 1 from both sides.' },
            { title: 'Find angles where cos = −1', lines: ['\\cos\\theta = -1 \\text{ at the point } (-1, 0)'], note: 'On the unit circle, cosine equals −1 only at θ = π.' },
            { title: 'State all solutions on [0, 2π)', lines: ['\\theta = \\pi'] },
          ],
          answer: '\\theta = \\pi',
          solutions: [{ deg: 180, color: '#059669' }],
        }
      }
    },
    {
      label: 'tan(2θ) = −1',
      solve: () => {
        return {
          steps: [
            { title: 'Let x = 2θ, solve tan x = −1', lines: ['\\tan(x) = -1'], note: 'tan = −1 in Quadrant II and Quadrant IV.' },
            { title: 'Reference angle', lines: ['\\tan(\\pi/4) = 1 \\Rightarrow \\theta_R = \\pi/4'], note: '' },
            { title: 'Find x in [0, 4π) since x = 2θ and θ ∈ [0, 2π)', lines: [
              'x = \\dfrac{3\\pi}{4},\\ \\dfrac{7\\pi}{4},\\ \\dfrac{11\\pi}{4},\\ \\dfrac{15\\pi}{4}'
            ], note: 'Each coterminal solution adds π.' },
            { title: 'Divide by 2 to get θ', lines: [
              '\\theta = \\dfrac{3\\pi}{8},\\ \\dfrac{7\\pi}{8},\\ \\dfrac{11\\pi}{8},\\ \\dfrac{15\\pi}{8}'
            ] },
          ],
          answer: '\\theta = \\dfrac{3\\pi}{8},\\ \\dfrac{7\\pi}{8},\\ \\dfrac{11\\pi}{8},\\ \\dfrac{15\\pi}{8}',
          solutions: [
            { deg: 67.5, color: '#059669' }, { deg: 157.5, color: '#059669' },
            { deg: 247.5, color: '#059669' }, { deg: 337.5, color: '#059669' },
          ],
        }
      }
    },
    {
      label: 'cos θ = −√3/2',
      solve: () => {
        return {
          steps: [
            { title: 'Identify the reference angle', lines: ['\\cos(\\theta_R) = \\dfrac{\\sqrt{3}}{2}', '\\theta_R = \\dfrac{\\pi}{6} = 30^\\circ'], note: 'cos is √3/2 at 30°.' },
            { title: 'cos is negative in Quadrants II and III', lines: [
              '\\text{QII: } \\theta = \\pi - \\dfrac{\\pi}{6} = \\dfrac{5\\pi}{6}',
              '\\text{QIII: } \\theta = \\pi + \\dfrac{\\pi}{6} = \\dfrac{7\\pi}{6}'
            ], note: 'Apply ASTC: cosine is negative in QII and QIII.' },
          ],
          answer: '\\theta = \\dfrac{5\\pi}{6},\\ \\dfrac{7\\pi}{6}',
          solutions: [{ deg: 150, color: '#059669' }, { deg: 210, color: '#7c3aed' }],
        }
      }
    },
    {
      label: '2 − √3 csc θ = 0',
      solve: () => {
        return {
          steps: [
            { title: 'Isolate csc θ', lines: ['-\\sqrt{3}\\csc\\theta = -2', '\\csc\\theta = \\dfrac{2}{\\sqrt{3}} = \\dfrac{2\\sqrt{3}}{3}'], note: 'So sin θ = √3/2.' },
            { title: 'Reference angle', lines: ['\\sin(\\pi/3) = \\dfrac{\\sqrt{3}}{2} \\Rightarrow \\theta_R = \\dfrac{\\pi}{3}'], note: '' },
            { title: 'sin is positive in QI and QII', lines: [
              '\\theta = \\dfrac{\\pi}{3},\\ \\pi - \\dfrac{\\pi}{3} = \\dfrac{2\\pi}{3}'
            ] },
          ],
          answer: '\\theta = \\dfrac{\\pi}{3},\\ \\dfrac{2\\pi}{3}',
          solutions: [{ deg: 60, color: '#059669' }, { deg: 120, color: '#7c3aed' }],
        }
      }
    },
  ]

  const [idx, setIdx] = useState(0)
  const { steps, answer, solutions } = PRESETS[idx].solve()

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Solve Trig Equations on [0, 2π)</h2>
      <Explain text="Solving a trig equation means finding all angles in [0, 2π) where the equation is true. The key steps: isolate the trig function, find the reference angle from the unit circle, then use the ASTC rule to find all valid quadrants." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Equation</label>
              <select className="trig-select" value={idx} onChange={e => setIdx(parseInt(e.target.value))}>
                {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="trig-steps">
            {steps.map((s, i) => (
              <Step key={i} num={i + 1} title={s.title}>
                {s.lines.map((l, j) => <Line key={j} latex={l} />)}
                {s.note && <Note text={s.note} />}
              </Step>
            ))}
            <AnswerBox latex={answer} />
          </div>
        </div>
        <UnitCircleSVG angleDeg={solutions[0]?.deg ?? 0} solutions={solutions} showPoint={false} />
      </div>
    </div>
  )
}

function VerifyIdentity() {
  const IDENTITIES = [
    {
      label: 'sec θ · sin θ = tan θ',
      steps: [
        { title: 'Start with the left side', lines: ['\\sec\\theta \\cdot \\sin\\theta'], note: 'Work on the more complex side.' },
        { title: 'Replace sec θ with its reciprocal identity', lines: ['= \\dfrac{1}{\\cos\\theta} \\cdot \\sin\\theta'], note: 'sec θ = 1/cos θ' },
        { title: 'Multiply and simplify', lines: ['= \\dfrac{\\sin\\theta}{\\cos\\theta}', '= \\tan\\theta \\ \\checkmark'], note: 'sin θ / cos θ = tan θ by definition.' },
      ]
    },
    {
      label: 'sin u · csc u − cos²u = sin²u',
      steps: [
        { title: 'Start with the left side', lines: ['\\sin u \\cdot \\csc u - \\cos^2 u'], note: '' },
        { title: 'Replace csc u with its reciprocal', lines: ['= \\sin u \\cdot \\dfrac{1}{\\sin u} - \\cos^2 u'], note: 'csc u = 1/sin u' },
        { title: 'Simplify the product', lines: ['= \\dfrac{\\sin u}{\\sin u} - \\cos^2 u', '= 1 - \\cos^2 u'], note: 'sin u / sin u = 1' },
        { title: 'Apply Pythagorean identity', lines: ['= \\sin^2 u \\ \\checkmark'], note: '1 − cos²u = sin²u (Pythagorean identity)' },
      ]
    },
    {
      label: '9sec²θ − 5tan²θ = 5 + 4sec²θ',
      steps: [
        { title: 'Start with the left side', lines: ['9\\sec^2\\theta - 5\\tan^2\\theta'], note: '' },
        { title: 'Rewrite tan²θ using Pythagorean identity', lines: ['\\tan^2\\theta = \\sec^2\\theta - 1', '= 9\\sec^2\\theta - 5(\\sec^2\\theta - 1)'], note: 'tan²θ + 1 = sec²θ → tan²θ = sec²θ − 1' },
        { title: 'Distribute and simplify', lines: ['= 9\\sec^2\\theta - 5\\sec^2\\theta + 5', '= 4\\sec^2\\theta + 5', '= 5 + 4\\sec^2\\theta \\ \\checkmark'], note: 'Combine like terms.' },
      ]
    },
  ]

  const [idx, setIdx] = useState(0)
  const { steps } = IDENTITIES[idx]

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Verify a Trig Identity</h2>
      <Explain text="Verifying an identity means showing that two expressions are always equal. The strategy: work on one side (usually the more complex one) and transform it using known identities until it matches the other side. Never move terms across the equals sign." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Identity</label>
              <select className="trig-select" value={idx} onChange={e => setIdx(parseInt(e.target.value))}>
                {IDENTITIES.map((id, i) => <option key={i} value={i}>{id.label}</option>)}
              </select>
            </div>
          </div>
          <div className="trig-steps">
            {steps.map((s, i) => (
              <Step key={i} num={i + 1} title={s.title}>
                {s.lines.map((l, j) => <Line key={j} latex={l} />)}
                {s.note && <Note text={s.note} />}
              </Step>
            ))}
            <AnswerBox latex={'\\checkmark \\text{ Identity verified}'} />
          </div>
        </div>
        <div className="trig-identity-box">
          <div className="trig-identity-note">
            <strong>Key Identities:</strong>
            <div><M latex={'\\sin^2\\theta + \\cos^2\\theta = 1'} /></div>
            <div><M latex={'\\tan^2\\theta + 1 = \\sec^2\\theta'} /></div>
            <div><M latex={'1 + \\cot^2\\theta = \\csc^2\\theta'} /></div>
            <div><M latex={'\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}'} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SumDifference() {
  const SPECIAL = [
    { label: '0°', deg: 0 }, { label: '30°', deg: 30 }, { label: '45°', deg: 45 },
    { label: '60°', deg: 60 }, { label: '90°', deg: 90 }, { label: '120°', deg: 120 },
    { label: '150°', deg: 150 }, { label: '180°', deg: 180 },
  ]
  const [formula, setFormula] = useState('sin-')
  const [ai, setAi] = useState(0) // index for A
  const [bi, setBi] = useState(2) // index for B (default 80 → 45°)

  const A = SPECIAL[ai].deg, B = SPECIAL[bi].deg
  const [fn, op] = formula.split('')
  const combined = op === '+' ? A + B : A - B
  const combNorm = ((combined % 360) + 360) % 360
  const sinA = exact(Math.sin(toRad(A))), cosA = exact(Math.cos(toRad(A)))
  const sinB = exact(Math.sin(toRad(B))), cosB = exact(Math.cos(toRad(B)))
  const result = fn === 's'
    ? (op === '+' ? Math.sin(toRad(A)) * Math.cos(toRad(B)) + Math.cos(toRad(A)) * Math.sin(toRad(B))
      : Math.sin(toRad(A)) * Math.cos(toRad(B)) - Math.cos(toRad(A)) * Math.sin(toRad(B)))
    : (op === '+' ? Math.cos(toRad(A)) * Math.cos(toRad(B)) - Math.sin(toRad(A)) * Math.sin(toRad(B))
      : Math.cos(toRad(A)) * Math.cos(toRad(B)) + Math.sin(toRad(A)) * Math.sin(toRad(B)))

  const fnFull = fn === 's' ? 'sin' : 'cos'
  const formulaLatex = fn === 's' && op === '+'
    ? '\\sin(A+B) = \\sin A\\cos B + \\cos A\\sin B'
    : fn === 's' && op === '-'
      ? '\\sin(A-B) = \\sin A\\cos B - \\cos A\\sin B'
      : fn === 'c' && op === '+'
        ? '\\cos(A+B) = \\cos A\\cos B - \\sin A\\sin B'
        : '\\cos(A-B) = \\cos A\\cos B + \\sin A\\sin B'

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Sum & Difference Formulas</h2>
      <Explain text="Sum and difference formulas let you evaluate trig functions of combined angles like sin(75°) = sin(45° + 30°). They're essential for simplifying expressions and appear frequently in calculus." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Formula</label>
              <select className="trig-select" value={formula} onChange={e => setFormula(e.target.value)}>
                <option value="s+">sin(A+B)</option><option value="s-">sin(A−B)</option>
                <option value="c+">cos(A+B)</option><option value="c-">cos(A−B)</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>Angle A</label>
              <select className="trig-select" value={ai} onChange={e => setAi(parseInt(e.target.value))}>
                {SPECIAL.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
              </select>
            </div>
            <div className="trig-input-group">
              <label>Angle B</label>
              <select className="trig-select" value={bi} onChange={e => setBi(parseInt(e.target.value))}>
                {SPECIAL.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="trig-steps">
            <Step num={1} title="Write the formula">
              <Line latex={formulaLatex} />
            </Step>
            <Step num={2} title="Substitute values from unit circle">
              <Line latex={`A = ${A}^\\circ,\\ B = ${B}^\\circ`} />
              <Line latex={`\\sin(${A}^\\circ)=${sinA},\\ \\cos(${A}^\\circ)=${cosA}`} />
              <Line latex={`\\sin(${B}^\\circ)=${sinB},\\ \\cos(${B}^\\circ)=${cosB}`} />
            </Step>
            <Step num={3} title="Compute">
              {fn === 's' ? (
                <>
                  <Line latex={`= (${sinA})(${cosB}) ${op} (${cosA})(${sinB})`} />
                  <Line latex={`= ${exact(result)}`} />
                </>
              ) : (
                <>
                  <Line latex={`= (${cosA})(${cosB}) ${op === '+' ? '-' : '+'} (${sinA})(${sinB})`} />
                  <Line latex={`= ${exact(result)}`} />
                </>
              )}
              <Note text={`This equals ${fnFull}(${combined}°) = ${fnFull}(${combNorm}°)`} />
            </Step>
            <AnswerBox latex={`${fnFull}(${A}^\\circ ${op} ${B}^\\circ) = ${exact(result)}`} />
          </div>
        </div>
        <UnitCircleSVG angleDeg={combNorm} />
      </div>
    </div>
  )
}

function DoubleHalfAngle() {
  const [fn, setFn] = useState('cos')
  const [numStr, setNumStr] = useState('3')
  const [denStr, setDenStr] = useState('5')
  const [quad, setQuad] = useState('1')

  const n = parseFloat(numStr), d = parseFloat(denStr)
  const valid = isFinite(n) && isFinite(d) && d !== 0
  const q = parseInt(quad)
  const signs = quadrantSigns(q)

  let sinT, cosT
  if (valid) {
    if (fn === 'cos') { cosT = signs.cos * n / d; sinT = signs.sin * Math.sqrt(1 - (n / d) ** 2) }
    else { sinT = signs.sin * n / d; cosT = signs.cos * Math.sqrt(1 - (n / d) ** 2) }
  }

  const sin2t = valid ? 2 * sinT * cosT : null
  const cos2t = valid ? 2 * cosT * cosT - 1 : null
  const tan2t = valid && cos2t !== 0 ? sin2t / cos2t : null
  // Half angle — need to know quadrant of θ/2
  const sinH = valid ? Math.sqrt((1 - cosT) / 2) : null
  const cosH = valid ? Math.sqrt((1 + cosT) / 2) : null
  const tanH = valid && cosH !== 0 ? sinH / cosH : null

  const halfNote = `Sign of sin(θ/2) and cos(θ/2) depends on which quadrant θ/2 is in.`

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Double & Half Angle Formulas</h2>
      <Explain text="Double angle formulas give sin(2θ) and cos(2θ) in terms of sin θ and cos θ. Half angle formulas do the reverse. These come from the sum formulas with A = B = θ, and are especially useful when you know one trig value and need the others." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Known</label>
              <select className="trig-select" value={fn} onChange={e => setFn(e.target.value)}>
                <option value="cos">cos θ =</option><option value="sin">sin θ =</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>Numerator</label>
              <input className="trig-input" value={numStr} onChange={e => setNumStr(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Denominator</label>
              <input className="trig-input" value={denStr} onChange={e => setDenStr(e.target.value)} />
            </div>
            <div className="trig-input-group">
              <label>Quadrant</label>
              <select className="trig-select" value={quad} onChange={e => setQuad(e.target.value)}>
                <option value="1">QI</option><option value="2">QII</option>
                <option value="3">QIII</option><option value="4">QIV</option>
              </select>
            </div>
          </div>
          {valid && (
            <div className="trig-steps">
              <Step num={1} title="Find sin θ and cos θ">
                <Line latex={`\\${fn}\\theta = \\dfrac{${Math.round(n)}}{${Math.round(d)}}`} />
                <Line latex={`\\sin\\theta = ${exact(sinT)}, \\quad \\cos\\theta = ${exact(cosT)}`} />
                <Note text="Use Pythagorean identity and quadrant signs." />
              </Step>
              <Step num={2} title="Double angle formulas">
                <Line latex={`\\sin(2\\theta) = 2\\sin\\theta\\cos\\theta = 2(${exact(sinT)})(${exact(cosT)}) = ${exact(sin2t)}`} />
                <Line latex={`\\cos(2\\theta) = 2\\cos^2\\theta - 1 = 2(${exact(cosT)})^2 - 1 = ${exact(cos2t)}`} />
                <Line latex={`\\tan(2\\theta) = \\dfrac{\\sin(2\\theta)}{\\cos(2\\theta)} = ${exact(tan2t)}`} />
              </Step>
              <Step num={3} title="Half angle formulas">
                <Line latex={`\\sin\\!\\left(\\dfrac{\\theta}{2}\\right) = \\pm\\sqrt{\\dfrac{1 - \\cos\\theta}{2}} = \\pm\\sqrt{\\dfrac{1 - ${exact(cosT)}}{2}} = ${exact(sinH)}`} />
                <Line latex={`\\cos\\!\\left(\\dfrac{\\theta}{2}\\right) = \\pm\\sqrt{\\dfrac{1 + \\cos\\theta}{2}} = \\pm\\sqrt{\\dfrac{1 + ${exact(cosT)}}{2}} = ${exact(cosH)}`} />
                <Line latex={`\\tan\\!\\left(\\dfrac{\\theta}{2}\\right) = \\dfrac{\\sin(\\theta/2)}{\\cos(\\theta/2)} = ${exact(tanH)}`} />
                <Note text={halfNote} />
              </Step>
              <AnswerBox latex={`\\sin(2\\theta)=${exact(sin2t)},\\ \\cos(2\\theta)=${exact(cos2t)},\\ \\tan(2\\theta)=${exact(tan2t)}`} />
            </div>
          )}
        </div>
        <div />
      </div>
    </div>
  )
}

function SolveRightTriangle() {
  const [knownAngle, setKnownAngle] = useState('A')
  const [angleVal, setAngleVal] = useState('20')
  const [sideLabel, setSideLabel] = useState('b')
  const [sideVal, setSideVal] = useState('6')

  const A = parseFloat(angleVal), s = parseFloat(sideVal)
  const valid = isFinite(A) && isFinite(s) && A > 0 && A < 90 && s > 0

  let a, b, c, B
  if (valid) {
    B = 90 - A
    const Ar = toRad(A)
    if (sideLabel === 'a') {
      a = s; c = a / Math.sin(Ar); b = c * Math.cos(Ar)
    } else if (sideLabel === 'b') {
      b = s; a = b * Math.tan(Ar); c = b / Math.cos(Ar)
    } else {
      c = s; a = c * Math.sin(Ar); b = c * Math.cos(Ar)
    }
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Solve a Right Triangle</h2>
      <Explain text="Given one acute angle and one side of a right triangle, you can find all remaining sides and angles using SOH-CAH-TOA. The three sides are: opposite (opp), adjacent (adj), and hypotenuse (hyp) relative to angle A." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Known angle A =</label>
              <input className="trig-input" value={angleVal} onChange={e => setAngleVal(e.target.value)} />
              <span style={{ fontSize: 12, color: '#64748b' }}>°</span>
            </div>
            <div className="trig-input-group">
              <label>Known side</label>
              <select className="trig-select" value={sideLabel} onChange={e => setSideLabel(e.target.value)}>
                <option value="a">a (opposite A)</option>
                <option value="b">b (adjacent to A)</option>
                <option value="c">c (hypotenuse)</option>
              </select>
            </div>
            <div className="trig-input-group">
              <label>= </label>
              <input className="trig-input" value={sideVal} onChange={e => setSideVal(e.target.value)} />
            </div>
          </div>
          {valid && (
            <div className="trig-steps">
              <Step num={1} title="Find the other angle">
                <Line latex={`B = 90^\\circ - A = 90^\\circ - ${fmt(A, 2)}^\\circ = ${fmt(B, 2)}^\\circ`} />
                <Note text="The three angles sum to 180°; the right angle is 90°." />
              </Step>
              <Step num={2} title="Find missing sides using SOH-CAH-TOA">
                {sideLabel === 'b' && (
                  <>
                    <Line latex={`\\tan(A) = \\dfrac{a}{b} \\Rightarrow a = b \\cdot \\tan(${fmt(A,2)}^\\circ) = ${fmt(s)} \\cdot \\tan(${fmt(A,2)}^\\circ) = ${fmt(a)}`} />
                    <Line latex={`\\cos(A) = \\dfrac{b}{c} \\Rightarrow c = \\dfrac{b}{\\cos(${fmt(A,2)}^\\circ)} = \\dfrac{${fmt(s)}}{\\cos(${fmt(A,2)}^\\circ)} = ${fmt(c)}`} />
                  </>
                )}
                {sideLabel === 'a' && (
                  <>
                    <Line latex={`\\sin(A) = \\dfrac{a}{c} \\Rightarrow c = \\dfrac{a}{\\sin(${fmt(A,2)}^\\circ)} = \\dfrac{${fmt(s)}}{\\sin(${fmt(A,2)}^\\circ)} = ${fmt(c)}`} />
                    <Line latex={`b = \\sqrt{c^2 - a^2} = \\sqrt{${fmt(c*c,2)} - ${fmt(s*s,2)}} = ${fmt(b)}`} />
                  </>
                )}
                {sideLabel === 'c' && (
                  <>
                    <Line latex={`a = c\\cdot\\sin(${fmt(A,2)}^\\circ) = ${fmt(s)}\\cdot\\sin(${fmt(A,2)}^\\circ) = ${fmt(a)}`} />
                    <Line latex={`b = c\\cdot\\cos(${fmt(A,2)}^\\circ) = ${fmt(s)}\\cdot\\cos(${fmt(A,2)}^\\circ) = ${fmt(b)}`} />
                  </>
                )}
              </Step>
              <AnswerBox latex={`A=${fmt(A,2)}^\\circ,\\ B=${fmt(B,2)}^\\circ,\\ a=${fmt(a)},\\ b=${fmt(b)},\\ c=${fmt(c)}`} />
            </div>
          )}
        </div>
        <RightTriangleSVG opp={valid ? a : null} adj={valid ? b : null} hyp={valid ? c : null} />
      </div>
    </div>
  )
}

function LawOfSines() {
  const [caseType, setCaseType] = useState('AAS')
  // AAS: A, B, a → find b, c, C
  // ASA: A, B, c → find a, b, C
  // SSA: A, a, b → ambiguous
  const [v1, setV1] = useState('40')
  const [v2, setV2] = useState('45')
  const [v3, setV3] = useState('4')

  const n1 = parseFloat(v1), n2 = parseFloat(v2), n3 = parseFloat(v3)
  const valid = isFinite(n1) && isFinite(n2) && isFinite(n3)

  let steps = null, triProps = {}
  if (valid) {
    if (caseType === 'AAS') {
      const A = n1, B = n2, a = n3
      const C = 180 - A - B
      const ratio = a / Math.sin(toRad(A))
      const b = ratio * Math.sin(toRad(B))
      const c = ratio * Math.sin(toRad(C))
      triProps = { A, B, C: fmt(C), a, b: fmt(b), c: fmt(c) }
      steps = (
        <>
          <Step num={1} title="Find the third angle">
            <Line latex={`C = 180^\\circ - ${fmt(A,1)}^\\circ - ${fmt(B,1)}^\\circ = ${fmt(C,1)}^\\circ`} />
          </Step>
          <Step num={2} title="Set up the Law of Sines ratio">
            <Line latex={`\\dfrac{a}{\\sin A} = \\dfrac{${fmt(a)}}{\\sin(${fmt(A,1)}^\\circ)} = ${fmt(ratio,4)}`} />
          </Step>
          <Step num={3} title="Solve for b and c">
            <Line latex={`b = ${fmt(ratio,4)} \\cdot \\sin(${fmt(B,1)}^\\circ) = ${fmt(b)}`} />
            <Line latex={`c = ${fmt(ratio,4)} \\cdot \\sin(${fmt(C,1)}^\\circ) = ${fmt(c)}`} />
          </Step>
          <AnswerBox latex={`C=${fmt(C,1)}^\\circ,\\ b=${fmt(b)},\\ c=${fmt(c)}`} />
        </>
      )
    } else if (caseType === 'ASA') {
      const A = n1, B = n2, c = n3
      const C = 180 - A - B
      const ratio = c / Math.sin(toRad(C))
      const a = ratio * Math.sin(toRad(A))
      const b = ratio * Math.sin(toRad(B))
      triProps = { A, B, C: fmt(C), a: fmt(a), b: fmt(b), c }
      steps = (
        <>
          <Step num={1} title="Find the third angle">
            <Line latex={`C = 180^\\circ - ${fmt(A,1)}^\\circ - ${fmt(B,1)}^\\circ = ${fmt(C,1)}^\\circ`} />
          </Step>
          <Step num={2} title="Set up ratio using known side c">
            <Line latex={`\\dfrac{c}{\\sin C} = \\dfrac{${fmt(c)}}{\\sin(${fmt(C,1)}^\\circ)} = ${fmt(ratio,4)}`} />
          </Step>
          <Step num={3} title="Solve for a and b">
            <Line latex={`a = ${fmt(ratio,4)} \\cdot \\sin(${fmt(A,1)}^\\circ) = ${fmt(a)}`} />
            <Line latex={`b = ${fmt(ratio,4)} \\cdot \\sin(${fmt(B,1)}^\\circ) = ${fmt(b)}`} />
          </Step>
          <AnswerBox latex={`C=${fmt(C,1)}^\\circ,\\ a=${fmt(a)},\\ b=${fmt(b)}`} />
        </>
      )
    } else {
      // SSA ambiguous case
      const A = n1, a = n2, b = n3
      const h = b * Math.sin(toRad(A))
      let conclusion, solutionLatex
      if (a < h) {
        conclusion = 'No triangle exists (a < h).'
        solutionLatex = '\\text{No solution}'
      } else if (Math.abs(a - h) < 1e-6) {
        conclusion = 'Exactly one right triangle.'
        const B = 90, C = 90 - A, c = b * Math.cos(toRad(A))
        solutionLatex = `B=90^\\circ,\\ C=${fmt(C,1)}^\\circ,\\ c=${fmt(c)}`
        triProps = { A, B, C: fmt(C), a, b, c: fmt(c) }
      } else if (a < b) {
        // Two triangles
        const sinB = b * Math.sin(toRad(A)) / a
        const B1 = toDeg(Math.asin(sinB))
        const B2 = 180 - B1
        const C1 = 180 - A - B1, C2 = 180 - A - B2
        const c1 = a * Math.sin(toRad(C1)) / Math.sin(toRad(A))
        const c2 = C2 > 0 ? a * Math.sin(toRad(C2)) / Math.sin(toRad(A)) : null
        conclusion = c2 !== null ? 'Two triangles exist.' : 'One triangle exists.'
        solutionLatex = c2 !== null
          ? `B_1=${fmt(B1,1)}^\\circ,\\ C_1=${fmt(C1,1)}^\\circ,\\ c_1=${fmt(c1)}; \\quad B_2=${fmt(B2,1)}^\\circ,\\ C_2=${fmt(C2,1)}^\\circ,\\ c_2=${fmt(c2)}`
          : `B=${fmt(B1,1)}^\\circ,\\ C=${fmt(C1,1)}^\\circ,\\ c=${fmt(c1)}`
        triProps = { A, a, b }
      } else {
        const sinB = b * Math.sin(toRad(A)) / a
        const B = toDeg(Math.asin(sinB))
        const C = 180 - A - B
        const c = a * Math.sin(toRad(C)) / Math.sin(toRad(A))
        conclusion = 'One triangle exists.'
        solutionLatex = `B=${fmt(B,1)}^\\circ,\\ C=${fmt(C,1)}^\\circ,\\ c=${fmt(c)}`
        triProps = { A, B: fmt(B), C: fmt(C), a, b, c: fmt(c) }
      }
      steps = (
        <>
          <Step num={1} title="Compute the height (ambiguous case check)">
            <Line latex={`h = b \\cdot \\sin A = ${fmt(b)} \\cdot \\sin(${fmt(A,1)}^\\circ) = ${fmt(h)}`} />
            <Note text="Compare a to h to determine how many triangles exist." />
          </Step>
          <Step num={2} title="Determine number of triangles">
            <Line latex={`a = ${fmt(a)},\\ h = ${fmt(h)},\\ b = ${fmt(b)}`} />
            <Note text={a < h ? 'a < h: no triangle.' : Math.abs(a-h)<1e-6 ? 'a = h: one right triangle.' : a < b ? 'h < a < b: possibly two triangles.' : 'a ≥ b: one triangle.'} />
            <Note text={conclusion} />
          </Step>
          <AnswerBox latex={solutionLatex} />
        </>
      )
    }
  }

  const labels = {
    AAS: ['Angle A (°)', 'Angle B (°)', 'Side a'],
    ASA: ['Angle A (°)', 'Angle B (°)', 'Side c (between A,B)'],
    SSA: ['Angle A (°)', 'Side a', 'Side b'],
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Law of Sines</h2>
      <Explain text="The Law of Sines: a/sin A = b/sin B = c/sin C. Use it when you know two angles and any side (AAS or ASA), or two sides and a non-included angle (SSA). The SSA case is the 'ambiguous case' — it can produce 0, 1, or 2 triangles." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Case</label>
              <select className="trig-select" value={caseType} onChange={e => setCaseType(e.target.value)}>
                <option value="AAS">AAS</option><option value="ASA">ASA</option><option value="SSA">SSA (Ambiguous)</option>
              </select>
            </div>
            {labels[caseType].map((lbl, i) => (
              <div key={i} className="trig-input-group">
                <label>{lbl}</label>
                <input className="trig-input"
                  value={[v1, v2, v3][i]}
                  onChange={e => [setV1, setV2, setV3][i](e.target.value)} />
              </div>
            ))}
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <ObliqueTriangleSVG {...triProps} />
      </div>
    </div>
  )
}

function LawOfCosines() {
  const [caseType, setCaseType] = useState('SAS')
  const [v1, setV1] = useState('3')
  const [v2, setV2] = useState('4')
  const [v3, setV3] = useState('30')

  const n1 = parseFloat(v1), n2 = parseFloat(v2), n3 = parseFloat(v3)
  const valid = isFinite(n1) && isFinite(n2) && isFinite(n3)

  let steps = null, triProps = {}
  if (valid) {
    if (caseType === 'SAS') {
      const b = n1, c = n2, A = n3
      const a2 = b * b + c * c - 2 * b * c * Math.cos(toRad(A))
      const a = Math.sqrt(a2)
      const cosB = (a2 + c * c - b * b) / (2 * a * c)
      const B = toDeg(Math.acos(cosB))
      const C = 180 - A - B
      triProps = { a: fmt(a), b, c, A, B: fmt(B), C: fmt(C) }
      steps = (
        <>
          <Step num={1} title="Apply Law of Cosines to find a">
            <Line latex={`a^2 = b^2 + c^2 - 2bc\\cos A`} />
            <Line latex={`a^2 = ${fmt(b)}^2 + ${fmt(c)}^2 - 2(${fmt(b)})(${fmt(c)})\\cos(${fmt(A,1)}^\\circ)`} />
            <Line latex={`a^2 = ${fmt(b*b,4)} + ${fmt(c*c,4)} - ${fmt(2*b*c,4)}(${fmt(Math.cos(toRad(A)),4)})`} />
            <Line latex={`a^2 = ${fmt(a2,4)},\\quad a = ${fmt(a)}`} />
          </Step>
          <Step num={2} title="Use Law of Sines to find B">
            <Line latex={`\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}`} />
            <Line latex={`\\sin B = \\dfrac{${fmt(b)} \\cdot \\sin(${fmt(A,1)}^\\circ)}{${fmt(a)}} = ${fmt(Math.sin(toRad(B)),4)}`} />
            <Line latex={`B = ${fmt(B)}^\\circ`} />
          </Step>
          <Step num={3} title="Find C">
            <Line latex={`C = 180^\\circ - ${fmt(A,1)}^\\circ - ${fmt(B)}^\\circ = ${fmt(C)}^\\circ`} />
          </Step>
          <AnswerBox latex={`a=${fmt(a)},\\ B=${fmt(B)}^\\circ,\\ C=${fmt(C)}^\\circ`} />
        </>
      )
    } else {
      const a = n1, b = n2, c = n3
      const cosA = (b * b + c * c - a * a) / (2 * b * c)
      const A = toDeg(Math.acos(cosA))
      const cosB = (a * a + c * c - b * b) / (2 * a * c)
      const B = toDeg(Math.acos(cosB))
      const C = 180 - A - B
      triProps = { a, b, c, A: fmt(A), B: fmt(B), C: fmt(C) }
      steps = (
        <>
          <Step num={1} title="Find angle A">
            <Line latex={`\\cos A = \\dfrac{b^2 + c^2 - a^2}{2bc} = \\dfrac{${fmt(b*b,2)} + ${fmt(c*c,2)} - ${fmt(a*a,2)}}{2(${fmt(b)})(${fmt(c)})} = ${fmt(cosA,4)}`} />
            <Line latex={`A = \\cos^{-1}(${fmt(cosA,4)}) = ${fmt(A)}^\\circ`} />
          </Step>
          <Step num={2} title="Find angle B">
            <Line latex={`\\cos B = \\dfrac{a^2 + c^2 - b^2}{2ac} = \\dfrac{${fmt(a*a,2)} + ${fmt(c*c,2)} - ${fmt(b*b,2)}}{2(${fmt(a)})(${fmt(c)})} = ${fmt(cosB,4)}`} />
            <Line latex={`B = \\cos^{-1}(${fmt(cosB,4)}) = ${fmt(B)}^\\circ`} />
          </Step>
          <Step num={3} title="Find angle C">
            <Line latex={`C = 180^\\circ - ${fmt(A)}^\\circ - ${fmt(B)}^\\circ = ${fmt(C)}^\\circ`} />
          </Step>
          <AnswerBox latex={`A=${fmt(A)}^\\circ,\\ B=${fmt(B)}^\\circ,\\ C=${fmt(C)}^\\circ`} />
        </>
      )
    }
  }

  const labels = {
    SAS: ['Side b', 'Side c', 'Included Angle A (°)'],
    SSS: ['Side a', 'Side b', 'Side c'],
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Law of Cosines</h2>
      <Explain text="The Law of Cosines: a² = b² + c² − 2bc·cosA. Use it for SAS (two sides and the included angle) or SSS (all three sides). It generalizes the Pythagorean theorem to non-right triangles." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Case</label>
              <select className="trig-select" value={caseType} onChange={e => setCaseType(e.target.value)}>
                <option value="SAS">SAS</option><option value="SSS">SSS</option>
              </select>
            </div>
            {labels[caseType].map((lbl, i) => (
              <div key={i} className="trig-input-group">
                <label>{lbl}</label>
                <input className="trig-input"
                  value={[v1, v2, v3][i]}
                  onChange={e => [setV1, setV2, setV3][i](e.target.value)} />
              </div>
            ))}
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <ObliqueTriangleSVG {...triProps} />
      </div>
    </div>
  )
}

function TriangleArea() {
  const [method, setMethod] = useState('SAS')
  const [v1, setV1] = useState('3')
  const [v2, setV2] = useState('4')
  const [v3, setV3] = useState('30')

  const n1 = parseFloat(v1), n2 = parseFloat(v2), n3 = parseFloat(v3)
  const valid = isFinite(n1) && isFinite(n2) && isFinite(n3) && n1 > 0 && n2 > 0 && n3 > 0

  let steps = null, triProps = {}
  if (valid) {
    if (method === 'SAS') {
      const b = n1, c = n2, A = n3
      const K = 0.5 * b * c * Math.sin(toRad(A))
      triProps = { b, c, A }
      steps = (
        <>
          <Step num={1} title="Apply the SAS Area formula">
            <Line latex={`K = \\dfrac{1}{2}bc\\sin A`} />
            <Note text="Use this when you know two sides and the included angle." />
          </Step>
          <Step num={2} title="Substitute values">
            <Line latex={`K = \\dfrac{1}{2}(${fmt(b)})(${fmt(c)})\\sin(${fmt(A,1)}^\\circ)`} />
            <Line latex={`K = \\dfrac{1}{2}(${fmt(b)})(${fmt(c)})(${fmt(Math.sin(toRad(A)),4)})`} />
            <Line latex={`K = ${fmt(K)}`} />
          </Step>
          <AnswerBox latex={`K = ${fmt(K)} \\text{ square units}`} />
        </>
      )
    } else {
      const a = n1, b = n2, c = n3
      const s = (a + b + c) / 2
      const K = Math.sqrt(s * (s - a) * (s - b) * (s - c))
      triProps = { a, b, c }
      steps = (
        <>
          <Step num={1} title="Compute the semi-perimeter s">
            <Line latex={`s = \\dfrac{a + b + c}{2} = \\dfrac{${fmt(a)} + ${fmt(b)} + ${fmt(c)}}{2} = \\dfrac{${fmt(a+b+c)}}{2} = ${fmt(s)}`} />
          </Step>
          <Step num={2} title="Apply Heron's Formula">
            <Line latex={`K = \\sqrt{s(s-a)(s-b)(s-c)}`} />
            <Line latex={`K = \\sqrt{${fmt(s)}(${fmt(s)}-${fmt(a)})(${fmt(s)}-${fmt(b)})(${fmt(s)}-${fmt(c)})}`} />
            <Line latex={`K = \\sqrt{${fmt(s)}(${fmt(s-a)})(${fmt(s-b)})(${fmt(s-c)})}`} />
            <Line latex={`K = \\sqrt{${fmt(s*(s-a)*(s-b)*(s-c))}} = ${fmt(K)}`} />
          </Step>
          <AnswerBox latex={`K = ${fmt(K)} \\text{ square units}`} />
        </>
      )
    }
  }

  const labels = {
    SAS: ['Side b', 'Side c', 'Included Angle A (°)'],
    Heron: ['Side a', 'Side b', 'Side c'],
  }

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Triangle Area</h2>
      <Explain text="There are two main area formulas for triangles: K = ½bc·sinA (when you know two sides and the included angle) and Heron's Formula (when you know all three sides). Both are exact methods." />
      <div className="trig-solver-body">
        <div>
          <div className="trig-inputs">
            <div className="trig-input-group">
              <label>Method</label>
              <select className="trig-select" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="SAS">SAS (two sides + angle)</option>
                <option value="Heron">Heron's Formula (three sides)</option>
              </select>
            </div>
            {labels[method].map((lbl, i) => (
              <div key={i} className="trig-input-group">
                <label>{lbl}</label>
                <input className="trig-input"
                  value={[v1, v2, v3][i]}
                  onChange={e => [setV1, setV2, setV3][i](e.target.value)} />
              </div>
            ))}
          </div>
          <div className="trig-steps">{steps}</div>
        </div>
        <ObliqueTriangleSVG {...triProps} />
      </div>
    </div>
  )
}

// ─── Sidebar nav data ─────────────────────────────────────────────────────────

const GROUPS = [
  {
    label: 'Angles',
    items: [
      { id: 'degrad', label: 'Degree ↔ Radian' },
      { id: 'stdpos', label: 'Standard Position' },
    ]
  },
  {
    label: 'Right Triangle Trig',
    items: [
      { id: 'sixfns', label: 'Find All 6 Functions' },
      { id: 'fromval', label: 'From Value + Quadrant' },
    ]
  },
  {
    label: 'Unit Circle',
    items: [
      { id: 'exact', label: 'Evaluate Exact Values' },
    ]
  },
  {
    label: 'Sinusoidal Graphs',
    items: [
      { id: 'ampperiod', label: 'Amplitude & Period' },
    ]
  },
  {
    label: 'Inverse Trig',
    items: [
      { id: 'invtrig', label: 'arcsin / arccos / arctan' },
      { id: 'composite', label: 'Composite Expressions' },
    ]
  },
  {
    label: 'Trig Equations',
    items: [
      { id: 'equations', label: 'Solve on [0, 2π)' },
    ]
  },
  {
    label: 'Identities & Formulas',
    items: [
      { id: 'identity', label: 'Verify an Identity' },
      { id: 'sumdiff', label: 'Sum & Difference' },
      { id: 'dblhalf', label: 'Double & Half Angle' },
    ]
  },
  {
    label: 'Solving Triangles',
    items: [
      { id: 'righttri', label: 'Right Triangle' },
      { id: 'sines', label: 'Law of Sines' },
      { id: 'cosines', label: 'Law of Cosines' },
      { id: 'area', label: 'Triangle Area' },
    ]
  },
]

const SOLVERS = {
  degrad: DegRadConverter,
  stdpos: StandardPosition,
  sixfns: FindSixFunctions,
  fromval: FromValueAndQuadrant,
  exact: EvaluateExact,
  ampperiod: AmpPeriod,
  invtrig: InverseTrig,
  composite: CompositeTrig,
  equations: TrigEquations,
  identity: VerifyIdentity,
  sumdiff: SumDifference,
  dblhalf: DoubleHalfAngle,
  righttri: SolveRightTriangle,
  sines: LawOfSines,
  cosines: LawOfCosines,
  area: TriangleArea,
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrigSection() {
  const [active, setActive] = useState('degrad')
  const Solver = SOLVERS[active] ?? DegRadConverter

  return (
    <div className="trig-layout">
      <aside className="trig-sidebar">
        {GROUPS.map(g => (
          <div key={g.label} className="trig-sidebar-group">
            <div className="trig-sidebar-group-label">{g.label}</div>
            {g.items.map(item => (
              <button
                key={item.id}
                className={`trig-sidebar-item ${active === item.id ? 'active' : ''}`}
                onClick={() => setActive(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>
      <main className="trig-main">
        <Solver />
      </main>
    </div>
  )
}
