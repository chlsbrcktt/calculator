import { useState, useRef, useEffect } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import API from '../api'
import './Calculator.css'

function KTex({ math, display = false }) {
  const html = (() => {
    try {
      return katex.renderToString(math, { displayMode: display, throwOnError: false, output: 'html' })
    } catch {
      return `<span class="calc-katex-err">${math}</span>`
    }
  })()
  return (
    <span
      className={display ? 'calc-ktex-block' : 'calc-ktex-inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function VarRow({ index, name, value, onChange, onRemove }) {
  return (
    <div className="calc-var-row">
      <input
        className="calc-var-name"
        value={name}
        onChange={e => onChange(index, 'name', e.target.value)}
        placeholder="x"
        spellCheck={false}
      />
      <span className="calc-var-eq">=</span>
      <input
        className="calc-var-val"
        value={value}
        onChange={e => onChange(index, 'value', e.target.value)}
        placeholder="3/2"
        spellCheck={false}
      />
      <button className="calc-var-remove" onClick={() => onRemove(index)}>✕</button>
    </div>
  )
}

function HistoryItem({ item, onReuse }) {
  return (
    <div className="calc-history-item" onClick={() => onReuse(item.expression)}>
      <span className="calc-history-expr">{item.expression}</span>
      <span className="calc-history-sep">=</span>
      <span className="calc-history-result">
        <KTex math={item.result_latex} />
        {item.numeric != null && item.numeric !== parseFloat(item.result_latex) && (
          <span className="calc-history-num">≈ {Number(item.numeric).toPrecision(6).replace(/\.?0+$/, '')}</span>
        )}
      </span>
    </div>
  )
}

export default function Calculator() {
  const [expression, setExpression] = useState('')
  const [variables, setVariables] = useState([{ name: '', value: '' }])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function addVar() {
    setVariables(v => [...v, { name: '', value: '' }])
  }

  function updateVar(i, field, val) {
    setVariables(v => v.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }

  function removeVar(i) {
    setVariables(v => v.length === 1 ? [{ name: '', value: '' }] : v.filter((_, idx) => idx !== i))
  }

  async function evaluate() {
    const expr = expression.trim()
    if (!expr) return
    setLoading(true)
    setError(null)
    setResult(null)

    const vars = {}
    for (const { name, value } of variables) {
      if (name.trim() && value.trim()) vars[name.trim()] = value.trim()
    }

    try {
      const res = await fetch(`${API}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: expr, variables: vars }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Calculation failed')
      }
      const data = await res.json()
      setResult(data)
      setHistory(h => [{ expression: expr, ...data }, ...h].slice(0, 50))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') evaluate()
  }

  function reuseExpression(expr) {
    setExpression(expr)
    setResult(null)
    setError(null)
    inputRef.current?.focus()
  }

  const hasVars = variables.some(v => v.name.trim() && v.value.trim())

  return (
    <div className="calc-root">
      <div className="calc-main">
        <div className="calc-card">
          <div className="calc-section-label">Variables</div>
          <div className="calc-vars">
            {variables.map((v, i) => (
              <VarRow key={i} index={i} name={v.name} value={v.value}
                onChange={updateVar} onRemove={removeVar} />
            ))}
            <button className="calc-add-var" onClick={addVar}>+ Add variable</button>
          </div>

          <div className="calc-section-label" style={{ marginTop: 20 }}>Expression</div>
          <div className="calc-input-row">
            <input
              ref={inputRef}
              className="calc-expr-input"
              value={expression}
              onChange={e => { setExpression(e.target.value); setResult(null); setError(null) }}
              onKeyDown={handleKey}
              placeholder="e.g.  4*(3/2)^2 - 12*(3/2)  or  2*x + 5 = 11"
              spellCheck={false}
            />
            <button className="calc-eval-btn" onClick={evaluate} disabled={loading || !expression.trim()}>
              {loading ? '…' : '='}
            </button>
          </div>

          {error && <div className="calc-error">{error}</div>}

          {result && (
            <div className="calc-result-block">
              <div className="calc-result-main">
                <KTex math={result.result_latex} display />
                {result.numeric != null && (
                  <div className="calc-result-decimal">
                    ≈ {Number(result.numeric).toPrecision(10).replace(/\.?0+$/, '')}
                  </div>
                )}
              </div>

              {result.steps && result.steps.length > 1 && (
                <div className="calc-steps">
                  <div className="calc-steps-label">Step by step</div>
                  {result.steps.map((s, i) => (
                    <div key={i} className="calc-step">
                      <span className="calc-step-label">{s.label}</span>
                      <span className="calc-step-expr"><KTex math={s.expr} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="calc-card calc-history-card">
            <div className="calc-section-label">
              History
              <button className="calc-clear-hist" onClick={() => setHistory([])}>Clear</button>
            </div>
            <div className="calc-history-list">
              {history.map((item, i) => (
                <HistoryItem key={i} item={item} onReuse={reuseExpression} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
