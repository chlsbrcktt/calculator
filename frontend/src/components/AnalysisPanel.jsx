import { useState, useCallback } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './AnalysisPanel.css'

function tex(math, display = false) {
  try {
    return katex.renderToString(math, {
      displayMode: display,
      throwOnError: false,
      output: 'html',
    })
  } catch {
    return `<span class="katex-error">${math}</span>`
  }
}

function KTex({ math, display = false }) {
  return (
    <span
      className={display ? 'katex-block-wrap' : 'katex-inline-wrap'}
      dangerouslySetInnerHTML={{ __html: tex(math, display) }}
    />
  )
}

// Split text on $$...$$ (block) then $...$ (inline), render each segment.
function MixedMath({ text }) {
  if (!text) return null

  // Split on $$...$$ first
  const blockSegments = text.split(/([$]{2}[\s\S]*?[$]{2})/g)

  return (
    <>
      {blockSegments.map((seg, i) => {
        if (seg.startsWith('$$') && seg.endsWith('$$') && seg.length > 4) {
          return <KTex key={i} math={seg.slice(2, -2)} display />
        }
        // Split remaining on $...$
        const inlineSegments = seg.split(/(\$[^$]+\$)/g)
        return inlineSegments.map((s, j) => {
          if (s.startsWith('$') && s.endsWith('$') && s.length > 2) {
            return <KTex key={`${i}-${j}`} math={s.slice(1, -1)} />
          }
          // Handle **bold** markers
          if (s.includes('**')) {
            const boldParts = s.split(/(\*\*[^*]+\*\*)/g)
            return boldParts.map((bp, k) => {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                return <strong key={`${i}-${j}-${k}`}>{bp.slice(2, -2)}</strong>
              }
              return <span key={`${i}-${j}-${k}`}>{bp}</span>
            })
          }
          return s ? <span key={`${i}-${j}`}>{s}</span> : null
        })
      })}
    </>
  )
}

function renderContent(text) {
  if (!text) return null
  return text.split('\n\n').map((para, i) => (
    <p key={i} className="step-para">
      <MixedMath text={para} />
    </p>
  ))
}

