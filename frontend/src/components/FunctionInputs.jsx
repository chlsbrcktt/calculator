import { useState } from 'react'
import './FunctionInputs.css'

const FLASHCARDS = [
  {
    id: 'end-behavior',
    title: 'End Behavior',
    body: (
      <div className="fc-body">
        <div className="fc-note">Check the <strong>leading term</strong> (highest-degree term):</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">Even degree, + coeff</span><span className="fc-value">↑ both ends up</span></div>
          <div className="fc-row"><span className="fc-label">Even degree, − coeff</span><span className="fc-value">↓ both ends down</span></div>
          <div className="fc-row"><span className="fc-label">Odd degree, + coeff</span><span className="fc-value">↓ left &nbsp;↑ right</span></div>
          <div className="fc-row"><span className="fc-label">Odd degree, − coeff</span><span className="fc-value">↑ left &nbsp;↓ right</span></div>
        </div>
        <div className="fc-example"><code>−2x³</code>: odd, negative → ↑ left, ↓ right</div>
      </div>
    ),
  },
  {
    id: 'vertex',
    title: 'Vertex / Local Extrema',
    body: (
      <div className="fc-body">
        <div className="fc-note"><strong>Parabolas only</strong> — standard form <code>ax² + bx + c</code>:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">x of vertex</span><span className="fc-value">x = −b ÷ (2a)</span></div>
          <div className="fc-row"><span className="fc-label">y of vertex</span><span className="fc-value">plug x back into f(x)</span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}>Vertex form <code>a(x − h)² + k</code>:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">vertex</span><span className="fc-value">(h, k) — read it directly</span></div>
          <div className="fc-row"><span className="fc-label">sign note</span><span className="fc-value">it's (x − h), so h is opposite the sign shown</span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}><strong>Degree 3+</strong> — no single "vertex"; find <em>local maxima/minima</em>:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">1. Take f′(x)</span><span className="fc-value">differentiate the function</span></div>
          <div className="fc-row"><span className="fc-label">2. Solve f′(x) = 0</span><span className="fc-value">these x-values are critical points</span></div>
          <div className="fc-row"><span className="fc-label">3. Classify each</span><span className="fc-value">plug into f″(x): negative → local max, positive → local min, zero → check further</span></div>
          <div className="fc-row"><span className="fc-label">or: sign chart</span><span className="fc-value">f′ goes + → − : local max &nbsp;|&nbsp; − → + : local min</span></div>
        </div>
        <div className="fc-example">e.g. <code>x³ − 3x</code>: f′ = 3x²−3 = 0 → x = ±1; local max at x=−1, local min at x=1</div>
      </div>
    ),
  },
  {
    id: 'max-min',
    title: 'Max or Minimum?',
    body: (
      <div className="fc-body">
        <div className="fc-note">For a parabola <code>ax² + …</code>:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">a &gt; 0 (opens ∪)</span><span className="fc-value">vertex is a <strong>minimum</strong></span></div>
          <div className="fc-row"><span className="fc-label">a &lt; 0 (opens ∩)</span><span className="fc-value">vertex is a <strong>maximum</strong></span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}>For any polynomial by end behavior:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">Both ends ↑</span><span className="fc-value">has a global minimum</span></div>
          <div className="fc-row"><span className="fc-label">Both ends ↓</span><span className="fc-value">has a global maximum</span></div>
          <div className="fc-row"><span className="fc-label">Ends go opposite</span><span className="fc-value">no global min or max</span></div>
        </div>
      </div>
    ),
  },
  {
    id: 'asymptotes',
    title: 'Asymptotes',
    body: (
      <div className="fc-body">
        <div className="fc-note">For rational functions <code>p(x) / q(x)</code>:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">Vertical</span><span className="fc-value">q(x) = 0 (and p(x) ≠ 0 there)</span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}>Horizontal — compare degree of numerator (n) vs denominator (m):</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">n &lt; m</span><span className="fc-value">y = 0</span></div>
          <div className="fc-row"><span className="fc-label">n = m</span><span className="fc-value">y = (leading coeff) ÷ (leading coeff)</span></div>
          <div className="fc-row"><span className="fc-label">n &gt; m by 1</span><span className="fc-value">oblique — do long division</span></div>
          <div className="fc-row"><span className="fc-label">n &gt; m by 2+</span><span className="fc-value">no horizontal or oblique</span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}>Oblique: long-divide p by q; the quotient line (drop remainder) is the asymptote.</div>
      </div>
    ),
  },
  {
    id: 'multiplicities',
    title: 'Multiplicities',
    body: (
      <div className="fc-body">
        <div className="fc-note">For a root r with multiplicity k:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">Even k</span><span className="fc-value">touches x-axis, bounces back (doesn't cross)</span></div>
          <div className="fc-row"><span className="fc-label">Odd k</span><span className="fc-value">crosses the x-axis</span></div>
        </div>
        <div className="fc-note" style={{marginTop: 6}}>Shape at the intercept:</div>
        <div className="fc-rows">
          <div className="fc-row"><span className="fc-label">k = 1</span><span className="fc-value">clean straight cross</span></div>
          <div className="fc-row"><span className="fc-label">k = 2</span><span className="fc-value">tangent touch — bounces like a ball</span></div>
          <div className="fc-row"><span className="fc-label">k = 3</span><span className="fc-value">S-curve cross — flattens at axis</span></div>
          <div className="fc-row"><span className="fc-label">k higher</span><span className="fc-value">even flatter at the intercept</span></div>
        </div>
        <div className="fc-example">e.g. <code>(x−2)²(x+1)³</code>: touches at x=2, crosses at x=−1</div>
      </div>
    ),
  },
]

