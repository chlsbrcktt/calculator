import { useState, useRef, useEffect, memo, useCallback } from 'react'
import Plotly from 'plotly.js-dist-min'
import { SurfacesSection } from './LinearAlgebra'
import './LinearAlgebra.css'

// ─── Shared Plot wrapper ──────────────────────────────────────────────────────
const Plot = memo(function Plot({ data, layout, config, style }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    Plotly.react(ref.current, data, layout, { ...config, responsive: true })
  })
  useEffect(() => { const el = ref.current; return () => { if (el) Plotly.purge(el) } }, [])
  return <div ref={ref} style={style} />
})

const BASE_LAYOUT = {
  paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
  margin: { t: 30, b: 48, l: 55, r: 20 },
  font: { color: '#64748b', size: 11 },
  xaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, tickfont: { color: '#64748b' }, linecolor: '#e5e7eb' },
  yaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, tickfont: { color: '#64748b' }, linecolor: '#e5e7eb' },
  legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(255,255,255,0.95)',
    font: { color: '#475569', size: 11 }, bordercolor: '#e5e7eb', borderwidth: 1 },
}

const API = 'http://localhost:8001'

// ─── Numeric helpers ──────────────────────────────────────────────────────────
function interp(xs, ys, xi) {
  if (!xs.length) return 0
  if (xi <= xs[0]) return ys[0] ?? 0
  if (xi >= xs[xs.length - 1]) return ys[xs.length - 1] ?? 0
  let lo = 0, hi = xs.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= xi) lo = mid; else hi = mid }
  const t = (xi - xs[lo]) / (xs[hi] - xs[lo])
  const y0 = ys[lo] ?? 0, y1 = ys[hi] ?? 0
  return y0 + t * (y1 - y0)
}

function numericalDeriv(xs, ys) {
  return ys.map((_, i) => {
    if (i === 0)             return (ys[1] - ys[0]) / (xs[1] - xs[0])
    if (i === ys.length - 1) return (ys[i] - ys[i-1]) / (xs[i] - xs[i-1])
    return (ys[i+1] - ys[i-1]) / (xs[i+1] - xs[i-1])
  })
}

function computeRiemann(xs, ys, a, b, n, method) {
  const bw = (b - a) / n
  let sum = 0
  for (let i = 0; i < n; i++) {
    const xl = a + i * bw, xr = xl + bw
    if      (method === 'Left')      sum += bw * interp(xs, ys, xl)
    else if (method === 'Right')     sum += bw * interp(xs, ys, xr)
    else if (method === 'Midpoint')  sum += bw * interp(xs, ys, (xl + xr) / 2)
    else if (method === 'Trapezoid') sum += bw * (interp(xs, ys, xl) + interp(xs, ys, xr)) / 2
    else { // Simpson's
      const yl = interp(xs, ys, xl), ym = interp(xs, ys, (xl+xr)/2), yr = interp(xs, ys, xr)
      sum += bw / 6 * (yl + 4 * ym + yr)
    }
  }
  return sum
}

function buildRiemannTrace(xs, ys, a, b, n, method, color) {
  const bw = (b - a) / n
  const rx = [], ry = []
  for (let i = 0; i < n; i++) {
    const xl = a + i * bw, xr = xl + bw
    if (method === 'Trapezoid') {
      const y1 = interp(xs, ys, xl), y2 = interp(xs, ys, xr)
      rx.push(xl, xl, xr, xr, null)
      ry.push(0, y1, y2, 0, null)
    } else {
      let x_eval = xl
      if (method === 'Right')    x_eval = xr
      if (method === 'Midpoint' || method === "Simpson's") x_eval = (xl + xr) / 2
      const yv = interp(xs, ys, x_eval)
      rx.push(xl, xl, xr, xr, null)
      ry.push(0, yv, yv, 0, null)
    }
  }
  return {
    type: 'scatter', x: rx, y: ry, mode: 'lines',
    fill: 'tozeroy', fillcolor: color + '40',
    line: { color, width: 1.5 },
    name: `${method} (n=${n})`,
  }
}

