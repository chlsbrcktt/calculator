import { useState } from 'react'
import './Formulas.css'

function fmt(n) {
  if (!isFinite(n)) return String(n)
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toPrecision(8)).toString()
}

// Wrap in parens if negative (for substitution display)
function p(v) {
  const s = fmt(v)
  return parseFloat(s) < 0 ? `(${s})` : s
}

function valid(...nums) {
  return nums.every(n => typeof n === 'number' && !isNaN(n) && isFinite(n))
}

// step helpers
const step   = (expr, note = '')         => ({ expr, note })
const header = (label)                    => ({ expr: label, isHeader: true })
const answer = (expr, note = '')         => ({ expr, note, isFinal: true })

const FORMULAS = [
  // ── Geometry ──────────────────────────────────────────────────────────────
  {
    id: 'distance',
    label: 'Distance Between Two Points',
    group: 'Geometry',
    formula: 'd = √[(x₂ − x₁)² + (y₂ − y₁)²]',
    inputs: [
      { id: 'x1', label: 'x₁', placeholder: '0' },
      { id: 'y1', label: 'y₁', placeholder: '0' },
      { id: 'x2', label: 'x₂', placeholder: '3' },
      { id: 'y2', label: 'y₂', placeholder: '4' },
    ],
    compute(v) {
      if (!valid(v.x1, v.y1, v.x2, v.y2)) return null
      const dx = v.x2 - v.x1, dy = v.y2 - v.y1
      const d = Math.sqrt(dx * dx + dy * dy)
      const steps = [
        step('d = √[(x₂ − x₁)² + (y₂ − y₁)²]', 'formula'),
        step(`d = √[(${p(v.x2)} − ${p(v.x1)})² + (${p(v.y2)} − ${p(v.y1)})²]`, 'substitute'),
        step(`d = √[(${p(dx)})² + (${p(dy)})²]`, 'subtract'),
        step(`d = √[${fmt(dx * dx)} + ${fmt(dy * dy)}]`, 'square each'),
        step(`d = √${fmt(dx * dx + dy * dy)}`, 'add'),
        answer(`d = ${fmt(d)}`, 'result'),
      ]
      // Collapse trivial steps
      const out = steps.filter((s, i) => {
        if (i === 2 && dx === v.x2 - v.x1 && dy === v.y2 - v.y1 && fmt(dx) === fmt(v.x2) + ' − ' + fmt(v.x1)) return true
        return true
      })
      return { steps, answers: [{ label: 'd', value: fmt(d) }] }
    },
  },
  {
    id: 'midpoint',
    label: 'Midpoint Formula',
    group: 'Geometry',
    formula: 'M = ((x₁+x₂)/2,  (y₁+y₂)/2)',
    inputs: [
      { id: 'x1', label: 'x₁', placeholder: '0' },
      { id: 'y1', label: 'y₁', placeholder: '0' },
      { id: 'x2', label: 'x₂', placeholder: '6' },
      { id: 'y2', label: 'y₂', placeholder: '4' },
    ],
    compute(v) {
      if (!valid(v.x1, v.y1, v.x2, v.y2)) return null
      const mx = (v.x1 + v.x2) / 2, my = (v.y1 + v.y2) / 2
      return {
        steps: [
          step('M = ((x₁ + x₂) / 2,  (y₁ + y₂) / 2)', 'formula'),
          step(`M = ((${p(v.x1)} + ${p(v.x2)}) / 2,  (${p(v.y1)} + ${p(v.y2)}) / 2)`, 'substitute'),
          step(`M = (${fmt(v.x1 + v.x2)} / 2,  ${fmt(v.y1 + v.y2)} / 2)`, 'add'),
          answer(`M = (${fmt(mx)}, ${fmt(my)})`, 'result'),
        ],
        answers: [{ label: 'Mₓ', value: fmt(mx) }, { label: 'Mᵧ', value: fmt(my) }],
      }
    },
  },
  {
    id: 'slope',
    label: 'Slope Between Two Points',
    group: 'Geometry',
    formula: 'm = (y₂ − y₁) / (x₂ − x₁)',
    inputs: [
      { id: 'x1', label: 'x₁', placeholder: '1' },
      { id: 'y1', label: 'y₁', placeholder: '2' },
      { id: 'x2', label: 'x₂', placeholder: '4' },
      { id: 'y2', label: 'y₂', placeholder: '8' },
    ],
    compute(v) {
      if (!valid(v.x1, v.y1, v.x2, v.y2)) return null
      if (Math.abs(v.x2 - v.x1) < 1e-12) return { error: 'Undefined — vertical line (x₁ = x₂)' }
      const num = v.y2 - v.y1, den = v.x2 - v.x1
      const m = num / den
      return {
        steps: [
          step('m = (y₂ − y₁) / (x₂ − x₁)', 'formula'),
          step(`m = (${p(v.y2)} − ${p(v.y1)}) / (${p(v.x2)} − ${p(v.x1)})`, 'substitute'),
          step(`m = ${fmt(num)} / ${fmt(den)}`, 'subtract'),
          answer(`m = ${fmt(m)}`, 'result'),
        ],
        answers: [{ label: 'm', value: fmt(m) }],
      }
    },
  },
  {
    id: 'pythagorean',
    label: 'Pythagorean Theorem',
    group: 'Geometry',
    formula: 'a² + b² = c²  —  leave one blank to solve',
    inputs: [
      { id: 'a', label: 'a', placeholder: '3' },
      { id: 'b', label: 'b', placeholder: '4' },
      { id: 'c', label: 'c (hypotenuse)', placeholder: 'leave blank to find c' },
    ],
    compute(v) {
      const aOk = valid(v.a), bOk = valid(v.b), cOk = valid(v.c)
      if (aOk && bOk && !cOk) {
        const c = Math.sqrt(v.a ** 2 + v.b ** 2)
        return {
          steps: [
            step('a² + b² = c²', 'formula'),
            step(`${p(v.a)}² + ${p(v.b)}² = c²`, 'substitute'),
            step(`${fmt(v.a ** 2)} + ${fmt(v.b ** 2)} = c²`, 'square each'),
            step(`${fmt(v.a ** 2 + v.b ** 2)} = c²`, 'add'),
            step(`c = √${fmt(v.a ** 2 + v.b ** 2)}`, 'square root'),
            answer(`c = ${fmt(c)}`, 'result'),
          ],
          answers: [{ label: 'c', value: fmt(c) }],
        }
      }
      if (aOk && cOk && !bOk) {
        const b2 = v.c ** 2 - v.a ** 2
        if (b2 < 0) return { error: 'c must be larger than a' }
        const b = Math.sqrt(b2)
        return {
          steps: [
            step('a² + b² = c²', 'formula'),
            step(`${p(v.a)}² + b² = ${p(v.c)}²`, 'substitute'),
            step(`${fmt(v.a ** 2)} + b² = ${fmt(v.c ** 2)}`, 'square each'),
            step(`b² = ${fmt(v.c ** 2)} − ${fmt(v.a ** 2)}`, 'subtract a²'),
            step(`b² = ${fmt(b2)}`, 'simplify'),
            step(`b = √${fmt(b2)}`, 'square root'),
            answer(`b = ${fmt(b)}`, 'result'),
          ],
          answers: [{ label: 'b', value: fmt(b) }],
        }
      }
      if (bOk && cOk && !aOk) {
        const a2 = v.c ** 2 - v.b ** 2
        if (a2 < 0) return { error: 'c must be larger than b' }
        const a = Math.sqrt(a2)
        return {
          steps: [
            step('a² + b² = c²', 'formula'),
            step(`a² + ${p(v.b)}² = ${p(v.c)}²`, 'substitute'),
            step(`a² + ${fmt(v.b ** 2)} = ${fmt(v.c ** 2)}`, 'square each'),
            step(`a² = ${fmt(v.c ** 2)} − ${fmt(v.b ** 2)}`, 'subtract b²'),
            step(`a² = ${fmt(a2)}`, 'simplify'),
            step(`a = √${fmt(a2)}`, 'square root'),
            answer(`a = ${fmt(a)}`, 'result'),
          ],
          answers: [{ label: 'a', value: fmt(a) }],
        }
      }
      if (aOk && bOk && cOk) {
        const lhs = v.a ** 2 + v.b ** 2, rhs = v.c ** 2
        const ok = Math.abs(lhs - rhs) < 1e-6
        return {
          steps: [
            step('a² + b² = c²', 'check'),
            step(`${p(v.a)}² + ${p(v.b)}² = ${p(v.c)}²`, 'substitute'),
            step(`${fmt(v.a ** 2)} + ${fmt(v.b ** 2)} = ${fmt(v.c ** 2)}`, 'square each'),
            answer(`${fmt(lhs)} ${ok ? '=' : '≠'} ${fmt(rhs)}  →  ${ok ? 'Valid ✓' : 'Not a right triangle ✗'}`, 'verify'),
          ],
          answers: [{ label: 'Valid right triangle?', value: ok ? 'Yes' : 'No' }],
        }
      }
      return null
    },
  },
  {
    id: 'herons',
    label: "Heron's Formula",
    group: 'Geometry',
    formula: 's = (a+b+c)/2,  A = √[s(s−a)(s−b)(s−c)]',
    inputs: [
      { id: 'a', label: 'Side a', placeholder: '5' },
      { id: 'b', label: 'Side b', placeholder: '6' },
      { id: 'c', label: 'Side c', placeholder: '7' },
    ],
    compute(v) {
      if (!valid(v.a, v.b, v.c)) return null
      if (v.a <= 0 || v.b <= 0 || v.c <= 0) return { error: 'Sides must be positive' }
      if (v.a + v.b <= v.c || v.a + v.c <= v.b || v.b + v.c <= v.a)
        return { error: 'Triangle inequality violated' }
      const s = (v.a + v.b + v.c) / 2
      const sa = s - v.a, sb = s - v.b, sc = s - v.c
      const inside = s * sa * sb * sc
      const A = Math.sqrt(inside)
      return {
        steps: [
          header('Step 1 — Semi-perimeter'),
          step('s = (a + b + c) / 2', 'formula'),
          step(`s = (${fmt(v.a)} + ${fmt(v.b)} + ${fmt(v.c)}) / 2`, 'substitute'),
          step(`s = ${fmt(v.a + v.b + v.c)} / 2`, 'add'),
          answer(`s = ${fmt(s)}`, 'result'),
          header('Step 2 — Area'),
          step('A = √[s(s − a)(s − b)(s − c)]', 'Heron\'s formula'),
          step(`A = √[${fmt(s)}(${fmt(s)} − ${fmt(v.a)})(${fmt(s)} − ${fmt(v.b)})(${fmt(s)} − ${fmt(v.c)})]`, 'substitute'),
          step(`A = √[${fmt(s)} · ${fmt(sa)} · ${fmt(sb)} · ${fmt(sc)}]`, 'subtract'),
          step(`A = √${fmt(inside)}`, 'multiply'),
          answer(`A = ${fmt(A)}`, 'result'),
        ],
        answers: [
          { label: 's (semi-perimeter)', value: fmt(s) },
          { label: 'A (area)', value: fmt(A) },
          { label: 'Perimeter', value: fmt(v.a + v.b + v.c) },
        ],
      }
    },
  },
  {
    id: 'circle',
    label: 'Circle',
    group: 'Geometry',
    formula: 'A = πr²,  C = 2πr',
    inputs: [{ id: 'r', label: 'Radius r', placeholder: '5' }],
    compute(v) {
      if (!valid(v.r)) return null
      if (v.r < 0) return { error: 'Radius must be non-negative' }
      const A = Math.PI * v.r ** 2
      const C = 2 * Math.PI * v.r
      return {
        steps: [
          header('Area'),
          step('A = πr²', 'formula'),
          step(`A = π · ${p(v.r)}²`, 'substitute'),
          step(`A = π · ${fmt(v.r ** 2)}`, 'square'),
          answer(`A = ${fmt(A)}`, 'evaluate'),
          header('Circumference'),
          step('C = 2πr', 'formula'),
          step(`C = 2π · ${p(v.r)}`, 'substitute'),
          answer(`C = ${fmt(C)}`, 'evaluate'),
        ],
        answers: [
          { label: 'Area A', value: fmt(A) },
          { label: 'Circumference C', value: fmt(C) },
          { label: 'Diameter', value: fmt(2 * v.r) },
        ],
      }
    },
  },
  {
    id: 'sphere',
    label: 'Sphere',
    group: 'Geometry',
    formula: 'V = (4/3)πr³,  SA = 4πr²',
    inputs: [{ id: 'r', label: 'Radius r', placeholder: '3' }],
    compute(v) {
      if (!valid(v.r)) return null
      if (v.r < 0) return { error: 'Radius must be non-negative' }
      const V = (4 / 3) * Math.PI * v.r ** 3
      const SA = 4 * Math.PI * v.r ** 2
      return {
        steps: [
          header('Volume'),
          step('V = (4/3)πr³', 'formula'),
          step(`V = (4/3)π · ${p(v.r)}³`, 'substitute'),
          step(`V = (4/3)π · ${fmt(v.r ** 3)}`, 'cube'),
          answer(`V = ${fmt(V)}`, 'evaluate'),
          header('Surface Area'),
          step('SA = 4πr²', 'formula'),
          step(`SA = 4π · ${p(v.r)}²`, 'substitute'),
          step(`SA = 4π · ${fmt(v.r ** 2)}`, 'square'),
          answer(`SA = ${fmt(SA)}`, 'evaluate'),
        ],
        answers: [
          { label: 'Volume V', value: fmt(V) },
          { label: 'Surface Area', value: fmt(SA) },
        ],
      }
    },
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    group: 'Geometry',
    formula: 'V = πr²h,  SA = 2πr² + 2πrh',
    inputs: [
      { id: 'r', label: 'Radius r', placeholder: '3' },
      { id: 'h', label: 'Height h', placeholder: '5' },
    ],
    compute(v) {
      if (!valid(v.r, v.h)) return null
      if (v.r < 0 || v.h < 0) return { error: 'Values must be non-negative' }
      const V = Math.PI * v.r ** 2 * v.h
      const bases = 2 * Math.PI * v.r ** 2
      const lateral = 2 * Math.PI * v.r * v.h
      const SA = bases + lateral
      return {
        steps: [
          header('Volume'),
          step('V = πr²h', 'formula'),
          step(`V = π · ${p(v.r)}² · ${p(v.h)}`, 'substitute'),
          step(`V = π · ${fmt(v.r ** 2)} · ${fmt(v.h)}`, 'square r'),
          answer(`V = ${fmt(V)}`, 'evaluate'),
          header('Surface Area'),
          step('SA = 2πr² + 2πrh', 'formula'),
          step(`SA = 2π(${p(v.r)})² + 2π(${p(v.r)})(${p(v.h)})`, 'substitute'),
          step(`SA = ${fmt(bases)} + ${fmt(lateral)}`, 'evaluate each'),
          answer(`SA = ${fmt(SA)}`, 'result'),
        ],
        answers: [
          { label: 'Volume V', value: fmt(V) },
          { label: 'Surface Area', value: fmt(SA) },
          { label: 'Lateral Area', value: fmt(lateral) },
        ],
      }
    },
  },
  {
    id: 'rect-prism',
    label: 'Rectangular Prism',
    group: 'Geometry',
    formula: 'V = lwh,  SA = 2(lw + lh + wh)',
    inputs: [
      { id: 'l', label: 'Length l', placeholder: '4' },
      { id: 'w', label: 'Width w', placeholder: '3' },
      { id: 'h', label: 'Height h', placeholder: '2' },
    ],
    compute(v) {
      if (!valid(v.l, v.w, v.h)) return null
      if (v.l < 0 || v.w < 0 || v.h < 0) return { error: 'Values must be non-negative' }
      const V = v.l * v.w * v.h
      const lw = v.l * v.w, lh = v.l * v.h, wh = v.w * v.h
      const SA = 2 * (lw + lh + wh)
      return {
        steps: [
          header('Volume'),
          step('V = l · w · h', 'formula'),
          step(`V = ${fmt(v.l)} · ${fmt(v.w)} · ${fmt(v.h)}`, 'substitute'),
          answer(`V = ${fmt(V)}`, 'result'),
          header('Surface Area'),
          step('SA = 2(lw + lh + wh)', 'formula'),
          step(`SA = 2(${fmt(v.l)}·${fmt(v.w)} + ${fmt(v.l)}·${fmt(v.h)} + ${fmt(v.w)}·${fmt(v.h)})`, 'substitute'),
          step(`SA = 2(${fmt(lw)} + ${fmt(lh)} + ${fmt(wh)})`, 'multiply pairs'),
          step(`SA = 2(${fmt(lw + lh + wh)})`, 'add'),
          answer(`SA = ${fmt(SA)}`, 'result'),
        ],
        answers: [
          { label: 'Volume V', value: fmt(V) },
          { label: 'Surface Area', value: fmt(SA) },
        ],
      }
    },
  },
  {
    id: 'law-cosines',
    label: 'Law of Cosines',
    group: 'Geometry',
    formula: 'c² = a² + b² − 2ab·cos(C)',
    inputs: [
      { id: 'a', label: 'Side a', placeholder: '5' },
      { id: 'b', label: 'Side b', placeholder: '7' },
      { id: 'C', label: 'Angle C (°)', placeholder: '60' },
    ],
    compute(v) {
      if (!valid(v.a, v.b, v.C)) return null
      if (v.a <= 0 || v.b <= 0) return { error: 'Sides must be positive' }
      if (v.C <= 0 || v.C >= 180) return { error: 'Angle must be between 0° and 180°' }
      const Cr = (v.C * Math.PI) / 180
      const cosC = Math.cos(Cr)
      const c2 = v.a ** 2 + v.b ** 2 - 2 * v.a * v.b * cosC
      const c = Math.sqrt(c2)
      const cosA = (v.b ** 2 + c2 - v.a ** 2) / (2 * v.b * c)
      const cosB = (v.a ** 2 + c2 - v.b ** 2) / (2 * v.a * c)
      const A = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI
      const B = (Math.acos(Math.max(-1, Math.min(1, cosB))) * 180) / Math.PI
      return {
        steps: [
          step('c² = a² + b² − 2ab·cos(C)', 'formula'),
          step(`c² = ${p(v.a)}² + ${p(v.b)}² − 2(${fmt(v.a)})(${fmt(v.b)})·cos(${fmt(v.C)}°)`, 'substitute'),
          step(`c² = ${fmt(v.a ** 2)} + ${fmt(v.b ** 2)} − ${fmt(2 * v.a * v.b)}·${fmt(cosC)}`, 'evaluate'),
          step(`c² = ${fmt(v.a ** 2)} + ${fmt(v.b ** 2)} − ${fmt(2 * v.a * v.b * cosC)}`, 'multiply'),
          step(`c² = ${fmt(c2)}`, 'simplify'),
          step(`c = √${fmt(c2)}`, 'square root'),
          answer(`c = ${fmt(c)}`, 'result'),
          header('Remaining Angles'),
          step(`cos(A) = (b² + c² − a²) / (2bc) = ${fmt(cosA)}`),
          answer(`A = ${fmt(A)}°`),
          step(`cos(B) = (a² + c² − b²) / (2ac) = ${fmt(cosB)}`),
          answer(`B = ${fmt(B)}°`),
        ],
        answers: [
          { label: 'Side c', value: fmt(c) },
          { label: 'Angle A', value: fmt(A) + '°' },
          { label: 'Angle B', value: fmt(B) + '°' },
        ],
      }
    },
  },
  // ── Algebra ───────────────────────────────────────────────────────────────
  {
    id: 'quadratic',
    label: 'Quadratic Formula',
    group: 'Algebra',
    formula: 'x = (−b ± √(b²−4ac)) / 2a',
    inputs: [
      { id: 'a', label: 'a', placeholder: '1' },
      { id: 'b', label: 'b', placeholder: '-3' },
      { id: 'c', label: 'c', placeholder: '2' },
    ],
    compute(v) {
      if (!valid(v.a, v.b, v.c)) return null
      if (Math.abs(v.a) < 1e-12) return { error: 'a cannot be 0 (not a quadratic)' }
      const disc = v.b ** 2 - 4 * v.a * v.c
      const steps = [
        step('x = (−b ± √(b² − 4ac)) / 2a', 'formula'),
        header('Discriminant'),
        step('Δ = b² − 4ac', ''),
        step(`Δ = ${p(v.b)}² − 4(${p(v.a)})(${p(v.c)})`, 'substitute'),
        step(`Δ = ${fmt(v.b ** 2)} − ${fmt(4 * v.a * v.c)}`, 'evaluate'),
        step(`Δ = ${fmt(disc)}`, 'simplify'),
        header('Roots'),
      ]
      if (disc < 0) {
        const re = -v.b / (2 * v.a), im = Math.sqrt(-disc) / (2 * v.a)
        steps.push(
          step('Δ < 0  →  complex roots'),
          step(`x = (−${p(v.b)} ± √${fmt(disc)}) / ${fmt(2 * v.a)}`, 'substitute'),
          answer(`x₁ = ${fmt(re)} + ${fmt(im)}i`),
          answer(`x₂ = ${fmt(re)} − ${fmt(Math.abs(im))}i`),
        )
        return {
          steps,
          answers: [
            { label: 'x₁', value: `${fmt(re)} + ${fmt(im)}i` },
            { label: 'x₂', value: `${fmt(re)} − ${fmt(Math.abs(im))}i` },
          ],
        }
      }
      const sqrtDisc = Math.sqrt(disc)
      const x1 = (-v.b + sqrtDisc) / (2 * v.a)
      const x2 = (-v.b - sqrtDisc) / (2 * v.a)
      steps.push(
        step(`x = (−${p(v.b)} ± √${fmt(disc)}) / ${fmt(2 * v.a)}`, 'substitute'),
        step(`x = (${fmt(-v.b)} ± ${fmt(sqrtDisc)}) / ${fmt(2 * v.a)}`, 'simplify √'),
        answer(`x₁ = (${fmt(-v.b)} + ${fmt(sqrtDisc)}) / ${fmt(2 * v.a)} = ${fmt(x1)}`),
        answer(`x₂ = (${fmt(-v.b)} − ${fmt(sqrtDisc)}) / ${fmt(2 * v.a)} = ${fmt(x2)}`),
      )
      return {
        steps,
        answers: [
          { label: 'Discriminant Δ', value: fmt(disc) },
          { label: 'x₁', value: fmt(x1) },
          { label: 'x₂', value: fmt(x2) },
        ],
      }
    },
  },
  {
    id: 'percent-change',
    label: 'Percent Change',
    group: 'Algebra',
    formula: '% change = (new − old) / |old| × 100',
    inputs: [
      { id: 'orig', label: 'Original value', placeholder: '80' },
      { id: 'nval', label: 'New value', placeholder: '100' },
    ],
    compute(v) {
      if (!valid(v.orig, v.nval)) return null
      if (Math.abs(v.orig) < 1e-12) return { error: 'Original value cannot be 0' }
      const change = v.nval - v.orig
      const pct = (change / Math.abs(v.orig)) * 100
      return {
        steps: [
          step('% change = (new − old) / |old| × 100', 'formula'),
          step(`% change = (${p(v.nval)} − ${p(v.orig)}) / |${p(v.orig)}| × 100`, 'substitute'),
          step(`% change = ${fmt(change)} / ${fmt(Math.abs(v.orig))} × 100`, 'subtract'),
          step(`% change = ${fmt(change / Math.abs(v.orig))} × 100`, 'divide'),
          answer(`% change = ${fmt(pct)}%  (${pct > 0 ? 'increase' : pct < 0 ? 'decrease' : 'no change'})`, 'result'),
        ],
        answers: [
          { label: 'Change', value: fmt(change) },
          { label: '% Change', value: fmt(pct) + '%' },
        ],
      }
    },
  },
  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'simple-interest',
    label: 'Simple Interest',
    group: 'Finance',
    formula: 'I = P · r · t,  A = P + I',
    inputs: [
      { id: 'P', label: 'Principal P ($)', placeholder: '1000' },
      { id: 'r', label: 'Annual rate (%)', placeholder: '5' },
      { id: 't', label: 'Time (years)', placeholder: '3' },
    ],
    compute(v) {
      if (!valid(v.P, v.r, v.t)) return null
      const rDec = v.r / 100
      const I = v.P * rDec * v.t
      const A = v.P + I
      return {
        steps: [
          step('I = P · r · t', 'formula'),
          step(`I = ${fmt(v.P)} · ${fmt(v.r)}% · ${fmt(v.t)}`, 'substitute'),
          step(`I = ${fmt(v.P)} · ${fmt(rDec)} · ${fmt(v.t)}`, 'convert % to decimal'),
          answer(`I = ${fmt(I)}`, 'interest'),
          header('Total'),
          step('A = P + I', 'formula'),
          step(`A = ${fmt(v.P)} + ${fmt(I)}`, 'substitute'),
          answer(`A = ${fmt(A)}`, 'result'),
        ],
        answers: [
          { label: 'Interest I', value: '$' + fmt(I) },
          { label: 'Total A', value: '$' + fmt(A) },
        ],
      }
    },
  },
  {
    id: 'compound-interest',
    label: 'Compound Interest',
    group: 'Finance',
    formula: 'A = P(1 + r/n)^(nt)',
    inputs: [
      { id: 'P', label: 'Principal P ($)', placeholder: '1000' },
      { id: 'r', label: 'Annual rate (%)', placeholder: '5' },
      { id: 'n', label: 'Periods per year', placeholder: '12' },
      { id: 't', label: 'Time (years)', placeholder: '10' },
    ],
    compute(v) {
      if (!valid(v.P, v.r, v.n, v.t)) return null
      if (v.n <= 0) return { error: 'Compounding periods must be > 0' }
      const rDec = v.r / 100
      const base = 1 + rDec / v.n
      const exp = v.n * v.t
      const A = v.P * Math.pow(base, exp)
      const effRate = (Math.pow(base, v.n) - 1) * 100
      return {
        steps: [
          step('A = P(1 + r/n)^(nt)', 'formula'),
          step(`A = ${fmt(v.P)}(1 + ${fmt(v.r)}%/${fmt(v.n)})^(${fmt(v.n)}·${fmt(v.t)})`, 'substitute'),
          step(`A = ${fmt(v.P)}(1 + ${fmt(rDec / v.n)})^${fmt(exp)}`, 'simplify r/n'),
          step(`A = ${fmt(v.P)}(${fmt(base)})^${fmt(exp)}`, 'add 1'),
          step(`A = ${fmt(v.P)} · ${fmt(Math.pow(base, exp))}`, 'evaluate exponent'),
          answer(`A = ${fmt(A)}`, 'result'),
        ],
        answers: [
          { label: 'Total A', value: '$' + fmt(A) },
          { label: 'Interest earned', value: '$' + fmt(A - v.P) },
          { label: 'Effective rate', value: fmt(effRate) + '%/yr' },
        ],
      }
    },
  },
]

