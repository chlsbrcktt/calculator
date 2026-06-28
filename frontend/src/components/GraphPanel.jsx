import { useRef, useState, useEffect, useCallback } from 'react'
import API from '../api'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import './GraphPanel.css'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, zoomPlugin)

// ── Plugins ────────────────────────────────────────────────────────────────

const chartBgPlugin = {
  id: 'chartBg',
  beforeDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height)
    ctx.restore()
  },
}

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements()
    if (!active?.length) return
    const { ctx, chartArea } = chart
    const xPx = active[0].element.x
    const yPx = active[0].element.y
    ctx.save()
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(xPx, chartArea.top)
    ctx.lineTo(xPx, chartArea.bottom)
    ctx.moveTo(chartArea.left, yPx)
    ctx.lineTo(chartArea.right, yPx)
    ctx.stroke()
    ctx.restore()
  },
}

// Draws labels next to key-point datasets (datasets with _kp: true)
const keyLabelPlugin = {
  id: 'keyLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return
    chart.data.datasets.forEach((ds, di) => {
      if (!ds._kp) return
      const meta = chart.getDatasetMeta(di)
      meta.data.forEach((elem, j) => {
        const label = ds._kpLabels?.[j]
        if (!label) return
        const kind = ds._kpKinds?.[j]
        const px = elem.x
        const py = elem.y
        if (px < chartArea.left || px > chartArea.right ||
            py < chartArea.top  || py > chartArea.bottom) return

        const above = kind === 'max' || kind === 'yint'
        const screenOffset = above ? -14 : 14

        ctx.save()
        ctx.font = '10px ui-monospace, monospace'
        const tw = ctx.measureText(label).width

        // Clamp label horizontally inside chart area
        const halfW = tw / 2 + 4
        const lx = Math.max(chartArea.left + halfW, Math.min(chartArea.right - halfW, px))
        const ly = py + screenOffset

        // Pill background
        ctx.fillStyle = 'rgba(255,255,255,0.93)'
        ctx.strokeStyle = ds.borderColor + '66'
        ctx.lineWidth = 1
        ctx.beginPath()
        const bx = lx - tw / 2 - 4
        const by = above ? ly - 12 : ly - 1
        if (ctx.roundRect) ctx.roundRect(bx, by, tw + 8, 13, 3)
        else ctx.rect(bx, by, tw + 8, 13)
        ctx.fill()
        ctx.stroke()

        // Text
        ctx.fillStyle = ds.borderColor
        ctx.textAlign = 'center'
        ctx.textBaseline = above ? 'bottom' : 'top'
        ctx.fillText(label, lx, ly)
        ctx.restore()
      })
    })
  },
}

// Draws gridlines at every integer, independent of tick/label density
const fineGridPlugin = {
  id: 'fineGrid',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart
    if (!chartArea) return
    const { x: xs, y: ys } = scales
    if (!xs || !ys) return

    const xRange = Math.floor(xs.max) - Math.ceil(xs.min)
    const yRange = Math.floor(ys.max) - Math.ceil(ys.min)
    // Skip fine grid if zoomed too far out — would be visually solid
    if (xRange > 120 || yRange > 120) return

    ctx.save()
    for (let v = Math.ceil(xs.min); v <= Math.floor(xs.max); v++) {
      const px = xs.getPixelForValue(v)
      ctx.beginPath()
      ctx.strokeStyle = v === 0 ? '#9ca3af' : '#e5e7eb'
      ctx.lineWidth   = v === 0 ? 1.5 : 1
      ctx.moveTo(px, chartArea.top)
      ctx.lineTo(px, chartArea.bottom)
      ctx.stroke()
    }
    for (let v = Math.ceil(ys.min); v <= Math.floor(ys.max); v++) {
      const py = ys.getPixelForValue(v)
      ctx.beginPath()
      ctx.strokeStyle = v === 0 ? '#9ca3af' : '#e5e7eb'
      ctx.lineWidth   = v === 0 ? 1.5 : 1
      ctx.moveTo(chartArea.left,  py)
      ctx.lineTo(chartArea.right, py)
      ctx.stroke()
    }
    ctx.restore()
  },
}

ChartJS.register(chartBgPlugin, crosshairPlugin, keyLabelPlugin, fineGridPlugin)

// ── Key-point detection ────────────────────────────────────────────────────