const fmtN = (v, d = 4) => (typeof v === 'number' && isFinite(v)) ? +v.toFixed(d) : '—'

// ─── Derivative Section ───────────────────────────────────────────────────────
const DIFF_PRESETS = [
  { label: 'Polynomial',  expr: 'x^3 - 2*x + 1' },
  { label: 'Trig',        expr: 'sin(x)*cos(x)' },
  { label: 'Exp',         expr: 'e^x * sin(x)' },
  { label: 'Log',         expr: 'log(x^2 + 1)' },
  { label: 'Rational',    expr: '1 / (x^2 + 1)' },
]

function DerivativeSection() {
  const [expr,   setExpr]   = useState('x^3 - 2*x + 1')
  const [xRange, setXRange] = useState([-3, 3])
  const [order,  setOrder]  = useState(1)
  const [x0,     setX0]     = useState(1)
  const [traces, setTraces] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const compute = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [lo, hi] = [Math.min(...xRange), Math.max(...xRange)]

      // Evaluate f(x) numerically
      const evalRes = await fetch(`${API}/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functions: [{ expression: expr, x_min: lo, x_max: hi, num_points: 600 }] }),
      })
      if (!evalRes.ok) { const e = await evalRes.json(); throw new Error(e.detail) }
      const { results } = await evalRes.json()
      const pts = results[0].points
      const xs  = pts.map(p => p.x)
      const ys0 = pts.map(p => p.y)

      // Symbolic derivative
      const diffRes = await fetch(`${API}/differentiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: expr, order, x0 }),
      })
      if (!diffRes.ok) { const e = await diffRes.json(); throw new Error(e.detail) }
      const sym = await diffRes.json()
      setResult(sym)

      // Filter out nulls for numerical diff
      const valid  = ys0.map(y => y !== null && isFinite(y))
      const vxs    = xs.filter((_, i) => valid[i])
      const vys    = ys0.filter((_, i) => valid[i])
      const dy1    = numericalDeriv(vxs, vys)
      const dy2    = order >= 2 ? numericalDeriv(vxs, dy1) : null
      const dy3    = order >= 3 ? numericalDeriv(vxs, dy2) : null

      // Tangent line at x0
      const slope = sym.derivative_at_x0
      const f0    = sym.f_at_x0
      const tx    = [lo, hi]
      const ty    = tx.map(x => f0 + slope * (x - x0))

      const t = [
        { type: 'scatter', x: vxs, y: vys, mode: 'lines', name: 'f(x)',
          line: { color: '#3b82f6', width: 2.5 } },
        { type: 'scatter', x: vxs, y: dy1, mode: 'lines', name: "f'(x)",
          line: { color: '#f59e0b', width: 2 } },
        ...(dy2 ? [{ type: 'scatter', x: vxs, y: dy2, mode: 'lines', name: "f''(x)",
          line: { color: '#4ade80', width: 1.5, dash: 'dash' } }] : []),
        ...(dy3 ? [{ type: 'scatter', x: vxs, y: dy3, mode: 'lines', name: "f'''(x)",
          line: { color: '#a78bfa', width: 1.5, dash: 'dot' } }] : []),
        ...(isFinite(slope) ? [{
          type: 'scatter', x: tx, y: ty, mode: 'lines', name: `Tangent at x=${x0}`,
          line: { color: '#fb7185', width: 1.5, dash: 'dash' },
        }] : []),
        ...(isFinite(f0) ? [{
          type: 'scatter', x: [x0], y: [f0], mode: 'markers', showlegend: false,
          marker: { color: '#fb7185', size: 8, symbol: 'circle', line: { color: '#fff', width: 1 } },
        }] : []),
      ]
      setTraces(t)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [expr, xRange, order, x0])

  useEffect(() => { compute() }, []) // eslint-disable-line

  const ordLabel = ['', '1st', '2nd', '3rd']
  const derivLabel = order === 1 ? "f '(x)" : order === 2 ? "f ''(x)" : "f '''(x)"

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Presets</div>
        <div className="preset-wrap">
          {DIFF_PRESETS.map(p => (
            <button key={p.label} className="preset-tag" onClick={() => setExpr(p.expr)}>{p.label}</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>f(x)</div>
        <input className="la-input" value={expr} onChange={e => setExpr(e.target.value)}
          placeholder="e.g. x^3 - 2*x + 1" />

        <div className="la-label" style={{marginTop:8}}>x range</div>
        <div className="range-inputs">
          <input className="la-input" type="number" value={xRange[0]}
            onChange={e => setXRange([+e.target.value, xRange[1]])} />
          <span style={{color:'#334155',fontSize:12}}>to</span>
          <input className="la-input" type="number" value={xRange[1]}
            onChange={e => setXRange([xRange[0], +e.target.value])} />
        </div>

        <div className="la-label" style={{marginTop:8}}>Derivative order</div>
        <div className="dim-row">
          {[1, 2, 3].map(o => (
            <button key={o} className={`dim-btn ${order===o?'active':''}`} onClick={() => setOrder(o)}>
              {ordLabel[o]}
            </button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:8}}>Tangent point x₀</div>
        <input className="la-input" type="number" step="0.1" value={x0}
          onChange={e => setX0(+e.target.value)} />

        <button className="la-btn" style={{marginTop:10}} onClick={compute} disabled={loading}>
          {loading ? 'Computing…' : 'Compute'}
        </button>
        {error && <div className="la-warn">{error}</div>}

        {result && (<>
          <div className="eq-card">
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:11,minWidth:60}}>{derivLabel}</span>
              <span className="eq-eq">=</span>
              <span className="eq-rhs" style={{fontSize:11,wordBreak:'break-all'}}>{result.derivative}</span>
            </div>
          </div>
          <div className="eq-card" style={{marginTop:4}}>
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:11}}>f({x0})</span>
              <span className="eq-eq">=</span>
              <span className="eq-rhs" style={{color:'#3b82f6'}}>{fmtN(result.f_at_x0)}</span>
            </div>
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:11}}>f'({x0})</span>
              <span className="eq-eq">=</span>
              <span className="eq-rhs" style={{color:'#f59e0b'}}>{fmtN(result.derivative_at_x0)}</span>
            </div>
            <div className="eq-domain">Tangent slope at x = {x0}</div>
          </div>
          <div className="eq-card" style={{marginTop:4}}>
            <div className="eq-domain" style={{color:'#475569',borderTop:'none',paddingTop:0}}>
              The {ordLabel[order]} derivative tells you the <strong style={{color:'#f59e0b'}}>rate of change</strong> of f.
              {order === 2 && ' The 2nd derivative shows concavity (positive = curving up, negative = curving down).'}
              {order === 3 && ' The 3rd derivative describes how concavity is changing.'}
            </div>
          </div>
        </>)}
      </div>

      <div className="la-viz">
        {traces.length > 0
          ? <Plot data={traces} layout={{
              ...BASE_LAYOUT,
              xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'x', font: { color: '#475569', size: 11 } } },
              yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'y', font: { color: '#475569', size: 11 } } },
            }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ width: '100%', height: '100%' }} />
          : <div className="la-hint">Enter a function and click Compute.</div>
        }
      </div>
    </div>
  )
}

