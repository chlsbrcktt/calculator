import { useState, useMemo, useRef } from 'react'
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
  const W = 800, H = 870
  const cx = 400, cy = 430, r = 200
  const labelR = 220, boxR = 320, bW = 76, bH = 40

  const a = toRad(angleDeg || 0)
  const px = cx + r * Math.cos(a)
  const py = cy - r * Math.sin(a)
  const normDeg = ((angleDeg % 360) + 360) % 360

  const ANGLES = [
    { d: 0,   ds: '0°',    rs: '0, 2π',   xs: '1',      ys: '0',      ts: '0' },
    { d: 30,  ds: '30°',   rs: 'π/6',     xs: '√3/2',   ys: '1/2',    ts: '√3/3' },
    { d: 45,  ds: '45°',   rs: 'π/4',     xs: '√2/2',   ys: '√2/2',   ts: '1' },
    { d: 60,  ds: '60°',   rs: 'π/3',     xs: '1/2',    ys: '√3/2',   ts: '√3' },
    { d: 90,  ds: '90°',   rs: 'π/2',     xs: '0',      ys: '1',      ts: 'undef.' },
    { d: 120, ds: '120°',  rs: '2π/3',    xs: '−1/2',   ys: '√3/2',   ts: '−√3' },
    { d: 135, ds: '135°',  rs: '3π/4',    xs: '−√2/2',  ys: '√2/2',   ts: '−1' },
    { d: 150, ds: '150°',  rs: '5π/6',    xs: '−√3/2',  ys: '1/2',    ts: '−√3/3' },
    { d: 180, ds: '180°',  rs: 'π',       xs: '−1',     ys: '0',      ts: '0' },
    { d: 210, ds: '210°',  rs: '7π/6',    xs: '−√3/2',  ys: '−1/2',   ts: '√3/3' },
    { d: 225, ds: '225°',  rs: '5π/4',    xs: '−√2/2',  ys: '−√2/2',  ts: '1' },
    { d: 240, ds: '240°',  rs: '4π/3',    xs: '−1/2',   ys: '−√3/2',  ts: '√3' },
    { d: 270, ds: '270°',  rs: '3π/2',    xs: '0',      ys: '−1',     ts: 'undef.' },
    { d: 300, ds: '300°',  rs: '5π/3',    xs: '1/2',    ys: '−√3/2',  ts: '−√3' },
    { d: 315, ds: '315°',  rs: '7π/4',    xs: '√2/2',   ys: '−√2/2',  ts: '−1' },
    { d: 330, ds: '330°',  rs: '11π/6',   xs: '√3/2',   ys: '−1/2',   ts: '−√3/3' },
  ]

  const arcR = 52
  const arcPath = (() => {
    if (solutions || !showPoint || normDeg < 0.5) return null
    const x1 = cx + arcR
    const x2 = cx + arcR * Math.cos(a)
    const y2 = cy - arcR * Math.sin(a)
    const largeArc = normDeg > 180 ? 1 : 0
    return `M ${x1} ${cy} A ${arcR} ${arcR} 0 ${largeArc} 0 ${x2} ${y2}`
  })()

  const pts = solutions || (showPoint ? [{ deg: angleDeg, color: '#2563eb' }] : [])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trig-unit-circle">
      {/* Quadrant watermarks */}
      <text x={cx + 80} y={cy - 70} textAnchor="middle" fontSize="30" fill="#f1f5f9" fontWeight="800" fontFamily="serif">I</text>
      <text x={cx - 80} y={cy - 70} textAnchor="middle" fontSize="30" fill="#f1f5f9" fontWeight="800" fontFamily="serif">II</text>
      <text x={cx - 80} y={cy + 100} textAnchor="middle" fontSize="30" fill="#f1f5f9" fontWeight="800" fontFamily="serif">III</text>
      <text x={cx + 80} y={cy + 100} textAnchor="middle" fontSize="30" fill="#f1f5f9" fontWeight="800" fontFamily="serif">IV</text>

      {/* Axes */}
      <line x1="22" y1={cy} x2={W - 22} y2={cy} stroke="#94a3b8" strokeWidth="2" />
      <line x1={cx} y1={H - 44} x2={cx} y2="22" stroke="#94a3b8" strokeWidth="2" />
      <polygon points={`${W - 22},${cy} ${W - 34},${cy - 5} ${W - 34},${cy + 5}`} fill="#94a3b8" />
      <polygon points={`${cx},22 ${cx - 5},34 ${cx + 5},34`} fill="#94a3b8" />
      <text x={W - 12} y={cy + 6} textAnchor="middle" fontSize="18" fill="#64748b" fontWeight="700">x</text>
      <text x={cx + 16} y="20" textAnchor="middle" fontSize="18" fill="#64748b" fontWeight="700">y</text>
      <text x={cx + r + 6} y={cy - 10} fontSize="13" fill="#94a3b8">1</text>
      <text x={cx + 6} y={cy - r - 8} fontSize="13" fill="#94a3b8">1</text>

      {/* Circle */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#cbd5e1" strokeWidth="2.5" />

      {/* Standard angle annotations */}
      {ANGLES.map(item => {
        const rad = toRad(item.d)
        const dx = Math.cos(rad)
        const dy = -Math.sin(rad)
        const isActive = Math.abs(normDeg - item.d) < 0.5 && showPoint && !solutions

        const tk1x = cx + (r - 7) * dx, tk1y = cy + (r - 7) * dy
        const tk2x = cx + (r + 7) * dx, tk2y = cy + (r + 7) * dy

        const lx = cx + labelR * dx
        const ly = cy + labelR * dy
        const ta = dx > 0.2 ? 'start' : dx < -0.2 ? 'end' : 'middle'

        const bx = cx + boxR * dx
        const by = cy + boxR * dy
        const brx = bx - bW / 2
        const bry = by - bH / 2

        return (
          <g key={item.d}>
            <line x1={tk1x} y1={tk1y} x2={tk2x} y2={tk2y} stroke={isActive ? '#2563eb' : '#94a3b8'} strokeWidth={isActive ? 2.5 : 1.5} />
            <text x={lx} y={ly - 4} textAnchor={ta} fontSize="12" fill={isActive ? '#1d4ed8' : '#1e293b'} fontWeight="700">{item.ds}</text>
            <text x={lx} y={ly + 10} textAnchor={ta} fontSize="11" fill={isActive ? '#4f46e5' : '#6366f1'}>{item.rs}</text>
            <rect x={brx} y={bry} width={bW} height={bH} rx="4"
              fill={isActive ? '#dbeafe' : '#eff6ff'}
              stroke={isActive ? '#3b82f6' : '#bfdbfe'}
              strokeWidth={isActive ? 1.5 : 1} />
            <text x={bx} y={bry + 15} textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="500">({item.xs}, {item.ys})</text>
            <text x={bx} y={bry + 29} textAnchor="middle" fontSize="10" fill="#7c3aed">tan = {item.ts}</text>
          </g>
        )
      })}

      {/* Angle arc */}
      {arcPath && <path d={arcPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />}

      {/* Terminal ray */}
      {showPoint && !solutions && (
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#2563eb" strokeWidth="2.5" />
      )}

      {/* All dots */}
      {pts.map((p, i) => {
        const pa = toRad(p.deg)
        const spx = cx + r * Math.cos(pa)
        const spy = cy - r * Math.sin(pa)
        return <circle key={i} cx={spx} cy={spy} r={8} fill={p.color || '#2563eb'} />
      })}

      {/* Perpendicular dashes for active point */}
      {showPoint && !solutions && (
        <>
          <line x1={px} y1={py} x2={px} y2={cy} stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 4" />
          <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />
        </>
      )}

      {/* θ label near arc */}
      {arcPath && (
        <text x={cx + (arcR + 18) * Math.cos(a / 2)} y={cy - (arcR + 18) * Math.sin(a / 2)}
          textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="600">θ</text>
      )}

      {/* Legend */}
      <text x={cx} y={H - 26} textAnchor="middle" fontSize="14" fill="#64748b">
        cos θ = x  ·  sin θ = y  ·  tan θ = y/x  (for any point on the unit circle)
      </text>
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
      </div>
      <UnitCircleSVG angleDeg={angleDeg} />
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
      </div>
      <UnitCircleSVG angleDeg={angleDeg} />
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
      </div>
      <UnitCircleSVG angleDeg={angleDeg} />
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
  const [valStr, setValStr] = useState('-0.7071')

  const ranges = {
    arcsin: { latex: '\\left[-\\dfrac{\\pi}{2},\\ \\dfrac{\\pi}{2}\\right]', note: 'arcsin and arctan return angles in [−π/2, π/2]; arccos returns angles in [0, π].' },
    arccos: { latex: '[0,\\ \\pi]', note: 'arccos returns an angle in [0, π] — always in Q1 or Q2.' },
    arctan: { latex: '\\left(-\\dfrac{\\pi}{2},\\ \\dfrac{\\pi}{2}\\right)', note: 'arctan can take any real number and returns an angle in (−π/2, π/2).' },
  }
  const fnNames = { arcsin: '\\sin^{-1}', arccos: '\\cos^{-1}', arctan: '\\tan^{-1}' }

  const inputVal = parseFloat(valStr)
  const valid = isFinite(inputVal)
  const domainOk = fn === 'arctan' || (valid && Math.abs(inputVal) <= 1 + 1e-9)
  const inputLatex = valid ? exact(inputVal) : '?'

  let result = null
  if (valid && domainOk) {
    if (fn === 'arcsin') result = Math.asin(Math.max(-1, Math.min(1, inputVal)))
    else if (fn === 'arccos') result = Math.acos(Math.max(-1, Math.min(1, inputVal)))
    else result = Math.atan(inputVal)
  }
  const ok = result !== null && isFinite(result)
  const resultDeg = ok ? toDeg(result) : 0
  const resultLatex = ok ? radLatex(result) : '\\text{undefined}'
  const absVal = valid ? Math.abs(inputVal) : 0
  const refAngleResult = ok ? Math.abs(result) : 0

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Inverse Trig Functions</h2>
      <Explain text="Inverse trig functions answer: 'what angle has this trig value?' Each has a restricted range so the answer is unique. Enter any decimal value — exact fractions like √2/2 ≈ 0.7071 will be recognized automatically." />
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
              <input className="trig-input" value={valStr} onChange={e => setValStr(e.target.value)}
                placeholder="e.g. -0.5, 0.866, -1" style={{ width: 130 }} />
            </div>
          </div>
          <div className="trig-hint">Common exact values: 0, ±0.5, ±0.7071 (±√2/2), ±0.866 (±√3/2), ±1, ±0.5774 (±√3/3), ±1.7321 (±√3)</div>
          {valid && !domainOk && <div className="trig-warning">Domain error: {fn} requires |value| ≤ 1.</div>}
          {ok && (
            <div className="trig-steps">
              <Step num={1} title="State the problem">
                <Line latex={`\\text{Find } \\theta = ${fnNames[fn]}\\!\\left(${inputLatex}\\right)`} />
                <Note text={`We want the angle θ such that ${fn.replace('arc','')}(θ) = ${inputLatex}.`} />
              </Step>
              <Step num={2} title="Apply the range restriction">
                <Line latex={`\\text{Range of } ${fnNames[fn]}: ${ranges[fn].latex}`} />
                <Note text={ranges[fn].note} />
              </Step>
              <Step num={3} title="Find the reference angle">
                <Line latex={`\\${fn.replace('arc','')}\\!\\left(${exact(absVal)}\\right) = ${radLatex(refAngleResult)} \\approx ${fmt(refAngleResult * 180 / PI, 2)}^\\circ`} />
              </Step>
              <Step num={4} title="Apply sign based on range">
                <Line latex={`\\theta = ${resultLatex} \\approx ${fmt(result, 4)}\\text{ rad} \\approx ${fmt(resultDeg, 2)}^\\circ`} />
              </Step>
              <AnswerBox latex={`${fnNames[fn]}\\!\\left(${inputLatex}\\right) = ${resultLatex}`} />
            </div>
          )}
        </div>
      </div>
      {ok && <UnitCircleSVG angleDeg={resultDeg} />}
    </div>
  )
}