const GROUPS = ['Geometry', 'Algebra', 'Finance']

export default function Formulas() {
  const [formulaId, setFormulaId] = useState('distance')
  const [vals, setVals] = useState({})

  const formula = FORMULAS.find(f => f.id === formulaId)

  function changeFormula(id) {
    setFormulaId(id)
    setVals({})
  }

  const parsed = {}
  for (const inp of formula.inputs) {
    const raw = vals[inp.id] ?? ''
    parsed[inp.id] = raw === '' ? NaN : parseFloat(raw)
  }

  let result = null
  try { result = formula.compute(parsed) } catch {}

  return (
    <div className="formulas-root">
      <select
        className="formulas-select"
        value={formulaId}
        onChange={e => changeFormula(e.target.value)}
      >
        {GROUPS.map(g => (
          <optgroup key={g} label={g}>
            {FORMULAS.filter(f => f.group === g).map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="formulas-formula">{formula.formula}</div>

      <div className="formulas-inputs">
        {formula.inputs.map(inp => (
          <div key={inp.id} className="formulas-input-row">
            <label className="formulas-label">{inp.label}</label>
            <input
              className="formulas-input"
              type="number"
              step="any"
              placeholder={inp.placeholder}
              value={vals[inp.id] ?? ''}
              onChange={e => setVals(prev => ({ ...prev, [inp.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {result && !result.error && (
        <div className="formulas-paper">
          {result.steps.map((s, i) => s.isHeader ? (
            <div key={i} className="formulas-step-header">{s.expr}</div>
          ) : (
            <div key={i} className={`formulas-step-line${s.isFinal ? ' final' : ''}`}>
              <span className="formulas-step-expr">{s.expr}</span>
              {s.note && <span className="formulas-step-note">{s.note}</span>}
            </div>
          ))}
        </div>
      )}

      {result?.error && <div className="formulas-error">{result.error}</div>}
    </div>
  )
}