function fmt(n) {
  if (Math.abs(n) < 0.005) return '0'
  if (Number.isInteger(n)) return String(n)
  return Number(n.toFixed(2)).toString()
}

function findKeyPoints(points) {
  if (!points || points.length < 3) return []
  const valid = points.filter(p => p.y !== null && p.y !== undefined && isFinite(p.y))
  if (valid.length < 3) return []

  const result = []
  const seen = new Set()
  const add = (pt) => {
    const key = `${pt.kind}:${Math.round(pt.x * 20)}`
    if (!seen.has(key)) { seen.add(key); result.push(pt) }
  }

  // Y-intercept — interpolate at x = 0
  for (let i = 0; i < valid.length - 1; i++) {
    const p1 = valid[i], p2 = valid[i + 1]
    if (p1.x <= 0 && p2.x >= 0) {
      const t = (0 - p1.x) / (p2.x - p1.x)
      const y = p1.y + t * (p2.y - p1.y)
      if (isFinite(y)) add({ x: 0, y, label: `(0, ${fmt(y)})`, kind: 'yint' })
      break
    }
  }

  // X-intercepts — sign changes in y
  for (let i = 0; i < valid.length - 1; i++) {
    const p1 = valid[i], p2 = valid[i + 1]
    if (p1.y * p2.y < 0) {
      const t = -p1.y / (p2.y - p1.y)
      const x = p1.x + t * (p2.x - p1.x)
      if (isFinite(x)) add({ x, y: 0, label: `(${fmt(x)}, 0)`, kind: 'xint' })
    }
  }

  // Local extrema — sign change in first difference
  for (let i = 1; i < valid.length - 1; i++) {
    const dy1 = valid[i].y - valid[i - 1].y
    const dy2 = valid[i + 1].y - valid[i].y
    if (dy1 * dy2 < 0) {
      const kind = dy1 > 0 ? 'max' : 'min'
      add({ x: valid[i].x, y: valid[i].y, label: `${kind} (${fmt(valid[i].x)}, ${fmt(valid[i].y)})`, kind })
    }
  }

  return result
}

// ── Numerical derivatives ──────────────────────────────────────────────────

function numericalDeriv(points) {
  const out = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.y === null || p.y === undefined || !isFinite(p.y)) {
      out.push({ x: p.x, y: null }); continue
    }
    const prev = i > 0 ? points[i - 1] : null
    const next = i < points.length - 1 ? points[i + 1] : null
    if (prev && next &&
        prev.y !== null && prev.y !== undefined && isFinite(prev.y) &&
        next.y !== null && next.y !== undefined && isFinite(next.y)) {
      out.push({ x: p.x, y: (next.y - prev.y) / (next.x - prev.x) })
    } else {
      out.push({ x: p.x, y: null })
    }
  }
  return out
}

function buildDerivDatasets(plotData, functions, colors, order, derivExprs) {
  const datasets = []
  if (!plotData) return datasets
  plotData.forEach((result, i) => {
    if (!result.points?.length) return
    if (!functions[i]?.expression.trim() || !functions[i]?.enabled) return
    let pts = result.points
    for (let d = 0; d < order; d++) pts = numericalDeriv(pts)
    const segments = []
    let current = []
    for (const pt of pts) {
      if (pt.y === null || !isFinite(pt.y)) {
        if (current.length > 1) segments.push(current)
        current = []
      } else {
        current.push({ x: pt.x, y: pt.y })
      }
    }
    if (current.length > 1) segments.push(current)
    const color = colors[i]
    const prime = order === 1 ? '′' : '″'
    const expr = derivExprs?.[i]
    const label = expr ? `f${i + 1}${prime}(x) = ${expr}` : `f${i + 1}${prime}(x)`
    segments.forEach((seg, si) => {
      datasets.push({
        label: si === 0 ? label : null,
        data: seg,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#0b0f1a',
        pointHoverBorderWidth: 2,
        tension: 0,
        parsing: false,
        showLine: true,
        spanGaps: false,
      })
    })
  })
  return datasets
}

// ── Dataset builder ────────────────────────────────────────────────────────

