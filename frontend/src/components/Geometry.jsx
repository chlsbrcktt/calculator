import { useState, useRef, useEffect, memo } from 'react'
import Plotly from 'plotly.js-dist-min'
import './Geometry.css'
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

const fmt = v => isFinite(v) ? v.toFixed(4).replace(/\.?0+$/, '') : '—'
const deg = r => r * 180 / Math.PI
const rad = d => d * Math.PI / 180

// ─── Triangle Section ─────────────────────────────────────────────────────────
const TRIANGLE_MODES = ['SSS', 'SAS', 'ASA', 'AAS', 'Right']

function solveTriangle(mode, inputs) {
  try {
    let a, b, c, A, B, C
    const i = inputs
    if (mode === 'SSS') {
      a = +i.a; b = +i.b; c = +i.c
      if (a <= 0 || b <= 0 || c <= 0) return null
      if (a + b <= c || a + c <= b || b + c <= a) return null
      A = Math.acos((b*b + c*c - a*a) / (2*b*c))
      B = Math.acos((a*a + c*c - b*b) / (2*a*c))
      C = Math.PI - A - B
    } else if (mode === 'SAS') {
      a = +i.a; b = +i.b; C = rad(+i.C)
      if (a <= 0 || b <= 0 || C <= 0 || C >= Math.PI) return null
      c = Math.sqrt(a*a + b*b - 2*a*b*Math.cos(C))
      A = Math.acos((b*b + c*c - a*a) / (2*b*c))
      B = Math.PI - A - C
    } else if (mode === 'ASA') {
      A = rad(+i.A); B = rad(+i.B); c = +i.c
      if (A <= 0 || B <= 0 || c <= 0 || A + B >= Math.PI) return null
      C = Math.PI - A - B
      a = c * Math.sin(A) / Math.sin(C)
      b = c * Math.sin(B) / Math.sin(C)
    } else if (mode === 'AAS') {
      A = rad(+i.A); B = rad(+i.B); a = +i.a
      if (A <= 0 || B <= 0 || a <= 0 || A + B >= Math.PI) return null
      C = Math.PI - A - B
      b = a * Math.sin(B) / Math.sin(A)
      c = a * Math.sin(C) / Math.sin(A)
    } else if (mode === 'Right') {
      // right angle at C; give a and b (legs)
      a = +i.a; b = +i.b
      if (a <= 0 || b <= 0) return null
      c = Math.sqrt(a*a + b*b)
      C = Math.PI / 2
      A = Math.atan2(a, b)
      B = Math.PI / 2 - A
    }
    if (!isFinite(a) || !isFinite(b) || !isFinite(c)) return null
    const s = (a + b + c) / 2
    const area = Math.sqrt(s * (s-a) * (s-b) * (s-c))
    const R = (a * b * c) / (4 * area)    // circumradius
    const r_in = area / s                  // inradius
    return { a, b, c, A, B, C, area, perimeter: a+b+c, R, r_in }
  } catch { return null }
}