function StepSection({ steps }) {
  const [open, setOpen] = useState(false)
  if (!steps || steps.length === 0) return null

  return (
    <div className="step-section">
      <button className="step-toggle" onClick={() => setOpen(o => !o)}>
        <span className="step-toggle-icon">{open ? '▾' : '▸'}</span>
        Step-by-step breakdown
      </button>
      {open && (
        <div className="step-content">
          {steps.map((step, i) => (
            <div key={i} className="step-item">
              <div className="step-num">Step {i + 1}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-body">{renderContent(step.content)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }) {
  if (!value) return null
  const hasLatex = typeof value === 'string' && value.includes('\\')
  return (
    <div className="fact-row">
      <span className="fact-label">{label}</span>
      <span className="fact-value">
        {hasLatex ? <KTex math={value} /> : value}
      </span>
    </div>
  )
}

function PiecewiseContinuitySection({ continuity }) {
  if (!continuity || continuity.length === 0) return null

  function bpType(bp) {
    if (bp.continuous === null || bp.continuous === undefined) return 'unknown'
    if (!bp.continuous) return bp.left_lim === bp.right_lim ? 'removable' : 'jump'
    if (bp.differentiable === true)  return 'smooth'
    if (bp.differentiable === false) return 'corner'
    return 'continuous'
  }

  const typeLabel = {
    smooth:     'Smooth',
    corner:     'Corner point',
    continuous: 'Continuous',
    removable:  'Removable',
    jump:       'Jump',
    unknown:    '?',
  }

  return (
    <div className="pw-cont-section">
      <div className="fact-label" style={{ minWidth: 'unset', marginBottom: 6 }}>Continuity at breakpoints</div>
      <div className="pw-cont-entries">
        {continuity.map((bp, i) => {
          const t = bpType(bp)
          const showDerivs = bp.left_deriv !== null && bp.left_deriv !== undefined
          return (
            <div key={i} className="pw-cont-entry">
              <div className="pw-cont-header">
                <span className="pw-cont-x"><KTex math={`x = ${bp.x}`} /></span>
                <span className={`pw-cont-badge pw-badge-${t}`}>{typeLabel[t]}</span>
              </div>
              {bp.left_lim !== null && (
                <div className="pw-cont-row">
                  <span className="pw-cont-item"><KTex math={`\\lim^- = ${bp.left_lim}`} /></span>
                  <span className="pw-cont-item"><KTex math={`\\lim^+ = ${bp.right_lim}`} /></span>
                  <span className="pw-cont-item"><KTex math={`f = ${bp.value}`} /></span>
                </div>
              )}
              {showDerivs && (
                <div className="pw-cont-row" style={{ marginTop: 4 }}>
                  <span className="pw-cont-item"><KTex math={`f'^{-} = ${bp.left_deriv}`} /></span>
                  <span className="pw-cont-item"><KTex math={`f'^{+} = ${bp.right_deriv}`} /></span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const FORM_LABELS = {
  slope_intercept: 'Slope-Intercept',
  point_slope:     'Point-Slope',
  standard:        'Standard',
}
const FORM_KEYS = ['slope_intercept', 'point_slope', 'standard']

function LinearFormsSection({ linearForms, expression }) {
  const [fromForm, setFromForm] = useState('slope_intercept')
  const [toForm,   setToForm]   = useState('standard')
  const [steps,    setSteps]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [open,     setOpen]     = useState(false)

  if (!linearForms) return null

  const handleShowSteps = async () => {
    if (fromForm === toForm) return
    setLoading(true)
    setError(null)
    setSteps(null)
    setOpen(false)
    try {
      const res = await fetch('http://localhost:8001/convert-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression, from_form: fromForm, to_form: toForm }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed') }
      const data = await res.json()
      setSteps(data.steps)
      setOpen(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lf-section">
      <div className="lf-group-label">Forms</div>
      <div className="lf-forms-list">
        {FORM_KEYS.map(key => (
          <div key={key} className="lf-form-row">
            <span className="lf-form-name">{FORM_LABELS[key]}</span>
            <span className="lf-form-expr"><KTex math={linearForms[key]} /></span>
          </div>
        ))}
      </div>

      <div className="lf-meta-row">
        <span className="lf-meta-chip">slope <KTex math={`m = ${linearForms.slope}`} /></span>
        <span className="lf-meta-chip">y-int <KTex math={`b = ${linearForms.b}`} /></span>
        <span className="lf-meta-chip lf-mono">A={linearForms.A}, B={linearForms.B}, C={linearForms.C}</span>
      </div>

      <div className="lf-group-label" style={{ marginTop: 8 }}>Convert</div>
      <div className="lf-convert-row">
        <select className="lf-select" value={fromForm}
          onChange={e => { setFromForm(e.target.value); setSteps(null) }}>
          {FORM_KEYS.map(k => <option key={k} value={k}>{FORM_LABELS[k]}</option>)}
        </select>
        <span className="lf-arrow">→</span>
        <select className="lf-select" value={toForm}
          onChange={e => { setToForm(e.target.value); setSteps(null) }}>
          {FORM_KEYS.map(k => <option key={k} value={k}>{FORM_LABELS[k]}</option>)}
        </select>
        <button className="lf-btn" onClick={handleShowSteps}
          disabled={loading || fromForm === toForm}>
          {loading ? '…' : 'Show steps'}
        </button>
      </div>

      {error && <div className="lf-error">{error}</div>}

      {steps && (
        <div className="step-section">
          <button className="step-toggle" onClick={() => setOpen(o => !o)}>
            <span className="step-toggle-icon">{open ? '▾' : '▸'}</span>
            {FORM_LABELS[fromForm]} → {FORM_LABELS[toForm]}
          </button>
          {open && (
            <div className="step-content">
              {steps.map((step, i) => (
                <div key={i} className="step-item">
                  <div className="step-num">Step {i + 1}</div>
                  <div className="step-title">{step.title}</div>
                  <div className="step-body">{renderContent(step.content)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AnalysisPanel({ analysis, color, index, onClose }) {
  if (!analysis) return null

  if (analysis.error) {
    return (
      <div className="analysis-panel">
        <div className="analysis-header" style={{ borderLeftColor: color }}>
          <span>f{index + 1} Analysis Error</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="analysis-error">{analysis.error}</div>
      </div>
    )
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-header" style={{ borderLeftColor: color }}>
        <div className="analysis-title-row">
          <span className="analysis-fn-label" style={{ color }}>f{index + 1}(x)</span>
          <span className="analysis-expr">
            {analysis.latex ? <KTex math={analysis.latex} /> : analysis.expression}
          </span>
          <span className="analysis-type-badge">{analysis.type}</span>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="analysis-body">
        <div className="facts-grid">
          {analysis.expanded && analysis.factored && analysis.expanded !== analysis.factored && (
            <>
              <Fact label="Expanded" value={analysis.expanded} />
              <Fact label="Factored" value={analysis.factored} />
            </>
          )}
          {analysis.expanded && (analysis.expanded === analysis.factored || !analysis.factored) && (
            <Fact label="Standard form" value={analysis.expanded} />
          )}
          <Fact label="Y-intercept" value={analysis.y_intercept ? `(0,\\ ${analysis.y_intercept})` : null} />
          {analysis.roots && analysis.roots.length > 0 && (
            <div className="fact-row">
              <span className="fact-label">Zeros (roots)</span>
              <span className="fact-value roots-list">
                {analysis.roots.map((r, i) => (
                  <span key={i} className="root-item">
                    <KTex math={`x = ${r.exact}`} />
                    {r.decimal !== 'complex' && r.decimal !== r.exact && (
                      <span className="root-decimal">≈ {r.decimal}</span>
                    )}
                  </span>
                ))}
              </span>
            </div>
          )}
          {analysis.roots && analysis.roots.length === 0 && (
            <Fact label="Zeros (roots)" value="No real roots" />
          )}
          <Fact label="Axis of symmetry" value={analysis.axis_of_symmetry} />
          <Fact label="Vertex" value={analysis.vertex} />
          <Fact label="Domain" value={analysis.domain} />
          <Fact label="Range" value={analysis.range} />
          {analysis.inverse && (
            <div className="fact-row">
              <span className="fact-label">Inverse</span>
              <span className="fact-value" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                {analysis.inverse.branches.map((branch, i) => (
                  <span key={i} className="root-item">
                    <KTex math={`f^{-1}(x) = ${branch}`} />
                  </span>
                ))}
                {analysis.inverse.note && (
                  <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                    {analysis.inverse.note}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <PiecewiseContinuitySection continuity={analysis.continuity} />

        <LinearFormsSection
          linearForms={analysis.linear_forms}
          expression={analysis.expression}
        />

        <StepSection steps={analysis.steps} />
      </div>
    </div>
  )
}