const EXAMPLES = [
  'x^2 - 4',
  '2*x + 1',
  'sin(x)',
  'x^3 - 3*x',
  'cos(x) + 0.5*x',
  'sqrt(x)',
  'log(x)',
  'exp(-x^2)',
  '1/x',
  'x^4 - 4*x^2',
]

const EMPTY_PS = { x: '', y: '', m: '', mUndef: false }

const R9 = v => Math.round(v * 1e9) / 1e9

// Parse a fraction string to a float (used for counting valid points)
function parseFrac(s) {
  const t = (s || '').trim()
  if (!t) return NaN
  const sl = t.indexOf('/')
  if (sl === -1) return parseFloat(t)
  const n = parseFloat(t.slice(0, sl)), d = parseFloat(t.slice(sl + 1))
  return (!isNaN(n) && !isNaN(d) && d !== 0) ? n / d : NaN
}

// ── Exact rational arithmetic ────────────────────────────────────────────────
// Used to build expressions that SymPy can simplify cleanly (avoids decimal noise)

function gcd(a, b) {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b))
  while (b) { const t = b; b = a % b; a = t }
  return a || 1
}

// Parse string to exact {n, d} rational, or null if not an exact integer/fraction
function toRat(s) {
  if (!s) return null
  const t = s.trim()
  const sl = t.indexOf('/')
  if (sl === -1) {
    const v = parseFloat(t)
    return (!isNaN(v) && Number.isInteger(v)) ? { n: v, d: 1 } : null
  }
  const n = parseInt(t.slice(0, sl), 10), d = parseInt(t.slice(sl + 1), 10)
  if (isNaN(n) || isNaN(d) || d === 0) return null
  const g = gcd(Math.abs(n), Math.abs(d))
  return { n: (d < 0 ? -1 : 1) * (n / g), d: Math.abs(d / g) }
}