function triangleViz(sol) {
  if (!sol) return []
  const { a, b, c, A, B, C } = sol
  // Place: vertex A at origin, vertex B at (c,0), compute C
  const Bx = c, By = 0
  const Cx = b * Math.cos(A), Cy = b * Math.sin(A)
  const xs = [0, Bx, Cx, 0], ys = [0, By, Cy, 0]

  const BLUE = '#3b82f6', GREEN = '#4ade80', AMBER = '#f59e0b'
  const traces = []

  // Triangle fill
  traces.push({
    type: 'scatter', x: xs, y: ys, mode: 'lines',
    fill: 'toself', fillcolor: 'rgba(59,130,246,0.07)',
    line: { color: BLUE, width: 2 },
    hoverinfo: 'skip', showlegend: false,
  })

  // Side labels (midpoints)
  const midLabel = (x1,y1,x2,y2,text,col) => ({
    type: 'scatter',
    x: [(x1+x2)/2 + (y2-y1)*0.08], y: [(y1+y2)/2 + (x1-x2)*0.08],
    mode: 'text', text: [text],
    textfont: { color: col, size: 12, family: 'ui-monospace,monospace' },
    hoverinfo: 'skip', showlegend: false,
  })
  traces.push(midLabel(0,0, Bx,By, `c=${fmt(c)}`, BLUE))
  traces.push(midLabel(0,0, Cx,Cy, `b=${fmt(b)}`, GREEN))
  traces.push(midLabel(Bx,By, Cx,Cy, `a=${fmt(a)}`, AMBER))

  // Vertex angle labels
  const vLabel = (x,y,text,dx,dy) => ({
    type: 'scatter', x: [x+dx], y: [y+dy], mode: 'text', text: [text],
    textfont: { color: '#94a3b8', size: 11 },
    hoverinfo: 'skip', showlegend: false,
  })
  traces.push(vLabel(0,   0,   `A=${fmt(deg(A))}°`, -0.06*c, -0.04*b))
  traces.push(vLabel(Bx,  By,  `B=${fmt(deg(B))}°`,  0.04*c, -0.04*b))
  traces.push(vLabel(Cx,  Cy,  `C=${fmt(deg(C))}°`,  0,       0.05*b))

  // Right-angle marker
  if (Math.abs(C - Math.PI/2) < 0.01) {
    const sz = Math.min(a, b) * 0.08
    traces.push({
      type: 'scatter',
      x: [Cx, Cx+sz*(Bx-Cx)/b, Cx+sz*(Bx-Cx)/b + sz*(0-Cx)/b],
      y: [Cy, Cy+sz*(By-Cy)/b, Cy+sz*(By-Cy)/b + sz*(0-Cy)/b],
      mode: 'lines', line: { color: '#475569', width: 1.5 },
      hoverinfo: 'skip', showlegend: false,
    })
  }

  return traces
}

const TRI_INPUTS = {
  SSS: [['a','Side a'],['b','Side b'],['c','Side c']],
  SAS: [['a','Side a'],['b','Side b'],['C','Angle C (°)']],
  ASA: [['A','Angle A (°)'],['B','Angle B (°)'],['c','Side c']],
  AAS: [['A','Angle A (°)'],['B','Angle B (°)'],['a','Side a']],
  Right:[['a','Leg a'],['b','Leg b']],
}

const TRI_DEFAULTS = {
  SSS: {a:'3',b:'4',c:'5'}, SAS: {a:'5',b:'7',C:'60'},
  ASA: {A:'45',B:'60',c:'8'}, AAS: {A:'30',B:'90',a:'5'},
  Right:{a:'3',b:'4'},
}