// ─── Integration Section ──────────────────────────────────────────────────────
const RIEMANN_METHODS = ['Left', 'Right', 'Midpoint', 'Trapezoid', "Simpson's"]

const INT_PRESETS = [
  { label: 'Parabola',  expr: 'x^2',           a: 0,          b: 3   },
  { label: 'Sine',      expr: 'sin(x)',         a: 0,          b: 3.14159 },
  { label: 'Exp',       expr: 'e^x',            a: 0,          b: 2   },
  { label: 'Bell',      expr: 'e^(-x^2)',       a: -3,         b: 3   },
  { label: '1/x',       expr: 'log(x)',         a: 1,          b: 5   },
]

function IntegrationSection() {
  const [expr,    setExpr]    = useState('x^2')
  const [xRange,  setXRange]  = useState([-0.5, 3.5])
  const [a,       setA]       = useState(0)
  const [b,       setB]       = useState(3)
  const [method,  setMethod]  = useState('Midpoint')
  const [nBars,   setNBars]   = useState(8)
  const [traces,  setTraces]  = useState([])
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const compute = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const lo = Math.min(a, b), hi = Math.max(a, b)
      const plotLo = Math.min(xRange[0], lo - 0.5)
      const plotHi = Math.max(xRange[1], hi + 0.5)

      // Evaluate f(x) over plot range
      const evalRes = await fetch(`${API}/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functions: [{ expression: expr, x_min: plotLo, x_max: plotHi, num_points: 600 }] }),
      })
      if (!evalRes.ok) { const e = await evalRes.json(); throw new Error(e.detail) }
      const { results } = await evalRes.json()
      const pts = results[0].points
      const xs  = pts.map(p => p.x)
      const ys  = pts.map(p => p.y)

      // Symbolic integration
      const intRes = await fetch(`${API}/integrate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: expr, a, b }),
      })
      if (!intRes.ok) { const e = await intRes.json(); throw new Error(e.detail) }
      const sym = await intRes.json()

      // Numerical Riemann approximation
      const vxs   = xs.filter((_, i) => ys[i] !== null && isFinite(ys[i]))
      const vys   = ys.filter((_, i) => ys[i] !== null && isFinite(ys[i]))
      const riemann = computeRiemann(vxs, vys, lo, hi, nBars, method)
      setResult({ ...sym, riemann, method, nBars })

      // Shaded area between a and b (exact region)
      const areaXs = [], areaYs = []
      areaXs.push(lo); areaYs.push(0)
      for (let i = 0; i < xs.length; i++) {
        if (xs[i] >= lo && xs[i] <= hi && ys[i] !== null && isFinite(ys[i])) {
          areaXs.push(xs[i]); areaYs.push(ys[i])
        }
      }
      areaXs.push(hi); areaYs.push(0)

      // Riemann bars trace
      const rTrace = buildRiemannTrace(vxs, vys, lo, hi, nBars, method, '#f59e0b')

      const t = [
        // f(x)
        { type: 'scatter', x: xs, y: ys, mode: 'lines', name: 'f(x)',
          line: { color: '#3b82f6', width: 2.5 } },
        // Exact shaded area
        { type: 'scatter', x: areaXs, y: areaYs, mode: 'lines',
          fill: 'tozeroy', fillcolor: 'rgba(59,130,246,0.12)',
          line: { color: '#1e3a8a', width: 1 }, name: 'Exact area', showlegend: false },
        // Riemann bars
        rTrace,
        // Bound markers
        { type: 'scatter', x: [lo, hi], y: [0, 0], mode: 'markers', showlegend: false,
          marker: { color: '#fb7185', size: 7, symbol: 'line-ns', line: { color: '#fb7185', width: 2 } } },
      ]
      setTraces(t)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [expr, xRange, a, b, method, nBars])

  useEffect(() => { compute() }, []) // eslint-disable-line

  const applyPreset = p => { setExpr(p.expr); setA(p.a); setB(p.b) }

  const exact   = result?.definite_value
  const riemann = result?.riemann
  const absErr  = (typeof exact === 'number' && typeof riemann === 'number') ? Math.abs(exact - riemann) : null

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Presets</div>
        <div className="preset-wrap">
          {INT_PRESETS.map(p => (
            <button key={p.label} className="preset-tag" onClick={() => applyPreset(p)}>{p.label}</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>f(x)</div>
        <input className="la-input" value={expr} onChange={e => setExpr(e.target.value)}
          placeholder="e.g. x^2" />

        <div className="la-label" style={{marginTop:8}}>Bounds</div>
        <div className="range-inputs">
          <input className="la-input" type="number" step="0.1" value={a}
            onChange={e => setA(+e.target.value)} />
          <span style={{color:'#334155',fontSize:12}}>to</span>
          <input className="la-input" type="number" step="0.1" value={b}
            onChange={e => setB(+e.target.value)} />
        </div>

        <div className="la-label" style={{marginTop:8}}>Riemann method</div>
        <div className="preset-wrap">
          {RIEMANN_METHODS.map(m => (
            <button key={m} className={`preset-tag ${method===m?'active-cs':''}`}
              onClick={() => setMethod(m)}>{m}</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:8}}>Rectangles n — {nBars}</div>
        <input type="range" min="1" max="50" step="1" value={nBars}
          onChange={e => setNBars(+e.target.value)} style={{width:'100%', accentColor:'#f59e0b'}} />

        <button className="la-btn" style={{marginTop:10}} onClick={compute} disabled={loading}>
          {loading ? 'Computing…' : 'Compute'}
        </button>
        {error && <div className="la-warn">{error}</div>}

        {result && (<>
          {/* Antiderivative */}
          <div className="eq-card">
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:10}}>∫f(x)dx</span>
              <span className="eq-eq">=</span>
              <span className="eq-rhs" style={{fontSize:11,wordBreak:'break-all'}}>{result.antiderivative} + C</span>
            </div>
          </div>
          {/* Definite integral — FTC */}
          <div className="eq-card" style={{marginTop:4}}>
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:10}}>∫_{a}^{b}</span>
              <span className="eq-eq">=</span>
              <span className="eq-rhs" style={{color:'#3b82f6',fontWeight:700}}>{fmtN(exact)}</span>
            </div>
            <div className="eq-domain" style={{color:'#475569',borderTop:'none',paddingTop:2,marginTop:2}}>
              F({b}) − F({a})  — Fundamental Theorem of Calculus
            </div>
          </div>
          {/* Riemann comparison */}
          <div className="eq-card" style={{marginTop:4}}>
            <div className="eq-row">
              <span className="eq-lhs" style={{fontSize:10,minWidth:72}}>{method} (n={nBars})</span>
              <span className="eq-eq">≈</span>
              <span className="eq-rhs" style={{color:'#f59e0b'}}>{fmtN(riemann)}</span>
            </div>
            {absErr !== null && (
              <div className="eq-row">
                <span className="eq-lhs" style={{fontSize:10,minWidth:72}}>Error</span>
                <span className="eq-eq">|</span>
                <span className="eq-rhs" style={{color:'#fb7185',fontSize:11}}>{fmtN(absErr)}</span>
              </div>
            )}
            <div className="eq-domain" style={{color:'#475569',borderTop:'none',paddingTop:2,marginTop:2}}>
              More rectangles → smaller error. {method === "Simpson's" ? "Simpson's rule uses parabolas and is very accurate." : ''}
            </div>
          </div>
        </>)}
      </div>

      <div className="la-viz">
        {traces.length > 0
          ? <Plot data={traces} layout={{
              ...BASE_LAYOUT,
              xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'x', font: { color: '#475569', size: 11 } } },
              yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'f(x)', font: { color: '#475569', size: 11 } } },
            }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ width: '100%', height: '100%' }} />
          : <div className="la-hint">Enter a function and bounds, then click Compute.</div>
        }
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const SUBTABS = [
  { id: 'derivatives',  label: 'Derivatives' },
  { id: 'integration',  label: 'Integration' },
  { id: 'surfaces',     label: '3D Surfaces' },
]

export default function CalculusSurfaces() {
  const [sub, setSub] = useState('derivatives')
  return (
    <div className="la-root">
      <div className="la-subtabs">
        {SUBTABS.map(t => (
          <button key={t.id} className={`la-subtab ${sub===t.id?'active':''}`}
            onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="la-content">
        {sub === 'derivatives' && <DerivativeSection />}
        {sub === 'integration' && <IntegrationSection />}
        {sub === 'surfaces'    && <SurfacesSection />}
      </div>
    </div>
  )
}