const rSimp = r => { if (!r || r.d === 0) return null; const g = gcd(Math.abs(r.n), Math.abs(r.d)); return { n: (r.d < 0 ? -1 : 1) * (r.n / g), d: Math.abs(r.d / g) } }
const rAdd  = (a, b) => rSimp({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
const rSub  = (a, b) => rAdd(a, { n: -b.n, d: b.d })
const rMul  = (a, b) => rSimp({ n: a.n * b.n, d: a.d * b.d })
const rDiv  = (a, b) => (b && b.n !== 0) ? rMul(a, { n: b.d, d: b.n }) : null
const rToF  = r => r.n / r.d

// Build a SymPy-safe expression string from exact rational m and b (y = mx + b)
function buildExactLinear(m, b) {
  if (!m || !b) return null
  const mF = rToF(m), bF = rToF(b)
  const mStr = m.d === 1 ? String(m.n) : `${m.n}/${m.d}`
  const bAbsStr = b.d === 1 ? String(Math.abs(b.n)) : `${Math.abs(b.n)}/${b.d}`

  let expr
  if (m.n === 0)   expr = b.d === 1 ? String(b.n) : `${b.n}/${b.d}`
  else if (b.n === 0) expr = `${mStr}*x`
  else if (bF > 0) expr = `${mStr}*x + ${bAbsStr}`
  else             expr = `${mStr}*x - ${bAbsStr}`

  // Human-readable display
  const mAbs = Math.abs(mF)
  const mSign = mF < 0 ? '-' : ''
  const mCore = mAbs === 1 ? `${mSign}x`
    : `${mSign}${m.d === 1 ? String(Math.abs(m.n)) : `(${Math.abs(m.n)}/${m.d})`}x`
  let display
  if (m.n === 0) display = `y = ${bF}`
  else if (b.n === 0) display = `y = ${mCore}`
  else if (bF > 0) display = `y = ${mCore} + ${bAbsStr}`
  else             display = `y = ${mCore} - ${bAbsStr}`

  return { vx: null, expr, display }
}

function makeLinear(m, b) {
  const expr = m === 0 ? String(b) : `${m}*x + ${b}`
  const mAbs = Math.abs(m)
  const mCore = mAbs === 1 ? 'x' : `${mAbs}x`
  const mSign = m < 0 ? '-' : ''
  let display
  if (m === 0) display = `y = ${b}`
  else if (b === 0) display = `y = ${mSign}${mCore}`
  else if (b > 0) display = `y = ${mSign}${mCore} + ${b}`
  else display = `y = ${mSign}${mCore} - ${Math.abs(b)}`
  return { vx: null, expr, display }
}

function makeQuadratic(a, b, c) {
  const aR = R9(a), bR = R9(b), cR = R9(c)
  if (Math.abs(aR) < 1e-9) return makeLinear(bR, cR)

  // expression for backend
  const parts = [`${aR}*x^2`]
  if (Math.abs(bR) > 1e-9) parts.push(`${bR > 0 ? '+' : ''}${bR}*x`)
  if (Math.abs(cR) > 1e-9) parts.push(`${cR > 0 ? '+' : ''}${cR}`)
  const expr = parts.join(' ')

  // human-readable display with ² superscript
  const aCore = Math.abs(aR) === 1 ? 'x²' : `${Math.abs(aR)}x²`
  let disp = `y = ${aR < 0 ? '-' : ''}${aCore}`
  if (Math.abs(bR) > 1e-9) {
    const bCore = Math.abs(bR) === 1 ? 'x' : `${Math.abs(bR)}x`
    disp += ` ${bR > 0 ? '+' : '-'} ${bCore}`
  }
  if (Math.abs(cR) > 1e-9) disp += ` ${cR > 0 ? '+' : '-'} ${Math.abs(cR)}`
  return { vx: null, expr, display: disp }
}

function fitQuadratic(x1, y1, x2, y2, x3, y3) {
  const m = [
    [x1 * x1, x1, 1, y1],
    [x2 * x2, x2, 1, y2],
    [x3 * x3, x3, 1, y3],
  ]
  for (let col = 0; col < 3; col++) {
    let maxRow = col
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[maxRow][col])) maxRow = r
    ;[m[col], m[maxRow]] = [m[maxRow], m[col]]
    if (Math.abs(m[col][col]) < 1e-12) return null
    for (let r = col + 1; r < 3; r++) {
      const f = m[r][col] / m[col][col]
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c]
    }
  }
  const res = [0, 0, 0]
  for (let i = 2; i >= 0; i--) {
    res[i] = m[i][3]
    for (let j = i + 1; j < 3; j++) res[i] -= m[i][j] * res[j]
    res[i] /= m[i][i]
  }
  return { a: res[0], b: res[1], c: res[2] }
}