function TriangleSection() {
  const [mode, setMode] = useState('SSS')
  const [inputs, setInputs] = useState(TRI_DEFAULTS.SSS)

  const sol = solveTriangle(mode, inputs)
  const traces = triangleViz(sol)

  const layout = {
    paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
    margin: { t: 40, b: 40, l: 40, r: 40 },
    xaxis: { autorange: true, showgrid: false, zeroline: false, showticklabels: false, scaleanchor: 'y', scaleratio: 1 },
    yaxis: { autorange: true, showgrid: false, zeroline: false, showticklabels: false },
    showlegend: false,
  }

  const switchMode = m => { setMode(m); setInputs(TRI_DEFAULTS[m]) }
  const set = (k, v) => setInputs(prev => ({ ...prev, [k]: v }))

  return (
    <div className="geo-section">
      <div className="geo-sidebar">
        <div className="la-label">Mode</div>
        <div className="geo-mode-row">
          {TRIANGLE_MODES.map(m => (
            <button key={m} className={`geo-mode-btn ${mode===m?'active':''}`}
              onClick={() => switchMode(m)}>{m}</button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>Inputs</div>
        {TRI_INPUTS[mode].map(([k, label]) => (
          <div key={k} style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{color:'#475569',fontSize:11,minWidth:90}}>{label}</span>
            <input className="la-input" type="number" value={inputs[k]||''}
              onChange={e => set(k, e.target.value)} step="any" />
          </div>
        ))}

        {sol ? (
          <>
            <div className="geo-results" style={{marginTop:8}}>
              <div className="geo-res-row"><span className="geo-res-k">Sides</span>
                <span className="geo-res-v">a={fmt(sol.a)}  b={fmt(sol.b)}  c={fmt(sol.c)}</span></div>
              <div className="geo-res-row"><span className="geo-res-k">Angles</span>
                <span className="geo-res-v">A={fmt(deg(sol.A))}°  B={fmt(deg(sol.B))}°  C={fmt(deg(sol.C))}°</span></div>
              <div className="geo-res-row"><span className="geo-res-k">Area</span>
                <span className="geo-res-v">{fmt(sol.area)}</span></div>
              <div className="geo-res-row"><span className="geo-res-k">Perimeter</span>
                <span className="geo-res-v">{fmt(sol.perimeter)}</span></div>
              <div className="geo-res-row"><span className="geo-res-k">Circumradius R</span>
                <span className="geo-res-v">{fmt(sol.R)}</span></div>
              <div className="geo-res-row"><span className="geo-res-k">Inradius r</span>
                <span className="geo-res-v">{fmt(sol.r_in)}</span></div>
            </div>

            <div className="geo-eq-list">
              <div className="geo-eq-card">
                <div className="geo-eq-name">Law of Cosines</div>
                <div className="geo-eq-formula">c² = a² + b² − 2ab·cos(C)</div>
                <div className="geo-eq-value">
                  {fmt(sol.c*sol.c)} = {fmt(sol.a*sol.a)} + {fmt(sol.b*sol.b)} − {fmt(2*sol.a*sol.b*Math.cos(sol.C))}
                </div>
              </div>
              <div className="geo-eq-card">
                <div className="geo-eq-name">Law of Sines</div>
                <div className="geo-eq-formula">a/sin(A) = b/sin(B) = c/sin(C)</div>
                <div className="geo-eq-value">
                  {fmt(sol.a/Math.sin(sol.A))} = {fmt(sol.b/Math.sin(sol.B))} = {fmt(sol.c/Math.sin(sol.C))}
                </div>
              </div>
              <div className="geo-eq-card">
                <div className="geo-eq-name">Heron's Formula</div>
                <div className="geo-eq-formula">Area = √(s(s−a)(s−b)(s−c)),  s=(a+b+c)/2</div>
                <div className="geo-eq-value">s = {fmt((sol.a+sol.b+sol.c)/2)},  Area = {fmt(sol.area)}</div>
              </div>
              <div className="geo-eq-card">
                <div className="geo-eq-name">Circumradius</div>
                <div className="geo-eq-formula">R = abc / (4·Area)</div>
                <div className="geo-eq-value">{fmt(sol.R)}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="la-warn" style={{marginTop:8}}>Invalid triangle — check inputs.</div>
        )}
      </div>

      <div className="geo-viz">
        {traces.length > 0
          ? <Plot data={traces} layout={layout} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ flex: 1 }} />
          : <div className="geo-hint">Enter valid triangle dimensions to visualize.</div>
        }
      </div>
    </div>
  )
}

// ─── Shapes Section ───────────────────────────────────────────────────────────
const SHAPES = [
  { id: 'circle',    label: 'Circle',    icon: '⬤' },
  { id: 'rectangle', label: 'Rectangle', icon: '▬' },
  { id: 'polygon',   label: 'Polygon',   icon: '⬡' },
  { id: 'ellipse',   label: 'Ellipse',   icon: '⬭' },
]