function buildDatasets(plotData, functions, colors, showKeyPoints, xMin, xMax, verticals) {
  const datasets = []

  // Vertical lines (x = c) — rendered as tall two-point segments
  if (verticals) {
    verticals.forEach((vx, i) => {
      if (vx === null || vx === undefined) return
      if (!functions[i]?.enabled) return
      const color = colors[i]
      datasets.push({
        label: null,
        data: [{ x: vx, y: -1e9 }, { x: vx, y: 1e9 }],
        borderColor: color + '28',
        borderWidth: 12,
        pointRadius: 0,
        tension: 0,
        parsing: false,
        showLine: true,
        spanGaps: false,
      })
      datasets.push({
        label: `f${i + 1}: x = ${vx}`,
        data: [{ x: vx, y: -1e9 }, { x: vx, y: 1e9 }],
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2.2,
        pointRadius: 0,
        tension: 0,
        parsing: false,
        showLine: true,
        spanGaps: false,
      })
    })
  }

  if (!plotData) return datasets

  plotData.forEach((result, i) => {
    if (!result.points?.length) return
    if (!functions[i]?.expression.trim() || !functions[i]?.enabled) return

    const segments = []
    let current = []
    for (const pt of result.points) {
      if (pt.y === null || pt.y === undefined) {
        if (current.length > 1) segments.push(current)
        current = []
      } else {
        current.push({ x: pt.x, y: pt.y })
      }
    }
    if (current.length > 1) segments.push(current)

    const color = colors[i]
    const label = `f${i + 1}(x) = ${functions[i].expression}`

    segments.forEach((seg, si) => {
      datasets.push({
        label: null,
        data: seg,
        borderColor: color + '28',
        borderWidth: 12,
        pointRadius: 0,
        tension: 0,
        parsing: false,
        showLine: true,
        spanGaps: false,
      })
      datasets.push({
        label: si === 0 ? label : null,
        data: seg,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2.2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#0b0f1a',
        pointHoverBorderWidth: 2,
        tension: 0,
        parsing: false,
        showLine: true,
        spanGaps: false,
      })
    })

    // Key points — only within the visible x range
    if (showKeyPoints) {
      const visible = result.points.filter(
        p => p.x >= xMin - 0.5 && p.x <= xMax + 0.5 &&
             p.y !== null && p.y !== undefined && isFinite(p.y)
      )
      const kpts = findKeyPoints(visible)
      if (kpts.length > 0) {
        datasets.push({
          label: null,
          data: kpts.map(p => ({ x: p.x, y: p.y })),
          _kp: true,
          _kpLabels: kpts.map(p => p.label),
          _kpKinds: kpts.map(p => p.kind),
          borderColor: color,
          backgroundColor: color,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
          showLine: false,
          parsing: false,
        })
      }
    }
  })

  return datasets
}

// ── Derivative sub-chart ───────────────────────────────────────────────────

const DERIV_TICK_OPTS = {
  color: '#64748b',
  font: { size: 11, family: 'ui-monospace, Consolas, monospace' },
  padding: 6,
  autoSkip: true,
  autoSkipPadding: 20,
  maxTicksLimit: 8,
}