function computeFromPS(ps) {
  const xs = ps.x.split(',').map(s => parseFrac(s.trim())).filter(v => !isNaN(v))
  const ys = ps.y.split(',').map(s => parseFrac(s.trim())).filter(v => !isNaN(v))
  const n = Math.min(xs.length, ys.length)

  if (ps.mUndef) return xs.length > 0 ? { vx: xs[0], expr: null, display: `x = ${xs[0]}` } : null
  if (n === 0) return null

  if (n === 1) {
    const mVal = parseFrac(ps.m)
    if (isNaN(mVal)) return null

    // Exact path: slope and point are both exact integer/fraction values
    const mR = toRat(ps.m.trim())
    const x1R = toRat(ps.x.split(',')[0]?.trim())
    const y1R = toRat(ps.y.split(',')[0]?.trim())
    if (mR && x1R && y1R) {
      const bR = rSub(y1R, rMul(mR, x1R))
      const exact = bR && buildExactLinear(mR, bR)
      if (exact) return exact
    }

    return makeLinear(R9(mVal), R9(ys[0] - mVal * xs[0]))
  }

  if (n === 2) {
    if (Math.abs(xs[1] - xs[0]) < 1e-12) return { vx: xs[0], expr: null, display: `x = ${xs[0]}` }

    // Exact path: both points are exact integer/fraction values
    const parts = (str) => str.split(',')
    const x1R = toRat(parts(ps.x)[0]?.trim()), y1R = toRat(parts(ps.y)[0]?.trim())
    const x2R = toRat(parts(ps.x)[1]?.trim()), y2R = toRat(parts(ps.y)[1]?.trim())
    if (x1R && y1R && x2R && y2R) {
      const dy = rSub(y2R, y1R), dx = rSub(x2R, x1R)
      if (dy && dx && dx.n !== 0) {
        const mR = rDiv(dy, dx)
        const bR = mR && rSub(y1R, rMul(mR, x1R))
        const exact = bR && buildExactLinear(mR, bR)
        if (exact) return exact
      }
    }

    const m = (ys[1] - ys[0]) / (xs[1] - xs[0])
    return makeLinear(R9(m), R9(ys[0] - m * xs[0]))
  }

  // n >= 3: fit quadratic through first 3 points
  const qr = fitQuadratic(xs[0], ys[0], xs[1], ys[1], xs[2], ys[2])
  if (!qr) return null
  return makeQuadratic(qr.a, qr.b, qr.c)
}

const EMPTY_PIECE = { expr: '', cond: '' }