function ShapesSection() {
  const [shape, setShape] = useState('circle')
  const [inputs, setInputs] = useState({ r:'5', w:'6', h:'4', n:'6', s:'5', a:'6', b:'3' })
  const set = (k,v) => setInputs(p => ({...p,[k]:v}))

  let traces = [], results = [], equations = []
  const N = 200

  if (shape === 'circle') {
    const r = +inputs.r
    const xs = Array.from({length:N+1},(_,i)=>r*Math.cos(2*Math.PI*i/N))
    const ys = Array.from({length:N+1},(_,i)=>r*Math.sin(2*Math.PI*i/N))
    traces = [{type:'scatter',x:xs,y:ys,mode:'lines',fill:'toself',
      fillcolor:'rgba(59,130,246,0.1)',line:{color:'#3b82f6',width:2},
      hoverinfo:'skip',showlegend:false}]
    results = [['Radius','r = '+r],['Diameter','d = '+fmt(2*r)],['Circumference','C = '+fmt(2*Math.PI*r)],['Area','A = '+fmt(Math.PI*r*r)]]
    equations = [['Area','A = π·r²','= '+fmt(Math.PI*r*r)],['Circumference','C = 2·π·r','= '+fmt(2*Math.PI*r)]]
  } else if (shape === 'rectangle') {
    const w = +inputs.w, h = +inputs.h
    traces = [{type:'scatter',x:[0,w,w,0,0],y:[0,0,h,h,0],mode:'lines',
      fill:'toself',fillcolor:'rgba(74,222,128,0.1)',line:{color:'#4ade80',width:2},
      hoverinfo:'skip',showlegend:false}]
    const diag = Math.sqrt(w*w+h*h)
    results = [['Width','w = '+w],['Height','h = '+h],['Perimeter','P = '+fmt(2*(w+h))],['Area','A = '+fmt(w*h)],['Diagonal','d = '+fmt(diag)]]
    equations = [['Area','A = w · h','= '+fmt(w*h)],['Perimeter','P = 2(w+h)','= '+fmt(2*(w+h))],['Diagonal','d = √(w²+h²)','= '+fmt(diag)]]
  } else if (shape === 'polygon') {
    const n = Math.max(3, Math.min(24, Math.round(+inputs.n)))
    const s = +inputs.s
    const R = s / (2 * Math.sin(Math.PI/n))
    const xs = Array.from({length:n+1},(_,i)=>R*Math.cos(2*Math.PI*i/n - Math.PI/2))
    const ys = Array.from({length:n+1},(_,i)=>R*Math.sin(2*Math.PI*i/n - Math.PI/2))
    traces = [{type:'scatter',x:xs,y:ys,mode:'lines',fill:'toself',
      fillcolor:'rgba(245,158,11,0.1)',line:{color:'#f59e0b',width:2},
      hoverinfo:'skip',showlegend:false}]
    const area = (n*s*s)/(4*Math.tan(Math.PI/n))
    const perim = n*s
    results = [['Sides','n = '+n],['Side length','s = '+s],['Circumradius','R = '+fmt(R)],['Perimeter','P = '+fmt(perim)],['Area','A = '+fmt(area)]]
    equations = [['Area',`A = (n·s²) / (4·tan(π/n))`,'= '+fmt(area)],['Circumradius','R = s / (2·sin(π/n))','= '+fmt(R)]]
  } else if (shape === 'ellipse') {
    const a = +inputs.a, b = +inputs.b
    const xs = Array.from({length:N+1},(_,i)=>a*Math.cos(2*Math.PI*i/N))
    const ys = Array.from({length:N+1},(_,i)=>b*Math.sin(2*Math.PI*i/N))
    traces = [{type:'scatter',x:xs,y:ys,mode:'lines',fill:'toself',
      fillcolor:'rgba(167,139,250,0.1)',line:{color:'#a78bfa',width:2},
      hoverinfo:'skip',showlegend:false}]
    const C_approx = Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)))  // Ramanujan
    const ecc = Math.sqrt(1-(Math.min(a,b)/Math.max(a,b))**2)
    results = [['Semi-major a','a = '+a],['Semi-minor b','b = '+b],['Eccentricity','e = '+fmt(ecc)],['Perimeter','≈ '+fmt(C_approx)],['Area','A = '+fmt(Math.PI*a*b)]]
    equations = [['Area','A = π·a·b','= '+fmt(Math.PI*a*b)],['Eccentricity','e = √(1−(b/a)²)','= '+fmt(ecc)],['Perimeter (Ramanujan)','C ≈ π[3(a+b)−√((3a+b)(a+3b))]','≈ '+fmt(C_approx)]]
  }

  const layout = {
    paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
    margin: { t: 40, b: 40, l: 40, r: 40 },
    xaxis: { autorange: true, showgrid: false, zeroline: false, showticklabels: false, scaleanchor: 'y', scaleratio: 1 },
    yaxis: { autorange: true, showgrid: false, zeroline: false, showticklabels: false },
    showlegend: false,
  }

  return (
    <div className="geo-section">
      <div className="geo-sidebar">
        <div className="la-label">Shape</div>
        <div className="shape-grid">
          {SHAPES.map(s => (
            <button key={s.id} className={`shape-btn ${shape===s.id?'active':''}`} onClick={() => setShape(s.id)}>
              <span className="shape-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="la-label" style={{marginTop:10}}>Dimensions</div>
        {shape==='circle'    && <><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Radius</span><input className="la-input" type="number" value={inputs.r} onChange={e=>set('r',e.target.value)} /></>}
        {shape==='rectangle' && <><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Width</span><input className="la-input" type="number" value={inputs.w} onChange={e=>set('w',e.target.value)} /><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Height</span><input className="la-input" type="number" value={inputs.h} onChange={e=>set('h',e.target.value)} /></>}
        {shape==='polygon'   && <><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Number of sides</span><input className="la-input" type="number" min="3" max="24" value={inputs.n} onChange={e=>set('n',e.target.value)} /><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Side length</span><input className="la-input" type="number" value={inputs.s} onChange={e=>set('s',e.target.value)} /></>}
        {shape==='ellipse'   && <><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Semi-major (a)</span><input className="la-input" type="number" value={inputs.a} onChange={e=>set('a',e.target.value)} /><span className="la-label" style={{marginTop:4,color:'#64748b',textTransform:'none',fontWeight:400,fontSize:12}}>Semi-minor (b)</span><input className="la-input" type="number" value={inputs.b} onChange={e=>set('b',e.target.value)} /></>}

        <div className="geo-results" style={{marginTop:8}}>
          {results.map(([k,v]) => (
            <div key={k} className="geo-res-row">
              <span className="geo-res-k">{k}</span>
              <span className="geo-res-v">{v}</span>
            </div>
          ))}
        </div>

        <div className="geo-eq-list">
          {equations.map(([name,formula,value]) => (
            <div key={name} className="geo-eq-card">
              <div className="geo-eq-name">{name}</div>
              <div className="geo-eq-formula">{formula}</div>
              <div className="geo-eq-value">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="geo-viz">
        <Plot data={traces} layout={layout} config={{ displayModeBar: 'hover', modeBarButtonsToRemove: ['toImage','select2d','lasso2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'] }} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const SUBTABS = [
  { id: 'triangle', label: 'Triangle' },
  { id: 'shapes',   label: 'Shapes' },
]

export default function Geometry() {
  const [sub, setSub] = useState('triangle')
  return (
    <div className="geo-root la-root">
      <div className="la-subtabs">
        {SUBTABS.map(t => (
          <button key={t.id} className={`la-subtab ${sub===t.id?'active':''}`} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="la-content">
        {sub === 'triangle' && <TriangleSection />}
        {sub === 'shapes'   && <ShapesSection />}
      </div>
    </div>
  )
}


