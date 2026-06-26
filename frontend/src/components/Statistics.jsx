import { useState, useRef, useEffect, memo, useMemo } from 'react'
import Plotly from 'plotly.js-dist-min'
import './Statistics.css'
import './LinearAlgebra.css'

const Plot = memo(function Plot({ data, layout, config, style }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    Plotly.react(ref.current, data, layout, { ...config, responsive: true })
  })
  useEffect(() => { const el = ref.current; return () => { if (el) Plotly.purge(el) } }, [])
  return <div ref={ref} style={style} />
})

const fmt = (v, d = 4) => isFinite(v) ? +v.toFixed(d) : '—'
const fmtP = v => !isFinite(v) ? '—' : v < 0.001 ? '<0.001' : fmt(v, 3)
const stars = v => v < 0.001 ? '***' : v < 0.01 ? '**' : v < 0.05 ? '*' : v < 0.1 ? '·' : ''

// ─── Math helpers ──────────────────────────────────────────────────────────────
function normalPDF(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))
}
function erf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z))
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const v = 1 - poly * Math.exp(-z * z)
  return z >= 0 ? v : -v
}
function normalCDF(x, mu, sigma) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))
}
function normalQuantile(p) {
  let lo = -10, hi = 10
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; normalCDF(mid, 0, 1) < p ? (lo = mid) : (hi = mid) }
  return (lo + hi) / 2
}
function logGamma(n) {
  if (n <= 1) return 0
  let x = n - 1, r = 0
  while (x < 6) { r += Math.log(x); x++ }
  return r + 0.5 * Math.log(2 * Math.PI / x) + x * (Math.log(x) - 1)
}
function binomCoeff(n, k) {
  if (k < 0 || k > n) return 0
  return Math.exp(logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1))
}
function poissonPMF(k, lambda) { return Math.exp(k * Math.log(lambda) - lambda - logGamma(k + 1)) }

// Lanczos log-gamma (accurate for all x > 0)
function lgamma(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y++; ser += cof[j] / y }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d; let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function betainc(a, b, x) {
  if (x < 0 || x > 1) return NaN
  if (x === 0) return 0; if (x === 1) return 1
  if (x > (a + 1) / (a + b + 2)) return 1 - betainc(b, a, 1 - x)
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lgamma(a) - lgamma(b) + lgamma(a + b)) / a
  return front * betacf(a, b, x)
}
function tCDF(t, df) {
  const x = df / (df + t * t), p = 0.5 * betainc(df / 2, 0.5, x)
  return t >= 0 ? 1 - p : p
}
function tPval2(t, df) { return 2 * Math.min(tCDF(t, df), 1 - tCDF(t, df)) }
function tQuantile(p, df) {
  let lo = -30, hi = 30
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; tCDF(mid, df) < p ? (lo = mid) : (hi = mid) }
  return (lo + hi) / 2
}
function fCDF(F, d1, d2) {
  if (F <= 0) return 0
  return betainc(d1 / 2, d2 / 2, (d1 * F) / (d1 * F + d2))
}
function tPDF(x, df) {
  return Math.exp(lgamma((df + 1) / 2) - 0.5 * Math.log(df * Math.PI) - lgamma(df / 2)
    - (df + 1) / 2 * Math.log(1 + x * x / df))
}

// ─── Matrix ops ────────────────────────────────────────────────────────────────
function matMul(A, B) {
  const m = A.length, n = B[0].length, k = B.length
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => A[i].reduce((s, _, l) => s + A[i][l] * B[l][j], 0)))
}
function matTrans(A) { return Array.from({ length: A[0].length }, (_, j) => A.map(r => r[j])) }
function matInv(A) {
  const n = A.length
  const aug = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-12) return null
    aug[col] = aug[col].map(v => v / pivot)
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row][col]
      aug[row] = aug[row].map((v, j) => v - f * aug[col][j])
    }
  }
  return aug.map(row => row.slice(n))
}

// ─── OLS fit with HC1 robust SEs ──────────────────────────────────────────────
function olsFit(Xraw, y) {
  const n = y.length, k = Xraw[0]?.length ?? 0, p = k + 1
  if (n < p + 1) return null
  const X = Xraw.map(row => [1, ...row])
  const Xt = matTrans(X), XtX = matMul(Xt, X), XtXinv = matInv(XtX)
  if (!XtXinv) return null
  const beta = matMul(XtXinv, matMul(Xt, y.map(v => [v]))).map(r => r[0])
  const fitted = X.map(row => row.reduce((s, v, j) => s + v * beta[j], 0))
  const residuals = y.map((v, i) => v - fitted[i])
  const ssr = residuals.reduce((s, r) => s + r * r, 0)
  const ybar = y.reduce((s, v) => s + v, 0) / n
  const tss = y.reduce((s, v) => s + (v - ybar) ** 2, 0)
  const r2 = 1 - ssr / tss, adjR2 = 1 - (1 - r2) * (n - 1) / (n - p)
  const meat = Array.from({ length: p }, () => Array(p).fill(0))
  const sc = n / (n - p)
  for (let i = 0; i < n; i++) {
    const u2 = residuals[i] * residuals[i] * sc
    for (let j = 0; j < p; j++) for (let l = 0; l < p; l++) meat[j][l] += X[i][j] * X[i][l] * u2
  }
  const sw = matMul(matMul(XtXinv, meat), XtXinv)
  const se = Array.from({ length: p }, (_, j) => Math.sqrt(Math.max(0, sw[j][j])))
  const tStats = beta.map((c, j) => c / se[j])
  const pVals = tStats.map(t => tPval2(t, n - p))
  const fStat = k > 0 ? (r2 / k) / ((1 - r2) / (n - p)) : NaN
  const fPval = k > 0 ? 1 - fCDF(fStat, k, n - p) : NaN
  return { coefs: beta, se, tStats, pVals, r2, adjR2, fStat, fPval, residuals, fitted, n, k, s: Math.sqrt(ssr / (n - p)), type: 'ols' }
}

// ─── Logit fit (Newton-Raphson) ────────────────────────────────────────────────
function sigmoid(z) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z)))) }
function logitFit(Xraw, y) {
  const n = y.length, k = Xraw[0]?.length ?? 0, p = k + 1
  if (n < p + 2) return null
  const X = Xraw.map(row => [1, ...row])
  let beta = Array(p).fill(0)
  for (let iter = 0; iter < 100; iter++) {
    const prob = X.map(row => sigmoid(row.reduce((s, v, j) => s + v * beta[j], 0)))
    const H = Array.from({ length: p }, () => Array(p).fill(0))
    const grad = Array(p).fill(0)
    for (let i = 0; i < n; i++) {
      const w = prob[i] * (1 - prob[i])
      for (let j = 0; j < p; j++) {
        grad[j] += X[i][j] * (y[i] - prob[i])
        for (let l = 0; l < p; l++) H[j][l] -= X[i][j] * X[i][l] * w
      }
    }
    const Hinv = matInv(H); if (!Hinv) break
    const step = matMul(Hinv, grad.map(v => [v])).map(r => r[0])
    beta = beta.map((b, j) => b - step[j])
    if (step.reduce((s, v) => s + v * v, 0) < 1e-10) break
  }
  const prob = X.map(row => sigmoid(row.reduce((s, v, j) => s + v * beta[j], 0)))
  const FI = Array.from({ length: p }, () => Array(p).fill(0))
  for (let i = 0; i < n; i++) {
    const w = prob[i] * (1 - prob[i])
    for (let j = 0; j < p; j++) for (let l = 0; l < p; l++) FI[j][l] += X[i][j] * X[i][l] * w
  }
  const FIinv = matInv(FI)
  const se = FIinv ? Array.from({ length: p }, (_, j) => Math.sqrt(Math.max(0, FIinv[j][j]))) : Array(p).fill(NaN)
  const zStats = beta.map((b, j) => b / se[j])
  const pVals = zStats.map(z => 2 * (1 - normalCDF(Math.abs(z), 0, 1)))
  const ll = y.reduce((s, v, i) => s + (v ? Math.log(Math.max(1e-15, prob[i])) : Math.log(Math.max(1e-15, 1 - prob[i]))), 0)
  const py = y.reduce((s, v) => s + v, 0) / n
  const ll0 = n * (py * Math.log(Math.max(1e-15, py)) + (1 - py) * Math.log(Math.max(1e-15, 1 - py)))
  return { coefs: beta, se, zStats, pVals, prob, ll, ll0, mcfaddenR2: 1 - ll / ll0, n, k, type: 'logit' }
}

// ─── Layout constant ──────────────────────────────────────────────────────────
const DARK_LAYOUT = {
  paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
  margin: { t: 30, b: 50, l: 55, r: 20 },
  font: { color: '#64748b', size: 11 },
  xaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, tickfont: { color: '#64748b' }, linecolor: '#e5e7eb' },
  yaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, tickfont: { color: '#64748b' }, linecolor: '#e5e7eb' },
  showlegend: false, bargap: 0.1,
}

