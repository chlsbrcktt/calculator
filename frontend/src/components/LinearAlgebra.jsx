import { useState, useRef, useEffect, memo } from 'react'
import Plotly from 'plotly.js-dist-min'
import './LinearAlgebra.css'

// Simple imperative Plotly wrapper — avoids react-plotly.js CJS interop issues
const Plot = memo(function Plot({ data, layout, config, style }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    Plotly.react(ref.current, data, layout, { ...config, responsive: true })
  })
  useEffect(() => {
    const el = ref.current
    return () => { if (el) Plotly.purge(el) }
  }, [])
  return <div ref={ref} style={style} />
})

const LA_COLORS = ['#4f8ef7', '#f76c4f', '#4fcf6c', '#e879f9', '#fb923c']

// ─── math helpers ────────────────────────────────────────────────────────────

function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0) }
function cross3(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
}
function mag(v) { return Math.sqrt(v.reduce((s, x) => s + x*x, 0)) }
function norm(v) { const m = mag(v); return m < 1e-12 ? v : v.map(x => x/m) }

function matMul(A, B) {
  const rows = A.length, cols = B[0].length
  const C = Array.from({length: rows}, () => Array(cols).fill(0))
  const steps = []
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const terms = A[i].map((a, k) => ({ a, b: B[k][j], prod: a * B[k][j] }))
      C[i][j] = terms.reduce((s,t) => s + t.prod, 0)
      steps.push({ i, j, terms, result: C[i][j] })
    }
  return { C, steps }
}

function det2(m) { return m[0][0]*m[1][1] - m[0][1]*m[1][0] }
function det3(m) {
  return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
       - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
       + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
}

function gaussElim(A, b) {
  const n = A.length
  const aug = A.map((row, i) => [...row.map(Number), Number(b[i])])
  const steps = []

  const snap = () => aug.map(r => [...r])

  for (let col = 0; col < n; col++) {
    let pivot = -1
    for (let r = col; r < n; r++) if (Math.abs(aug[r][col]) > 1e-10) { pivot = r; break }
    if (pivot === -1) { steps.push({ type: 'no_pivot', col }); continue }
    if (pivot !== col) {
      ;[aug[col], aug[pivot]] = [aug[pivot], aug[col]]
      steps.push({ type: 'swap', r1: col+1, r2: pivot+1, matrix: snap() })
    }
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) < 1e-10) continue
      const f = aug[r][col] / aug[col][col]
      for (let c = col; c <= n; c++) aug[r][c] -= f * aug[col][c]
      aug[r][col] = 0
      steps.push({ type: 'elim', row: r+1, pivot: col+1, factor: f.toFixed(4), matrix: snap() })
    }
    steps.push({ type: 'upper', col: col+1, matrix: snap() })
  }

  const x = Array(n).fill(0)
  for (let i = n-1; i >= 0; i--) {
    x[i] = aug[i][n]
    for (let j = i+1; j < n; j++) x[i] -= aug[i][j] * x[j]
    x[i] /= aug[i][i]
  }
  return { solution: x, steps, final: snap() }
}

function fmt(n) {
  if (typeof n !== 'number' || isNaN(n)) return '?'
  if (Math.abs(n) < 1e-10) return '0'
  if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n))
  return n.toFixed(3).replace(/\.?0+$/, '')
}

// ─── Plotly config ────────────────────────────────────────────────────────────

const DARK_LAYOUT_2D = {
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#ffffff',
  font: { color: '#64748b', size: 11 },
  xaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, color: '#64748b', linecolor: '#e5e7eb' },
  yaxis: { gridcolor: '#e5e7eb', gridwidth: 1, showgrid: true, zerolinecolor: '#9ca3af', zerolinewidth: 1.5, color: '#64748b', linecolor: '#e5e7eb' },
  margin: { l: 40, r: 20, t: 20, b: 40 },
  showlegend: true,
  legend: { bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e5e7eb', borderwidth: 1, font: { color: '#475569', size: 11 } },
}