function parseCondition(s) {
  const t = (s || '').trim().replace(/≤/g, '<=').replace(/≥/g, '>=')
  if (!t || /^(otherwise|else|all)$/i.test(t)) return 'True'
  const flipOp = o => ({ '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[o] || o)
  const cmp = t.match(/^(-?[\d./]+)\s*(<=?|>=?)\s*x\s*(<=?|>=?)\s*(-?[\d./]+)$/i)
  if (cmp) return `(x ${flipOp(cmp[2])} ${cmp[1]}) & (x ${cmp[3]} ${cmp[4]})`
  const sm = t.match(/^x\s*(<=?|>=?|[<>])\s*(-?[\d./]+)$/i)
  if (sm) return `x ${sm[1]} ${sm[2]}`
  const rv = t.match(/^(-?[\d./]+)\s*(<=?|>=?|[<>])\s*x$/i)
  if (rv) return `x ${flipOp(rv[2])} ${rv[1]}`
  return t
}

function buildPiecewiseExpr(pieces) {
  const valid = pieces.filter(p => p.expr.trim())
  if (valid.length === 0) return ''
  if (valid.length === 1 && parseCondition(valid[0].cond) === 'True') return valid[0].expr.trim()
  const parts = valid.map(p => `(${p.expr.trim()}, ${parseCondition(p.cond)})`)
  return `Piecewise(${parts.join(', ')})`
}

export default function FunctionInputs({
  functions,
  colors,
  colorNames,
  onUpdate,
  onToggle,
  onSetVertical,
  xMin,
  xMax,
  onRangeChange,
}) {
  const [localXMin, setLocalXMin] = useState(String(xMin))
  const [localXMax, setLocalXMax] = useState(String(xMax))
  const [openCards, setOpenCards] = useState({})
  const [showTip, setShowTip] = useState(false)
  const [inputMode, setInputMode] = useState('eq')
  const [psInputs, setPsInputs] = useState([EMPTY_PS, EMPTY_PS, EMPTY_PS])
  const [pwInputs, setPwInputs] = useState([
    [{ ...EMPTY_PIECE }, { ...EMPTY_PIECE }],
    [{ ...EMPTY_PIECE }, { ...EMPTY_PIECE }],
    [{ ...EMPTY_PIECE }, { ...EMPTY_PIECE }],
  ])

  const toggleCard = (id) => setOpenCards(prev => ({ ...prev, [id]: !prev[id] }))

  const handleRangeSubmit = (e) => {
    e.preventDefault()
    const min = parseFloat(localXMin)
    const max = parseFloat(localXMax)
    if (!isNaN(min) && !isNaN(max) && min < max) {
      onRangeChange(min, max)
    }
  }

  const setPreset = (min, max) => {
    setLocalXMin(String(min))
    setLocalXMax(String(max))
    onRangeChange(min, max)
  }

  const handlePwChange = (si, pi, field, val) => {
    const next = pwInputs.map((slot, s) =>
      s !== si ? slot : slot.map((piece, p) => p !== pi ? piece : { ...piece, [field]: val })
    )
    setPwInputs(next)
    const expr = buildPiecewiseExpr(next[si])
    if (expr) onUpdate(si, expr)
  }

  const handlePwAddPiece = (si) => {
    if (pwInputs[si].length >= 5) return
    setPwInputs(prev => prev.map((slot, s) => s === si ? [...slot, { ...EMPTY_PIECE }] : slot))
  }

  const handlePwRemovePiece = (si, pi) => {
    const next = pwInputs.map((slot, s) =>
      s !== si ? slot : slot.filter((_, p) => p !== pi)
    )
    setPwInputs(next)
    const expr = buildPiecewiseExpr(next[si])
    onUpdate(si, expr || '')
  }

  const handlePsChange = (i, field, rawValue) => {
    const next = psInputs.map((ps, j) => j === i ? { ...ps, [field]: rawValue } : ps)
    setPsInputs(next)
    const computed = computeFromPS(next[i])
    if (!computed) return
    if (computed.vx !== null) {
      onSetVertical(i, computed.vx)
    } else {
      onUpdate(i, computed.expr)
    }
  }

  return (
    <div className="function-inputs">
      {/* Tab bar */}
      <div className="fi-tabs">
        <button className={`fi-tab ${inputMode === 'eq' ? 'active' : ''}`} onClick={() => setInputMode('eq')}>
          f(x) =
        </button>
        <button className={`fi-tab ${inputMode === 'ps' ? 'active' : ''}`} onClick={() => setInputMode('ps')}>
          Point &amp; Slope
        </button>
        <button className={`fi-tab ${inputMode === 'pw' ? 'active' : ''}`} onClick={() => setInputMode('pw')}>
          Piecewise
        </button>
        {inputMode === 'eq' && (
          <div className="tip-anchor" style={{ marginLeft: 'auto' }}>
            <button className="tip-trigger" onClick={() => setShowTip(v => !v)} aria-label="Syntax tips">?</button>
            {showTip && (
              <div className="tip-popup" role="tooltip">
                <div className="tip-popup-title">Syntax tips</div>
                <div className="tip-item"><code>^</code> or <code>**</code> for powers</div>
                <div className="tip-item"><code>2x</code> or <code>2*x</code> both work</div>
                <div className="tip-item">Functions: sin, cos, tan, sqrt, log, exp, abs</div>
                <div className="tip-item">Constants: pi, e</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Equations tab ── */}
      {inputMode === 'eq' && functions.map((fn, i) => (
        <div key={i} className="function-row">
          <div className="function-row-top">
            <button
              className="color-toggle"
              style={{ background: fn.enabled ? colors[i] : '#2a2d3a', border: `2px solid ${colors[i]}` }}
              onClick={() => onToggle(i)}
              title={fn.enabled ? 'Hide' : 'Show'}
            />
            <div className="function-label">f{i + 1}(x) =</div>
            <input
              className="function-input"
              type="text"
              value={fn.expression}
              onChange={e => onUpdate(i, e.target.value)}
              placeholder={`e.g. ${EXAMPLES[i * 3] || 'x^2'}`}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      ))}

      {/* ── Point & Slope tab ── */}
      {inputMode === 'ps' && (
        <div className="ps-section">
          <div className="ps-hint">Enter up to 3 (x, y) pairs. 1 point needs a slope; 2 points → line; 3 points → parabola.</div>
          {functions.map((fn, i) => {
            const ps = psInputs[i]
            const xs = ps.x.split(',').map(s => parseFrac(s.trim())).filter(v => !isNaN(v))
            const ys = ps.y.split(',').map(s => parseFrac(s.trim())).filter(v => !isNaN(v))
            const n = Math.min(xs.length, ys.length)
            const slopeActive = n <= 1
            const computed = computeFromPS(ps)
            return (
              <div key={i} className="ps-row">
                <button
                  className="color-toggle"
                  style={{ background: fn.enabled ? colors[i] : '#2a2d3a', border: `2px solid ${colors[i]}` }}
                  onClick={() => onToggle(i)}
                  title={fn.enabled ? 'Hide' : 'Show'}
                />
                <div className="ps-body">
                  <div className="ps-fi-label">f{i + 1}</div>
                  <div className="ps-inline">
                    <span className="ps-lbl">x</span>
                    <input
                      className="ps-arr"
                      placeholder="0, 1, 2"
                      value={ps.x}
                      onChange={e => handlePsChange(i, 'x', e.target.value)}
                    />
                    <span className="ps-lbl">y</span>
                    <input
                      className="ps-arr"
                      placeholder="1, 3, 7"
                      value={ps.y}
                      onChange={e => handlePsChange(i, 'y', e.target.value)}
                    />
                    <span className={`ps-lbl${slopeActive ? '' : ' ps-lbl-dim'}`}>m</span>
                    <input
                      className="ps-m"
                      type="text"
                      placeholder={slopeActive ? '2 or 1/3' : '—'}
                      value={ps.m}
                      disabled={!slopeActive || ps.mUndef}
                      onChange={e => handlePsChange(i, 'm', e.target.value)}
                    />
                    <label className={`ps-vert${slopeActive ? '' : ' ps-vert-dim'}`}>
                      <input
                        type="checkbox"
                        checked={ps.mUndef}
                        disabled={!slopeActive}
                        onChange={e => handlePsChange(i, 'mUndef', e.target.checked)}
                      />
                      vert
                    </label>
                  </div>
                  {computed && <div className="ps-preview">{computed.display}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Piecewise tab ── */}
      {inputMode === 'pw' && (
        <div className="pw-section">
          <div className="pw-hint">Conditions: x &lt; 0, x ≥ 2, -1 ≤ x &lt; 3 — leave empty for "otherwise"</div>
          {functions.map((fn, si) => (
            <div key={si} className="pw-slot">
              <button
                className="color-toggle"
                style={{ background: fn.enabled ? colors[si] : '#2a2d3a', border: `2px solid ${colors[si]}` }}
                onClick={() => onToggle(si)}
                title={fn.enabled ? 'Hide' : 'Show'}
              />
              <div className="pw-body">
                <div className="pw-fi-label">f{si + 1}</div>
                {pwInputs[si].map((piece, pi) => (
                  <div key={pi} className="pw-piece">
                    <input
                      className="pw-expr"
                      placeholder="expression"
                      value={piece.expr}
                      onChange={e => handlePwChange(si, pi, 'expr', e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <span className="pw-if">if</span>
                    <input
                      className="pw-cond"
                      placeholder="otherwise"
                      value={piece.cond}
                      onChange={e => handlePwChange(si, pi, 'cond', e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button
                      className="pw-remove"
                      onClick={() => handlePwRemovePiece(si, pi)}
                      disabled={pwInputs[si].length <= 1}
                      title="Remove piece"
                    >×</button>
                  </div>
                ))}
                {pwInputs[si].length < 5 && (
                  <button className="pw-add" onClick={() => handlePwAddPiece(si)}>+ piece</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 8 }}>X Range</div>
      <form className="range-form" onSubmit={handleRangeSubmit}>
        <div className="range-row">
          <label>Min</label>
          <input
            className="range-input"
            type="number"
            value={localXMin}
            onChange={e => setLocalXMin(e.target.value)}
            step="any"
          />
          <label>Max</label>
          <input
            className="range-input"
            type="number"
            value={localXMax}
            onChange={e => setLocalXMax(e.target.value)}
            step="any"
          />
          <button className="apply-btn" type="submit">Apply</button>
        </div>
        <div className="preset-row">
          {[[-5,5],[-10,10],[-20,20],[-100,100]].map(([a,b]) => (
            <button
              key={`${a},${b}`}
              type="button"
              className={`preset-btn ${xMin === a && xMax === b ? 'active' : ''}`}
              onClick={() => setPreset(a, b)}
            >
              {a} to {b}
            </button>
          ))}
        </div>
      </form>

      <div className="section-label" style={{ marginTop: 8 }}>Quick Reference</div>
      <div className="flashcard-section">
        {FLASHCARDS.map(card => (
          <div key={card.id} className="flashcard">
            <button
              className="flashcard-header"
              onClick={() => toggleCard(card.id)}
              aria-expanded={!!openCards[card.id]}
            >
              <span className="flashcard-title">{card.title}</span>
              <span className={`flashcard-chevron${openCards[card.id] ? ' open' : ''}`}>▼</span>
            </button>
            {openCards[card.id] && card.body}
          </div>
        ))}
      </div>
    </div>
  )
}