function CompositeTrig() {
  const [outer, setOuter] = useState('tan')
  const [inner, setInner] = useState('arcsin')
  const [valStr, setValStr] = useState('-0.5')

  const pval = parseFloat(valStr)
  const plab = isFinite(pval) ? exact(pval) : '?'

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
              <input className="trig-input" value={valStr} onChange={e => setValStr(e.target.value)}
                placeholder="e.g. -0.5, 0.866" style={{ width: 120 }} />
            </div>
          </div>
          <div className="trig-hint">Enter any decimal (e.g. -0.5 = −½, 0.7071 ≈ √2/2, 0.866 ≈ √3/2)</div>
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

// ─── Trig equation text parser ─────────────────────────────────────────────────
function parseTrigEq(rawInput) {
  if (!rawInput.trim()) return null

  let s = rawInput
    .trim()
    .replace(/theta/gi, 'θ')
    .replace(/²/g, '^2')
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .toLowerCase()

  const eqIdx = s.indexOf('=')
  if (eqIdx < 0) return { error: 'Missing = sign — enter a full equation like sinθ = −1/2' }
  if (s.indexOf('=', eqIdx + 1) >= 0) return { error: 'Multiple = signs' }

  const lhsStr = s.slice(0, eqIdx)
  const rhsStr = s.slice(eqIdx + 1)

  const parseNum = (str) => {
    if (!str) return NaN
    if (/^-?\d+\.?\d*$/.test(str)) return parseFloat(str)
    const frac = str.match(/^(-?\d+)\/(\d+)$/)
    if (frac) return parseFloat(frac[1]) / parseFloat(frac[2])
    const sq1 = str.match(/^(-?)√(\d+\.?\d*)$/)
    if (sq1) return (sq1[1] ? -1 : 1) * Math.sqrt(parseFloat(sq1[2]))
    const sq2 = str.match(/^(-?)√(\d+\.?\d*)\/(\d+)$/)
    if (sq2) return (sq2[1] ? -1 : 1) * Math.sqrt(parseFloat(sq2[2])) / parseFloat(sq2[3])
    return NaN
  }

  const tokenizeTerms = (expr) => {
    const terms = []
    let depth = 0, cur = ''
    const e = (expr[0] !== '+' && expr[0] !== '-') ? '+' + expr : expr
    for (const c of e) {
      if (c === '(') depth++
      else if (c === ')') depth--
      if ((c === '+' || c === '-') && depth === 0 && cur.length > 0) {
        terms.push(cur)
        cur = c
      } else {
        cur += c
      }
    }
    if (cur) terms.push(cur)
    return terms
  }

  const parseTerm = (term) => {
    if (!term) return null
    const sign = term[0] === '-' ? -1 : 1
    const body = term.slice(1)
    // Trig term: [coeff][fn][^2]?[(Nθ)|θ][^2]?
    const m = body.match(/^(\d*\.?\d*)(sin|cos|tan|csc|sec|cot)(\^2)?(\((\d*)θ\)|θ)(\^2)?$/)
    if (m) {
      const coeff = sign * (m[1] === '' ? 1 : parseFloat(m[1]))
      const fn = m[2]
      const power = (m[3] || m[6]) ? 2 : 1
      const argDigit = m[5]
      const argMult = argDigit !== undefined ? (argDigit === '' ? 1 : parseInt(argDigit)) : 1
      return { type: 'trig', fn, coeff, argMult, power }
    }
    const numVal = parseNum(body)
    if (!isNaN(numVal)) return { type: 'const', val: sign * numVal }
    return null
  }

  const lhsTerms = tokenizeTerms(lhsStr).map(parseTerm)
  if (lhsTerms.some(t => t === null)) return { error: `Cannot parse "${lhsStr}" — check spelling (use sin, cos, tan) and format` }

  const rhsNum = parseNum(rhsStr)
  let rhsTerms = []
  if (!isNaN(rhsNum)) {
    if (Math.abs(rhsNum) > 1e-10) rhsTerms = [{ type: 'const', val: -rhsNum }]
  } else {
    const raw = tokenizeTerms(rhsStr).map(parseTerm)
    if (raw.some(t => t === null)) return { error: `Cannot parse right side "${rhsStr}"` }
    rhsTerms = raw.map(t => t.type === 'const' ? { ...t, val: -t.val } : { ...t, coeff: -t.coeff })
  }

  const allTerms = [...lhsTerms, ...rhsTerms]
  const trigTerms = allTerms.filter(t => t.type === 'trig')
  const constVal = allTerms.filter(t => t.type === 'const').reduce((sum, t) => sum + t.val, 0)

  const daTerms  = trigTerms.filter(t => t.argMult >= 2 && t.power === 1)
  const sqTerms  = trigTerms.filter(t => t.power === 2 && t.argMult === 1)
  const linTerms = trigTerms.filter(t => t.power === 1 && t.argMult === 1)

  // Pure double-angle with no other trig → simple equation f(Nθ) = c
  if (daTerms.length > 0 && sqTerms.length === 0 && linTerms.length === 0) {
    const { fn, coeff, argMult } = daTerms[0]
    if (Math.abs(coeff) < 1e-10) return { error: 'Coefficient is zero' }
    return { type: 'simple', fn, B: argMult, rhs: -constVal / coeff }
  }

  // Double-angle + other trig → substitution required
  if (daTerms.length > 0) {
    const daFn = daTerms[0].fn
    const remFns = [...new Set([...sqTerms, ...linTerms].map(t => t.fn))]
    if (remFns.length > 1) return { error: 'Mixed trig functions — only one supported alongside the double-angle term' }
    const daRem = remFns[0] || daFn
    const daLin = linTerms.filter(t => t.fn === daRem).reduce((sum, t) => sum + t.coeff, 0)
    const daCon = constVal
    return { type: 'dblangle', daFn, daRem, daLin, daCon }
  }

  // Quadratic: has squared term
  if (sqTerms.length > 0) {
    const fns = [...new Set([...sqTerms, ...linTerms].map(t => t.fn))]
    if (fns.length > 1) return { error: 'Mixed trig functions — quadratic requires one function' }
    const fn = fns[0]
    const a = sqTerms.reduce((sum, t) => sum + t.coeff, 0)
    const b = linTerms.reduce((sum, t) => sum + t.coeff, 0)
    const c = constVal
    if (Math.abs(a) < 1e-10) return { error: 'Squared coefficient is zero' }
    return { type: 'quadratic', fn, a, b, c }
  }

  // Simple: linear trig only
  if (linTerms.length > 0) {
    const fns = [...new Set(linTerms.map(t => t.fn))]
    if (fns.length > 1) return { error: 'Multiple different functions — solve each separately' }
    const fn = fns[0]
    const coeff = linTerms.reduce((sum, t) => sum + t.coeff, 0)
    const B = linTerms[0].argMult
    if (Math.abs(coeff) < 1e-10) return { error: 'Coefficient is zero' }
    return { type: 'simple', fn, B, rhs: -constVal / coeff }
  }

  return { error: 'No trig function found' }
}

function TrigEquations() {
  const [equationStr, setEquationStr] = useState('2cos²θ + cosθ = 0')
  const inputRef = useRef(null)

  const insertTheta = () => {
    const el = inputRef.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const newVal = equationStr.slice(0, start) + 'θ' + equationStr.slice(end)
    setEquationStr(newVal)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + 1; el.focus() }, 0)
  }

  const fnL = { sin: '\\sin', cos: '\\cos', tan: '\\tan', csc: '\\csc', sec: '\\sec', cot: '\\cot' }

  // ── Linear trig solver (returns {solutions, refAngle, baseFn, baseRhs} or null) ──
  const solveLinear = (f, rhsVal, B = 1) => {
    let baseFn = f, baseRhs = rhsVal
    if (f === 'csc') { baseFn = 'sin'; baseRhs = 1 / rhsVal }
    else if (f === 'sec') { baseFn = 'cos'; baseRhs = 1 / rhsVal }
    else if (f === 'cot') { baseFn = 'tan'; baseRhs = 1 / rhsVal }
    if (!isFinite(baseRhs)) return null

    let refAngle = 0, bases = []
    if (baseFn === 'sin') {
      if (Math.abs(baseRhs) > 1 + 1e-9) return null
      const cl = Math.max(-1, Math.min(1, baseRhs))
      refAngle = Math.asin(Math.abs(cl))
      if (Math.abs(baseRhs) < 1e-9) bases = [0, PI]
      else if (Math.abs(Math.abs(baseRhs) - 1) < 1e-9) bases = [cl > 0 ? PI / 2 : 3 * PI / 2]
      else if (cl > 0) bases = [refAngle, PI - refAngle]
      else bases = [PI + refAngle, 2 * PI - refAngle]
    } else if (baseFn === 'cos') {
      if (Math.abs(baseRhs) > 1 + 1e-9) return null
      const cl = Math.max(-1, Math.min(1, baseRhs))
      const x0 = Math.acos(cl)
      refAngle = Math.min(x0, PI - x0)
      bases = Math.abs(Math.sin(x0)) < 1e-9 ? [x0] : [x0, 2 * PI - x0]
    } else {
      const x0 = Math.atan(baseRhs)
      refAngle = Math.abs(x0)
      bases = [((x0 % PI) + PI) % PI]
    }

    const period = baseFn === 'tan' ? PI : 2 * PI
    const xRange = B * 2 * PI
    const allX = []
    for (const base of bases) {
      for (let k = 0; ; k++) {
        const x = base + period * k
        if (x > xRange - 1e-9) break
        if (x >= -1e-9) allX.push(x)
      }
    }
    allX.sort((a, b) => a - b)
    return { solutions: allX.map(x => x / B), refAngle, baseFn, baseRhs }
  }

  // ── Quadratic factoring info for a·u² + b·u + c = 0 ──────────
  const factorInfo = (a, b, c) => {
    if (Math.abs(c) < 1e-9) {
      return { type: 'factor_out', roots: [0, -b / a] }
    }
    if (Math.abs(b) < 1e-9) {
      const val = -c / a
      if (val < -1e-9) return { type: 'no_real' }
      return { type: 'sqrt', sq: Math.sqrt(Math.max(0, val)), roots: [Math.sqrt(Math.max(0, val)), -Math.sqrt(Math.max(0, val))] }
    }
    const disc = b * b - 4 * a * c
    if (disc < -1e-9) return { type: 'no_real' }

    const r1 = (-b + Math.sqrt(Math.max(0, disc))) / (2 * a)
    const r2 = (-b - Math.sqrt(Math.max(0, disc))) / (2 * a)

    // Try integer factor pair (D1·u + N1)(D2·u + N2) = 0
    const absA = Math.abs(a)
    for (let d1 = 1; d1 <= absA; d1++) {
      if (absA % d1 !== 0) continue
      const d2 = absA / d1
      for (const [sd1, sd2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const D1 = d1 * sd1, D2 = d2 * sd2
        for (const [R1, R2] of [[r1, r2], [r2, r1]]) {
          const N1 = Math.round(-D1 * R1), N2 = Math.round(-D2 * R2)
          if (
            Math.abs(D1 * D2 - a) < 0.5 &&
            Math.abs(D1 * N2 + D2 * N1 - b) < 0.5 &&
            Math.abs(N1 * N2 - c) < 0.5
          ) {
            return { type: 'factored', D1, N1, D2, N2, roots: [-N1 / D1, -N2 / D2] }
          }
        }
      }
    }
    return { type: 'formula', roots: [r1, r2], disc }
  }

  // Format (D·u + N) in LaTeX with trig symbol
  const fmtFactor = (D, N, sym) => {
    let s = D === 1 ? sym : D === -1 ? `-${sym}` : `${D}${sym}`
    if (N > 0) s += ` + ${N}`
    else if (N < 0) s += ` - ${Math.abs(N)}`
    return s
  }

  // Equation LaTeX: a·sym2 + b·sym + c = 0
  const eqLx = (a, b, c, sym, sym2) => {
    let parts = []
    if (a !== 0) parts.push(a === 1 ? sym2 : a === -1 ? `-${sym2}` : `${a}${sym2}`)
    if (b !== 0) {
      const sign = parts.length ? (b > 0 ? ' + ' : ' - ') : (b < 0 ? '-' : '')
      const coef = Math.abs(b) === 1 ? '' : Math.abs(b)
      parts.push(`${sign}${coef}${sym}`)
    }
    if (c !== 0) {
      const sign = parts.length ? (c > 0 ? ' + ' : ' - ') : (c < 0 ? '-' : '')
      parts.push(`${sign}${Math.abs(c)}`)
    }
    return (parts.join('') || '0') + ' = 0'
  }

  const qNote = (f, v) => {
    if (f === 'sin') return v >= 0 ? 'sin > 0 in QI and QII' : 'sin < 0 in QIII and QIV'
    if (f === 'cos') return v >= 0 ? 'cos > 0 in QI and QIV' : 'cos < 0 in QII and QIII'
    return v >= 0 ? 'tan > 0 in QI and QIII' : 'tan < 0 in QII and QIV'
  }

  // Deduplicated sorted solution set from radians array
  const dedupe = arr => [...new Set(arr.map(s => Math.round(s * 1e9) / 1e9))].sort((a, b) => a - b)

  // Render one linear branch (fn(θ) = root) inside a quadratic solve
  const Branch = ({ fnName, root }) => {
    const res = solveLinear(fnName, root)
    const rootLx = exact(root)
    return (
      <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: '2px solid #bfdbfe', marginTop: 6 }}>
        <Line latex={`\\${fnName}\\theta = ${rootLx}`} />
        {!res || res.solutions.length === 0
          ? <Note text={`No solution — |${rootLx}| > 1 or out of domain`} />
          : res.solutions.map((s, i) => <Line key={i} latex={`\\theta = ${radLatex(s)}`} />)
        }
      </div>
    )
  }

  // ── Parse & solve from equation string ───────────────────────
  const parsed = parseTrigEq(equationStr)

  const simpleRes = parsed?.type === 'simple'
    ? solveLinear(parsed.fn, parsed.rhs, parsed.B) : null

  const quadRes = (() => {
    if (parsed?.type !== 'quadratic') return null
    const { fn, a, b, c } = parsed
    const fi = factorInfo(a, b, c)
    if (fi.type === 'no_real') return { error: 'Discriminant < 0 — no real solutions' }
    const allSols = dedupe(fi.roots.flatMap(r => solveLinear(fn, r)?.solutions || []))
    return { fi, allSols }
  })()

  const daRes = (() => {
    if (parsed?.type !== 'dblangle') return null
    const { daFn, daRem, daLin, daCon } = parsed
    if (daFn === 'sin') {
      const f1Fn = daRem, f2Fn = daRem === 'sin' ? 'cos' : 'sin'
      const f1Res = solveLinear(f1Fn, 0)
      const f2Rhs = -daLin / 2
      const f2Res = solveLinear(f2Fn, f2Rhs)
      const allSols = dedupe([...(f1Res?.solutions || []), ...(f2Res?.solutions || [])])
      return { type: 'sin2_product', f1Fn, f1Res, f2Fn, f2Rhs, f2Res, allSols, daLin, daRem }
    }
    let dqa, dqb, dqc, subFn, identLx
    if (daRem === 'cos') {
      dqa = 2; dqb = daLin; dqc = daCon - 1; subFn = 'cos'
      identLx = '\\cos(2\\theta) = 2\\cos^2\\!\\theta - 1'
    } else {
      dqa = -2; dqb = daLin; dqc = daCon + 1; subFn = 'sin'
      identLx = '\\cos(2\\theta) = 1 - 2\\sin^2\\!\\theta'
    }
    const fi = factorInfo(dqa, dqb, dqc)
    if (fi.type === 'no_real') return { error: 'No real solutions after substitution' }
    const allSols = dedupe(fi.roots.flatMap(r => solveLinear(subFn, r)?.solutions || []))
    return { type: 'cos2_quad', fi, identLx, subFn, dqa, dqb, dqc, allSols, daLin, daCon }
  })()

  const allSolsForCircle = simpleRes?.solutions || quadRes?.allSols || daRes?.allSols || []

  return (
    <div className="trig-solver">
      <h2 className="trig-solver-title">Solve Trig Equations on [0, 2π)</h2>
      <Explain text="Type a trig equation below — the solver detects the type automatically and shows full paper-style work. Click θ to insert the theta symbol at the cursor." />

      <div className="trig-eq-row">
        <input
          ref={inputRef}
          className="trig-eq-input"
          value={equationStr}
          onChange={e => setEquationStr(e.target.value)}
          placeholder="e.g.  2cos²θ + cosθ = 0"
          spellCheck={false}
        />
        <button className="trig-theta-btn" onClick={insertTheta} title="Insert θ">θ</button>
      </div>
      <div className="trig-hint">
        Try: <code>sinθ = −1/2</code> &nbsp;·&nbsp; <code>2cos²θ + cosθ = 0</code> &nbsp;·&nbsp; <code>cos(2θ) + cosθ − 2 = 0</code> &nbsp;·&nbsp; <code>sin(2θ) + sinθ = 0</code>
      </div>

      {parsed?.error && <div className="trig-warning">{parsed.error}</div>}

      {parsed && !parsed.error && (
        <div className="trig-solver-body">
          <div>

            {/* ── Simple ─────────────────────────────────────────── */}
            {parsed.type === 'simple' && simpleRes && (<div className="trig-steps">
              <Step num={1} title="Write the equation">
                <Line latex={`${fnL[parsed.fn]}(${parsed.B === 1 ? '\\theta' : `${parsed.B}\\theta`}) = ${exact(parsed.rhs)}`} />
                {parsed.fn !== simpleRes.baseFn && <Line latex={`\\Rightarrow \\${simpleRes.baseFn}(${parsed.B === 1 ? '\\theta' : `${parsed.B}\\theta`}) = ${exact(simpleRes.baseRhs)}`} />}
              </Step>
              {parsed.B > 1 && (<Step num={2} title={`Let x = ${parsed.B}θ, solve x ∈ [0, ${parsed.B * 2}π)`}>
                <Line latex={`\\${simpleRes.baseFn}(x) = ${exact(simpleRes.baseRhs)},\\quad x \\in [0,\\ ${parsed.B * 2}\\pi)`} />
                <Note text="Expanding the interval ensures dividing by B gives a full revolution." />
              </Step>)}
              <Step num={parsed.B > 1 ? 3 : 2} title="Find reference angle">
                <Line latex={`\\theta_R = ${radLatex(simpleRes.refAngle)} \\approx ${fmt(toDeg(simpleRes.refAngle), 2)}^\\circ`} />
                <Note text={qNote(simpleRes.baseFn, simpleRes.baseRhs)} />
              </Step>
              <Step num={parsed.B > 1 ? 4 : 3} title="All solutions">
                {simpleRes.solutions.length === 0
                  ? <Line latex="\\text{No solution in } [0,2\\pi)" />
                  : simpleRes.solutions.map((s, i) => <Line key={i} latex={`\\theta = ${radLatex(s)} \\approx ${fmt(toDeg(s), 1)}^\\circ`} />)}
              </Step>
              <AnswerBox latex={simpleRes.solutions.length === 0 ? '\\text{No solution}'
                : `\\theta = ${simpleRes.solutions.map(s => radLatex(s)).join(',\\ ')}`} />
            </div>)}

            {/* ── Quadratic ──────────────────────────────────────── */}
            {parsed.type === 'quadratic' && (() => {
              if (quadRes?.error) return <div className="trig-warning">{quadRes.error}</div>
              if (!quadRes) return null
              const { fi } = quadRes
              const { fn: qFn, a: qa, b: qb, c: qc } = parsed
              const fSym = `\\${qFn}\\theta`, fSym2 = `\\${qFn}^2\\!\\theta`
              const uSym = 'u', uSym2 = 'u^2'
              let sn = 1
              return (<div className="trig-steps">
                <Step num={sn++} title="Write the equation">
                  <Line latex={eqLx(qa, qb, qc, fSym, fSym2)} />
                </Step>
                <Step num={sn++} title={`Let u = ${qFn}(θ) — write as a quadratic in u`}>
                  <Line latex={eqLx(qa, qb, qc, uSym, uSym2)} />
                </Step>
                {fi.type === 'factor_out' && (<Step num={sn++} title="Factor: c = 0, so factor out u">
                  <Line latex={`u(${eqLx(qa, 0, qb, uSym, '').replace(' = 0','')}) = 0`} />
                  <Line latex={`u = 0 \\quad \\text{or} \\quad ${qa !== 1 ? qa : ''}u ${qb >= 0 ? '+' : ''}${qb} = 0`} />
                </Step>)}
                {fi.type === 'sqrt' && (<Step num={sn++} title="Solve by square root (b = 0)">
                  <Line latex={`u^2 = ${exact(-qc / qa)}`} />
                  <Line latex={`u = \\pm ${exact(fi.sq)}`} />
                </Step>)}
                {fi.type === 'factored' && (<Step num={sn++} title="Factor the quadratic (AC method)">
                  <Line latex={`(${fmtFactor(fi.D1, fi.N1, uSym)})(${fmtFactor(fi.D2, fi.N2, uSym)}) = 0`} />
                  <Line latex={`u = ${exact(-fi.N1 / fi.D1)} \\quad \\text{or} \\quad u = ${exact(-fi.N2 / fi.D2)}`} />
                </Step>)}
                {fi.type === 'formula' && (<Step num={sn++} title="Quadratic formula">
                  <Line latex={`u = \\dfrac{${-qb} \\pm \\sqrt{${fmt(fi.disc, 4)}}}{${2 * qa}}`} />
                  <Line latex={`u \\approx ${exact(fi.roots[0])} \\quad \\text{or} \\quad u \\approx ${exact(fi.roots[1])}`} />
                </Step>)}
                <Step num={sn++} title={`Back-substitute: solve ${qFn}(θ) = u for each root`}>
                  {fi.roots.map((r, i) => <Branch key={i} fnName={qFn} root={r} />)}
                </Step>
                <AnswerBox latex={quadRes.allSols.length === 0 ? '\\text{No solution in }[0,2\\pi)'
                  : `\\theta = ${quadRes.allSols.map(s => radLatex(s)).join(',\\ ')}`} />
              </div>)
            })()}

            {/* ── Double Angle ────────────────────────────────────── */}
            {parsed.type === 'dblangle' && (() => {
              if (daRes?.error) return <div className="trig-warning">{daRes.error}</div>
              if (!daRes) return null

              if (daRes.type === 'sin2_product') {
                const { f1Fn, f1Res, f2Fn, f2Rhs, f2Res, daLin, daRem } = daRes
                let sn = 1
                return (<div className="trig-steps">
                  <Step num={sn++} title="Apply identity: sin(2θ) = 2sinθcosθ">
                    <Line latex={`2\\sin\\theta\\cos\\theta ${daLin >= 0 ? '+' : ''}${daLin}\\${daRem}\\theta = 0`} />
                  </Step>
                  <Step num={sn++} title={`Factor out ${daRem}(θ)`}>
                    <Line latex={`\\${daRem}\\theta\\left(2\\${f2Fn}\\theta ${daLin >= 0 ? '+' : ''}${daLin}\\right) = 0`} />
                  </Step>
                  <Step num={sn++} title="Set each factor equal to zero">
                    <Note text={`Factor 1: ${f1Fn}(θ) = 0`} />
                    {f1Res?.solutions.map((s, i) => <Line key={i} latex={`\\theta = ${radLatex(s)}`} />)}
                    <Note text={`Factor 2: 2·${f2Fn}(θ) + ${daLin} = 0 → ${f2Fn}(θ) = ${exact(f2Rhs)}`} />
                    {!f2Res || f2Res.solutions.length === 0
                      ? <Note text={`No solution — |${exact(f2Rhs)}| > 1`} />
                      : f2Res.solutions.map((s, i) => <Line key={i} latex={`\\theta = ${radLatex(s)}`} />)}
                  </Step>
                  <AnswerBox latex={daRes.allSols.length === 0 ? '\\text{No solution}'
                    : `\\theta = ${daRes.allSols.map(s => radLatex(s)).join(',\\ ')}`} />
                </div>)
              }

              if (daRes.type === 'cos2_quad') {
                const { fi, identLx, subFn, dqa, dqb, dqc, daLin, daCon } = daRes
                const fSym = `\\${subFn}\\theta`, fSym2 = `\\${subFn}^2\\!\\theta`
                let sn = 1
                return (<div className="trig-steps">
                  <Step num={sn++} title={`Apply identity: cos(2θ) in terms of ${subFn}`}>
                    <Line latex={identLx} />
                    <Line latex={`(${identLx.split('=')[1].trim()}) ${daLin >= 0 ? '+' : ''}${daLin !== 0 ? `${daLin}\\${subFn}\\theta` : ''} ${daCon >= 0 ? '+' : ''}${daCon !== 0 ? daCon : ''} = 0`} />
                  </Step>
                  <Step num={sn++} title="Simplify — collect like terms">
                    <Line latex={eqLx(dqa, dqb, dqc, fSym, fSym2)} />
                  </Step>
                  <Step num={sn++} title={`Let u = ${subFn}(θ)`}>
                    <Line latex={eqLx(dqa, dqb, dqc, 'u', 'u^2')} />
                  </Step>
                  {fi.type === 'factor_out' && (<Step num={sn++} title="Factor (c = 0)">
                    <Line latex={`u(${dqa !== 1 ? dqa : ''}u ${dqb >= 0 ? '+' : ''}${dqb}) = 0`} />
                    <Line latex={`u = 0 \\quad \\text{or} \\quad u = ${exact(-dqb / dqa)}`} />
                  </Step>)}
                  {fi.type === 'sqrt' && (<Step num={sn++} title="Square root">
                    <Line latex={`u^2 = ${exact(-dqc / dqa)} \\Rightarrow u = \\pm ${exact(fi.sq)}`} />
                  </Step>)}
                  {fi.type === 'factored' && (<Step num={sn++} title="Factor (AC method)">
                    <Line latex={`(${fmtFactor(fi.D1, fi.N1, 'u')})(${fmtFactor(fi.D2, fi.N2, 'u')}) = 0`} />
                    <Line latex={`u = ${exact(-fi.N1 / fi.D1)} \\quad \\text{or} \\quad u = ${exact(-fi.N2 / fi.D2)}`} />
                  </Step>)}
                  {fi.type === 'formula' && (<Step num={sn++} title="Quadratic formula">
                    <Line latex={`u = \\dfrac{${-dqb} \\pm \\sqrt{${fmt(fi.disc, 4)}}}{${2 * dqa}}`} />
                    <Line latex={`u \\approx ${exact(fi.roots[0])} \\quad \\text{or} \\quad u \\approx ${exact(fi.roots[1])}`} />
                  </Step>)}
                  <Step num={sn++} title={`Back-substitute: solve ${subFn}(θ) = u`}>
                    {fi.roots.map((r, i) => <Branch key={i} fnName={subFn} root={r} />)}
                  </Step>
                  <AnswerBox latex={daRes.allSols.length === 0 ? '\\text{No solution in }[0,2\\pi)'
                    : `\\theta = ${daRes.allSols.map(s => radLatex(s)).join(',\\ ')}`} />
                </div>)
              }

              return null
            })()}

          </div>
        </div>
      )}

      <UnitCircleSVG
        angleDeg={allSolsForCircle[0] ? toDeg(allSolsForCircle[0]) : 0}
        solutions={allSolsForCircle.map((s, i) => ({ deg: toDeg(s), color: ['#059669','#7c3aed','#dc2626','#d97706'][i % 4] }))}
        showPoint={false}
      />
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
  const [formula, setFormula] = useState('s-')
  const [aStr, setAStr] = useState('20')
  const [bStr, setBStr] = useState('80')

  const A = parseFloat(aStr), B = parseFloat(bStr)
  const valid = isFinite(A) && isFinite(B)
  const fn = formula[0], op = formula[1]  // 's'/'c' and '+'/ '-'
  const combined = valid ? (op === '+' ? A + B : A - B) : 0
  const combNorm = ((combined % 360) + 360) % 360
  const sinA = valid ? exact(Math.sin(toRad(A))) : '?'
  const cosA = valid ? exact(Math.cos(toRad(A))) : '?'
  const sinB = valid ? exact(Math.sin(toRad(B))) : '?'
  const cosB = valid ? exact(Math.cos(toRad(B))) : '?'
  const result = valid
    ? fn === 's'
      ? (op === '+' ? Math.sin(toRad(A)) * Math.cos(toRad(B)) + Math.cos(toRad(A)) * Math.sin(toRad(B))
        : Math.sin(toRad(A)) * Math.cos(toRad(B)) - Math.cos(toRad(A)) * Math.sin(toRad(B)))
      : (op === '+' ? Math.cos(toRad(A)) * Math.cos(toRad(B)) - Math.sin(toRad(A)) * Math.sin(toRad(B))
        : Math.cos(toRad(A)) * Math.cos(toRad(B)) + Math.sin(toRad(A)) * Math.sin(toRad(B)))
    : 0

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
              <label>Angle A (degrees)</label>
              <input className="trig-input" value={aStr} onChange={e => setAStr(e.target.value)}
                placeholder="e.g. 20, 45, 75" style={{ width: 100 }} />
            </div>
            <div className="trig-input-group">
              <label>Angle B (degrees)</label>
              <input className="trig-input" value={bStr} onChange={e => setBStr(e.target.value)}
                placeholder="e.g. 80, 30, 15" style={{ width: 100 }} />
            </div>
          </div>
          {valid && (
            <div className="trig-steps">
              <Step num={1} title="Write the formula">
                <Line latex={formulaLatex} />
              </Step>
              <Step num={2} title="Look up values for each angle">
                <Line latex={`A = ${fmt(A,1)}^\\circ,\\ B = ${fmt(B,1)}^\\circ`} />
                <Line latex={`\\sin(${fmt(A,1)}^\\circ)=${sinA},\\ \\cos(${fmt(A,1)}^\\circ)=${cosA}`} />
                <Line latex={`\\sin(${fmt(B,1)}^\\circ)=${sinB},\\ \\cos(${fmt(B,1)}^\\circ)=${cosB}`} />
                <Note text="For non-special angles, decimal approximations are used." />
              </Step>
              <Step num={3} title="Substitute and compute">
                {fn === 's' ? (
                  <>
                    <Line latex={`= (${sinA})(${cosB}) ${op === '+' ? '+' : '-'} (${cosA})(${sinB})`} />
                    <Line latex={`= ${exact(result)}`} />
                  </>
                ) : (
                  <>
                    <Line latex={`= (${cosA})(${cosB}) ${op === '+' ? '-' : '+'} (${sinA})(${sinB})`} />
                    <Line latex={`= ${exact(result)}`} />
                  </>
                )}
                <Note text={`This equals ${fnFull}(${fmt(combined,1)}°) = ${fnFull}(${fmt(combNorm,1)}°)`} />
              </Step>
              <AnswerBox latex={`${fnFull}(${fmt(A,1)}^\\circ ${op === '+' ? '+' : '-'} ${fmt(B,1)}^\\circ) = ${exact(result)}`} />
            </div>
          )}
        </div>
      </div>
      {valid && <UnitCircleSVG angleDeg={combNorm} />}
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