const DARK_LAYOUT_3D = {
  paper_bgcolor: '#ffffff',
  scene: {
    bgcolor: '#ffffff',
    xaxis: { gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af', color: '#64748b', title: { text: 'x', font: { color: '#64748b' } } },
    yaxis: { gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af', color: '#64748b', title: { text: 'y', font: { color: '#64748b' } } },
    zaxis: { gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af', color: '#64748b', title: { text: 'z', font: { color: '#64748b' } } },
  },
  margin: { l: 0, r: 0, t: 20, b: 0 },
  showlegend: true,
  legend: { bgcolor: 'rgba(255,255,255,0.95)', bordercolor: '#e5e7eb', borderwidth: 1, font: { color: '#475569', size: 11 } },
}

const PLOTLY_CONFIG = { responsive: true, displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }

// ─── Vector 3D traces ─────────────────────────────────────────────────────────

function vectorTrace3D(v, color, name) {
  const [vx, vy, vz = 0] = v
  const m = mag([vx, vy, vz])
  if (m < 1e-10) return []
  const u = norm([vx, vy, vz])
  const shaftEnd = 0.82  // shaft ends before arrowhead
  return [
    {
      type: 'scatter3d', mode: 'lines',
      x: [0, vx * shaftEnd], y: [0, vy * shaftEnd], z: [0, vz * shaftEnd],
      line: { color, width: 5 },
      name, legendgroup: name, showlegend: true,
    },
    {
      type: 'cone',
      x: [vx], y: [vy], z: [vz],
      u: [u[0] * m * 0.18], v: [u[1] * m * 0.18], w: [u[2] * m * 0.18],
      colorscale: [[0, color], [1, color]],
      showscale: false, anchor: 'tip', sizemode: 'absolute', sizeref: 0.28,
      name: '', legendgroup: name, showlegend: false,
    },
  ]
}

function spanTrace3D(vectors, color) {
  const traces = []
  if (vectors.length === 1) {
    const v = [...vectors[0], 0, 0, 0].slice(0, 3)
    const u = norm(v)
    const t = Math.max(...v.map(Math.abs)) * 4 || 3
    traces.push({
      type: 'scatter3d', mode: 'lines',
      x: [-t*u[0], t*u[0]], y: [-t*u[1], t*u[1]], z: [-t*u[2], t*u[2]],
      line: { color: color + '60', width: 2, dash: 'dot' },
      name: 'Span', showlegend: true,
    })
  }
  if (vectors.length >= 2) {
    const v1 = [...vectors[0], 0, 0, 0].slice(0, 3)
    const v2 = [...vectors[1], 0, 0, 0].slice(0, 3)
    const R = 3
    const Nsteps = 9
    const sVals = Array.from({length: Nsteps}, (_, i) => -R + i * 2*R/(Nsteps-1))
    const X = sVals.map(s => sVals.map(t => s*v1[0]+t*v2[0]))
    const Y = sVals.map(s => sVals.map(t => s*v1[1]+t*v2[1]))
    const Z = sVals.map(s => sVals.map(t => s*v1[2]+t*v2[2]))
    traces.push({
      type: 'surface', x: X, y: Y, z: Z,
      opacity: 0.25,
      colorscale: [[0, color+'40'], [1, color]],
      showscale: false,
      name: 'Span (plane)', showlegend: true,
    })
  }
  return traces
}

// ─── Section: Vectors ─────────────────────────────────────────────────────────

function VectorSection() {
  const [dim, setDim] = useState(3)
  const [inputs, setInputs] = useState(['3, 2, 1', '1, -1, 2', '', '', ''])
  const [showSpan, setShowSpan] = useState(false)

  const vectors = inputs.map(inp =>
    inp.trim() ? inp.split(',').map(Number).filter(v => !isNaN(v)) : null
  ).filter(Boolean)

  const active = vectors.filter(v => v.length >= 2)
  const is3D = dim === 3 || active.some(v => v.length === 3)
  const is4D = dim >= 4 || active.some(v => v.length === 4)
  const is5D = dim >= 5 || active.some(v => v.length === 5)

  const padVec = (v, d) => {
    const r = [...v]
    while (r.length < d) r.push(0)
    return r.slice(0, d)
  }

  // Build Plotly traces
  const traces = []
  active.slice(0, 5).forEach((v, i) => {
    const v3 = padVec(v, 3)
    traces.push(...vectorTrace3D(v3, LA_COLORS[i], `v${i+1} = [${v.join(', ')}]`))
  })
  if (showSpan && active.length >= 1) {
    traces.push(...spanTrace3D(active.slice(0, 2).map(v => padVec(v, 3)), '#94a3b8'))
  }
  // Axis arrows
  ;[['x',[1,0,0],'#ef4444'], ['y',[0,1,0],'#22c55e'], ['z',[0,0,1],'#a78bfa']].forEach(([l,d,c]) => {
    traces.push({
      type:'scatter3d', mode:'lines',
      x:[0,d[0]*0.5], y:[0,d[1]*0.5], z:[0,d[2]*0.5],
      line:{color:c+'55', width:2, dash:'dot'},
      name:l, showlegend:false,
    })
  })

  // 4D/5D color encoding
  const colorDim = active.map(v => v[3] ?? 0)
  const sizeDim  = active.map(v => v[4] ?? 8)

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Dimensions</div>
        <div className="dim-row">
          {[2,3,4,5].map(d => (
            <button key={d} className={`dim-btn ${dim===d?'active':''}`} onClick={() => setDim(d)}>{d}D</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:12}}>Vectors (comma-separated)</div>
        {inputs.map((inp, i) => (
          <div key={i} className="vec-input-row">
            <span className="vec-badge" style={{background: LA_COLORS[i]+'22', color: LA_COLORS[i]}}>v{i+1}</span>
            <input
              className="la-input"
              value={inp}
              placeholder={dim===2 ? 'x, y' : dim===3 ? 'x, y, z' : dim===4 ? 'x, y, z, w' : 'x,y,z,w,v'}
              onChange={e => setInputs(prev => prev.map((v,j) => j===i ? e.target.value : v))}
            />
          </div>
        ))}

        <label className="la-check">
          <input type="checkbox" checked={showSpan} onChange={e => setShowSpan(e.target.checked)} />
          Show span
        </label>

        {active.length > 0 && (
          <div className="vec-stats">
            <div className="la-label" style={{marginTop:8}}>Properties</div>
            {active.slice(0,5).map((v, i) => (
              <div key={i} className="stat-row">
                <span style={{color: LA_COLORS[i]}}>v{i+1}</span>
                <span>|v| = {fmt(mag(v))}</span>
                <span>unit: [{norm(v).map(x=>fmt(x)).join(', ')}]</span>
              </div>
            ))}
            {active.length >= 2 && (
              <div className="stat-row" style={{marginTop:6}}>
                <span>v1 · v2 = {fmt(dot(padVec(active[0],active[1].length), active[1]))}</span>
              </div>
            )}
            {active.length >= 2 && active[0].length <= 3 && active[1].length <= 3 && (
              <div className="stat-row">
                <span>v1 × v2 = [{cross3(padVec(active[0],3), padVec(active[1],3)).map(fmt).join(', ')}]</span>
              </div>
            )}
            {(is4D || is5D) && (
              <div className="stat-row" style={{color:'#64748b', fontSize:11, marginTop:4}}>
                {is5D ? '4D shown as color, 5th dim as endpoint size. First 3 components plotted.' :
                        '4th dimension encoded as dot color.'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="la-viz">
        <Plot
          data={traces}
          layout={{
            ...DARK_LAYOUT_3D,
            title: { text: `${dim}D Vectors`, font: { color: '#94a3b8', size: 13 }, x: 0.04 },
          }}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
        {(is4D || is5D) && (
          <div className="dim-note">
            {is5D
              ? 'Plotting 3D projection (x,y,z). 4th dim shown as color, 5th as point size.'
              : 'Plotting 3D projection (x,y,z). 4th dimension encoded as color.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section: Transformations ─────────────────────────────────────────────────

function TransformSection() {
  const canvasRef = useRef(null)
  const [size, setSize] = useState(2) // 2 = 2x2, 3 = 3x3
  const [mat, setMat] = useState([[1,0],[0,1]])
  const [progress, setProgress] = useState(1) // 0=identity, 1=full transform
  const animRef = useRef(null)

  const setEntry = (r, c, val) => {
    setMat(prev => {
      const next = prev.map(row => [...row])
      next[r][c] = parseFloat(val) || 0
      return next
    })
  }

  const resetToIdentity = () => {
    const n = size
    setMat(Array.from({length:n}, (_,i) => Array.from({length:n}, (_,j) => i===j?1:0)))
    setProgress(1)
  }

  const setPreset = (name) => {
    const presets = {
      'Rotate 90°': [[0,-1],[1,0]],
      'Scale 2x': [[2,0],[0,2]],
      'Shear x': [[1,1],[0,1]],
      'Reflect x': [[1,0],[0,-1]],
      'Project x': [[1,0],[0,0]],
    }
    if (presets[name]) { setMat(presets[name]); setSize(2); setProgress(1) }
  }

  const animate = () => {
    setProgress(0)
    const start = performance.now()
    const dur = 1000
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1)
      setProgress(t)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cx = W/2, cy = H/2
    const scale = Math.min(W, H) / 22

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0b0f1a'
    ctx.fillRect(0, 0, W, H)

    const px = (x, y) => [cx + x * scale, cy - y * scale]

    // Interpolated matrix M(t) = I*(1-t) + M*t
    const a = mat[0]?.[0] ?? 1, b = mat[0]?.[1] ?? 0
    const c = mat[1]?.[0] ?? 0, d = mat[1]?.[1] ?? 1
    const t = progress
    const ma = 1*(1-t) + a*t, mb = 0*(1-t) + b*t
    const mc = 0*(1-t) + c*t, md = 1*(1-t) + d*t

    const T = (x, y) => [ma*x + mb*y, mc*x + md*y]

    // Original grid (faint)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 0.5
    for (let i = -10; i <= 10; i++) {
      const [x1,y1]=px(-10,i), [x2,y2]=px(10,i)
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
      const [x3,y3]=px(i,-10), [x4,y4]=px(i,10)
      ctx.beginPath(); ctx.moveTo(x3,y3); ctx.lineTo(x4,y4); ctx.stroke()
    }

    // Transformed grid
    for (let i = -10; i <= 10; i++) {
      // Horizontal line y=i
      const [tx1,ty1] = T(-10, i), [tx2,ty2] = T(10, i)
      ctx.strokeStyle = i === 0 ? '#334155' : '#1a2d50'
      ctx.lineWidth = i === 0 ? 1.5 : 0.75
      const [x1,y1]=px(tx1,ty1), [x2,y2]=px(tx2,ty2)
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
      // Vertical line x=i
      const [tx3,ty3] = T(i,-10), [tx4,ty4] = T(i,10)
      ctx.strokeStyle = i === 0 ? '#334155' : '#1a2d50'
      const [x3,y3]=px(tx3,ty3), [x4,y4]=px(tx4,ty4)
      ctx.beginPath(); ctx.moveTo(x3,y3); ctx.lineTo(x4,y4); ctx.stroke()
    }

    // Transformed basis vectors
    const drawArrow = (from, to, color, label) => {
      const [fx,fy] = px(...from), [tx2,ty2] = px(...to)
      const angle = Math.atan2(ty2-fy, tx2-fx)
      const hl = 10
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(tx2,ty2); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(tx2, ty2)
      ctx.lineTo(tx2 - hl*Math.cos(angle-0.4), ty2 - hl*Math.sin(angle-0.4))
      ctx.lineTo(tx2 - hl*Math.cos(angle+0.4), ty2 - hl*Math.sin(angle+0.4))
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = color; ctx.font = '12px ui-monospace,monospace'
      ctx.fillText(label, tx2+6, ty2-4)
    }

    const [ix, iy] = T(1, 0)
    const [jx, jy] = T(0, 1)
    drawArrow([0,0],[ix,iy], '#4f8ef7', 'î')
    drawArrow([0,0],[jx,jy], '#4fcf6c', 'ĵ')

  }, [mat, progress])

  const detVal = mat.length === 2 ? det2(mat) : (mat.length === 3 ? det3(mat) : null)

  const matType = () => {
    if (mat.length !== 2) return ''
    const [a,b,c,d] = [mat[0][0],mat[0][1],mat[1][0],mat[1][1]]
    if (Math.abs(a-d) < 0.01 && Math.abs(b+c) < 0.01 && Math.abs(a*a+b*b-1) < 0.01) return 'Rotation'
    if (b === 0 && c === 0) return Math.abs(a) === Math.abs(d) ? 'Uniform scale' : 'Non-uniform scale'
    if (a===1&&d===1&&c===0) return 'Horizontal shear'
    if (a===1&&d===1&&b===0) return 'Vertical shear'
    if (Math.abs(detVal) < 0.001) return 'Singular (collapses space)'
    return 'Linear transformation'
  }

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Matrix size</div>
        <div className="dim-row">
          {[2,3].map(n => (
            <button key={n} className={`dim-btn ${size===n?'active':''}`} onClick={() => { setSize(n); resetToIdentity() }}>
              {n}×{n}
            </button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:12}}>Matrix entries</div>
        <div className="matrix-grid" style={{gridTemplateColumns: `repeat(${size}, 1fr)`}}>
          {Array.from({length: size}, (_, r) =>
            Array.from({length: size}, (_, c) => (
              <input
                key={`${r}-${c}`}
                className="matrix-cell"
                type="number"
                value={mat[r]?.[c] ?? 0}
                onChange={e => setEntry(r, c, e.target.value)}
              />
            ))
          )}
        </div>

        <div className="la-label" style={{marginTop:12}}>Presets</div>
        <div className="preset-wrap">
          {['Rotate 90°','Scale 2x','Shear x','Reflect x','Project x'].map(n => (
            <button key={n} className="preset-tag" onClick={() => setPreset(n)}>{n}</button>
          ))}
        </div>

        <div className="la-actions" style={{marginTop:12}}>
          <button className="la-btn" onClick={animate}>Animate</button>
          <button className="la-btn secondary" onClick={resetToIdentity}>Reset</button>
        </div>

        <div className="vec-stats" style={{marginTop:12}}>
          {detVal !== null && <div className="stat-row"><span>det = {fmt(detVal)}</span></div>}
          <div className="stat-row"><span>Type: {matType()}</span></div>
          <div className="stat-row" style={{fontSize:11,color:'#475569'}}>
            Blue = î (col 1) · Green = ĵ (col 2)
          </div>
        </div>
      </div>

      <div className="la-viz">
        <canvas
          ref={canvasRef}
          width={700}
          height={560}
          style={{width:'100%', height:'100%', display:'block'}}
        />
      </div>
    </div>
  )
}

// ─── Section: Matrix Operations ────────────────────────────────────────────────

function MatrixOpsSection() {
  const [rawA, setRawA] = useState('1,2,3\n4,5,6')
  const [rawB, setRawB] = useState('7,8\n9,10\n11,12')
  const [result, setResult] = useState(null)
  const [activeCell, setActiveCell] = useState(null)

  const parseMatrix = (raw) => {
    try {
      const rows = raw.trim().split('\n').map(r => r.split(',').map(Number))
      if (rows.some(r => r.some(isNaN))) return null
      if (rows.some(r => r.length !== rows[0].length)) return null
      return rows
    } catch { return null }
  }

  const A = parseMatrix(rawA)
  const B = parseMatrix(rawB)
  const canMul = A && B && A[0].length === B.length

  const compute = () => {
    if (!canMul) return
    setResult(matMul(A, B))
    setActiveCell(null)
  }

  const activeStep = result && activeCell
    ? result.steps.find(s => s.i === activeCell[0] && s.j === activeCell[1])
    : null

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Matrix A (rows, comma-separated)</div>
        <textarea className="la-textarea" value={rawA} onChange={e => { setRawA(e.target.value); setResult(null) }} rows={4} />
        {A && <div className="mat-dim">{A.length} × {A[0].length}</div>}

        <div className="la-label" style={{marginTop:12}}>Matrix B</div>
        <textarea className="la-textarea" value={rawB} onChange={e => { setRawB(e.target.value); setResult(null) }} rows={4} />
        {B && <div className="mat-dim">{B.length} × {B[0].length}</div>}

        {!canMul && A && B && (
          <div className="la-warn">A cols ({A[0].length}) ≠ B rows ({B.length}) — cannot multiply</div>
        )}

        <button className="la-btn" style={{marginTop:12}} onClick={compute} disabled={!canMul}>
          Compute A × B
        </button>

        {activeStep && (
          <div className="step-detail">
            <div className="la-label">C[{activeCell[0]+1}][{activeCell[1]+1}] = row {activeCell[0]+1} of A · col {activeCell[1]+1} of B</div>
            {activeStep.terms.map((t, k) => (
              <div key={k} className="term-row">
                <span className="term">{fmt(t.a)}</span>
                <span className="op">×</span>
                <span className="term">{fmt(t.b)}</span>
                <span className="op">=</span>
                <span className="term">{fmt(t.prod)}</span>
              </div>
            ))}
            <div className="term-row total">
              <span>Sum = {fmt(activeStep.result)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="la-viz matops-viz">
        {A && B && (
          <div className="matop-layout">
            <MatDisplay mat={A} label="A" color="#4f8ef7" />
            <div className="matop-sym">×</div>
            <MatDisplay mat={B} label="B" color="#f76c4f" />
            <div className="matop-sym">=</div>
            {result ? (
              <MatDisplay
                mat={result.C}
                label="A × B"
                color="#4fcf6c"
                interactive
                activeCell={activeCell}
                onCell={setActiveCell}
              />
            ) : (
              <div className="mat-placeholder">Click compute</div>
            )}
          </div>
        )}
        {!A && <div className="la-hint">Enter matrices above (one row per line, comma-separated values)</div>}
      </div>
    </div>
  )
}

function MatDisplay({ mat, label, color, interactive, activeCell, onCell }) {
  return (
    <div className="mat-display">
      <div className="mat-label" style={{color}}>{label}</div>
      <div className="mat-bracket-wrap">
        <span className="mat-bracket">[</span>
        <div className="mat-rows">
          {mat.map((row, i) => (
            <div key={i} className="mat-row">
              {row.map((v, j) => (
                <span
                  key={j}
                  className={`mat-cell ${interactive ? 'clickable' : ''} ${activeCell?.[0]===i && activeCell?.[1]===j ? 'active' : ''}`}
                  onClick={() => interactive && onCell([i, j])}
                >
                  {fmt(v)}
                </span>
              ))}
            </div>
          ))}
        </div>
        <span className="mat-bracket">]</span>
      </div>
    </div>
  )
}

// ─── Section: Systems ─────────────────────────────────────────────────────────

function SystemsSection() {
  const [n, setN] = useState(2)
  const [aug, setAug] = useState([[2,-1,3],[1,3,5]])
  const [result, setResult] = useState(null)

  const setCell = (r, c, v) => {
    setAug(prev => { const next = prev.map(row=>[...row]); next[r][c] = parseFloat(v)||0; return next })
    setResult(null)
  }

  const resize = (newN) => {
    setN(newN)
    setAug(Array.from({length: newN}, (_, i) =>
      Array.from({length: newN+1}, (_, j) => (aug[i]?.[j] ?? (i===j ? 1 : 0)))
    ))
    setResult(null)
  }

  const solve = () => {
    const A = aug.map(row => row.slice(0, n))
    const b = aug.map(row => row[n])
    try { setResult(gaussElim(A, b)) }
    catch (e) { setResult({ error: e.message }) }
  }

  // Build Plotly traces for visualisation
  const getTraces = () => {
    if (n === 2) {
      const traces = []
      const xs = [-8,-4,0,4,8]
      aug.slice(0,2).forEach((row, i) => {
        const [a,b2,c] = row
        if (Math.abs(b2) > 1e-10) {
          const ys = xs.map(x => (c - a*x) / b2)
          traces.push({ type:'scatter', mode:'lines', x:xs, y:ys,
            line:{color:LA_COLORS[i], width:2.5},
            name:`Eq ${i+1}: ${a}x + ${b2>0?'+':''}${b2}y = ${c}` })
        } else if (Math.abs(a) > 1e-10) {
          const xv = c/a
          traces.push({ type:'scatter', mode:'lines',
            x:[xv,xv], y:[-10,10], line:{color:LA_COLORS[i],width:2.5},
            name:`Eq ${i+1}: x = ${xv}` })
        }
      })
      if (result?.solution) {
        const [sx,sy] = result.solution
        traces.push({ type:'scatter', mode:'markers',
          x:[sx], y:[sy], marker:{color:'#fff',size:10,symbol:'cross',
            line:{color:'#e2e8f0',width:2}},
          name:`Solution (${fmt(sx)}, ${fmt(sy)})` })
      }
      return traces
    }
    if (n === 3) {
      const traces = []
      const R = 5
      const grid = Array.from({length:9}, (_,i) => -R + i * R/4)
      aug.slice(0,3).forEach((row, i) => {
        const [a,b2,c,d] = row
        let X=[], Y=[], Z=[]
        if (Math.abs(c) > 1e-10) {
          X = grid.map(x => grid.map(() => x))
          Y = grid.map(() => grid.map(y => y))
          Z = grid.map((x,xi) => grid.map((y) => (d - a*x - b2*y) / c))
        } else if (Math.abs(b2) > 1e-10) {
          X = grid.map(x => grid.map(() => x))
          Z = grid.map(() => grid.map(z => z))
          Y = grid.map((x,xi) => grid.map((z) => (d - a*x - c*z) / b2))
        }
        if (X.length) {
          traces.push({ type:'surface', x:X, y:Y, z:Z,
            opacity:0.35, colorscale:[[0,LA_COLORS[i]+'40'],[1,LA_COLORS[i]]],
            showscale:false, name:`Plane ${i+1}` })
        }
      })
      if (result?.solution) {
        const [sx,sy,sz] = result.solution
        traces.push({ type:'scatter3d', mode:'markers',
          x:[sx], y:[sy], z:[sz],
          marker:{color:'#fff',size:6,symbol:'cross'},
          name:`Solution (${fmt(sx)},${fmt(sy)},${fmt(sz)})` })
      }
      return traces
    }
    return []
  }

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">System size (n × n)</div>
        <div className="dim-row">
          {[2,3,4].map(k => (
            <button key={k} className={`dim-btn ${n===k?'active':''}`} onClick={() => resize(k)}>{k}×{k}</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:12}}>Augmented matrix [A | b]</div>
        <div className="aug-grid" style={{gridTemplateColumns: `repeat(${n+1}, 1fr) 4px`}}>
          {Array.from({length: n}, (_, r) =>
            Array.from({length: n+1}, (_, c) => (
              <input
                key={`${r}-${c}`}
                className={`matrix-cell ${c===n ? 'rhs' : ''}`}
                type="number"
                value={aug[r]?.[c] ?? 0}
                onChange={e => setCell(r, c, e.target.value)}
              />
            ))
          )}
        </div>
        <div className="la-label" style={{fontSize:10, color:'#334155', marginTop:2}}>
          Last column = b (right-hand side)
        </div>

        <button className="la-btn" style={{marginTop:12}} onClick={solve}>Solve</button>

        {result && !result.error && (
          <div className="vec-stats" style={{marginTop:12}}>
            <div className="la-label">Solution</div>
            {result.solution.map((v, i) => (
              <div key={i} className="stat-row">
                <span>x{i+1} = {fmt(v)}</span>
              </div>
            ))}
            <div className="la-label" style={{marginTop:10}}>Elimination steps</div>
            {result.steps.slice(0,12).map((s, i) => (
              <div key={i} className="stat-row" style={{fontSize:11}}>
                {s.type==='swap' && `R${s.r1} ↔ R${s.r2}`}
                {s.type==='elim' && `R${s.row} → R${s.row} − (${s.factor}) × R${s.pivot}`}
                {s.type==='upper' && `Column ${s.col} done`}
              </div>
            ))}
          </div>
        )}
        {result?.error && <div className="la-warn">{result.error}</div>}
      </div>

      <div className="la-viz">
        {n <= 3 ? (
          <Plot
            data={getTraces()}
            layout={n === 3 ? {
              ...DARK_LAYOUT_3D,
              title: { text: '3D: Three Planes', font: { color: '#94a3b8', size: 13 }, x: 0.04 },
            } : {
              ...DARK_LAYOUT_2D,
              xaxis: { ...DARK_LAYOUT_2D.xaxis, range: [-8, 8] },
              yaxis: { ...DARK_LAYOUT_2D.yaxis, range: [-8, 8] },
              title: { text: '2D: Lines', font: { color: '#94a3b8', size: 13 }, x: 0.04 },
            }}
            config={PLOTLY_CONFIG}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        ) : (
          <div className="la-hint">
            Visualization available for 2×2 and 3×3 systems.<br/>
            Solution shown in the left panel.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section: 3D Surfaces ─────────────────────────────────────────────────────

// Celestial body catalog — masses in Earth masses, radii in Earth radii
const CELESTIAL_DATA = [
  { name: 'Moon',          mass: 0.0123,   radius: 0.273,  color: '#94a3b8', category: 'Moons'       },
  { name: 'Pluto',         mass: 0.00218,  radius: 0.186,  color: '#c4a882', category: 'Moons'       },
  { name: 'Mercury',       mass: 0.055,    radius: 0.383,  color: '#9ca3af', category: 'Planets'     },
  { name: 'Venus',         mass: 0.815,    radius: 0.949,  color: '#fbbf24', category: 'Planets'     },
  { name: 'Mars',          mass: 0.107,    radius: 0.532,  color: '#f97316', category: 'Planets'     },
  { name: 'Jupiter',       mass: 317.8,    radius: 11.21,  color: '#d97706', category: 'Planets'     },
  { name: 'Saturn',        mass: 95.16,    radius: 9.45,   color: '#ca8a04', category: 'Planets'     },
  { name: 'Uranus',        mass: 14.54,    radius: 4.01,   color: '#67e8f9', category: 'Planets'     },
  { name: 'Neptune',       mass: 17.15,    radius: 3.88,   color: '#3b82f6', category: 'Planets'     },
  { name: 'Ceres',         mass: 1.58e-4,  radius: 0.074,  color: '#78716c', category: 'Small Bodies'},
  { name: 'Eros',          mass: 4.6e-10,  radius: 0.0024, color: '#a8a29e', category: 'Small Bodies'},
  { name: "Halley's Comet",mass: 2.2e-14,  radius: 0.003,  color: '#bae6fd', category: 'Small Bodies'},
  { name: 'Sun',           mass: 332946,   radius: 109,    color: '#fbbf24', category: 'Stars'       },
  { name: 'Red Dwarf',     mass: 66431,    radius: 14,     color: '#f87171', category: 'Stars'       },
  { name: 'Red Giant',     mass: 500000,   radius: 400,    color: '#ef4444', category: 'Stars'       },
  { name: 'Sirius A',      mass: 2.12e6,   radius: 171,    color: '#e0f2fe', category: 'Stars'       },
  { name: 'White Dwarf',   mass: 200000,   radius: 0.01,   color: '#f0f9ff', category: 'Remnants'    },
  { name: 'Neutron Star',  mass: 500000,   radius: 1.7e-5, color: '#c4b5fd', category: 'Remnants'    },
  { name: 'Stellar BH',    mass: 3.3e6,    radius: 0,      color: '#a855f7', category: 'Black Holes' },
  { name: 'Sagittarius A*',mass: 1.3e12,   radius: 0,      color: '#7c3aed', category: 'Black Holes' },
]

const CELESTIAL_CATEGORIES = ['All', 'Moons', 'Planets', 'Small Bodies', 'Stars', 'Remnants', 'Black Holes']

// Visual compression so tiny bodies and black holes both look reasonable
const COMP_POWER = 0.18

function buildComparisonTraces(body) {
  const N = 55, hw = 2.5, gap = 0.4
  const cx_e = -(hw + gap / 2)
  const cx_b =  (hw + gap / 2)
  const eps = 0.05
  const vscale = m => Math.pow(m, COMP_POWER)

  const makeWell = (cx, sc) => {
    const xs = Array.from({length: N}, (_, i) => cx - hw + i * 2 * hw / (N - 1))
    const ys = Array.from({length: N}, (_, i) => -hw + i * 2 * hw / (N - 1))
    const X = ys.map(() => [...xs])
    const Y = ys.map(y => xs.map(() => y))
    const Z = ys.map(y => xs.map(x => -sc / Math.sqrt((x - cx) ** 2 + y ** 2 + eps)))
    return { X, Y, Z, zMin: -sc / Math.sqrt(eps), cx }
  }

  const ew = makeWell(cx_e, vscale(1))
  const bw = makeWell(cx_b, vscale(body.mass))

  const wellTrace = (w, name) => ({
    type: 'surface', x: w.X, y: w.Y, z: w.Z,
    colorscale: SPACETIME_CS, showscale: false, opacity: 0.88,
    contours: {
      x: { show: true, color: '#1e3a8a', usecolormap: false, width: 1 },
      y: { show: true, color: '#1e3a8a', usecolormap: false, width: 1 },
    },
    name, hovertemplate: `${name}<br>curvature: %{z:.3f}<extra></extra>`,
  })

  const sphereT = (cx, cz, r, cs, name, opts = {}) => {
    const { X, Y, Z } = makeSphere(cx, 0, cz, r)
    return { type: 'surface', x: X, y: Y, z: Z, colorscale: cs, showscale: false, name,
      lighting: { ambient: 0.5, diffuse: 0.9, specular: 0.3 },
      lightposition: { x: 200, y: 300, z: 500 }, ...opts }
  }

  const labelT = (cx, z, text, color) => ({
    type: 'scatter3d', mode: 'text',
    x: [cx], y: [0], z: [z + 0.55],
    text: [text], textposition: 'top center',
    textfont: { color, size: 10, family: 'ui-monospace,monospace' },
    showlegend: false, hoverinfo: 'skip',
  })

  const earthR = 0.22
  const earthCz = ew.zMin + earthR * 0.85
  const bodyR = body.category === 'Black Holes' ? 0.15
    : Math.max(0.07, Math.min(0.62, earthR * Math.pow(Math.max(body.radius, 0.001), 0.28)))
  const bodyCz = bw.zMin + bodyR * 0.85

  const traces = [
    wellTrace(ew, 'Earth spacetime'),
    wellTrace(bw, `${body.name} spacetime`),
    // Earth sphere with land colors
    { type: 'surface',
      ...(() => { const s = makeSphere(cx_e, 0, earthCz, earthR); return {x:s.X,y:s.Y,z:s.Z} })(),
      surfacecolor: earthSurfaceColor(28),
      colorscale: [[0,'#1a56db'],[0.45,'#1e7a3e'],[0.55,'#1e7a3e'],[1,'#1a56db']],
      showscale: false, name: 'Earth',
      lighting: { ambient: 0.5, diffuse: 0.9 }, lightposition: { x: 200, y: 300, z: 500 } },
    // Earth atmosphere glow
    sphereT(cx_e, earthCz, earthR + 0.09, [[0,'#60a5fa'],[1,'#60a5fa']], 'Atmosphere',
      { opacity: 0.1, hoverinfo: 'skip' }),
    // Comparison body
    sphereT(cx_b, bodyCz, bodyR, [[0, body.color],[1, body.color]], body.name,
      { opacity: body.category === 'Black Holes' ? 0.95 : 1 }),
    // Labels
    labelT(cx_e, earthCz, 'Earth', '#60a5fa'),
    labelT(cx_b, bodyCz, body.name, body.color),
  ]

  // Black hole event horizon ring
  if (body.category === 'Black Holes') {
    const ringR = bodyR * 1.3
    const pts = 80
    const ang = Array.from({length: pts}, (_, i) => i * 2 * Math.PI / (pts - 1))
    traces.push({
      type: 'scatter3d', mode: 'lines',
      x: ang.map(a => cx_b + ringR * Math.cos(a)),
      y: ang.map(a => ringR * Math.sin(a)),
      z: Array(pts).fill(bodyCz),
      line: { color: body.color, width: 3 },
      name: 'Event horizon', showlegend: false,
    })
  }

  return traces
}

const SPACETIME_EXPR = '-1 / sqrt(x^2 + y^2 + 0.05)'

const SPACETIME_CS = [
  [0,    '#e0f2fe'],
  [0.08, '#38bdf8'],
  [0.2,  '#0284c7'],
  [0.4,  '#1e3a8a'],
  [0.65, '#0f172a'],
  [1,    '#020617'],
]

// Build a parametric sphere grid, returns {X, Y, Z} as 2D arrays
function makeSphere(cx, cy, cz, r, N = 28) {
  const phi   = Array.from({length: N}, (_, i) => i * Math.PI / (N - 1))
  const theta = Array.from({length: N}, (_, i) => i * 2 * Math.PI / (N - 1))
  return {
    X: phi.map(p => theta.map(t => cx + r * Math.sin(p) * Math.cos(t))),
    Y: phi.map(p => theta.map(t => cy + r * Math.sin(p) * Math.sin(t))),
    Z: phi.map(p => theta.map(t => cz + r * Math.cos(p))),
  }
}

// Simple land-mass approximation via trig on lat/lon
function earthSurfaceColor(N = 28) {
  const phi   = Array.from({length: N}, (_, i) => i * Math.PI / (N - 1))
  const theta = Array.from({length: N}, (_, i) => i * 2 * Math.PI / (N - 1))
  return phi.map(p => theta.map(t => {
    const lat = p / Math.PI         // 0→1
    const lon = t / (2 * Math.PI)   // 0→1
    // crude continent-like blobs
    const land =
      Math.sin(lat * Math.PI * 2.1) * Math.cos(lon * Math.PI * 3.7) > 0.18 ||
      Math.sin(lat * Math.PI * 1.4 + 1) * Math.cos(lon * Math.PI * 5.2 + 2) > 0.22 ||
      Math.sin(lat * Math.PI * 3.1 + 0.5) * Math.cos(lon * Math.PI * 2.3 + 1) > 0.28
    return land ? 1 : 0
  }))
}

const SURFACE_PRESETS = {
  explicit: [
    { name: 'Spacetime (Earth)', expr: SPACETIME_EXPR,                                           xRange: [-3.5,3.5], yRange: [-3.5,3.5] },
    { name: 'Sinc',              expr: 'sin(sqrt(x^2+y^2)) / (sqrt(x^2+y^2)+0.01)',              xRange: [-8,8],     yRange: [-8,8]     },
    { name: 'Saddle',            expr: 'x^2 - y^2',                                              xRange: [-3,3],     yRange: [-3,3]     },
    { name: 'Ripple',            expr: 'cos(x) * sin(y)',                                        xRange: [-5,5],     yRange: [-5,5]     },
    { name: 'Cone',              expr: 'sqrt(x^2 + y^2)',                                        xRange: [-4,4],     yRange: [-4,4]     },
    { name: 'Monkey saddle',     expr: 'x^3 - 3*x*y^2',                                         xRange: [-2,2],     yRange: [-2,2]     },
  ],
  parametric: [
    { name: 'Swiss Roll', xExpr: 'u*cos(u)', yExpr: 'v',                       zExpr: 'u*sin(u)', uRange: [4.71,14.14], vRange: [0,20]   },
    { name: 'Torus',      xExpr: '(3+cos(v))*cos(u)', yExpr: '(3+cos(v))*sin(u)', zExpr: 'sin(v)', uRange: [0,6.28],     vRange: [0,6.28] },
    { name: 'Sphere',     xExpr: 'sin(v)*cos(u)', yExpr: 'sin(v)*sin(u)',      zExpr: 'cos(v)',   uRange: [0,6.28],     vRange: [0,3.14] },
    { name: 'Möbius',     xExpr: '(1+v*cos(u/2))*cos(u)', yExpr: '(1+v*cos(u/2))*sin(u)', zExpr: 'v*sin(u/2)', uRange: [0,6.28], vRange: [-0.5,0.5] },
    { name: 'Helix surf', xExpr: 'cos(u)',   yExpr: 'sin(u)',                  zExpr: 'u+v',      uRange: [0,18.85],    vRange: [0,1]    },
    { name: 'Klein',      xExpr: '(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*cos(v)',
                          yExpr: '(2+cos(v/2)*sin(u)-sin(v/2)*sin(2*u))*sin(v)',
                          zExpr: 'sin(v/2)*sin(u)+cos(v/2)*sin(2*u)',          uRange: [0,6.28],  vRange: [0,6.28] },
  ],
}

const COLORSCALES = ['Viridis', 'Plasma', 'Portland', 'RdBu', 'Electric', 'Hot']

// Stats helpers (Earth baseline: g=9.8 m/s², esc=11.2 km/s, M=1)
function fmtMass(m) {
  if (m < 1e-6)  return `${(m*1e9).toFixed(1)} × 10⁻⁹ M⊕`
  if (m < 0.001) return `${(m*1e6).toFixed(0)} × 10⁻⁶ M⊕`
  if (m < 1)     return `${(m*100).toFixed(1)}% M⊕`
  if (m >= 1e9)  return `${(m/1e9).toFixed(2)} × 10⁹ M⊕`
  if (m >= 1e6)  return `${(m/1e6).toFixed(2)} × 10⁶ M⊕`
  if (m >= 1000) return `${(m/1000).toFixed(0)}k M⊕`
  return `${m.toFixed(1)} M⊕`
}
function fmtGrav(b) {
  if (!b.radius) return '∞ (singularity)'
  const g = 9.8 * b.mass / b.radius ** 2
  if (g > 1e11) return `>${(1e11/9.8).toFixed(0)}B g`
  if (g > 1e6)  return `${(g/1e6).toFixed(1)}M g`
  if (g > 1000) return `${(g/1000).toFixed(0)}k g`
  return `${g.toFixed(1)} g`
}
function fmtEsc(b) {
  if (!b.radius) return '≥ c (BH)'
  const v = 11.2 * Math.sqrt(b.mass / Math.max(b.radius, 1e-10))
  if (v > 300000) return '≥ c (BH)'
  if (v > 1e6)  return `${(v/1e6).toFixed(1)}M km/s`
  if (v > 1000) return `${(v/1000).toFixed(0)}k km/s`
  return `${v.toFixed(1)} km/s`
}
function fmtWell(m) {
  const ratio = Math.pow(m, COMP_POWER)
  if (ratio > 1000) return `${ratio.toFixed(0)}× deeper (visual)`
  if (ratio > 10)   return `${ratio.toFixed(1)}× deeper (visual)`
  if (ratio < 1)    return `${(1/ratio).toFixed(1)}× shallower`
  return `${ratio.toFixed(2)}× deeper`
}

export function SurfacesSection() {
  const [mode, setMode]         = useState('explicit')
  const [expr, setExpr]         = useState(SPACETIME_EXPR)
  const [xRange, setXRange]     = useState([-3.5, 3.5])
  const [yRange, setYRange]     = useState([-3.5, 3.5])
  const [xExpr, setXExpr]       = useState('u*cos(u)')
  const [yExpr, setYExpr]       = useState('v')
  const [zExpr, setZExpr]       = useState('u*sin(u)')
  const [uRange, setURange]     = useState([4.71, 14.14])
  const [vRange, setVRange]     = useState([0, 20])
  const [colorscale, setColorscale] = useState('Viridis')
  const [opacity, setOpacity]   = useState(0.9)
  const [traces, setTraces]     = useState([])
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [compareBody, setCompareBody] = useState(null)
  const [catFilter, setCatFilter]     = useState('All')

  const isSpacetime = mode === 'explicit' && expr.trim() === SPACETIME_EXPR

  // Auto-build comparison whenever a body is selected
  useEffect(() => {
    if (isSpacetime && compareBody) {
      setTraces(buildComparisonTraces(compareBody))
    }
  }, [compareBody]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSurface = async () => {
    if (isSpacetime && compareBody) {
      setTraces(buildComparisonTraces(compareBody))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const body = mode === 'explicit'
        ? { mode, expression: expr, x_range: xRange, y_range: yRange, num_points: isSpacetime ? 80 : 70 }
        : { mode: 'parametric', x_expr: xExpr, y_expr: yExpr, z_expr: zExpr,
            u_range: uRange, v_range: vRange, num_points: 70 }
      const res = await fetch('http://localhost:8001/surface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail) }
      const { X, Y, Z } = await res.json()

      const newTraces = []

      if (isSpacetime) {
        newTraces.push({
          type: 'surface', x: X, y: Y, z: Z,
          colorscale: SPACETIME_CS, opacity: 0.88, showscale: false,
          contours: {
            x: { show: true, color: '#1e3a8a', usecolormap: false, width: 1, highlightcolor: '#3b82f6', highlightwidth: 2 },
            y: { show: true, color: '#1e3a8a', usecolormap: false, width: 1, highlightcolor: '#3b82f6', highlightwidth: 2 },
          },
          name: 'Spacetime fabric',
          hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>curvature: %{z:.3f}<extra></extra>',
        })
        const flat = Z.flat().filter(v => v !== null && isFinite(v))
        const zMin = Math.min(...flat)
        const earthR = 0.34
        const earthCz = zMin + earthR * 0.9
        const N = 28
        const { X: eX, Y: eY, Z: eZ } = makeSphere(0, 0, earthCz, earthR, N)
        newTraces.push({
          type: 'surface', x: eX, y: eY, z: eZ,
          surfacecolor: earthSurfaceColor(N),
          colorscale: [[0,'#1a56db'],[0.45,'#1e7a3e'],[0.55,'#1e7a3e'],[1,'#1a56db']],
          showscale: false, name: 'Earth',
          lighting: { ambient: 0.5, diffuse: 0.9, specular: 0.4, roughness: 0.6 },
          lightposition: { x: 200, y: 300, z: 500 },
        })
        const { X: aX, Y: aY, Z: aZ } = makeSphere(0, 0, earthCz, earthR + 0.1, N)
        newTraces.push({
          type: 'surface', x: aX, y: aY, z: aZ,
          colorscale: [[0,'#60a5fa'],[1,'#60a5fa']], opacity: 0.1,
          showscale: false, name: 'Atmosphere', hoverinfo: 'skip',
        })
      } else {
        newTraces.push({
          type: 'surface', x: X, y: Y, z: Z,
          colorscale, opacity, showscale: true,
          colorbar: { thickness: 14, len: 0.7, tickfont: { color: '#64748b', size: 10 } },
        })
      }

      setTraces(newTraces)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (p) => {
    if (mode === 'explicit') {
      setExpr(p.expr); setXRange(p.xRange); setYRange(p.yRange)
    } else {
      setXExpr(p.xExpr); setYExpr(p.yExpr); setZExpr(p.zExpr)
      setURange(p.uRange); setVRange(p.vRange)
    }
  }

  const RangeInput = ({ label, value, onChange }) => (
    <div className="range-pair">
      <span className="la-label" style={{marginBottom:2}}>{label}</span>
      <div className="range-inputs">
        <input className="la-input" type="number" value={value[0]}
          onChange={e => onChange([parseFloat(e.target.value)||0, value[1]])} />
        <span style={{color:'#334155', fontSize:12}}>to</span>
        <input className="la-input" type="number" value={value[1]}
          onChange={e => onChange([value[0], parseFloat(e.target.value)||0])} />
      </div>
    </div>
  )

  const filteredBodies = catFilter === 'All' ? CELESTIAL_DATA : CELESTIAL_DATA.filter(b => b.category === catFilter)

  const plotTitle = isSpacetime && compareBody
    ? `Earth vs ${compareBody.name} — Spacetime Curvature`
    : isSpacetime
    ? "Spacetime Curvature — Earth's Gravitational Well"
    : mode === 'explicit' ? `z = ${expr}` : 'Parametric Surface'

  const spaceLayout = isSpacetime ? {
    paper_bgcolor: '#ffffff',
    scene: {
      ...DARK_LAYOUT_3D.scene,
      bgcolor: '#010409',
      xaxis: { ...DARK_LAYOUT_3D.scene.xaxis, gridcolor: '#e2e8f0', color: '#1e3a8a', showticklabels: false },
      yaxis: { ...DARK_LAYOUT_3D.scene.yaxis, gridcolor: '#e2e8f0', color: '#1e3a8a', showticklabels: false },
      zaxis: { ...DARK_LAYOUT_3D.scene.zaxis, gridcolor: '#e2e8f0', color: '#1e3a8a',
        title: { text: 'spacetime curvature', font: { color: '#1e3a8a', size: 10 } } },
      camera: compareBody ? { eye: { x: 0, y: 2.2, z: 0.9 } } : { eye: { x: 1.5, y: 1.5, z: 0.8 } },
    },
  } : {}

  return (
    <div className="la-section">
      <div className="la-sidebar">
        <div className="la-label">Mode</div>
        <div className="dim-row">
          <button className={`dim-btn ${mode==='explicit'?'active':''}`} onClick={() => setMode('explicit')}>z = f(x,y)</button>
          <button className={`dim-btn ${mode==='parametric'?'active':''}`} onClick={() => setMode('parametric')}>Parametric</button>
        </div>

        <div className="la-label" style={{marginTop:12}}>Presets</div>
        <div className="preset-wrap">
          {SURFACE_PRESETS[mode].map(p => (
            <button key={p.name} className="preset-tag" onClick={() => applyPreset(p)}>{p.name}</button>
          ))}
        </div>

        {mode === 'explicit' ? (
          <>
            <div className="la-label" style={{marginTop:12}}>z = f(x, y)</div>
            <input className="la-input" value={expr} onChange={e => setExpr(e.target.value)}
              placeholder="e.g. sin(sqrt(x^2+y^2))" />
            <RangeInput label="x range" value={xRange} onChange={setXRange} />
            <RangeInput label="y range" value={yRange} onChange={setYRange} />
          </>
        ) : (
          <>
            <div className="la-label" style={{marginTop:12}}>x(u, v)</div>
            <input className="la-input" value={xExpr} onChange={e => setXExpr(e.target.value)} placeholder="e.g. cos(u)" />
            <div className="la-label" style={{marginTop:6}}>y(u, v)</div>
            <input className="la-input" value={yExpr} onChange={e => setYExpr(e.target.value)} placeholder="e.g. sin(u)" />
            <div className="la-label" style={{marginTop:6}}>z(u, v)</div>
            <input className="la-input" value={zExpr} onChange={e => setZExpr(e.target.value)} placeholder="e.g. v" />
            <RangeInput label="u range" value={uRange} onChange={setURange} />
            <RangeInput label="v range" value={vRange} onChange={setVRange} />
          </>
        )}

        {!isSpacetime && (<>
          <div className="la-label" style={{marginTop:12}}>Color</div>
          <div className="preset-wrap">
            {COLORSCALES.map(cs => (
              <button key={cs} className={`preset-tag ${colorscale===cs?'active-cs':''}`}
                onClick={() => setColorscale(cs)}>{cs}</button>
            ))}
          </div>
          <div className="la-label" style={{marginTop:12}}>Opacity — {Math.round(opacity*100)}%</div>
          <input type="range" min="0.1" max="1" step="0.05" value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{width:'100%', accentColor:'#3b82f6'}} />
        </>)}

        {isSpacetime && (<>
          <div className="la-label" style={{marginTop:14}}>Compare with Earth</div>
          <div className="cat-tabs">
            {CELESTIAL_CATEGORIES.map(c => (
              <button key={c} className={`cat-tab ${catFilter===c?'active':''}`}
                onClick={() => setCatFilter(c)}>{c}</button>
            ))}
          </div>
          <div className="body-grid">
            {filteredBodies.map(b => (
              <button key={b.name}
                className={`body-btn ${compareBody?.name===b.name?'selected':''}`}
                onClick={() => setCompareBody(compareBody?.name===b.name ? null : b)}>
                <span className="body-dot" style={{background: b.color}} />
                <span className="body-name">{b.name}</span>
              </button>
            ))}
          </div>
          {compareBody && (
            <div className="compare-stats">
              <div className="cs-row"><span className="cs-k">Mass</span>
                <span className="cs-v" style={{color: compareBody.color}}>{fmtMass(compareBody.mass)}</span></div>
              <div className="cs-row"><span className="cs-k">Surface g</span>
                <span className="cs-v">{fmtGrav(compareBody)}</span></div>
              <div className="cs-row"><span className="cs-k">Escape v</span>
                <span className="cs-v">{fmtEsc(compareBody)}</span></div>
              <div className="cs-row"><span className="cs-k">Well depth</span>
                <span className="cs-v">{fmtWell(compareBody.mass)}</span></div>
              <div className="cs-row"><span className="cs-k">Category</span>
                <span className="cs-v">{compareBody.category}</span></div>
            </div>
          )}
        </>)}

        <button className="la-btn" style={{marginTop:12}} onClick={fetchSurface} disabled={loading}>
          {loading ? 'Computing…' : isSpacetime && compareBody ? `Compare vs ${compareBody.name}` : 'Plot Surface'}
        </button>
        {error && <div className="la-warn">{error}</div>}

        <div className="eq-card">
          {mode === 'explicit' ? (
            <>
              <div className="eq-row"><span className="eq-lhs">z</span><span className="eq-eq">=</span><span className="eq-rhs">{expr || '…'}</span></div>
              {isSpacetime && (
                <>
                  <div className="eq-row" style={{marginTop:4}}><span className="eq-lhs">Φ(r)</span><span className="eq-eq">=</span><span className="eq-rhs" style={{color:'#94a3b8'}}>−GM / r</span></div>
                  <div className="eq-domain" style={{color:'#475569'}}>Newtonian gravitational potential. The fabric bends deeper where gravity is strongest — closest to Earth.</div>
                </>
              )}
              {!isSpacetime && <div className="eq-domain">x ∈ [{xRange[0]}, {xRange[1]}],  y ∈ [{yRange[0]}, {yRange[1]}]</div>}
            </>
          ) : (
            <>
              <div className="eq-row"><span className="eq-lhs">x(u,v)</span><span className="eq-eq">=</span><span className="eq-rhs">{xExpr || '…'}</span></div>
              <div className="eq-row"><span className="eq-lhs">y(u,v)</span><span className="eq-eq">=</span><span className="eq-rhs">{yExpr || '…'}</span></div>
              <div className="eq-row"><span className="eq-lhs">z(u,v)</span><span className="eq-eq">=</span><span className="eq-rhs">{zExpr || '…'}</span></div>
              <div className="eq-domain">u ∈ [{uRange[0]}, {uRange[1]}],  v ∈ [{vRange[0]}, {vRange[1]}]</div>
            </>
          )}
        </div>
      </div>

      <div className="la-viz">
        {traces.length > 0 ? (
          <Plot
            data={traces}
            layout={{
              ...DARK_LAYOUT_3D,
              ...spaceLayout,
              title: { text: plotTitle, font: { color: isSpacetime ? '#60a5fa' : '#94a3b8', size: 12 }, x: 0.04 },
            }}
            config={PLOTLY_CONFIG}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div className="la-hint">
            {isSpacetime
              ? <>Select a celestial body above and it will plot automatically, or click <strong>Plot Surface</strong> for Earth alone.</>
              : <>Choose a preset or enter an expression, then click <strong>Plot Surface</strong>.<br/><br/>Try <em>Swiss Roll</em>, <em>Torus</em>, or <em>Möbius</em> in Parametric mode.</>
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────

const SUBTABS = [
  { id: 'vectors',   label: 'Vectors' },
  { id: 'transform', label: 'Transformations' },
  { id: 'matrix',    label: 'Matrix Operations' },
  { id: 'systems',   label: 'Systems' },
]

export default function LinearAlgebra() {
  const [sub, setSub] = useState('vectors')
  return (
    <div className="la-root">
      <div className="la-subtabs">
        {SUBTABS.map(t => (
          <button
            key={t.id}
            className={`la-subtab ${sub === t.id ? 'active' : ''}`}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="la-content">
        {sub === 'vectors'   && <VectorSection />}
        {sub === 'transform' && <TransformSection />}
        {sub === 'matrix'    && <MatrixOpsSection />}
        {sub === 'systems'   && <SystemsSection />}
      </div>
    </div>
  )
}



