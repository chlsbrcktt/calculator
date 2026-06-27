import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import API from './api'
import GraphPanel from './components/GraphPanel'
import FunctionInputs from './components/FunctionInputs'
import AnalysisPanel from './components/AnalysisPanel'
import './App.css'

const LinearAlgebra    = lazy(() => import('./components/LinearAlgebra'))
const Geometry         = lazy(() => import('./components/Geometry'))
const CalculusSurfaces = lazy(() => import('./components/CalculusSurfaces'))
const Statistics       = lazy(() => import('./components/Statistics'))
const Physics          = lazy(() => import('./components/Physics'))

const TABS = [
  { id: 'functions', label: 'Functions' },
  { id: 'geometry',  label: 'Geometry' },
  { id: 'linalg',    label: 'Linear Algebra' },
  { id: 'calculus',  label: 'Calculus & Surfaces' },
  { id: 'stats',     label: 'Statistics' },
  { id: 'physics',   label: 'Physics' },
]

export const COLORS = ['#4f8ef7', '#f76c4f', '#4fcf6c']
const COLOR_NAMES = ['Blue', 'Red', 'Green']

const DEFAULT_FUNCTIONS = [
  { expression: 'x^2 - 4', enabled: true },
  { expression: '', enabled: true },
  { expression: '', enabled: true },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('functions')
  const [functions, setFunctions] = useState(DEFAULT_FUNCTIONS)
  const [verticals, setVerticals] = useState([null, null, null])
  const [xMin, setXMin] = useState(-10)
  const [xMax, setXMax] = useState(10)
  const [plotData, setPlotData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysisData, setAnalysisData] = useState([null, null, null])
  const [analysisLoading, setAnalysisLoading] = useState([false, false, false])
  const [activeAnalysisIdx, setActiveAnalysisIdx] = useState(0)
  const debounceRef = useRef(null)
  const analysisTimers = useRef([null, null, null])

  const fetchGraph = useCallback(async (fns, xmin, xmax) => {
    const hasActive = fns.some(f => f.expression.trim() && f.enabled)
    if (!hasActive) { setPlotData(null); return }

    const span = xmax - xmin
    const pad = span * 4
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('${API}/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functions: fns.map(f => ({
            expression: f.enabled ? f.expression : '',
            x_min: xmin - pad,
            x_max: xmax + pad,
            num_points: 1200,
          })),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Evaluation failed') }
      const data = await res.json()
      setPlotData(data.results)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerFetch = useCallback((fns, xmin, xmax) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGraph(fns, xmin, xmax), 400)
  }, [fetchGraph])

  const doAnalyze = useCallback(async (index, expression) => {
    setAnalysisLoading(prev => prev.map((v, i) => i === index ? true : v))
    try {
      const res = await fetch('${API}/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Analysis failed') }
      const data = await res.json()
      setAnalysisData(prev => prev.map((v, i) => i === index ? data : v))
    } catch (e) {
      setAnalysisData(prev => prev.map((v, i) => i === index ? { error: e.message } : v))
    } finally {
      setAnalysisLoading(prev => prev.map((v, i) => i === index ? false : v))
    }
  }, [])

  const scheduleAnalysis = useCallback((index, expr) => {
    if (analysisTimers.current[index]) clearTimeout(analysisTimers.current[index])
    if (!expr.trim()) {
      setAnalysisData(prev => prev.map((v, i) => i === index ? null : v))
      return
    }
    setAnalysisLoading(prev => prev.map((v, i) => i === index ? true : v))
    analysisTimers.current[index] = setTimeout(() => doAnalyze(index, expr.trim()), 700)
  }, [doAnalyze])

  useEffect(() => {
    fetchGraph(DEFAULT_FUNCTIONS, xMin, xMax)
    doAnalyze(0, DEFAULT_FUNCTIONS[0].expression.trim())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateFunction = (index, value) => {
    // Clear any vertical line for this slot when an expression is set
    if (verticals[index] !== null) {
      setVerticals(prev => prev.map((v, i) => i === index ? null : v))
    }
    const updated = functions.map((f, i) => i === index ? { ...f, expression: value } : f)
    setFunctions(updated)
    triggerFetch(updated, xMin, xMax)
    scheduleAnalysis(index, value)
    if (value.trim()) {
      setActiveAnalysisIdx(index)
    } else {
      setActiveAnalysisIdx(prev => {
        if (prev !== index) return prev
        const fallback = updated.findIndex(f => f.expression.trim())
        return fallback >= 0 ? fallback : 0
      })
    }
  }

  const setVertical = (index, xVal) => {
    setVerticals(prev => prev.map((v, i) => i === index ? xVal : v))
    // Clear expression for this slot — vertical line is graphed client-side
    const updated = functions.map((f, i) => i === index ? { ...f, expression: '' } : f)
    setFunctions(updated)
    triggerFetch(updated, xMin, xMax)
    setAnalysisData(prev => prev.map((v, i) => i === index ? null : v))
    setActiveAnalysisIdx(prev => prev === index ? (updated.findIndex(f => f.expression.trim()) >= 0 ? updated.findIndex(f => f.expression.trim()) : 0) : prev)
  }

  const toggleFunction = (index) => {
    const updated = functions.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f)
    setFunctions(updated)
    triggerFetch(updated, xMin, xMax)
  }

  const updateRange = (newXMin, newXMax) => {
    setXMin(newXMin)
    setXMax(newXMax)
    triggerFetch(functions, newXMin, newXMax)
  }

  const clearAnalysis = (index) => {
    setAnalysisData(prev => prev.map((v, i) => i === index ? null : v))
  }

  const activeFunctions = functions.filter(f => f.expression.trim())

  return (
    <div className="app">
      <header className="app-header">
        <h1>Graphing Calculator</h1>
        <nav className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'functions' ? (
        <div className="app-body">
          <div className="functions-col">
            <FunctionInputs
              functions={functions}
              colors={COLORS}
              colorNames={COLOR_NAMES}
              onUpdate={updateFunction}
              onToggle={toggleFunction}
              onSetVertical={setVertical}
              xMin={xMin}
              xMax={xMax}
              onRangeChange={updateRange}
            />
          </div>

          <div className="analysis-col">
            {activeFunctions.length > 1 && (
              <div className="analysis-tabs">
                {functions.map((fn, i) => fn.expression.trim() ? (
                  <button
                    key={i}
                    className={`analysis-tab ${activeAnalysisIdx === i ? 'active' : ''}`}
                    onClick={() => setActiveAnalysisIdx(i)}
                  >
                    <span className="analysis-tab-dot" style={{ background: COLORS[i] }} />
                    f{i + 1}
                  </button>
                ) : null)}
              </div>
            )}

            {analysisLoading[activeAnalysisIdx] ? (
              <div className="analysis-col-empty">Analyzing…</div>
            ) : analysisData[activeAnalysisIdx] ? (
              <AnalysisPanel
                analysis={analysisData[activeAnalysisIdx]}
                color={COLORS[activeAnalysisIdx]}
                index={activeAnalysisIdx}
                onClose={() => clearAnalysis(activeAnalysisIdx)}
              />
            ) : (
              <div className="analysis-col-empty">
                Enter a function to see its analysis here
              </div>
            )}
          </div>

          <div className="graph-col">
            <GraphPanel
              plotData={plotData}
              functions={functions}
              colors={COLORS}
              xMin={xMin}
              xMax={xMax}
              loading={loading}
              error={error}
              verticals={verticals}
            />
          </div>
        </div>
      ) : (
        <Suspense fallback={<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#334155'}}>Loading…</div>}>
          {activeTab === 'geometry' && <Geometry />}
          {activeTab === 'linalg'   && <LinearAlgebra />}
          {activeTab === 'calculus' && <CalculusSurfaces />}
          {activeTab === 'stats'    && <Statistics />}
          {activeTab === 'physics'  && <Physics />}
        </Suspense>
      )}
    </div>
  )
}