// ─── Distributions ────────────────────────────────────────────────────────────
const DISTRIBUTIONS = [
  { id: 'normal', name: 'Normal', color: '#3b82f6' },
  { id: 'binomial', name: 'Binomial', color: '#4ade80' },
  { id: 'poisson', name: 'Poisson', color: '#f59e0b' },
  { id: 'uniform', name: 'Uniform', color: '#a78bfa' },
  { id: 'exponential', name: 'Exponential', color: '#fb7185' },
  { id: 'tDist', name: 't-dist', color: '#22d3ee' },
]
function DistributionSection() {
  const [dist, setDist] = useState('normal')
  const [mu, setMu] = useState(0)
  const [sigma, setSigma] = useState(1)
  const [n, setN] = useState(20)
  const [p, setP] = useState(0.4)
  const [lam, setLam] = useState(4)
  const [a, setA] = useState(0)
  const [b, setB] = useState(10)
  const [df, setDf] = useState(5)
  const [shadeFrom, setShadeFrom] = useState('')
  const [shadeTo, setShadeTo] = useState('')
  const { traces, stats, formula, xLabel } = useMemo(() => {
    const col = DISTRIBUTIONS.find(d => d.id === dist)?.color || '#3b82f6'
    const colFade = col + '55'
    let xs = [], ys = [], results = [], formula = '', xLabel = 'x'
    if (dist === 'normal') {
      const lo = mu - 4 * sigma, hi = mu + 4 * sigma
      xs = Array.from({ length: 300 }, (_, i) => lo + i * (hi - lo) / 299)
      ys = xs.map(x => normalPDF(x, mu, sigma))
      results = [['Mean μ', fmt(mu)], ['Std dev σ', fmt(sigma)], ['Variance σ²', fmt(sigma * sigma)], ['Mode', fmt(mu)], ['Median', fmt(mu)]]
      formula = 'f(x) = (1/σ√2π)·exp(−(x−μ)²/2σ²)'
    } else if (dist === 'binomial') {
      const nn = Math.min(Math.max(1, Math.round(n)), 100)
      xs = Array.from({ length: nn + 1 }, (_, k) => k)
      ys = xs.map(k => binomCoeff(nn, k) * Math.pow(p, k) * Math.pow(1 - p, nn - k))
      const mean = nn * p, variance = nn * p * (1 - p)
      results = [['Mean np', fmt(mean, 3)], ['Std dev', fmt(Math.sqrt(variance), 3)], ['Variance np(1−p)', fmt(variance, 3)], ['Mode', fmt(Math.floor((nn + 1) * p), 0)]]
      formula = 'P(X=k) = C(n,k)·pᵏ·(1−p)^(n−k)'; xLabel = 'k'
    } else if (dist === 'poisson') {
      const maxK = Math.ceil(lam + 4 * Math.sqrt(lam)) + 2
      xs = Array.from({ length: maxK }, (_, k) => k)
      ys = xs.map(k => poissonPMF(k, lam))
      results = [['Mean λ', fmt(lam)], ['Variance λ', fmt(lam)], ['Std dev √λ', fmt(Math.sqrt(lam), 3)], ['Mode', fmt(Math.max(0, Math.floor(lam)), 0)]]
      formula = 'P(X=k) = λᵏ·e⁻λ / k!'; xLabel = 'k'
    } else if (dist === 'uniform') {
      const lo = Math.min(a, b), hi = Math.max(a, b), h = hi > lo ? 1 / (hi - lo) : 0
      xs = [lo - 0.5 * (hi - lo) * 0.1, lo, lo, hi, hi, hi + 0.5 * (hi - lo) * 0.1]
      ys = [0, 0, h, h, 0, 0]
      results = [['Mean', fmt((lo + hi) / 2)], ['Std dev', fmt((hi - lo) / Math.sqrt(12), 3)], ['Variance', fmt((hi - lo) ** 2 / 12, 3)], ['Range', `[${fmt(lo)}, ${fmt(hi)}]`]]
      formula = 'f(x) = 1/(b−a)  for a ≤ x ≤ b'
    } else if (dist === 'exponential') {
      const hi = Math.max(6 / lam, 0.1)
      xs = Array.from({ length: 200 }, (_, i) => i * hi / 199)
      ys = xs.map(x => lam * Math.exp(-lam * x))
      results = [['Mean 1/λ', fmt(1 / lam, 4)], ['Std dev 1/λ', fmt(1 / lam, 4)], ['Median ln(2)/λ', fmt(Math.log(2) / lam, 4)], ['Mode', '0']]
      formula = 'f(x) = λ·e^(−λx),  x ≥ 0'
    } else if (dist === 'tDist') {
      const nu = Math.max(1, Math.round(df))
      xs = Array.from({ length: 300 }, (_, i) => -5 + i * 10 / 299)
      ys = xs.map(x => tPDF(x, nu))
      results = [['Degrees of freedom', fmt(nu, 0)], ['Mean', nu > 1 ? '0' : 'undefined'], ['Variance', nu > 2 ? fmt(nu / (nu - 2), 4) : nu > 1 ? '∞' : 'undefined'], ['Vs Normal', nu > 30 ? '≈ Normal' : 'heavier tails']]
      formula = 'f(x) = Γ((ν+1)/2)/(√(νπ)·Γ(ν/2))·(1+x²/ν)^(−(ν+1)/2)'
    }
    const isDiscrete = dist === 'binomial' || dist === 'poisson'
    const mainTrace = isDiscrete
      ? { type: 'bar', x: xs, y: ys, marker: { color: col }, name: dist }
      : { type: 'scatter', x: xs, y: ys, mode: 'lines', line: { color: col, width: 2.5 }, fill: 'toself', fillcolor: colFade, name: dist }
    const shadeTraces = []
    if (!isDiscrete && shadeFrom !== '' && shadeTo !== '') {
      const sf = +shadeFrom, st = +shadeTo
      if (isFinite(sf) && isFinite(st) && sf < st) {
        const sxs = xs.filter(x => x >= sf && x <= st)
        const sys = sxs.map(x => dist === 'normal' ? normalPDF(x, mu, sigma) : dist === 'exponential' ? lam * Math.exp(-lam * x) : ys[xs.indexOf(x)] || 0)
        shadeTraces.push({ type: 'scatter', x: [sf, ...sxs, st], y: [0, ...sys, 0], mode: 'lines', fill: 'toself', fillcolor: col + '88', line: { color: 'transparent' }, hoverinfo: 'skip', showlegend: false })
        if (dist === 'normal') results = [...results, ['P(' + fmt(sf) + '≤X≤' + fmt(st) + ')', fmt(normalCDF(st, mu, sigma) - normalCDF(sf, mu, sigma), 4)]]
      }
    }
    return { traces: [mainTrace, ...shadeTraces], stats: results, formula, xLabel }
  }, [dist, mu, sigma, n, p, lam, a, b, df, shadeFrom, shadeTo])
  const col = DISTRIBUTIONS.find(d => d.id === dist)?.color || '#3b82f6'
  const NumIn = ({ label, value, onChange, min, max, step = 'any' }) => (
    <div className="stat-param-row">
      <span className="stat-param-label">{label}</span>
      <input className="la-input" type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(+e.target.value)} />
    </div>
  )
  return (
    <div className="stat-section">
      <div className="stat-sidebar">
        <div className="la-label">Distribution</div>
        <div className="dist-grid">
          {DISTRIBUTIONS.map(d => (
            <button key={d.id} className={`dist-btn ${dist === d.id ? 'active' : ''}`}
              style={dist === d.id ? { borderColor: d.color, color: d.color, background: d.color + '22' } : {}}
              onClick={() => setDist(d.id)}>{d.name}</button>
          ))}
        </div>
        <div className="la-label" style={{ marginTop: 8 }}>Parameters</div>
        {dist === 'normal' && <><NumIn label="Mean (μ)" value={mu} onChange={setMu} /><NumIn label="Std dev (σ)" value={sigma} onChange={v => setSigma(Math.max(0.001, v))} min="0.001" /></>}
        {dist === 'binomial' && <><NumIn label="Trials (n)" value={n} onChange={v => setN(Math.max(1, Math.round(v)))} min="1" max="100" step="1" /><NumIn label="P(success)" value={p} onChange={v => setP(Math.min(1, Math.max(0, v)))} min="0" max="1" step="0.01" /></>}
        {dist === 'poisson' && <NumIn label="Rate (λ)" value={lam} onChange={v => setLam(Math.max(0.01, v))} min="0.01" />}
        {dist === 'uniform' && <><NumIn label="Min (a)" value={a} onChange={setA} /><NumIn label="Max (b)" value={b} onChange={setB} /></>}
        {dist === 'exponential' && <NumIn label="Rate (λ)" value={lam} onChange={v => setLam(Math.max(0.001, v))} min="0.001" />}
        {dist === 'tDist' && <NumIn label="Deg. freedom" value={df} onChange={v => setDf(Math.max(1, Math.round(v)))} min="1" step="1" />}
        {!['binomial', 'poisson'].includes(dist) && (
          <>
            <div className="la-label" style={{ marginTop: 6 }}>Shade region P(a ≤ X ≤ b)</div>
            <div className="stat-param-row"><span className="stat-param-label">From</span><input className="la-input" type="number" value={shadeFrom} placeholder="—" onChange={e => setShadeFrom(e.target.value)} step="any" /></div>
            <div className="stat-param-row"><span className="stat-param-label">To</span><input className="la-input" type="number" value={shadeTo} placeholder="—" onChange={e => setShadeTo(e.target.value)} step="any" /></div>
          </>
        )}
        <div className="stat-results">
          {stats.map(([k, v]) => (<div key={k} className="stat-res-row"><span className="stat-res-k">{k}</span><span style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: 12 }}>{v}</span></div>))}
        </div>
        <div className="stat-formula-card"><div className="stat-formula-name">PDF / PMF</div><div style={{ fontFamily: 'monospace', fontSize: 11, color: '#93c5fd', lineHeight: 1.6 }}>{formula}</div></div>
      </div>
      <div className="stat-viz">
        <Plot data={traces} layout={{ ...DARK_LAYOUT, title: { text: DISTRIBUTIONS.find(d => d.id === dist)?.name, font: { color: col, size: 12 }, x: 0.04 }, xaxis: { ...DARK_LAYOUT.xaxis, title: { text: xLabel, font: { color: '#475569', size: 11 } } }, yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Probability', font: { color: '#475569', size: 11 } } } }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

// ─── Descriptive ─────────────────────────────────────────────────────────────
function DescriptiveSection() {
  const [raw, setRaw] = useState('4, 8, 15, 16, 23, 42, 7, 3, 11, 19, 25, 6')
  const [bins, setBins] = useState(8)
  const data = useMemo(() => {
    const nums = raw.split(/[\s,;]+/).map(Number).filter(v => isFinite(v) && !isNaN(v))
    if (nums.length < 2) return null
    const sorted = [...nums].sort((a, b) => a - b), n = nums.length
    const mean = nums.reduce((s, v) => s + v, 0) / n
    const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    const sd = Math.sqrt(variance)
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
    const q1 = sorted[Math.floor(n / 4)], q3 = sorted[Math.floor(3 * n / 4)]
    const freq = {}; nums.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
    const maxF = Math.max(...Object.values(freq))
    const mode = Object.entries(freq).filter(([, f]) => f === maxF).map(([v]) => +v)
    const skew = nums.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) / n
    const kurt = nums.reduce((s, v) => s + ((v - mean) / sd) ** 4, 0) / n - 3
    return { nums, sorted, n, mean, variance, sd, median, q1, q3, iqr: q3 - q1, mode, skew, kurt, min: sorted[0], max: sorted[n - 1] }
  }, [raw])
  const traces = useMemo(() => {
    if (!data) return []
    const b = Math.max(2, Math.min(50, bins)), lo = data.min, hi = data.max, bw = (hi - lo) / b
    const counts = Array(b).fill(0)
    data.nums.forEach(v => { const i = Math.min(Math.floor((v - lo) / bw), b - 1); counts[i]++ })
    const barX = Array.from({ length: b }, (_, i) => lo + i * bw + bw / 2)
    return [
      { type: 'bar', x: barX, y: counts, width: bw * 0.92, marker: { color: '#3b82f6', opacity: 0.8, line: { color: '#1e3a8a', width: 1 } }, name: 'Frequency' },
      { type: 'scatter', x: [data.mean, data.mean], y: [0, Math.max(...counts) * 1.1], mode: 'lines', line: { color: '#f59e0b', width: 2, dash: 'dash' }, name: 'Mean', showlegend: false },
      { type: 'scatter', x: [data.median, data.median], y: [0, Math.max(...counts) * 1.1], mode: 'lines', line: { color: '#4ade80', width: 2, dash: 'dot' }, name: 'Median', showlegend: false },
    ]
  }, [data, bins])
  return (
    <div className="stat-section">
      <div className="stat-sidebar">
        <div className="la-label">Dataset</div>
        <textarea className="stat-textarea" value={raw} onChange={e => setRaw(e.target.value)} placeholder="Numbers separated by commas or spaces" rows={4} />
        <div className="la-label" style={{ marginTop: 6 }}>Histogram bins — {bins}</div>
        <input type="range" min="2" max="40" step="1" value={bins} onChange={e => setBins(+e.target.value)} style={{ width: '100%', accentColor: '#3b82f6' }} />
        {data ? (
          <div className="stat-results" style={{ marginTop: 8 }}>
            {[['n', data.n, '#93c5fd'], ['Mean', fmt(data.mean), '#f59e0b'], ['Median', fmt(data.median), '#4ade80'],
              ['Mode', data.mode.join(', '), '#93c5fd'], ['Std dev (s)', fmt(data.sd), '#93c5fd'],
              ['Variance (s²)', fmt(data.variance), '#93c5fd'], ['Min / Max', `${fmt(data.min)} / ${fmt(data.max)}`, '#93c5fd'],
              ['Q1 / Q3', `${fmt(data.q1)} / ${fmt(data.q3)}`, '#93c5fd'], ['IQR', fmt(data.iqr), '#93c5fd'],
              ['Skewness', fmt(data.skew, 3), '#93c5fd'], ['Excess kurtosis', fmt(data.kurt, 3), '#93c5fd'],
            ].map(([k, v, c]) => (<div key={k} className="stat-res-row"><span className="stat-res-k">{k}</span><span style={{ color: c, fontFamily: 'monospace', fontSize: 12 }}>{v}</span></div>))}
          </div>
        ) : <div className="la-warn" style={{ marginTop: 8 }}>Enter at least 2 numbers.</div>}
      </div>
      <div className="stat-viz">
        {data
          ? <Plot data={traces} layout={{ ...DARK_LAYOUT, xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'Value', font: { color: '#475569', size: 11 } } }, yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Frequency', font: { color: '#475569', size: 11 } } }, annotations: [{ x: data.mean, y: 0, xref: 'x', yref: 'paper', text: 'μ', showarrow: false, font: { color: '#f59e0b', size: 12 }, yanchor: 'bottom', yshift: 4 }, { x: data.median, y: 0, xref: 'x', yref: 'paper', text: 'M', showarrow: false, font: { color: '#4ade80', size: 12 }, yanchor: 'bottom', yshift: 4 }] }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ flex: 1 }} />
          : <div className="la-hint">Enter a dataset to see the histogram.</div>}
      </div>
    </div>
  )
}

// ─── Regression ───────────────────────────────────────────────────────────────
const REG_MODES = [{ id: 'simple', label: 'Simple OLS' }, { id: 'multiple', label: 'Multiple OLS' }, { id: 'logit', label: 'Logit' }]
const REG_DEFAULTS = {
  simple: `12,28000\n14,35000\n16,45000\n18,55000\n20,65000\n16,42000\n14,38000\n18,52000\n12,30000\n16,48000`,
  multiple: `12,2,28000\n14,5,38000\n16,8,48000\n18,12,60000\n20,15,70000\n16,3,40000\n14,10,42000\n18,6,55000\n12,8,32000\n16,15,52000`,
  logit: `25,30000,0\n30,45000,1\n35,55000,1\n22,25000,0\n28,38000,0\n40,65000,1\n32,50000,1\n26,32000,0\n45,70000,1\n33,48000,1\n27,35000,0\n42,62000,1`,
}

function CoeffTable({ names, coefs, se, tstats, pvals }) {
  return (
    <div className="reg-table">
      <div className="reg-header"><span>Var</span><span>β̂</span><span>SE</span><span>Stat</span><span>p-val</span></div>
      {names.map((name, j) => (
        <div key={j} className="reg-row">
          <span className="reg-name">{name}</span>
          <span className="reg-val">{fmt(coefs[j], 4)}</span>
          <span className="reg-val">{fmt(se[j], 4)}</span>
          <span className="reg-val">{fmt(tstats[j], 3)}</span>
          <span className={`reg-pval ${pvals[j] < 0.001 ? 'pv3' : pvals[j] < 0.01 ? 'pv2' : pvals[j] < 0.05 ? 'pv1' : ''}`}>
            {fmtP(pvals[j])} <span className="reg-stars">{stars(pvals[j])}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function RegressionSection() {
  const [mode, setMode] = useState('simple')
  const [rawData, setRawData] = useState(REG_DEFAULTS.simple)

  const parsed = useMemo(() => {
    const rows = rawData.trim().split('\n')
      .map(line => line.trim().split(/[\s,;]+/).map(Number))
      .filter(row => row.length >= 2 && row.every(v => isFinite(v) && !isNaN(v)))
    if (rows.length < 3) return null
    const ncols = Math.min(...rows.map(r => r.length))
    return { y: rows.map(r => r[ncols - 1]), Xraw: rows.map(r => r.slice(0, ncols - 1)), n: rows.length, k: ncols - 1 }
  }, [rawData])

  const result = useMemo(() => {
    if (!parsed) return null
    try { return mode === 'logit' ? logitFit(parsed.Xraw, parsed.y) : olsFit(parsed.Xraw, parsed.y) }
    catch { return null }
  }, [parsed, mode])

  const names = useMemo(() => parsed ? ['Intercept', ...parsed.Xraw[0].map((_, i) => `X${i + 1}`)] : [], [parsed])

  const traces = useMemo(() => {
    if (!result || !parsed) return []
    if (mode === 'simple' && result.type === 'ols') {
      const xs = parsed.Xraw.map(r => r[0]), xmin = Math.min(...xs), xmax = Math.max(...xs)
      return [
        { type: 'scatter', x: xs, y: parsed.y, mode: 'markers', marker: { color: '#3b82f6', size: 7 }, name: 'Data' },
        { type: 'scatter', x: [xmin, xmax], y: [result.coefs[0] + result.coefs[1] * xmin, result.coefs[0] + result.coefs[1] * xmax], mode: 'lines', line: { color: '#f59e0b', width: 2.5 }, name: 'OLS fit' },
      ]
    }
    if (mode === 'logit' && result.type === 'logit' && parsed.k === 1) {
      const xs = parsed.Xraw.map(r => r[0])
      const xmin = Math.min(...xs) - 2, xmax = Math.max(...xs) + 2
      const lxs = Array.from({ length: 200 }, (_, i) => xmin + i * (xmax - xmin) / 199)
      return [
        { type: 'scatter', x: xs, y: parsed.y, mode: 'markers', marker: { color: parsed.y.map(v => v ? '#4ade80' : '#fb7185'), size: 8 }, name: 'Observed' },
        { type: 'scatter', x: lxs, y: lxs.map(x => sigmoid(result.coefs[0] + result.coefs[1] * x)), mode: 'lines', line: { color: '#f59e0b', width: 2.5 }, name: 'P(Y=1|X)' },
      ]
    }
    if (result.residuals && result.fitted) {
      const fmin = Math.min(...result.fitted), fmax = Math.max(...result.fitted)
      return [
        { type: 'scatter', x: result.fitted, y: result.residuals, mode: 'markers', marker: { color: '#3b82f6', size: 6, opacity: 0.7 }, name: 'Residuals' },
        { type: 'scatter', x: [fmin, fmax], y: [0, 0], mode: 'lines', line: { color: '#475569', width: 1, dash: 'dash' }, showlegend: false },
      ]
    }
    return []
  }, [result, parsed, mode])

  return (
    <div className="stat-section">
      <div className="stat-sidebar" style={{ width: 290, minWidth: 250 }}>
        <div className="la-label">Model</div>
        <div className="dim-row">{REG_MODES.map(m => <button key={m.id} className={`dim-btn ${mode === m.id ? 'active' : ''}`} onClick={() => { setMode(m.id); setRawData(REG_DEFAULTS[m.id]) }}>{m.label}</button>)}</div>
        <div className="la-label" style={{ marginTop: 8 }}>Data — last column is Y</div>
        <textarea className="stat-textarea" style={{ minHeight: 110, fontSize: 11 }} value={rawData} onChange={e => setRawData(e.target.value)} />
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>One row per observation, comma/space separated</div>
        {!result && <div className="la-warn">Need ≥ 3 valid rows.</div>}
        {result && (<>
          <div className="stat-results" style={{ marginTop: 6 }}>
            {result.type === 'ols' && [['n', result.n, '#93c5fd'], ['R²', fmt(result.r2), '#4ade80'], ['Adj. R²', fmt(result.adjR2), '#93c5fd'], ['F-stat', fmt(result.fStat, 3), '#f59e0b'], ['F p-val', fmtP(result.fPval), '#93c5fd'], ['σ̂ (RMSE)', fmt(result.s, 3), '#93c5fd']].map(([k, v, c]) => <div key={k} className="stat-res-row"><span className="stat-res-k">{k}</span><span style={{ color: c, fontFamily: 'monospace', fontSize: 12 }}>{v}</span></div>)}
            {result.type === 'logit' && [['n', result.n, '#93c5fd'], ['McFadden R²', fmt(result.mcfaddenR2), '#4ade80'], ['Log-lik.', fmt(result.ll, 2), '#93c5fd']].map(([k, v, c]) => <div key={k} className="stat-res-row"><span className="stat-res-k">{k}</span><span style={{ color: c, fontFamily: 'monospace', fontSize: 12 }}>{v}</span></div>)}
          </div>
          <div className="la-label" style={{ marginTop: 6 }}>Coefficients {result.type === 'ols' ? '(HC1 robust SE)' : '(Fisher SE)'}</div>
          <CoeffTable names={names.slice(0, result.coefs.length)} coefs={result.coefs} se={result.se} tstats={result.type === 'logit' ? result.zStats : result.tStats} pvals={result.pVals} />
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>*** p&lt;0.001  ** p&lt;0.01  * p&lt;0.05  · p&lt;0.1</div>
        </>)}
      </div>
      <div className="stat-viz">
        {traces.length > 0
          ? <Plot data={traces} layout={{ ...DARK_LAYOUT, showlegend: true, legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(255,255,255,0.9)', font: { color: '#94a3b8', size: 11 } }, xaxis: { ...DARK_LAYOUT.xaxis, title: { text: mode === 'simple' || (mode === 'logit' && parsed?.k === 1) ? 'X₁' : 'Fitted values', font: { color: '#475569', size: 11 } } }, yaxis: { ...DARK_LAYOUT.yaxis, title: { text: mode === 'logit' && parsed?.k === 1 ? 'P(Y=1)' : mode === 'simple' ? 'Y' : 'Residuals', font: { color: '#475569', size: 11 } }, ...(mode === 'logit' && parsed?.k === 1 ? { range: [-0.05, 1.05] } : {}) } }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ flex: 1 }} />
          : <div className="la-hint">Enter data to see the plot.</div>}
      </div>
    </div>
  )
}

// ─── Hypothesis Tests ─────────────────────────────────────────────────────────
const TEST_MODES = [
  { id: 'one', label: 'One-sample t' },
  { id: 'two', label: 'Two-sample t' },
  { id: 'ci', label: 'CI Builder' },
  { id: 'ss', label: 'Sample Size' },
]

function TDistViz({ ts, df, alpha = 0.05 }) {
  const traces = useMemo(() => {
    if (!df || df <= 0) return []
    const xs = Array.from({ length: 400 }, (_, i) => -5 + i * 10 / 399)
    const ys = xs.map(x => tPDF(x, df))
    const tcrit = tQuantile(1 - alpha / 2, df)
    const ltx = xs.filter(x => x <= -tcrit), rtx = xs.filter(x => x >= tcrit)
    const lty = ltx.map(x => tPDF(x, df)), rty = rtx.map(x => tPDF(x, df))
    const result = [
      { type: 'scatter', x: xs, y: ys, mode: 'lines', line: { color: '#3b82f6', width: 2 }, name: `t(${df})` },
      { type: 'scatter', x: [...ltx, -tcrit], y: [...lty, 0], fill: 'tozeroy', fillcolor: '#fb718530', line: { color: 'transparent' }, hoverinfo: 'skip', showlegend: false },
      { type: 'scatter', x: [tcrit, ...rtx], y: [0, ...rty], fill: 'tozeroy', fillcolor: '#fb718530', line: { color: 'transparent' }, hoverinfo: 'skip', showlegend: false },
    ]
    if (ts !== null && isFinite(ts)) {
      const ymax = tPDF(0, df) * 1.15
      result.push({ type: 'scatter', x: [ts, ts], y: [0, ymax], mode: 'lines', line: { color: '#f59e0b', width: 2.5, dash: 'dash' }, name: `TS=${fmt(ts, 3)}` })
      result.push({ type: 'scatter', x: [ts], y: [0], mode: 'markers', marker: { color: '#f59e0b', size: 8 }, showlegend: false })
    }
    return result
  }, [ts, df, alpha])
  if (!traces.length) return null
  return (
    <Plot data={traces} layout={{ ...DARK_LAYOUT, showlegend: true, margin: { t: 20, b: 40, l: 45, r: 20 }, legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(255,255,255,0.9)', font: { color: '#94a3b8', size: 10 } }, xaxis: { ...DARK_LAYOUT.xaxis, range: [-5, 5] }, yaxis: { ...DARK_LAYOUT.yaxis } }} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ width: '100%', height: 220 }} />
  )
}

function StepCard({ step, formula, result, color = '#3b82f6' }) {
  return (
    <div className="step-card">
      <div className="step-num" style={{ color }}>{step}</div>
      <div className="step-formula">{formula}</div>
      {result !== undefined && <div className="step-result" style={{ color }}>{result}</div>}
    </div>
  )
}

function HypothesisSection() {
  const [mode, setMode] = useState('one')
  // One-sample
  const [xbar, setXbar] = useState(52), [s1, setS1] = useState(8), [n1, setN1] = useState(25), [mu0, setMu0] = useState(50)
  // Two-sample
  const [xbar1, setXbar1] = useState(62), [sd1, setSd1] = useState(10), [nn1, setNn1] = useState(30)
  const [xbar2, setXbar2] = useState(58), [sd2, setSd2] = useState(12), [nn2, setNn2] = useState(28), [pooled, setPooled] = useState(false)
  // CI
  const [ciX, setCiX] = useState(100), [ciS, setCiS] = useState(15), [ciN, setCiN] = useState(40), [ciConf, setCiConf] = useState(95)
  // Sample size
  const [ssP, setSsP] = useState(0.5), [ssSE, setSsSE] = useState(0.02), [ssME, setSsME] = useState(2), [ssSig, setSsSig] = useState(10)
  const [alpha, setAlpha] = useState(0.05)

  const res = useMemo(() => {
    if (mode === 'one') {
      const se = s1 / Math.sqrt(n1), ts = (xbar - mu0) / se, df = n1 - 1
      const pval = tPval2(ts, df), tcrit = tQuantile(1 - alpha / 2, df)
      return { ts, df, pval, se, ci: [xbar - tcrit * se, xbar + tcrit * se], tcrit }
    }
    if (mode === 'two') {
      if (pooled) {
        const sp2 = ((nn1 - 1) * sd1 ** 2 + (nn2 - 1) * sd2 ** 2) / (nn1 + nn2 - 2)
        const sp = Math.sqrt(sp2), se = sp * Math.sqrt(1 / nn1 + 1 / nn2)
        const ts = (xbar1 - xbar2) / se, df = nn1 + nn2 - 2
        const pval = tPval2(ts, df), tcrit = tQuantile(1 - alpha / 2, df)
        return { ts, df, pval, se, sp, ci: [(xbar1 - xbar2) - tcrit * se, (xbar1 - xbar2) + tcrit * se], tcrit, pooled: true }
      } else {
        const v1 = sd1 ** 2 / nn1, v2 = sd2 ** 2 / nn2, se = Math.sqrt(v1 + v2)
        const ts = (xbar1 - xbar2) / se
        const df = (v1 + v2) ** 2 / (v1 ** 2 / (nn1 - 1) + v2 ** 2 / (nn2 - 1))
        const pval = tPval2(ts, df), tcrit = tQuantile(1 - alpha / 2, df)
        return { ts, df, pval, se, v1, v2, ci: [(xbar1 - xbar2) - tcrit * se, (xbar1 - xbar2) + tcrit * se], tcrit }
      }
    }
    if (mode === 'ci') {
      const confDec = ciConf / 100, alpha2 = 1 - confDec, df = ciN - 1
      const tcrit = tQuantile(1 - alpha2 / 2, df), se = ciS / Math.sqrt(ciN)
      const me = tcrit * se
      return { ci: [ciX - me, ciX + me], me, se, tcrit, df }
    }
    if (mode === 'ss') {
      const nProp = Math.ceil(ssP * (1 - ssP) / ssSE ** 2)
      const nMean = Math.ceil((normalQuantile(1 - alpha / 2) * ssSig / ssME) ** 2)
      return { nProp, nMean }
    }
    return null
  }, [mode, xbar, s1, n1, mu0, xbar1, sd1, nn1, xbar2, sd2, nn2, pooled, ciX, ciS, ciN, ciConf, ssP, ssSE, ssME, ssSig, alpha])

  const NI = ({ label, val, set, step = 'any', min, style }) => (
    <div className="stat-param-row" style={style}>
      <span className="stat-param-label">{label}</span>
      <input className="la-input" type="number" value={val} step={step} min={min} onChange={e => set(+e.target.value)} />
    </div>
  )

  return (
    <div className="stat-section">
      <div className="stat-sidebar" style={{ width: 290, minWidth: 250 }}>
        <div className="la-label">Test type</div>
        <div className="preset-wrap">
          {TEST_MODES.map(m => <button key={m.id} className={`preset-tag ${mode === m.id ? 'active-cs' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div>
        {(mode === 'one' || mode === 'two') && <><div className="la-label" style={{ marginTop: 8 }}>Significance level α</div><NI label="α" val={alpha} set={setAlpha} step="0.01" min="0.001" /></>}

        {mode === 'one' && (<>
          <div className="la-label" style={{ marginTop: 6 }}>Sample statistics</div>
          <NI label="x̄" val={xbar} set={setXbar} /><NI label="s" val={s1} set={setS1} min="0.001" /><NI label="n" val={n1} set={v => setN1(Math.max(2, Math.round(v)))} step="1" min="2" />
          <div className="la-label" style={{ marginTop: 6 }}>Null hypothesis</div>
          <NI label="μ₀" val={mu0} set={setMu0} />
        </>)}

        {mode === 'two' && (<>
          <div className="dim-row" style={{ marginTop: 6 }}>
            <button className={`dim-btn ${!pooled ? 'active' : ''}`} onClick={() => setPooled(false)}>Welch</button>
            <button className={`dim-btn ${pooled ? 'active' : ''}`} onClick={() => setPooled(true)}>Pooled</button>
          </div>
          <div className="la-label" style={{ marginTop: 6 }}>Group 1</div>
          <NI label="x̄₁" val={xbar1} set={setXbar1} /><NI label="s₁" val={sd1} set={setSd1} min="0.001" /><NI label="n₁" val={nn1} set={v => setNn1(Math.max(2, Math.round(v)))} step="1" />
          <div className="la-label" style={{ marginTop: 6 }}>Group 2</div>
          <NI label="x̄₂" val={xbar2} set={setXbar2} /><NI label="s₂" val={sd2} set={setSd2} min="0.001" /><NI label="n₂" val={nn2} set={v => setNn2(Math.max(2, Math.round(v)))} step="1" />
        </>)}

        {mode === 'ci' && (<>
          <div className="la-label" style={{ marginTop: 6 }}>Sample statistics</div>
          <NI label="x̄" val={ciX} set={setCiX} /><NI label="s" val={ciS} set={setCiS} min="0" /><NI label="n" val={ciN} set={v => setCiN(Math.max(2, Math.round(v)))} step="1" />
          <NI label="Conf. %" val={ciConf} set={v => setCiConf(Math.min(99.9, Math.max(50, v)))} step="1" />
        </>)}

        {mode === 'ss' && (<>
          <div className="la-label" style={{ marginTop: 8, color: '#f59e0b' }}>For a proportion</div>
          <NI label="p (est.)" val={ssP} set={v => setSsP(Math.min(1, Math.max(0, v)))} step="0.01" /><NI label="Target SE" val={ssSE} set={setSsSE} step="0.001" min="0.001" />
          <div className="la-label" style={{ marginTop: 6, color: '#4ade80' }}>For a mean</div>
          <NI label="Margin E" val={ssME} set={setSsME} min="0.001" /><NI label="σ (assumed)" val={ssSig} set={setSsSig} min="0.001" /><NI label="α" val={alpha} set={setAlpha} step="0.01" />
        </>)}

        {res && mode !== 'ss' && (
          <div className="test-result-box">
            {(mode === 'one' || mode === 'two') && (<>
              <div className="test-res-row"><span>Test stat</span><span style={{ color: '#f59e0b' }}>{fmt(res.ts, 4)}</span></div>
              <div className="test-res-row"><span>df</span><span style={{ color: '#93c5fd' }}>{fmt(res.df, 2)}</span></div>
              <div className="test-res-row"><span>p-value</span><span style={{ color: res.pval < alpha ? '#4ade80' : '#fb7185' }}>{fmtP(res.pval)}</span></div>
              <div className="test-res-row"><span>Decision</span><span style={{ color: res.pval < alpha ? '#4ade80' : '#94a3b8' }}>{res.pval < alpha ? 'Reject H₀' : 'Fail to reject'}</span></div>
              <div className="test-res-row"><span>{ciConf || 95}% CI</span><span style={{ color: '#93c5fd', fontSize: 11 }}>[{fmt(res.ci[0], 3)}, {fmt(res.ci[1], 3)}]</span></div>
            </>)}
            {mode === 'ci' && (<>
              <div className="test-res-row"><span>{ciConf}% CI</span><span style={{ color: '#4ade80' }}>[{fmt(res.ci[0], 3)}, {fmt(res.ci[1], 3)}]</span></div>
              <div className="test-res-row"><span>Margin of error</span><span style={{ color: '#f59e0b' }}>±{fmt(res.me, 3)}</span></div>
              <div className="test-res-row"><span>t* (df={res.df})</span><span style={{ color: '#93c5fd' }}>{fmt(res.tcrit, 4)}</span></div>
            </>)}
          </div>
        )}
        {res && mode === 'ss' && (
          <div className="test-result-box" style={{ marginTop: 8 }}>
            <div className="test-res-row"><span>n (proportion)</span><span style={{ color: '#f59e0b' }}>{res.nProp.toLocaleString()}</span></div>
            <div className="test-res-row"><span>n (mean)</span><span style={{ color: '#4ade80' }}>{res.nMean.toLocaleString()}</span></div>
          </div>
        )}
      </div>

      <div className="stat-viz" style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', overflowY: 'auto', gap: 12 }}>
        {(mode === 'one' || mode === 'two') && res && (<>
          <TDistViz ts={res.ts} df={Math.round(res.df)} alpha={alpha} />
          <div className="steps-wrap">
            {mode === 'one' && (<>
              <StepCard step="1  SE" formula="SE = s / √n" result={`= ${fmt(s1)} / √${n1} = ${fmt(res.se, 4)}`} />
              <StepCard step="2  Test statistic" formula="TS = (x̄ − μ₀) / SE" result={`= (${xbar} − ${mu0}) / ${fmt(res.se, 4)} = ${fmt(res.ts, 4)}`} color="#f59e0b" />
              <StepCard step="3  Degrees of freedom" formula="df = n − 1" result={`= ${n1} − 1 = ${res.df}`} />
              <StepCard step="4  p-value (two-sided)" formula="p = 2 · P(t_{df} > |TS|)" result={fmtP(res.pval)} color={res.pval < alpha ? '#4ade80' : '#fb7185'} />
              <StepCard step="5  95% CI" formula={`x̄ ± t* · SE,   t* = ${fmt(res.tcrit, 3)}`} result={`[${fmt(res.ci[0], 3)}, ${fmt(res.ci[1], 3)}]`} />
            </>)}
            {mode === 'two' && !pooled && (<>
              <StepCard step="1  Variances" formula="v₁ = s₁²/n₁,  v₂ = s₂²/n₂" result={`${fmt(res.v1, 4)},  ${fmt(res.v2, 4)}`} />
              <StepCard step="2  SE of difference" formula="SE = √(v₁ + v₂)" result={fmt(res.se, 4)} />
              <StepCard step="3  TS  (Welch)" formula="TS = (x̄₁ − x̄₂) / SE" result={fmt(res.ts, 4)} color="#f59e0b" />
              <StepCard step="4  Welch df" formula="df = (v₁+v₂)² / [v₁²/(n₁−1) + v₂²/(n₂−1)]" result={fmt(res.df, 2)} />
              <StepCard step="5  p-value" formula="p = 2·P(t_{df} > |TS|)" result={fmtP(res.pval)} color={res.pval < alpha ? '#4ade80' : '#fb7185'} />
            </>)}
            {mode === 'two' && pooled && (<>
              <StepCard step="1  Pooled variance" formula="sₚ² = [(n₁−1)s₁² + (n₂−1)s₂²] / (n₁+n₂−2)" result={fmt(res.sp ** 2, 4)} />
              <StepCard step="2  SE" formula="SE = sₚ·√(1/n₁ + 1/n₂)" result={fmt(res.se, 4)} />
              <StepCard step="3  TS  (Pooled)" formula="TS = (x̄₁ − x̄₂) / SE" result={fmt(res.ts, 4)} color="#f59e0b" />
              <StepCard step="4  df" formula="df = n₁ + n₂ − 2" result={res.df} />
              <StepCard step="5  p-value" formula="p = 2·P(t_{df} > |TS|)" result={fmtP(res.pval)} color={res.pval < alpha ? '#4ade80' : '#fb7185'} />
            </>)}
          </div>
        </>)}
        {mode === 'ci' && res && (
          <div className="steps-wrap">
            <StepCard step="1  SE" formula="SE = s / √n" result={`${fmt(ciS)} / √${ciN} = ${fmt(res.se, 4)}`} />
            <StepCard step="2  Critical value" formula={`t* = t_{α/2, df} where df = ${res.df}`} result={fmt(res.tcrit, 4)} />
            <StepCard step="3  Margin of error" formula="ME = t* · SE" result={`${fmt(res.tcrit, 4)} × ${fmt(res.se, 4)} = ${fmt(res.me, 4)}`} color="#f59e0b" />
            <StepCard step="4  Confidence interval" formula="CI = x̄ ± ME" result={`[${fmt(res.ci[0], 3)}, ${fmt(res.ci[1], 3)}]`} color="#4ade80" />
          </div>
        )}
        {mode === 'ss' && res && (
          <div className="steps-wrap">
            <StepCard step="Proportion — n formula" formula="n = p(1−p) / SE²" result={`${ssP}·${1 - ssP} / ${ssSE}² = ${res.nProp.toLocaleString()}`} color="#f59e0b" />
            <div className="step-card"><div className="step-num" style={{ color: '#475569' }}>Note</div><div className="step-formula">Using p = 0.5 maximizes the required n (conservative). If you have a prior estimate for p, use it.</div></div>
            <StepCard step="Mean — n formula" formula="n = (z_{α/2} · σ / E)²" result={`(${fmt(normalQuantile(1 - alpha / 2), 3)} × ${ssSig} / ${ssME})² = ${res.nMean.toLocaleString()}`} color="#4ade80" />
          </div>
        )}
        {!(mode === 'one' || mode === 'two') && mode !== 'ci' && mode !== 'ss' && (
          <div className="la-hint">Select a test type on the left.</div>
        )}
      </div>
    </div>
  )
}

// ─── Causal Inference ─────────────────────────────────────────────────────────
const CAUSAL_MODES = [{ id: 'ovb', label: 'OVB' }, { id: 'did', label: 'DiD' }, { id: 'iv', label: 'IV / 2SLS' }]

function CausalSection() {
  const [mode, setMode] = useState('ovb')
  // OVB
  const [beta2, setBeta2] = useState(4), [covXX, setCovXX] = useState(-0.2), [varX1, setVarX1] = useState(1)
  // DiD
  const [y00, setY00] = useState(10), [y01, setY01] = useState(12) // control before/after
  const [y10, setY10] = useState(15), [y11, setY11] = useState(20) // treated before/after
  // IV
  const [covZY, setCovZY] = useState(0.4), [covZX, setCovZX] = useState(0.6), [covZU, setCovZU] = useState(0)

  const NI = ({ label, val, set, step = 'any' }) => (
    <div className="stat-param-row"><span className="stat-param-label" style={{ minWidth: 100 }}>{label}</span><input className="la-input" type="number" value={val} step={step} onChange={e => set(+e.target.value)} /></div>
  )

  return (
    <div className="stat-section">
      <div className="stat-sidebar" style={{ width: 290 }}>
        <div className="la-label">Method</div>
        <div className="dim-row">{CAUSAL_MODES.map(m => <button key={m.id} className={`dim-btn ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>

        {mode === 'ovb' && (<>
          <div className="la-label" style={{ marginTop: 10 }}>Omitted Variable Bias Calculator</div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>True model: Y = β₀ + β₁X₁ + β₂X₂ + u<br />You omit X₂ and regress Y on X₁ only.</div>
          <NI label="β₂ (true coef.)" val={beta2} set={setBeta2} step="0.1" />
          <NI label="Cov(X₁, X₂)" val={covXX} set={setCovXX} step="0.1" />
          <NI label="Var(X₁)" val={varX1} set={setVarX1} step="0.1" />
        </>)}

        {mode === 'did' && (<>
          <div className="la-label" style={{ marginTop: 10 }}>Difference-in-Differences</div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Enter group means before and after treatment.</div>
          <div className="la-label" style={{ color: '#64748b', fontSize: 10 }}>CONTROL GROUP</div>
          <NI label="Before" val={y00} set={setY00} /><NI label="After" val={y01} set={setY01} />
          <div className="la-label" style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>TREATED GROUP</div>
          <NI label="Before" val={y10} set={setY10} /><NI label="After" val={y11} set={setY11} />
        </>)}

        {mode === 'iv' && (<>
          <div className="la-label" style={{ marginTop: 10 }}>IV / 2SLS Calculator</div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Model: Y = β₀ + β₁X + u, X endogenous.<br />Z is the instrument.</div>
          <NI label="Cov(Z, Y)" val={covZY} set={setCovZY} step="0.1" />
          <NI label="Cov(Z, X)" val={covZX} set={setCovZX} step="0.1" />
          <div className="la-label" style={{ marginTop: 6 }}>Validity check</div>
          <NI label="Cov(Z, u)" val={covZU} set={setCovZU} step="0.1" />
        </>)}
      </div>

      <div className="stat-viz" style={{ display: 'flex', flexDirection: 'column', padding: '16px 20px', overflowY: 'auto', gap: 10 }}>
        {mode === 'ovb' && (() => {
          const bias = beta2 * covXX / varX1
          const dir = bias > 0 ? 'upward' : bias < 0 ? 'downward' : 'none'
          const col = bias > 0 ? '#fb7185' : bias < 0 ? '#4ade80' : '#94a3b8'
          return (<>
            <div className="causal-result-box">
              <div className="causal-title">Omitted Variable Bias</div>
              <div className="causal-formula">bias = β₂ · Cov(X₁,X₂) / Var(X₁)</div>
              <div className="causal-formula">     = {beta2} · {covXX} / {varX1}</div>
              <div className="causal-big" style={{ color: col }}>= {fmt(bias, 4)}</div>
              <div className="causal-interp">Direction: <span style={{ color: col }}>{dir}</span></div>
            </div>
            <div className="steps-wrap">
              <StepCard step="Rule of signs" formula="sign(bias) = sign(β₂) × sign(Cov(X₁,X₂))" result={`${beta2 > 0 ? '+' : '−'} × ${covXX > 0 ? '+' : '−'} = ${bias > 0 ? '+' : bias < 0 ? '−' : '0'}`} color={col} />
              <StepCard step="Short regression limit" formula="β̂₁ →ᵖ β₁ + β₂·Cov(X₁,X₂)/Var(X₁)" result={`β₁ + ${fmt(bias, 4)}`} />
              <div className="step-card"><div className="step-num" style={{ color: '#475569' }}>Fix</div><div className="step-formula">Include X₂ as a control variable. If X₂ is unobserved, consider: IV estimation, RDD, or DiD (if treatment is as-good-as-random conditional on controls).</div></div>
            </div>
          </>)
        })()}

        {mode === 'did' && (() => {
          const dC = y01 - y00, dT = y11 - y10, did = dT - dC
          return (<>
            <div className="causal-result-box">
              <div className="causal-title">Difference-in-Differences Estimator</div>
              <div className="causal-formula">DiD = (Ȳ_{T,after} − Ȳ_{T,before}) − (Ȳ_{C,after} − Ȳ_{C,before})</div>
              <div className="causal-big" style={{ color: '#f59e0b' }}>= {fmt(did, 4)}</div>
              <div className="causal-interp">Estimated treatment effect (under parallel trends)</div>
            </div>
            <div className="steps-wrap">
              <StepCard step="Δ Control" formula="After − Before (control)" result={`${y01} − ${y00} = ${fmt(dC, 4)}`} />
              <StepCard step="Δ Treated" formula="After − Before (treated)" result={`${y11} − ${y10} = ${fmt(dT, 4)}`} color="#f59e0b" />
              <StepCard step="DiD" formula="Δ Treated − Δ Control" result={`${fmt(dT, 4)} − ${fmt(dC, 4)} = ${fmt(did, 4)}`} color="#4ade80" />
              <div className="step-card"><div className="step-num" style={{ color: '#475569' }}>Key assumption</div><div className="step-formula">Parallel trends: without treatment, treated and control groups would have evolved at the same rate. This is untestable but can be examined using pre-treatment trends.</div></div>
            </div>
          </>)
        })()}

        {mode === 'iv' && (() => {
          const betaIV = covZX !== 0 ? covZY / covZX : NaN
          const relevant = Math.abs(covZX) > 0.1
          const exog = Math.abs(covZU) < 0.05
          return (<>
            <div className="causal-result-box">
              <div className="causal-title">IV Estimator</div>
              <div className="causal-formula">β̂_IV = Cov(Z,Y) / Cov(Z,X)</div>
              <div className="causal-formula">     = {covZY} / {covZX}</div>
              <div className="causal-big" style={{ color: isFinite(betaIV) ? '#f59e0b' : '#fb7185' }}>{isFinite(betaIV) ? fmt(betaIV, 4) : 'undefined'}</div>
            </div>
            <div className="steps-wrap">
              <StepCard step="Proof of consistency" formula="Cov(Z,Y) = Cov(Z, β₀+β₁X+u) = β₁·Cov(Z,X) + Cov(Z,u)" result={`Since Cov(Z,u)=0: β₁ = Cov(Z,Y)/Cov(Z,X)`} />
              <div className="step-card">
                <div className="step-num" style={{ color: relevant ? '#4ade80' : '#fb7185' }}>Condition 1 — Relevance</div>
                <div className="step-formula">Cov(Z,X) ≠ 0 (Z is correlated with X)</div>
                <div className="step-result" style={{ color: relevant ? '#4ade80' : '#fb7185' }}>{relevant ? '✓ Satisfied (|Cov| > 0.1)' : '✗ Weak instrument — IV is unreliable'}</div>
              </div>
              <div className="step-card">
                <div className="step-num" style={{ color: exog ? '#4ade80' : '#fb7185' }}>Condition 2 — Exogeneity</div>
                <div className="step-formula">Cov(Z,u) = 0 (Z is uncorrelated with error)</div>
                <div className="step-result" style={{ color: exog ? '#4ade80' : '#fb7185' }}>{exog ? '✓ Satisfied (|Cov| < 0.05)' : '✗ Instrument may be invalid'}</div>
              </div>
              <div className="step-card"><div className="step-num" style={{ color: '#475569' }}>2SLS procedure</div><div className="step-formula">Stage 1: Regress X on Z → get X̂<br />Stage 2: Regress Y on X̂ → β̂_2SLS</div></div>
            </div>
          </>)
        })()}
      </div>
    </div>
  )
}

// ─── Proofs & Theory ──────────────────────────────────────────────────────────
const PROOFS = [
  { id: 'clt', title: 'Central Limit Theorem', accent: '#3b82f6', tag: 'Probability',
    statement: 'If X₁,…,Xₙ are i.i.d. with E[Xᵢ]=μ and Var(Xᵢ)=σ²<∞, then √n(X̄ₙ−μ) →ᴰ N(0,σ²)',
    plain: 'No matter what distribution your data comes from, averaging enough independent draws produces a bell curve — this is why so many real-world quantities look normal. The √n scaling is essential: without it the variance would shrink to zero or blow up to infinity as n grows.',
    conditions: ['i.i.d. sample', 'Finite variance σ²<∞'],
    steps: [
      { math: 'WLOG μ=0, σ=1. Let Mₙ(t)=E[e^{tXᵢ/√n}]ⁿ (MGF of √nX̄ₙ)',
        explain: 'We standardize without loss of generality. The moment generating function (MGF) M(t)=E[eᵗˣ] uniquely characterizes a distribution. Since the Xᵢ are independent, the MGF of their sum √nX̄ₙ = ∑Xᵢ/√n is the product of individual MGFs — hence the exponent n.' },
      { math: 'Taylor: Mₙ(t) = [1 + t²/2n + O(n⁻²)]ⁿ',
        explain: 'We expand E[e^{tXᵢ/√n}] around t=0. Since E[Xᵢ]=0, the first-order term vanishes. The second-order term gives E[Xᵢ²]·t²/(2n) = t²/(2n) (since σ=1). Higher-order terms shrink faster than 1/n and become negligible.' },
      { math: 'log Mₙ(t) = n·ln(1 + t²/2n + …) → t²/2 as n→∞',
        explain: 'Taking logs: log Mₙ(t) = n·log(1 + t²/2n + O(n⁻²)). Using log(1+x)≈x for small x: this becomes n·(t²/2n + O(n⁻²)) = t²/2 + O(n⁻¹) → t²/2 as n→∞.' },
      { math: 'MGF → e^{t²/2} = N(0,1) MGF. By uniqueness: √nX̄ₙ →ᴰ N(0,1) ✓',
        explain: 'Exponentiating: Mₙ(t) → e^{t²/2}, which is exactly the MGF of N(0,1). By Lévy\'s continuity theorem, pointwise MGF convergence implies convergence in distribution. For general σ², rescale to get √n(X̄ₙ−μ) →ᴰ N(0,σ²).' },
    ],
    insight: 'The CLT justifies using normal-based inference for large n regardless of the underlying distribution. Rule of thumb: n≥30 is often sufficient.' },

  { id: 'ols_unbiased', title: 'OLS Unbiasedness', accent: '#4ade80', tag: 'OLS',
    statement: 'Under strict exogeneity E[u|X]=0 and no perfect multicollinearity, E[β̂|X]=β',
    plain: 'OLS is right on average. As long as the errors are genuinely unrelated to your predictors — nothing you omitted systematically relates to X — the OLS estimate is centered exactly on the true coefficient. Repeat the study many times and the average of all estimates hits the truth.',
    conditions: ['E[u|X]=0 (strict exogeneity)', 'No perfect multicollinearity (rank(X)=k+1)'],
    steps: [
      { math: 'β̂ = (X\'X)⁻¹X\'Y  (OLS formula)',
        explain: 'OLS minimizes ∑(Yᵢ−Xᵢ\'β)². The first-order conditions yield the normal equations X\'Xβ̂ = X\'Y. Solving gives β̂ = (X\'X)⁻¹X\'Y. Here X is the n×(k+1) design matrix (rows = observations, columns = intercept + regressors).' },
      { math: 'β̂ = (X\'X)⁻¹X\'(Xβ+u)  (substitute Y=Xβ+u)',
        explain: 'We substitute the true data generating process Y = Xβ + u, where β is the true population coefficient vector and u is the n×1 vector of unobservable error terms. This links the estimator back to the true parameter.' },
      { math: 'β̂ = β + (X\'X)⁻¹X\'u  (simplify)',
        explain: '(X\'X)⁻¹X\'X = I (the identity matrix), so the first term collapses to β. We get β̂ = β + (X\'X)⁻¹X\'u. The estimator equals the truth β plus a "noise" term. Unbiasedness requires this noise to have expectation zero.' },
      { math: 'E[β̂|X] = β + (X\'X)⁻¹X\'·E[u|X] = β  ✓',
        explain: 'Taking E[·|X]: E[β̂|X] = β + (X\'X)⁻¹X\'E[u|X]. Strict exogeneity E[u|X]=0 means the errors are mean-zero conditional on the ENTIRE X matrix — ruling out lagged dependent variables and measurement error. This makes the noise term vanish. By the law of iterated expectations, E[β̂]=β.' },
    ],
    insight: 'Exogeneity is the single most important assumption in OLS. Violation (e.g., omitted variable) causes bias that does not disappear with larger samples.' },

  { id: 'ols_consistency', title: 'OLS Consistency', accent: '#4ade80', tag: 'OLS',
    statement: 'Under E[Xᵢuᵢ]=0 and identification, β̂ →ᵖ β as n→∞',
    plain: 'Given enough data, OLS converges to the true value. You only need errors to be uncorrelated with regressors on average — not fully independent of them. This is a large-sample guarantee: the estimate keeps getting closer as n grows, but there is no promise for any single small sample.',
    conditions: ['E[Xᵢuᵢ]=0 (predetermined regressors)', 'Q_X = E[XᵢXᵢ\'] is invertible', 'Finite 4th moments'],
    steps: [
      { math: 'β̂ = β + (X\'X/n)⁻¹(X\'u/n)',
        explain: 'Starting from β̂−β = (X\'X)⁻¹X\'u, multiply numerator and denominator by 1/n: β̂−β = (X\'X/n)⁻¹·(X\'u/n). This "divide by n" trick rewrites the formula as sample averages, which the Law of Large Numbers (LLN) can handle.' },
      { math: 'X\'X/n →ᵖ Q_X = E[XᵢXᵢ\']  (by LLN)',
        explain: 'X\'X/n = n⁻¹∑XᵢXᵢ\' is a sample average of k×k outer product matrices. By the LLN, it converges in probability to its expectation Q_X = E[XᵢXᵢ\']. Invertibility of Q_X (the "identification" condition) then gives (X\'X/n)⁻¹ →ᵖ Q_X⁻¹.' },
      { math: 'X\'u/n →ᵖ E[Xᵢuᵢ] = 0  (LLN + moment condition)',
        explain: 'X\'u/n = n⁻¹∑Xᵢuᵢ is a sample average of "score" vectors Xᵢuᵢ. By LLN it converges to E[Xᵢuᵢ]=0 — our moment condition. This is weaker than strict exogeneity E[u|X]=0; it allows, e.g., lagged regressors in time series.' },
      { math: 'β̂ →ᵖ β + Q_X⁻¹·0 = β  ✓  (Slutsky\'s theorem)',
        explain: 'Slutsky\'s theorem: if Aₙ →ᵖ A and Bₙ →ᵖ B, then AₙBₙ →ᵖ AB. So (X\'X/n)⁻¹(X\'u/n) →ᵖ Q_X⁻¹·0 = 0. Therefore β̂ →ᵖ β.' },
    ],
    insight: 'Consistency requires a weaker condition than unbiasedness (E[Xᵢuᵢ]=0 vs E[u|X]=0). Panel with lagged regressors satisfies consistency but not unbiasedness.' },

  { id: 'gauss_markov', title: 'Gauss-Markov Theorem', accent: '#f59e0b', tag: 'OLS',
    statement: 'Under homoskedasticity Var(u|X)=σ²I, OLS is BLUE (Best Linear Unbiased Estimator)',
    plain: 'When errors have equal variance across all observations, no other linear unbiased method can beat OLS precision — it has the smallest possible standard errors in that class. Violating homoskedasticity does not make OLS biased, but it does make it lose this efficiency advantage.',
    conditions: ['E[u|X]=0', 'Var(u|X)=σ²I (homoskedasticity + no autocorrelation)', 'No perfect multicollinearity'],
    steps: [
      { math: 'Let β̃ = CY be any linear unbiased estimator',
        explain: 'A "linear estimator" is any function of Y of the form β̃ = CY where C is a k×n matrix (may depend on X but not Y). Every linear estimator can be parameterized this way. We want to find the one with smallest variance among all unbiased ones.' },
      { math: 'Unbiasedness requires C·X = Iₖ',
        explain: 'E[β̃|X] = C·E[Y|X] = C·Xβ. For this to equal β for ALL possible β, we need CX = Iₖ. This is a constraint: C must be a "left inverse" of X, which OLS (X\'X)⁻¹X\' satisfies trivially.' },
      { math: 'Write C = (X\'X)⁻¹X\' + D where DX=0',
        explain: 'Any C satisfying CX=I can be decomposed into the OLS weight matrix plus an "extra" part D with DX=0. The condition DX=0 ensures D doesn\'t mess up unbiasedness — it\'s in the null space of X\'.' },
      { math: 'Var(β̃|X) = σ²CC\' = σ²(X\'X)⁻¹ + σ²DD\'',
        explain: 'Under homoskedasticity, Var(Y|X)=σ²I, so Var(β̃|X)=σ²CC\'. Expanding CC\' with the decomposition and using DX=0 (which implies X\'D\'=0), the cross-terms vanish: CC\' = (X\'X)⁻¹ + DD\'.' },
      { math: 'DD\'≥0 (PSD) → OLS has minimum variance ✓',
        explain: 'For any vector v, v\'(DD\')v = ‖D\'v‖²≥0, so DD\' is positive semi-definite. Therefore Var(β̃|X) = σ²(X\'X)⁻¹ + σ²DD\' ≥ σ²(X\'X)⁻¹ = Var(β̂|X) in the matrix PSD sense. OLS achieves the minimum variance in this class.' },
    ],
    insight: 'Gauss-Markov does NOT require normality — only homoskedasticity. Under heteroskedasticity, WLS or GLS is BLUE. HC robust SEs fix inference but not efficiency.' },

  { id: 'sandwich', title: 'HC Robust (Sandwich) SE', accent: '#f59e0b', tag: 'Inference',
    statement: 'The sandwich estimator V̂ = (X\'X)⁻¹Ŝ(X\'X)⁻¹ is consistent for Var(β̂) under heteroskedasticity',
    plain: 'When different observations have different error variances, classical standard errors are wrong. The sandwich formula wraps the estimated error-variance matrix between two copies of (X\'X)⁻¹ and gives valid standard errors no matter what shape the heteroskedasticity takes — it just requires large samples.',
    conditions: ['i.i.d. observations', 'E[Xᵢuᵢ]=0', 'Finite 4th moments'],
    steps: [
      { math: 'Var(β̂|X) = (X\'X)⁻¹·[∑XᵢXᵢ\'σᵢ²]·(X\'X)⁻¹  (true sandwich)',
        explain: 'Without homoskedasticity, Var(β̂|X) = (X\'X)⁻¹·Var(X\'u|X)·(X\'X)⁻¹. Since observations are independent, Var(X\'u|X) = ∑XᵢXᵢ\'σᵢ² where σᵢ² = E[uᵢ²|Xᵢ]. This "sandwich" shape (bread–meat–bread) is valid without assuming σᵢ² is constant.' },
      { math: 'Replace σᵢ² with ûᵢ²·n/(n−k−1)  (HC1)',
        explain: 'The true conditional variance σᵢ² is unknown. We plug in squared OLS residuals ûᵢ². HC0 (White 1980) uses ûᵢ² directly. HC1 multiplies by n/(n−k−1), a degrees-of-freedom correction analogous to using s² = SSR/(n−2) instead of SSR/n in classical OLS — correcting for the fact that OLS residuals are smaller than the true errors.' },
      { math: 'Ŝ = ∑XᵢXᵢ\'ûᵢ²·n/(n−k−1)  (estimated meat)',
        explain: 'Ŝ is the estimated "meat" of the sandwich. It sums n outer products XᵢXᵢ\', each weighted by the squared residual ûᵢ² with the small-sample HC1 correction. Dividing by n gives the sample analog of E[XᵢXᵢ\'uᵢ²].' },
      { math: 'V̂ = (X\'X)⁻¹Ŝ(X\'X)⁻¹ →ᵖ Var(β̂)  ✓',
        explain: 'By LLN, n⁻¹Ŝ →ᵖ E[XᵢXᵢ\'uᵢ²] and n⁻¹X\'X →ᵖ Q_X. The sandwich V̂ →ᵖ Q_X⁻¹·E[XᵢXᵢ\'uᵢ²]·Q_X⁻¹ = Var(β̂). Standard errors are the square roots of the diagonal elements of V̂.' },
    ],
    insight: 'Always use robust SEs in practice — homoskedasticity is rarely guaranteed. HC1 (used here) applies a degrees-of-freedom correction vs HC0. R: vcovHC(fit, type="HC1").' },

  { id: 'asymp_ols', title: 'Asymptotic Normality of OLS', accent: '#a78bfa', tag: 'Inference',
    statement: '√n(β̂−β) →ᴰ N(0, Q_X⁻¹Σ_V Q_X⁻¹)  where Σ_V = E[VᵢVᵢ\'], Vᵢ = Xᵢuᵢ',
    plain: 'In large samples, your OLS estimates follow a bell curve centered on the true value. The width of that bell — the asymptotic variance — has a sandwich shape that stays valid under heteroskedasticity. This is the theoretical foundation for all large-sample t-tests, z-tests, and confidence intervals you compute in regression.',
    conditions: ['Consistency conditions hold', 'CLT applies to n⁻¹/²∑Vᵢ (finite 4th moments sufficient)'],
    steps: [
      { math: '√n(β̂−β) = (X\'X/n)⁻¹ · n⁻¹/²∑Xᵢuᵢ',
        explain: 'From β̂−β = (X\'X/n)⁻¹(X\'u/n), multiply both sides by √n: √n(β̂−β) = (X\'X/n)⁻¹·n⁻¹/²∑Xᵢuᵢ. We split into a "plug-in" piece (X\'X/n) that converges by LLN, and a "score sum" piece (n⁻¹/²∑Xᵢuᵢ) that converges by CLT.' },
      { math: 'Vᵢ = Xᵢuᵢ are i.i.d. with E[Vᵢ]=0, Var(Vᵢ)=Σ_V',
        explain: 'Define the score vector Vᵢ = Xᵢuᵢ. These are i.i.d. (since data are i.i.d.) with mean E[Vᵢ]=E[Xᵢuᵢ]=0 (our moment condition) and covariance matrix Σ_V = E[XᵢXᵢ\'uᵢ²]. We apply the multivariate CLT to their average.' },
      { math: 'By CLT: n⁻¹/²∑Vᵢ →ᴰ N(0, Σ_V)',
        explain: 'Applying the multivariate CLT to the i.i.d. sequence Vᵢ with mean 0 and variance Σ_V: n⁻¹/²∑Vᵢ →ᴰ N(0, Σ_V). This requires finite second moments of Vᵢ, which finite 4th moments of (X,u) guarantee.' },
      { math: 'By Slutsky: √n(β̂−β) →ᴰ N(0, Q_X⁻¹Σ_V Q_X⁻¹) ✓',
        explain: 'Since X\'X/n →ᵖ Q_X (Slutsky) and n⁻¹/²∑Vᵢ →ᴰ N(0,Σ_V) (CLT), Slutsky\'s theorem gives √n(β̂−β) →ᴰ Q_X⁻¹·N(0,Σ_V) = N(0, Q_X⁻¹Σ_V Q_X⁻¹). The sandwich Q⁻¹ΣQ⁻¹ is exactly the HC robust variance; under homoskedasticity Σ_V=σ²Q_X and it simplifies to σ²Q_X⁻¹.' },
    ],
    insight: 'This is the theoretical justification for z-tests and CIs in large samples. The sandwich form Q⁻¹ΣQ⁻¹ is valid under heteroskedasticity; it simplifies to σ²Q⁻¹ under homoskedasticity.' },

  { id: 'ovb_proof', title: 'Omitted Variable Bias', accent: '#fb7185', tag: 'OLS',
    statement: 'Omitting X₂ when Cov(X₁,X₂)≠0 biases β̂₁ by β₂·Cov(X₁,X₂)/Var(X₁)',
    plain: 'Leave out a variable that affects the outcome and correlates with your included regressors, and your estimates are permanently wrong. More data never fixes it. The bias equals the omitted variable\'s true effect multiplied by how strongly it correlates with the included variable — same-sign correlation inflates the estimate, opposite-sign deflates it.',
    conditions: ['True model: Y = β₀+β₁X₁+β₂X₂+u with E[u|X₁,X₂]=0'],
    steps: [
      { math: 'Short regression: Y = γ₀+γ₁X₁+ε (omits X₂)',
        explain: 'The "short" (misspecified) regression omits X₂. The coefficient γ₁ captures the raw association between Y and X₁. If X₂ is correlated with both, this association conflates the causal effect of X₁ with the indirect effect of X₂.' },
      { math: 'plim γ̂₁ = Cov(Y,X₁)/Var(X₁)  (by LLN)',
        explain: 'γ̂₁ = S_{YX₁}/S²_{X₁}. By LLN both sample moments converge to their population counterparts: plim γ̂₁ = Cov(Y,X₁)/Var(X₁). We now substitute the true model for Y to evaluate this ratio.' },
      { math: 'Cov(Y,X₁) = β₁·Var(X₁) + β₂·Cov(X₂,X₁)  (by linearity)',
        explain: 'Plug in Y=β₀+β₁X₁+β₂X₂+u. By bilinearity of covariance: Cov(β₀,X₁)=0 (constant), Cov(β₁X₁,X₁)=β₁Var(X₁), Cov(β₂X₂,X₁)=β₂Cov(X₂,X₁), Cov(u,X₁)=0 (exogeneity). Only the middle two terms survive.' },
      { math: 'plim γ̂₁ = β₁ + β₂·Cov(X₁,X₂)/Var(X₁)  ✓',
        explain: 'Dividing through by Var(X₁): plim γ̂₁ = β₁ + β₂·Cov(X₁,X₂)/Var(X₁). The second term is the asymptotic bias — it is permanent and does NOT shrink as n→∞.' },
      { math: 'Bias = β₂·Cov(X₁,X₂)/Var(X₁)  [sign rule]',
        explain: 'The bias equals β₂ times the coefficient from regressing X₂ on X₁. Sign rule: sign(bias) = sign(β₂) × sign(Cov(X₁,X₂)). Example: omitting "ability" from wage regressions — ability positively affects wages (β₂>0) and correlates positively with education → upward bias on education coefficient.' },
    ],
    insight: 'Sign rule: bias = sign(β₂)×sign(Cov). E.g., ability omitted from wage regression: positive coef on ability, ability↑ with education → upward bias on education coefficient.' },

  { id: 'mle', title: 'MLE Consistency & Asymptotics', accent: '#22d3ee', tag: 'MLE',
    statement: 'Under regularity conditions, θ̂_MLE →ᵖ θ₀ and √n(θ̂−θ₀) →ᴰ N(0, I(θ₀)⁻¹)',
    plain: 'Maximum likelihood picks the parameter that makes your observed data most probable. With large samples it converges to the truth, and no other estimator achieves smaller standard errors — it hits the Cramér-Rao efficiency bound. Fisher information measures how much information your data carries about the parameter.',
    conditions: ['Model correctly specified', 'θ₀ in the interior of the parameter space', 'Fisher information I(θ) finite and positive definite'],
    steps: [
      { math: 'θ̂ = argmax ℓ(θ) = argmax ∑log f(Xᵢ|θ)',
        explain: 'The log-likelihood ℓ(θ) = ∑log f(Xᵢ|θ) converts the product of densities L=∏f(Xᵢ|θ) into a sum, making optimization tractable. The MLE θ̂ is the parameter value that makes the observed data most probable under the model.' },
      { math: 'FOC: ∑∂log f(Xᵢ|θ̂)/∂θ = 0  (score equation)',
        explain: 'The score s(Xᵢ,θ) = ∂log f(Xᵢ|θ)/∂θ measures how fast the log-likelihood changes with θ. At the maximum, the total score ∑s(Xᵢ,θ̂)=0. The expected score at the true θ₀ is also zero: E[s(X,θ₀)]=0 (a key identity from differentiating ∫f dX=1).' },
      { math: 'n⁻¹ℓ(θ) →ᵖ E[log f(X|θ)], maximized at θ₀  (by KL)',
        explain: 'By LLN, n⁻¹ℓ(θ) → E[log f(X|θ)]. The Kullback-Leibler divergence inequality ensures E[log f(X|θ)] is uniquely maximized at the true θ₀ (assuming correct specification). This is the core argument for consistency: the criterion concentrates around its global max at the truth.' },
      { math: 'I(θ) = E[(∂log f/∂θ)²] = −E[∂²log f/∂θ²]  (information equality)',
        explain: 'Fisher information I(θ) has two equivalent forms. The first is Var(score) = E[s²]. The second uses the expected curvature of the log-likelihood. The equality follows from differentiating the identity ∫f dX=1 twice. This "information equality" is crucial for the asymptotic variance derivation.' },
      { math: '√n(θ̂−θ₀) →ᴰ N(0, I(θ₀)⁻¹) ✓  (CLT + delta method)',
        explain: 'Taylor-expand the score equation around θ₀: 0 ≈ n⁻¹∑s(Xᵢ,θ₀) + (n⁻¹∑∂s/∂θ)·(θ̂−θ₀). By CLT, n⁻¹/²∑s(Xᵢ,θ₀) →ᴰ N(0,I(θ₀)). By LLN + information equality, n⁻¹∑∂s/∂θ →ᵖ −I(θ₀). Solving gives √n(θ̂−θ₀) →ᴰ N(0,I(θ₀)⁻¹). This Cramér-Rao bound is achieved: MLE is asymptotically efficient.' },
    ],
    insight: 'MLE achieves the Cramér-Rao lower bound asymptotically (efficient). For Bernoulli: θ̂=X̄. For Normal: μ̂=X̄, σ̂²=n⁻¹∑(Xᵢ−X̄)² (biased but consistent).' },

  { id: 'iv_proof', title: 'IV / 2SLS Consistency', accent: '#f59e0b', tag: 'Causal',
    statement: 'If Cov(Z,u)=0 and Cov(Z,X)≠0, then β̂_IV = Cov(Z,Y)/Cov(Z,X) →ᵖ β₁',
    plain: 'When your regressor is endogenous — correlated with unobserved factors that also affect the outcome — OLS is biased. An instrument Z shifts X but has no direct effect on Y. IV essentially divides the effect of Z on Y by the effect of Z on X to isolate the clean causal variation in X.',
    conditions: ['Relevance: Cov(Z,X) ≠ 0', 'Exogeneity: Cov(Z,u) = 0'],
    steps: [
      { math: 'Model: Y = β₀+β₁X+u  with Cov(X,u)≠0 (X endogenous)',
        explain: 'X is "endogenous" — correlated with the error u, making OLS inconsistent: plim β̂_OLS = β₁ + Cov(X,u)/Var(X) ≠ β₁. Common causes: omitted variable (ability in wage equations), simultaneous causality, or measurement error. We need an instrument Z — a variable that shifts X but is unrelated to u.' },
      { math: 'Take Cov(Z,·): Cov(Z,Y) = β₁·Cov(Z,X) + Cov(Z,u)',
        explain: 'Multiply both sides of Y=β₀+β₁X+u by (Z−E[Z]) and take expectations. Constants have zero covariance. This gives Cov(Z,Y) = β₁Cov(Z,X) + Cov(Z,u). This "moment condition" is the key equation IV exploits.' },
      { math: 'If Cov(Z,u)=0: β₁ = Cov(Z,Y)/Cov(Z,X)',
        explain: 'The exogeneity condition Cov(Z,u)=0 makes the last term vanish. Solving for β₁: β₁ = Cov(Z,Y)/Cov(Z,X). Relevance Cov(Z,X)≠0 ensures no division by zero. A valid instrument must satisfy BOTH: exclusion restriction (exogeneity) and relevance.' },
      { math: 'β̂_IV = S_{ZY}/S_{ZX} →ᵖ β₁  ✓  (by LLN)',
        explain: 'Replacing population moments with sample analogs: β̂_IV = S_{ZY}/S_{ZX}. By LLN, both sample covariances converge to their population versions, so β̂_IV →ᵖ Cov(Z,Y)/Cov(Z,X) = β₁. Weak instruments (Cov(Z,X)≈0) cause near-division-by-zero: huge variance and severe finite-sample bias.' },
    ],
    insight: '2SLS generalizes to multiple instruments: project X onto all instruments, then use predicted X̂ in OLS. Weak instruments cause large variance and severe finite-sample bias toward OLS.' },

  { id: 'fixed_effects', title: 'Panel Fixed Effects', accent: '#a78bfa', tag: 'Panel',
    statement: 'The within estimator β̂_FE is consistent under E[uᵢₜ|Xᵢ,αᵢ]=0 even when Cov(αᵢ,Xᵢₜ)≠0',
    plain: 'Fixed effects removes permanent differences between units — ability, geography, culture — by centering each unit on its own time average. Only within-unit changes over time identify the coefficient. This controls for any time-invariant unobservable, even ones never measured, as long as they do not change over time.',
    conditions: ['Strict exogeneity conditional on fixed effect', 'No perfect multicollinearity after demeaning'],
    steps: [
      { math: 'Model: Yᵢₜ = αᵢ + β·Xᵢₜ + uᵢₜ  (αᵢ = entity fixed effect)',
        explain: 'αᵢ is an unobserved, time-invariant "fixed effect" for entity i — capturing permanent ability, culture, location advantages, etc. If αᵢ correlates with Xᵢₜ, pooled OLS on the raw data is biased. The FE estimator eliminates αᵢ by differencing.' },
      { math: 'Demean within entities: Ÿᵢₜ = Yᵢₜ−Ȳᵢ·, Ẍᵢₜ = Xᵢₜ−X̄ᵢ·',
        explain: 'For each entity i, subtract its time-average Ȳᵢ· = T⁻¹∑ₜYᵢₜ. This "within transformation" centers each entity\'s observations around zero, retaining only time variation within each entity and discarding cross-sectional (between-entity) variation.' },
      { math: 'Demeaning eliminates αᵢ: Ÿᵢₜ = β·Ẍᵢₜ + ůᵢₜ',
        explain: 'Time-average the model: Ȳᵢ·= αᵢ + βX̄ᵢ·+ ūᵢ·. Subtracting from the original: αᵢ−αᵢ=0 drops out. The demeaned model Ÿᵢₜ = βẌᵢₜ + ůᵢₜ has no fixed effect. This is the key step: the within transformation sweeps out all time-invariant unobservables.' },
      { math: 'β̂_FE = (∑Ẍᵢₜ²)⁻¹∑Ẍᵢₜ·Ÿᵢₜ  ✓',
        explain: 'Apply OLS to the demeaned model. Under strict exogeneity E[uᵢₜ|Xᵢ,αᵢ]=0, the demeaned error ůᵢₜ is uncorrelated with Ẍᵢₜ, giving a consistent estimate. In practice: include entity dummies (which is equivalent by Frisch-Waugh) or use the within transformation directly.' },
    ],
    insight: 'FE controls for all time-invariant unobservables, observed or not. Cost: cannot estimate time-invariant variables (e.g., race, gender). Time FE controls for common shocks.' },

  { id: 'logit_proof', title: 'Logit / Probit MLE', accent: '#22d3ee', tag: 'Binary Y',
    statement: 'P(Y=1|X) = Λ(Xβ) where Λ(z)=1/(1+e⁻ᶻ). β̂ maximizes the log-likelihood.',
    plain: 'For yes/no outcomes, logistic regression models probability as an S-curve guaranteed to stay between 0 and 1. The log-likelihood is globally concave — exactly one maximum exists — so gradient ascent always converges. Each Newton step is equivalent to a weighted regression, making estimation fast and stable.',
    conditions: ['Binary Y ∈ {0,1}', 'Correct link function specification'],
    steps: [
      { math: 'ℓ(β) = ∑[Yᵢlog Λ(Xᵢβ) + (1−Yᵢ)log(1−Λ(Xᵢβ))]',
        explain: 'For binary Y, the probability model is P(Y=1|X)=Λ(Xβ) where Λ(z)=1/(1+e⁻ᶻ) is the logistic CDF. The likelihood of one observation is Λ^{Yᵢ}(1−Λ)^{1−Yᵢ}. Taking logs and summing gives ℓ(β). No closed-form maximum exists — we use Newton-Raphson.' },
      { math: '∂ℓ/∂β = ∑Xᵢ(Yᵢ−p̂ᵢ)  where p̂ᵢ=Λ(Xᵢβ)',
        explain: 'Differentiating and using Λ\'(z)=Λ(z)(1−Λ(z)): the score is ∑Xᵢ(Yᵢ−p̂ᵢ) — a sum of "residuals" Yᵢ−p̂ᵢ weighted by Xᵢ. This has the same form as the OLS normal equations, making iterative optimization straightforward.' },
      { math: '∂²ℓ/∂β∂β\' = −∑XᵢXᵢ\'·p̂ᵢ(1−p̂ᵢ)  (negative definite)',
        explain: 'The Hessian H = −∑XᵢXᵢ\'wᵢ where wᵢ=p̂ᵢ(1−p̂ᵢ)>0. Since wᵢ>0, H = −∑wᵢXᵢXᵢ\' is the negative of a positive definite matrix. H is negative definite → ℓ(β) is globally concave → unique maximum, so gradient ascent always converges.' },
      { math: 'β_{t+1} = βₜ − H⁻¹·∇ℓ  (Newton-Raphson / IRLS)',
        explain: 'Newton-Raphson jumps from current βₜ to the maximum of the local quadratic approximation to ℓ. With logit Hessian, each iteration is a weighted least squares regression of a "working response" on X with weights wᵢ=p̂ᵢ(1−p̂ᵢ). This is "Iteratively Reweighted Least Squares" (IRLS). Convergence is quadratic near the optimum.' },
    ],
    insight: 'Marginal effect ≠ coefficient: ∂P/∂Xⱼ = βⱼ·Λ(Xβ)·(1−Λ(Xβ)) — depends on X. McFadden R²=1−ℓ/ℓ₀; values 0.2–0.4 indicate very good fit.' },

  { id: 'tobit', title: 'Tobit / Censored Regression', accent: '#fb7185', tag: 'Limited DV',
    statement: 'Latent model: Y*=Xβ+ε, ε~N(0,σ²). Observed: Y=Y* if Y*>0, else Y=0.',
    plain: 'When many outcomes are zero because a floor censors the data — not because zero is the true value — OLS is biased downward. Tobit posits an underlying variable Y* that we only observe when positive, and writes the correct probability for both cases (positive values and censored zeros), then maximizes jointly over β and σ.',
    conditions: ['Normality and homoskedasticity of ε', 'Y* is the latent (unobserved) variable'],
    steps: [
      { math: 'Likelihood has two regimes: censored vs uncensored',
        explain: 'When Y* is observed only if positive (else Y=0), OLS treating zeros as "Y*=0" is biased — zeros mean Y*≤0, not Y*=0. The Tobit likelihood correctly models both cases. Naively applying OLS pulls the fitted line downward toward zero.' },
      { math: 'Uncensored (Yᵢ>0): contribution = fₙ(Yᵢ|Xᵢβ, σ²)',
        explain: 'For observations where the latent variable is observed (Y*>0), the likelihood contribution is the normal density: fₙ(y|Xᵢβ,σ²) = (2πσ²)^{−1/2}·exp(−(y−Xᵢβ)²/(2σ²)). We treat these like ordinary regression observations.' },
      { math: 'Censored (Yᵢ=0): contribution = Φ(−Xᵢβ/σ)',
        explain: 'For censored observations (Y=0), we observe only Y*≤0. The probability: P(Y*≤0) = P(ε≤−Xᵢβ) = Φ(−Xᵢβ/σ) where Φ is the standard normal CDF. This contribution depends on β and σ but not on the unobserved Y*.' },
      { math: 'ℓ(β,σ) = ∑_{Y>0}log fₙ + ∑_{Y=0}log Φ(−Xᵢβ/σ)',
        explain: 'The total log-likelihood sums contributions from both regimes. We maximize over both β and σ simultaneously using Newton-Raphson. The model is identified by the normal distributional assumption — so normality matters more here than in OLS.' },
      { math: 'β̂_Tobit consistent; OLS on full sample biased ✓',
        explain: 'OLS on the full sample underestimates the effect because zeros pull the fitted line down. OLS on only Y>0 observations has a different bias (selection on Y* which depends on u). Tobit MLE correctly accounts for the censoring mechanism and is consistent under the normality/homoskedasticity assumptions.' },
    ],
    insight: 'OLS on censored data is biased downward. Truncated regression (only Y>0 observed) needs a different likelihood. Both require distributional assumptions unlike OLS.' },

  { id: 'pred_var', title: 'OLS Prediction Variance', accent: '#22d3ee', tag: 'OLS',
    statement: 'Var(μ̂₀) = σ²/n + (σ²/G)·(x₀−x̄)²  where G = ∑(xᵢ−x̄)²',
    plain: 'Your regression is most confident at the center of your data. Every step away from the mean of X adds extra uncertainty proportional to the squared distance — so the confidence band widens into a parabola as you move outward. This is why interpolating (predicting within your data range) is more reliable than extrapolating beyond it.',
    conditions: ['Classical OLS: εᵢ ~ iid N(0,σ²)', 'μ̂₀ = β̂₀ + β̂₁·x₀ is the predicted mean at x₀'],
    steps: [
      { math: 'Var(μ̂₀) = Var(β̂₀) + x₀²·Var(β̂₁) + 2x₀·Cov(β̂₀,β̂₁)',
        explain: 'μ̂₀ = β̂₀ + β̂₁x₀ is a linear combination of two random variables. By the variance formula for a+bZ₁+cZ₂: Var = a²·0 + Var(β̂₀) + x₀²Var(β̂₁) + 2x₀Cov(β̂₀,β̂₁). We need each component from the OLS covariance matrix (X\'X)⁻¹.' },
      { math: 'Var(β̂₀)=σ²·∑xᵢ²/(nG), Var(β̂₁)=σ²/G, Cov(β̂₀,β̂₁)=−σ²x̄/G',
        explain: 'These come from the (X\'X)⁻¹ matrix for simple regression where G=∑(xᵢ−x̄)². Var(β̂₁)=σ²/G (inversely proportional to spread in X). Cov(β̂₀,β̂₁)=−σ²x̄/G (negative: a steeper slope tends to lower the intercept, and vice versa).' },
      { math: 'Use: ∑xᵢ² = G + nx̄²  (from G=∑xᵢ²−nx̄²)',
        explain: 'G = ∑(xᵢ−x̄)² = ∑xᵢ²−2x̄∑xᵢ+nx̄² = ∑xᵢ²−nx̄². Rearranging: ∑xᵢ² = G+nx̄². This algebraic identity lets us simplify Var(β̂₀) = σ²(G+nx̄²)/(nG) in the next step.' },
      { math: 'Var(μ̂₀) = σ²(G+nx̄²)/(nG) + x₀²σ²/G − 2x₀x̄σ²/G',
        explain: 'Substituting the known formulas: first term = Var(β̂₀) = σ²(G+nx̄²)/(nG); second = x₀²·σ²/G; third = 2x₀·(−σ²x̄/G). Adding all three.' },
      { math: '= σ²/n + σ²x̄²/G + x₀²σ²/G − 2x₀x̄σ²/G',
        explain: 'Split σ²(G+nx̄²)/(nG) = σ²G/(nG) + σ²nx̄²/(nG) = σ²/n + σ²x̄²/G. Now we have four terms: σ²/n plus three terms all sharing the factor σ²/G.' },
      { math: '= σ²/n + (σ²/G)·(x₀−x̄)²  ✓',
        explain: 'Factor σ²/G from the last three: σ²/G·(x̄² + x₀² − 2x₀x̄) = σ²/G·(x₀−x̄)². Final result: Var(μ̂₀) = σ²/n + (σ²/G)·(x₀−x̄)². Minimum variance σ²/n at x₀=x̄. The U-shape as x₀ moves away from x̄ justifies interpolation being more reliable than extrapolation.' },
    ],
    insight: 'Precision is highest at x₀=x̄ and degrades as a U-shaped parabola away from it. This justifies why interpolation is more reliable than extrapolation.' },

  { id: 'dummy_ttest', title: 'Dummy Variable = Pooled t-test', accent: '#4ade80', tag: 'OLS',
    statement: 'OLS with a binary indicator Xᵢ∈{0,1} is algebraically identical to the pooled two-sample t-test.',
    plain: 'If you code groups as 0 and 1 and run a regression, the coefficient is exactly the difference in group means and the t-statistic is exactly the classical pooled two-sample t-test. The two procedures are the same formula in different notation — regression is the more general version that extends to multiple groups and covariates.',
    conditions: ['Equal variance assumed (pooled t-test assumption)', 'Xᵢ=1 for treatment, Xᵢ=0 for control'],
    steps: [
      { math: 'OLS model: Yᵢ = β₀ + β₁Xᵢ + uᵢ',
        explain: 'We run OLS with X as a 0/1 indicator. β₀ is the mean outcome in the control group. β₁ is the treatment-control mean difference (treatment effect). The question: does the OLS t-test for β₁=0 equal the classical pooled two-sample t-test?' },
      { math: 'Normal equations → β̂₀ = ȳ_ctrl, β̂₁ = ȳ_treat − ȳ_ctrl',
        explain: 'With binary X, the OLS normal equations simplify: ∂SSR/∂β₀=0 gives β̂₀+β̂₁X̄=Ȳ; ∂SSR/∂β₁=0 gives β̂₁·S²_X = S_{YX}. Solving: β̂₀=ȳ_ctrl (control mean) and β̂₁=ȳ_treat−ȳ_ctrl (group mean difference).' },
      { math: 'Residuals ûᵢ = Yᵢ − ȳ_group (within-group deviations)',
        explain: 'For treated (X=1): ŷᵢ=β̂₀+β̂₁=ȳ_treat, so ûᵢ=Yᵢ−ȳ_treat. For control (X=0): ŷᵢ=β̂₀=ȳ_ctrl, so ûᵢ=Yᵢ−ȳ_ctrl. OLS residuals are exactly within-group deviations from group means.' },
      { math: 'SSR = (n₁−1)s₁² + (n₀−1)s₀²  (pooled sum of squares)',
        explain: '∑ûᵢ² = ∑_{treat}(Yᵢ−ȳ_treat)² + ∑_{ctrl}(Yᵢ−ȳ_ctrl)² = (n₁−1)s₁²+(n₀−1)s₀² by definition of sample variance. This is exactly the numerator of the pooled variance sₚ² = SSR/(n−2).' },
      { math: 'SE(β̂₁) = sₚ·√(1/n₁+1/n₀)',
        explain: 'The OLS variance formula gives Var(β̂₁) = σ²/∑(Xᵢ−X̄)² = σ²·n/(n₁n₀) = σ²(1/n₁+1/n₀). Plugging in sₚ²: SE(β̂₁) = sₚ·√(1/n₁+1/n₀). This is identical to the pooled-t SE formula.' },
      { math: 'TS = (ȳ₁−ȳ₀)/(sₚ√(1/n₁+1/n₀))  — exactly the pooled t-stat ✓',
        explain: 'The OLS t-statistic β̂₁/SE(β̂₁) = (ȳ₁−ȳ₀)/(sₚ√(1/n₁+1/n₀)) is identically the classical pooled two-sample t-test formula. Same t-statistic, same p-value, same CI. Assignment 4 verified numerically: TS=2.45, p=0.024 from both methods.' },
    ],
    insight: 'OLS on a dummy = pooled t-test. This extends naturally: multiple dummies for multiple groups, additional covariates for covariate-adjusted comparisons.' },

  { id: 'wls_proof', title: 'WLS Transformation & BLUE', accent: '#f59e0b', tag: 'OLS',
    statement: 'Dividing by σᵢ=wᵢσ transforms heteroskedastic → homoskedastic; OLS on the new model = WLS.',
    plain: 'When some observations are noisier than others by a known amount, dividing every term by each observation\'s standard deviation restores equal error variance. OLS on the rescaled data automatically trusts precise observations more and noisy ones less — it is the most efficient linear estimator when the weights are correctly specified.',
    conditions: ['Known weights: Var(εᵢ|Xᵢ)=wᵢ²σ² (wᵢ known)', 'Model: Yᵢ=β₀+β₁Xᵢ+εᵢ'],
    steps: [
      { math: 'Divide each observation by wᵢ: Ỹᵢ=Yᵢ/wᵢ, X̃ᵢ₀=1/wᵢ, X̃ᵢ₁=Xᵢ/wᵢ',
        explain: 'We transform the model by dividing every term by the known standard deviation factor wᵢ. The transformed variables are Ỹᵢ=Yᵢ/wᵢ (response), X̃ᵢ₀=1/wᵢ (intercept column), X̃ᵢ₁=Xᵢ/wᵢ (slope column). The same coefficients β₀,β₁ appear — division doesn\'t change what we\'re estimating.' },
      { math: 'Var(εᵢ/wᵢ) = σ²/wᵢ²·Var(εᵢ) = σ²  (homoskedastic) ✓',
        explain: 'The transformed error ũᵢ=εᵢ/wᵢ has variance Var(εᵢ)/wᵢ² = wᵢ²σ²/wᵢ² = σ². All transformed errors have the same variance σ² regardless of i. Homoskedasticity is restored — Gauss-Markov now applies to the new model.' },
      { math: 'OLS on transformed: minimize ∑(Ỹᵢ−β₀X̃ᵢ₀−β₁X̃ᵢ₁)²',
        explain: 'We apply standard OLS to the transformed data: minimize ∑(Yᵢ/wᵢ−β₀/wᵢ−β₁Xᵢ/wᵢ)². The 1/wᵢ column plays the role of the intercept. Note: no separate constant term — the 1/wᵢ column handles that.' },
      { math: '= ∑(1/wᵢ²)(Yᵢ−β₀−β₁Xᵢ)²  (WLS objective) ✓',
        explain: 'Factoring out 1/wᵢ from each squared term: ∑(1/wᵢ)²(Yᵢ−β₀−β₁Xᵢ)². This is the WLS objective with weights 1/wᵢ² — observations with high variance (large wᵢ) are DOWN-weighted, low-variance observations are UP-weighted. WLS trusts precise observations more.' },
      { math: 'By Gauss-Markov on the transformed model, WLS is BLUE ✓',
        explain: 'The transformed model satisfies all Gauss-Markov conditions: linearity in β, exogeneity (inherited from original model), and homoskedasticity (just shown). Therefore OLS on the transformed model — which equals WLS on the original — is BLUE among all linear unbiased estimators. WLS dominates OLS on efficiency when heteroskedasticity is correctly specified.' },
    ],
    insight: 'When heteroskedasticity form is known, WLS beats OLS on efficiency. When unknown, use feasible WLS: estimate variance by regressing ûᵢ² on Xᵢ, weight by 1/√ĥᵢ.' },

  { id: 'delta_method', title: 'Nonlinear Marginal Effects & Delta Method', accent: '#a78bfa', tag: 'Inference',
    statement: 'For θ=d\'β, SE(d\'β̂)=√(d\'Σ̂d). For nonlinear g(β), replace d with ∂g/∂β|_{β̂}.',
    plain: 'The standard error of any linear combination of estimates — like a marginal effect or a contrast between coefficients — comes directly from the covariance matrix: compute d\'Σ̂d and take the square root. For nonlinear functions (marginal effects in logit or quadratic models), the same formula applies using the gradient vector at the estimated value.',
    conditions: ['d is a known vector (may depend on X)', 'Σ̂ is the HC or classical estimated covariance matrix of β̂'],
    steps: [
      { math: 'Quadratic model: ΔY = β₁ + β₂(2a+1) at X=a',
        explain: 'For Y=β₀+β₁X+β₂X²+u, the marginal effect at X=a is the discrete change when X goes from a to a+1: ΔY = E[Y|X=a+1]−E[Y|X=a] = β₁+β₂[(a+1)²−a²] = β₁+β₂(2a+1). Unlike linear models, this marginal effect depends on where we evaluate (a).' },
      { math: 'ΔY = d\'β where d=(0, 1, 2a+1)\'',
        explain: 'We can write the marginal effect as a linear combination of coefficients: d\'β = 0·β₀ + 1·β₁ + (2a+1)·β₂. The vector d=(0,1,2a+1)\' picks the relevant coefficients with appropriate weights. This "linearization" is what makes the delta method work.' },
      { math: 'SE(d\'β̂) = √(d\'Σ̂d)',
        explain: 'By the variance formula for linear combinations: Var(d\'β̂) = d\'·Var(β̂)·d = d\'Σ̂d where Σ̂ is the k×k estimated covariance matrix of β̂. This is a scalar: d is k×1, so d\'Σ̂d is 1×1. The square root is the standard error.' },
      { math: 'Expand: = √(Σ̂₁₁ + (2a+1)²Σ̂₂₂ + 2(2a+1)Σ̂₁₂)',
        explain: 'Writing out the quadratic form d\'Σ̂d with d=(0,1,2a+1)\': = [1·1·Σ̂₁₁] + [(2a+1)²·Σ̂₂₂] + [2·1·(2a+1)·Σ̂₁₂]. This uses the quadratic form expansion and symmetry of Σ̂ (Σ̂₁₂=Σ̂₂₁). Crucially, it correctly accounts for the correlation between β̂₁ and β̂₂.' },
      { math: '95% CI: d\'β̂ ± 1.96·√(d\'Σ̂d)',
        explain: 'The marginal effect estimator d\'β̂ is asymptotically normal because β̂ is asymptotically normal and d\'β is a continuous linear function. The 95% CI uses 1.96 (z_{0.025}) for large samples, or t_{n-k,0.025} for small samples.' },
      { math: 'Simultaneous Δ (e.g. Δeduc=1, Δage=1): d=(0,1,1)\'',
        explain: 'When multiple variables change at once (as in Assignment 7: both education and age +1 simultaneously), the gradient d=(0,1,1)\' and SE=√(Σ̂₁₁+2Σ̂₁₂+Σ̂₂₂). Assignment 7 computed SE=√(4.544e-4+2×3.384e-6+1.701e-5)=0.02187. The delta method handles joint changes and correlations between estimates correctly.' },
    ],
    insight: 'The delta method generalizes to any smooth nonlinear g(β): SE ≈ √((∂g/∂β|_{β̂})\'Σ̂(∂g/∂β|_{β̂})). Used for logit marginal effects, elasticities, and ratio estimators.' },

  { id: 'ovb_full', title: 'OVB Full Covariance Proof', accent: '#fb7185', tag: 'OLS',
    statement: 'Step-by-step: plim(β̂₁) = β₁ + β₂·Cov(X₁,X₂)/Var(X₁) when X₂ is omitted.',
    plain: 'This walks through the omitted variable bias algebra one step at a time. The probability limit of the short-regression coefficient equals the true effect plus a bias term. That bias is the true effect of the omitted variable multiplied by the correlation between the omitted and included variables — and it stays fixed no matter how large the sample grows.',
    conditions: ['True model: Yᵢ=β₀+β₁X₁ᵢ+β₂X₂ᵢ+uᵢ with E[u|X₁,X₂]=0'],
    steps: [
      { math: 'β̂₁ = S_{Y,X₁}/S²_{X₁} →ᵖ Cov(Y,X₁)/Var(X₁)  (by LLN)',
        explain: 'The short-regression OLS estimator β̂₁ is the sample covariance S_{Y,X₁} divided by the sample variance S²_{X₁}. By the LLN, both sample moments converge to their population versions as n→∞, so plim β̂₁ = Cov(Y,X₁)/Var(X₁). We evaluate this limit next.' },
      { math: 'Expand Cov(Y,X₁) using Y=β₀+β₁X₁+β₂X₂+u',
        explain: 'By bilinearity of covariance: Cov(Y,X₁) = Cov(β₀+β₁X₁+β₂X₂+u, X₁). We expand term-by-term. Constants have zero covariance. Scalars factor out. The four terms separate cleanly.' },
      { math: '= 0 + β₁·Var(X₁) + β₂·Cov(X₂,X₁) + 0',
        explain: 'Term by term: Cov(β₀,X₁)=0 (constant). Cov(β₁X₁,X₁)=β₁Var(X₁) (variance). Cov(β₂X₂,X₁)=β₂Cov(X₂,X₁). Cov(u,X₁)=0 by strict exogeneity E[u|X₁,X₂]=0 → E[uX₁]=E[X₁E[u|X₁,X₂]]=0.' },
      { math: 'plim(β̂₁) = β₁ + β₂·Cov(X₁,X₂)/Var(X₁)  ✓',
        explain: 'Dividing Cov(Y,X₁)=β₁Var(X₁)+β₂Cov(X₁,X₂) by Var(X₁): plim(β̂₁) = β₁ + β₂·Cov(X₁,X₂)/Var(X₁). The bias term β₂·Cov(X₁,X₂)/Var(X₁) is exactly β₂ times the OLS coefficient from regressing X₂ on X₁.' },
      { math: 'Bias = β₂·Cov(X₁,X₂)/Var(X₁)  [permanent — does not vanish]',
        explain: 'This bias is asymptotic: it remains even as n→∞. Sign rule: sign(bias) = sign(β₂) × sign(Cov(X₁,X₂)). The bias is zero only if β₂=0 (X₂ has no effect) or Cov(X₁,X₂)=0 (the omitted variable is uncorrelated with X₁).' },
      { math: 'Example: β₂=4, Cov=−0.2, Var=1 → bias = 4×(−0.2) = −0.8',
        explain: 'From the final exam. True effect of X₂ is β₂=4 (positive), but X₂ negatively correlates with X₁ (Cov=−0.2). By the sign rule: sign(bias)=(+)×(−)=(−). The short regression understates β₁ by 0.8. If the true β₁=2, we\'d estimate about 1.2 — a 40% underestimate.' },
    ],
    insight: 'The bias equals β₂ times the coefficient from regressing X₂ on X₁. Sign rule: sign(bias)=sign(β₂)×sign(Cov). Negative bias means we understate the true effect.' },
]

function TheorySection() {
  const [selected, setSelected] = useState(PROOFS[0].id)
  const [filter, setFilter] = useState('All')
  const [openSteps, setOpenSteps] = useState(new Set())
  const tags = ['All', ...new Set(PROOFS.map(p => p.tag))]
  const visible = filter === 'All' ? PROOFS : PROOFS.filter(p => p.tag === filter)
  const proof = PROOFS.find(p => p.id === selected) || visible[0]

  function selectProof(id) {
    setSelected(id)
    setOpenSteps(new Set())
  }
  function changeFilter(t) {
    setFilter(t)
    const newVisible = t === 'All' ? PROOFS : PROOFS.filter(p => p.tag === t)
    if (!newVisible.find(p => p.id === selected)) selectProof(newVisible[0]?.id)
  }
  function toggleStep(i) {
    setOpenSteps(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })
  }

  return (
    <div className="theory-layout">
      {/* Left list panel */}
      <div className="theory-list-panel">
        <div className="theory-tags">
          {tags.map(t => (
            <button key={t} className={`theory-tag-btn ${filter === t ? 'active' : ''}`} onClick={() => changeFilter(t)}>{t}</button>
          ))}
        </div>
        <div className="theory-list">
          {visible.map(p => (
            <button key={p.id}
              className={`theory-list-item ${selected === p.id ? 'active' : ''}`}
              style={{ borderLeftColor: selected === p.id ? p.accent : 'transparent' }}
              onClick={() => selectProof(p.id)}>
              <span className="theory-item-tag" style={{ background: p.accent + '22', color: p.accent }}>{p.tag}</span>
              <span className="theory-item-title">{p.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      {proof && (
        <div className="theory-detail-panel">
          <div className="theory-detail-header" style={{ borderLeftColor: proof.accent }}>
            <span className="theory-detail-tag" style={{ background: proof.accent + '20', color: proof.accent }}>{proof.tag}</span>
            <h2 className="theory-detail-title">{proof.title}</h2>
          </div>

          <div className="theory-detail-statement">{proof.statement}</div>
          {proof.plain && <div className="theory-plain-english">{proof.plain}</div>}

          <div className="theory-detail-section">CONDITIONS</div>
          {proof.conditions.map((c, i) => (
            <div key={i} className="theory-detail-cond">✦ {c}</div>
          ))}

          <div className="theory-detail-section" style={{ marginTop: 22 }}>PROOF STEPS <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, color: '#94a3b8' }}>— click any step to expand explanation</span></div>
          <div className="theory-steps-list">
            {proof.steps.map((s, i) => (
              <div key={i} className="theory-step-block">
                <button className="theory-step-row" onClick={() => toggleStep(i)}>
                  <span className="theory-step-num">{i + 1}</span>
                  <span className="theory-step-math">{s.math}</span>
                  <span className="theory-step-arrow">{openSteps.has(i) ? '▲' : '▼'}</span>
                </button>
                {openSteps.has(i) && (
                  <div className="theory-step-explain">{s.explain}</div>
                )}
              </div>
            ))}
          </div>

          <div className="theory-detail-section" style={{ marginTop: 22 }}>KEY INSIGHT</div>
          <div className="theory-detail-insight">{proof.insight}</div>
        </div>
      )}
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const SUBTABS = [
  { id: 'distributions', label: 'Distributions' },
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'regression', label: 'Regression' },
  { id: 'tests', label: 'Hypothesis Tests' },
  { id: 'causal', label: 'Causal Inference' },
  { id: 'theory', label: 'Proofs & Theory' },
]

export default function Statistics() {
  const [sub, setSub] = useState('distributions')
  return (
    <div className="stat-root la-root">
      <div className="la-subtabs">
        {SUBTABS.map(t => (
          <button key={t.id} className={`la-subtab ${sub === t.id ? 'active' : ''}`} onClick={() => setSub(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="la-content">
        {sub === 'distributions' && <DistributionSection />}
        {sub === 'descriptive' && <DescriptiveSection />}
        {sub === 'regression' && <RegressionSection />}
        {sub === 'tests' && <HypothesisSection />}
        {sub === 'causal' && <CausalSection />}
        {sub === 'theory' && <TheorySection />}
      </div>
    </div>
  )
}