function DerivChart({ plotData, functions, colors, view, order, derivExprs, lineRef, zoomCfg }) {
  const datasets = buildDerivDatasets(plotData, functions, colors, order, derivExprs)
  const hasData = datasets.length > 0
  const label = order === 1 ? "f′(x)" : "f″(x)"

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'linear', min: view.x0, max: view.x1,
        grid: { display: false },
        ticks: { ...DERIV_TICK_OPTS, maxRotation: 0, maxTicksLimit: 21 },
        border: { display: false },
      },
      y: {
        type: 'linear', min: view.y0, max: view.y1,
        grid: { display: false },
        ticks: { ...DERIV_TICK_OPTS },
        border: { display: false },
      },
    },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'start',
        labels: {
          color: '#475569',
          font: { size: 11, family: 'ui-monospace, Consolas, monospace' },
          boxWidth: 20, boxHeight: 2, padding: 16, usePointStyle: false,
          filter: item => item.text !== null,
        },
      },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#94a3b8',
        bodyColor: '#f8fafc', borderColor: '#334155',
        borderWidth: 1, padding: 8, cornerRadius: 6,
        callbacks: {
          title: items => `x = ${items[0]?.parsed.x?.toFixed(4)}`,
          label: ctx => ctx.dataset.label === null ? null
            : ` ${ctx.dataset.label.split('=')[0].trim()} = ${ctx.parsed.y?.toFixed(4)}`,
        },
        filter: item => item.dataset.label !== null,
      },
      zoom: zoomCfg,
    },
  }

  return (
    <div className="deriv-panel">
      <div className="deriv-header">
        <span className="deriv-title">{label}</span>
      </div>
      <div className={`graph-canvas-wrap ${!hasData ? 'faded' : ''}`}>
        <div className="graph-canvas-inner">
          <Line ref={lineRef} data={{ datasets }} options={options} />
        </div>
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GraphPanel({ plotData, functions, colors, xMin, xMax, loading, error, verticals }) {
  const chartRef = useRef(null)
  const d1Ref    = useRef(null)
  const d2Ref    = useRef(null)
  const [showKeyPoints, setShowKeyPoints] = useState(false)
  const [d1Exprs, setD1Exprs] = useState([null, null, null])
  const [d2Exprs, setD2Exprs] = useState([null, null, null])
  const [activeChart, setActiveChart] = useState('main')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Shared view bounds for all three charts — updating this syncs them all
  const [view, setView] = useState({ x0: xMin, x1: xMax, y0: xMin, y1: xMax })

  // When the range inputs change, reset view to the new defaults
  useEffect(() => {
    setView({ x0: xMin, x1: xMax, y0: xMin, y1: xMax })
  }, [xMin, xMax])

  // Called by any chart's onZoomComplete / onPanComplete — reads that chart's
  // current scale and pushes it to all three charts via React state
  const onSync = useCallback(({ chart }) => {
    setView({
      x0: chart.scales.x.min,
      x1: chart.scales.x.max,
      y0: chart.scales.y.min,
      y1: chart.scales.y.max,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    functions.forEach(async (fn, i) => {
      const expr = fn.expression.trim()
      if (!expr || !fn.enabled) {
        if (!cancelled) {
          setD1Exprs(p => p.map((v, j) => j === i ? null : v))
          setD2Exprs(p => p.map((v, j) => j === i ? null : v))
        }
        return
      }
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}/differentiate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expression: expr, order: 1 }),
          }).then(r => r.json()),
          fetch(`${API}/differentiate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expression: expr, order: 2 }),
          }).then(r => r.json()),
        ])
        if (!cancelled) {
          setD1Exprs(p => p.map((v, j) => j === i ? r1.derivative : v))
          setD2Exprs(p => p.map((v, j) => j === i ? r2.derivative : v))
        }
      } catch { /* silent */ }
    })
    return () => { cancelled = true }
  }, [functions.map(f => f.expression + f.enabled).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Shared zoom config — limits only restrict minimum zoom range (not max),
  // so zooming out is unlimited in both axes
  const zoomCfg = {
    pan: { enabled: true, mode: 'xy', cursor: 'grab' },
    zoom: { wheel: { enabled: true, speed: 0.08 }, pinch: { enabled: true }, mode: 'xy' },
    limits: { x: { minRange: 0.001 }, y: { minRange: 0.001 } },
    onZoomComplete: onSync,
    onPanComplete: onSync,
  }

  const datasets = buildDatasets(plotData, functions, colors, showKeyPoints, xMin, xMax, verticals)
  const hasData = datasets.length > 0

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 120 },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'linear', min: view.x0, max: view.x1,
        grid: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 11, family: 'ui-monospace, Consolas, monospace' },
          padding: 6, maxRotation: 0, autoSkip: true, autoSkipPadding: 20, maxTicksLimit: 21,
        },
        border: { display: false },
      },
      y: {
        type: 'linear', min: view.y0, max: view.y1,
        grid: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 11, family: 'ui-monospace, Consolas, monospace' },
          padding: 6, autoSkip: true, autoSkipPadding: 20, maxTicksLimit: 21,
        },
        border: { display: false },
      },
    },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'start',
        labels: {
          color: '#475569',
          font: { size: 12, family: 'ui-monospace, Consolas, monospace' },
          boxWidth: 24, boxHeight: 3, padding: 20, usePointStyle: false,
          filter: (item) => item.text !== null,
        },
      },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#94a3b8',
        bodyColor: '#f8fafc', borderColor: '#334155',
        borderWidth: 1, padding: 10, cornerRadius: 6,
        callbacks: {
          title: (items) => `x = ${items[0]?.parsed.x?.toFixed(4)}`,
          label: (ctx) => {
            if (ctx.dataset.label === null) return null
            return ` ${ctx.dataset.label.split('=')[0].trim()} = ${ctx.parsed.y?.toFixed(4)}`
          },
        },
        filter: (item) => item.dataset.label !== null,
      },
      zoom: zoomCfg,
    },
  }

  const handleReset = () => setView({ x0: xMin, x1: xMax, y0: xMin, y1: xMax })
  const handleZoomIn  = () => chartRef.current?.zoom(1.3)
  const handleZoomOut = () => chartRef.current?.zoom(0.77)

  const d1Datasets = buildDerivDatasets(plotData, functions, colors, 1, d1Exprs)
  const d2Datasets = buildDerivDatasets(plotData, functions, colors, 2, d2Exprs)

  const derivOpts = (order) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { type: 'linear', min: view.x0, max: view.x1, grid: { display: false }, ticks: { ...DERIV_TICK_OPTS, maxRotation: 0, maxTicksLimit: 21 }, border: { display: false } },
      y: { type: 'linear', min: view.y0, max: view.y1, grid: { display: false }, ticks: { ...DERIV_TICK_OPTS }, border: { display: false } },
    },
    plugins: {
      legend: {
        display: true, position: 'top', align: 'start',
        labels: { color: '#475569', font: { size: 11, family: 'ui-monospace, Consolas, monospace' }, boxWidth: 20, boxHeight: 2, padding: 16, usePointStyle: false, filter: item => item.text !== null },
      },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f8fafc', borderColor: '#334155', borderWidth: 1, padding: 8, cornerRadius: 6,
        callbacks: { title: items => `x = ${items[0]?.parsed.x?.toFixed(4)}`, label: ctx => ctx.dataset.label === null ? null : ` ${ctx.dataset.label.split('=')[0].trim()} = ${ctx.parsed.y?.toFixed(4)}` },
        filter: item => item.dataset.label !== null,
      },
      zoom: zoomCfg,
    },
  })

  return (
    <>
      <div className="graph-panel">
        {isMobile && (
          <div className="graph-chart-tabs">
            {[['main', 'f(x)'], ['d1', "f′(x)"], ['d2', "f″(x)"]].map(([id, label]) => (
              <button key={id} className={`graph-chart-tab${activeChart === id ? ' active' : ''}`} onClick={() => setActiveChart(id)}>{label}</button>
            ))}
          </div>
        )}

        {loading && <div className="graph-status">Computing...</div>}

        {(!isMobile || activeChart === 'main') && <>
          <div className="graph-toolbar">
            <button className="graph-btn" onClick={handleReset} title="Reset zoom">↺ Reset</button>
            <button className="graph-btn" onClick={handleZoomIn} title="Zoom in">+</button>
            <button className="graph-btn" onClick={handleZoomOut} title="Zoom out">-</button>
            <span className="graph-toolbar-sep" />
            <label className="kp-toggle">
              <input type="checkbox" checked={showKeyPoints} onChange={e => setShowKeyPoints(e.target.checked)} />
              Key points
            </label>
            <span className="graph-hint">Scroll to zoom · Drag to pan</span>
          </div>
          {error && <div className="graph-error">{error}</div>}
          {!hasData && !loading && !error && <div className="graph-empty">Enter a function to see its graph</div>}
          <div className={`graph-canvas-wrap ${!hasData ? 'faded' : ''}`}>
            <div className="graph-canvas-inner">
              <Line ref={chartRef} data={{ datasets }} options={options} />
            </div>
          </div>
        </>}

        {isMobile && activeChart === 'd1' && (
          <div className={`graph-canvas-wrap ${d1Datasets.length === 0 ? 'faded' : ''}`}>
            <div className="graph-canvas-inner">
              <Line ref={d1Ref} data={{ datasets: d1Datasets }} options={derivOpts(1)} />
            </div>
          </div>
        )}

        {isMobile && activeChart === 'd2' && (
          <div className={`graph-canvas-wrap ${d2Datasets.length === 0 ? 'faded' : ''}`}>
            <div className="graph-canvas-inner">
              <Line ref={d2Ref} data={{ datasets: d2Datasets }} options={derivOpts(2)} />
            </div>
          </div>
        )}
      </div>

      {!isMobile && <>
        <DerivChart plotData={plotData} functions={functions} colors={colors} view={view} order={1} derivExprs={d1Exprs} lineRef={d1Ref} zoomCfg={zoomCfg} />
        <DerivChart plotData={plotData} functions={functions} colors={colors} view={view} order={2} derivExprs={d2Exprs} lineRef={d2Ref} zoomCfg={zoomCfg} />
      </>}
    </>
  )
}
