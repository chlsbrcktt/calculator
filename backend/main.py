from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import math
import re
from typing import Optional
import sympy as sp
from sympy import symbols, factor, expand, solve, diff, latex, simplify, Rational, sqrt, oo, S, limit, zoo
from sympy.calculus.util import continuous_domain, function_range
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application,
    convert_xor
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

NUMPY_SAFE = {
    "sin": np.sin, "cos": np.cos, "tan": np.tan,
    "asin": np.arcsin, "acos": np.arccos, "atan": np.arctan,
    "sinh": np.sinh, "cosh": np.cosh, "tanh": np.tanh,
    "sqrt": np.sqrt, "abs": np.abs, "log": np.log,
    "log2": np.log2, "log10": np.log10, "exp": np.exp,
    "floor": np.floor, "ceil": np.ceil,
    "pi": math.pi, "e": math.e,
}

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


class FunctionRequest(BaseModel):
    expression: str
    x_min: float = -10
    x_max: float = 10
    num_points: int = 600


class FunctionsRequest(BaseModel):
    functions: list[FunctionRequest]


class AnalyzeRequest(BaseModel):
    expression: str


def normalize_for_numpy(expr: str) -> str:
    expr = expr.strip()
    expr = re.sub(r'\^', '**', expr)
    expr = re.sub(r'(\d)([a-zA-Z(])', r'\1*\2', expr)
    return expr


def normalize_for_sympy(expr: str) -> str:
    return expr.strip()


def evaluate_expression(expr: str, x_vals: np.ndarray) -> np.ndarray:
    if 'Piecewise' in expr:
        x_sym = symbols('x')
        try:
            expr_sym = parse_expr(
                normalize_for_sympy(expr),
                transformations=TRANSFORMATIONS,
                local_dict={"x": x_sym, "e": sp.E, "pi": sp.pi},
            )
            # Lambdify each piece independently — avoids the Piecewise name issue
            cond_arrs, val_arrs = [], []
            for val_sym, cond_sym in expr_sym.args:
                if cond_sym == sp.true:
                    cond_arr = np.ones(x_vals.shape, dtype=bool)
                else:
                    cf = sp.lambdify(x_sym, cond_sym, modules='numpy')
                    cond_arr = np.asarray(cf(x_vals), dtype=bool)
                    if cond_arr.ndim == 0:
                        cond_arr = np.broadcast_to(cond_arr, x_vals.shape).copy()
                vf = sp.lambdify(x_sym, val_sym, modules='numpy')
                val_arr = np.asarray(vf(x_vals), dtype=float)
                if val_arr.ndim == 0:
                    val_arr = np.full(x_vals.shape, float(val_arr))
                cond_arrs.append(cond_arr)
                val_arrs.append(val_arr)
            result = np.select(cond_arrs, val_arrs, default=np.nan)
            result = np.where(np.isfinite(result), result, np.nan)
            return result
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error evaluating '{expr}': {str(e)}")

    expr_np = normalize_for_numpy(expr)
    namespace = {**NUMPY_SAFE, "x": x_vals, "np": np}
    try:
        result = eval(expr_np, {"__builtins__": {}}, namespace)
        result = np.array(result, dtype=float)
        if result.ndim == 0:
            result = np.full(x_vals.shape, float(result))
        result = np.where(np.isfinite(result), result, np.nan)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error evaluating '{expr}': {str(e)}")


@app.post("/evaluate")
def evaluate_functions(req: FunctionsRequest):
    results = []
    for fn in req.functions:
        if not fn.expression.strip():
            results.append({"points": []})
            continue

        x_vals = np.linspace(fn.x_min, fn.x_max, fn.num_points)
        y_vals = evaluate_expression(fn.expression, x_vals)

        points = []
        for x, y in zip(x_vals.tolist(), y_vals.tolist()):
            y_out = None if (isinstance(y, float) and (math.isnan(y) or math.isinf(y))) else y
            points.append({"x": x, "y": y_out})

        results.append({"points": points, "expression": fn.expression})

    return {"results": results}


def _fmt(val) -> str:
    """Format a sympy value nicely."""
    if val is None:
        return "undefined"
    try:
        f = float(val)
        if f == int(f):
            return str(int(f))
        return f"{f:.4f}".rstrip('0').rstrip('.')
    except Exception:
        return str(val)


def _latex_expr(expr_sympy) -> str:
    return latex(expr_sympy)


def analyze_expression(raw_expr: str) -> dict:
    x = symbols('x')

    try:
        expr_sympy = parse_expr(
            normalize_for_sympy(raw_expr),
            transformations=TRANSFORMATIONS,
            local_dict={"x": x, "e": sp.E, "pi": sp.pi},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse '{raw_expr}': {e}")

    poly = sp.Poly(expr_sympy, x) if expr_sympy.is_polynomial(x) else None
    degree = int(poly.degree()) if poly else None

    result = {
        "expression": raw_expr,
        "latex": _latex_expr(expr_sympy),
        "type": _classify(degree, expr_sympy, x),
        "degree": degree,
        "expanded": None,
        "factored": None,
        "roots": [],
        "y_intercept": None,
        "vertex": None,
        "axis_of_symmetry": None,
        "domain": None,
        "range": None,
        "inverse": None,
        "steps": [],
        "linear_forms": None,
        "vertical_asymptotes": [],
        "horizontal_asymptotes": [],
        "vertical_asymptote_steps": "",
        "horizontal_asymptote_steps": "",
    }

    # Expanded form
    expanded = expand(expr_sympy)
    result["expanded"] = _latex_expr(expanded)

    # Factored form
    try:
        factored = factor(expr_sympy)
        result["factored"] = _latex_expr(factored)
    except Exception:
        result["factored"] = result["expanded"]

    # Y-intercept
    try:
        y_int = expr_sympy.subs(x, 0)
        result["y_intercept"] = _fmt(y_int)
    except Exception:
        pass

    # Roots
    try:
        raw_roots = solve(expr_sympy, x)
        roots_out = []
        for r in raw_roots:
            try:
                roots_out.append({"exact": _latex_expr(r), "decimal": _fmt(float(r))})
            except Exception:
                roots_out.append({"exact": _latex_expr(r), "decimal": "complex"})
        result["roots"] = roots_out
    except Exception:
        pass

    # Step-by-step
    steps = _build_steps(expr_sympy, expanded, degree, x, poly)
    result["steps"] = steps

    # Linear forms (degree-1 only)
    if degree == 1:
        try:
            m_sym = sp.nsimplify(poly.nth(1))
            b_sym = sp.nsimplify(poly.nth(0))
            result["linear_forms"] = _build_linear_forms(m_sym, b_sym)
        except Exception:
            pass

    # Vertex & axis of symmetry (quadratics)
    if degree == 2:
        try:
            a_coef = float(poly.nth(2))
            b_coef = float(poly.nth(1))
            c_coef = float(poly.nth(0))
            h = Rational(-b_coef * 2, 2) / 2 if False else sp.Rational(-int(b_coef * 1000), int(a_coef * 2000))
            h_exact = sp.nsimplify(-b_coef / (2 * a_coef))
            k_exact = expr_sympy.subs(x, h_exact)
            result["axis_of_symmetry"] = f"x = {_latex_expr(h_exact)}"
            result["vertex"] = f"({_latex_expr(h_exact)},\\ {_latex_expr(simplify(k_exact))})"
        except Exception as e:
            pass

    # Domain & range
    try:
        domain = continuous_domain(expr_sympy, x, S.Reals)
        result["domain"] = _latex_expr(domain)
    except Exception:
        result["domain"] = r"\mathbb{R}"

    try:
        domain_for_range = continuous_domain(expr_sympy, x, S.Reals)
        rng = function_range(expr_sympy, x, domain_for_range)
        result["range"] = _latex_expr(rng)
    except Exception:
        if degree is not None and degree % 2 == 1:
            result["range"] = r"\mathbb{R}"

    # Asymptotes
    asym = _find_asymptotes(expr_sympy, x)
    result["vertical_asymptotes"] = asym["vertical"]
    result["horizontal_asymptotes"] = asym["horizontal"]
    result["vertical_asymptote_steps"] = asym["vertical_steps"]
    result["horizontal_asymptote_steps"] = asym["horizontal_steps"]

    # Inverse
    result["inverse"] = _compute_inverse(expr_sympy, x, degree)

    return result


def _find_asymptotes(expr_sympy, x) -> dict:
    vert, horiz = [], []

    # Vertical asymptotes — rational functions: denominator zeros where numerator ≠ 0
    try:
        numer, denom = sp.fraction(sp.cancel(expr_sympy))
        if denom not in (sp.Integer(1), sp.Integer(-1)):
            for z in solve(denom, x):
                if not z.is_real:
                    continue
                try:
                    if numer.subs(x, z) != 0:
                        vert.append({"x": _latex_expr(z)})
                except Exception:
                    vert.append({"x": _latex_expr(z)})
    except Exception:
        pass

    # Vertical asymptotes — non-rational (log, etc.): domain boundaries where limit → ±∞
    if not vert:
        try:
            domain = continuous_domain(expr_sympy, x, S.Reals)
            bps = set()

            def _collect_bps(dom):
                if isinstance(dom, sp.Interval):
                    if dom.inf.is_finite and dom.inf.is_real:
                        bps.add(dom.inf)
                    if dom.sup.is_finite and dom.sup.is_real:
                        bps.add(dom.sup)
                elif hasattr(dom, 'args'):
                    for arg in dom.args:
                        _collect_bps(arg)

            _collect_bps(domain)
            for pt in bps:
                try:
                    for side in ('+', '-'):
                        lv = limit(expr_sympy, x, pt, side)
                        if lv in (oo, -oo):
                            vert.append({"x": _latex_expr(pt)})
                            break
                except Exception:
                    pass
        except Exception:
            pass

    # Horizontal asymptotes — finite limits as x → ±∞
    try:
        lim_pos = limit(expr_sympy, x, oo)
        lim_neg = limit(expr_sympy, x, -oo)
        seen = []
        for lv in (lim_pos, lim_neg):
            try:
                f = float(lv)
                if not (f == float('inf') or f == float('-inf')):
                    if not any(float(s["_val"]) == f for s in seen):
                        seen.append({"y": _latex_expr(lv), "_val": lv})
            except (TypeError, ValueError):
                pass
        horiz = [{"y": s["y"]} for s in seen]
    except Exception:
        pass

    return {
        "vertical": vert,
        "horizontal": horiz,
        "vertical_steps": _vertical_asymptote_steps(expr_sympy, x, vert),
        "horizontal_steps": _horizontal_asymptote_steps(expr_sympy, x, horiz),
    }


def _vertical_asymptote_steps(expr_sympy, x, vert) -> str:
    lines = []
    try:
        numer, denom = sp.fraction(sp.cancel(expr_sympy))
        is_rational = denom not in (sp.Integer(1), sp.Integer(-1))
    except Exception:
        is_rational = False

    lines.append("**Vertical asymptotes** occur where the function is undefined and the output grows without bound.")

    if is_rational:
        try:
            numer, denom = sp.fraction(sp.cancel(expr_sympy))
            lines.append(
                f"Write in rational form:\n\n$$f(x) = \\frac{{{_latex_expr(numer)}}}{{{_latex_expr(denom)}}}$$"
            )
            lines.append(f"**Step 1 — Set the denominator equal to zero:**\n\n$${_latex_expr(denom)} = 0$$")
            denom_zeros = [z for z in solve(denom, x) if z.is_real]
            if denom_zeros:
                zero_strs = ", ".join(f"$x = {_latex_expr(z)}$" for z in denom_zeros)
                lines.append(f"**Step 2 — Solve:** {zero_strs}")
                lines.append("**Step 3 — Confirm the numerator is non-zero there** (otherwise it's a hole, not an asymptote):")
                for z in denom_zeros:
                    try:
                        nv = simplify(numer.subs(x, z))
                        if nv != 0:
                            lines.append(f"At $x = {_latex_expr(z)}$: numerator $= {_latex_expr(nv)} \\neq 0$ → **vertical asymptote** ✓")
                        else:
                            lines.append(f"At $x = {_latex_expr(z)}$: numerator $= 0$ → removable hole, not an asymptote")
                    except Exception:
                        lines.append(f"At $x = {_latex_expr(z)}$: → **vertical asymptote**")
            else:
                lines.append("The denominator has no real zeros → **no vertical asymptotes**.")
        except Exception:
            pass
    else:
        lines.append(
            "For non-rational functions (e.g. logarithms), check where the function is undefined "
            "and whether the limit is $\\pm\\infty$ there."
        )
        if vert:
            for va in vert:
                try:
                    pt = sp.sympify(va["x"])
                    lv = limit(expr_sympy, x, pt, '+')
                    lines.append(f"$\\lim_{{x \\to {va['x']}^+}} f(x) = {_latex_expr(lv)}$ → **vertical asymptote at $x = {va['x']}$**")
                except Exception:
                    lines.append(f"**Vertical asymptote at $x = {va['x']}$**")

    if vert:
        va_strs = ", ".join(f"$x = {va['x']}$" for va in vert)
        lines.append(f"**Vertical asymptote(s): {va_strs}**")
    else:
        lines.append("**Result: No vertical asymptotes.**")

    return "\n\n".join(lines)


def _horizontal_asymptote_steps(expr_sympy, x, horiz) -> str:
    lines = []
    lines.append("**Horizontal asymptotes** describe the value $f(x)$ approaches as $x \\to \\pm\\infty$.")

    try:
        numer, denom = sp.fraction(sp.cancel(expr_sympy))
        is_rational = denom not in (sp.Integer(1), sp.Integer(-1))
    except Exception:
        is_rational = False

    if is_rational:
        try:
            numer, denom = sp.fraction(sp.cancel(expr_sympy))
            poly_n = sp.Poly(numer, x) if numer.is_polynomial(x) else None
            poly_d = sp.Poly(denom, x) if denom.is_polynomial(x) else None
            if poly_n and poly_d:
                dn, dd = int(poly_n.degree()), int(poly_d.degree())
                ln = sp.nsimplify(poly_n.nth(dn))
                ld = sp.nsimplify(poly_d.nth(dd))
                lines.append(
                    f"This is a rational function. Compare degrees:\n\n"
                    f"- Numerator degree: $n = {dn}$, leading coefficient $= {_latex_expr(ln)}$\n\n"
                    f"- Denominator degree: $d = {dd}$, leading coefficient $= {_latex_expr(ld)}$"
                )
                if dn < dd:
                    lines.append("Since $n < d$: the x-axis is the horizontal asymptote.\n\n$$y = 0$$")
                elif dn == dd:
                    ratio = sp.nsimplify(ln / ld)
                    lines.append(
                        f"Since $n = d$: the horizontal asymptote is the ratio of leading coefficients.\n\n"
                        f"$$y = \\frac{{{_latex_expr(ln)}}}{{{_latex_expr(ld)}}} = {_latex_expr(ratio)}$$"
                    )
                else:
                    lines.append(
                        "Since $n > d$: there is **no horizontal asymptote** — the function grows without bound. "
                        "There may be an oblique (slant) asymptote instead."
                    )
        except Exception:
            pass
    else:
        lines.append("Compute the limits at infinity:")
        try:
            lim_pos = limit(expr_sympy, x, oo)
            lim_neg = limit(expr_sympy, x, -oo)
            def fmt(v):
                if v == oo: return "+\\infty"
                if v == -oo: return "-\\infty"
                return _latex_expr(v)
            lines.append(f"$$\\lim_{{x \\to +\\infty}} f(x) = {fmt(lim_pos)}$$")
            lines.append(f"$$\\lim_{{x \\to -\\infty}} f(x) = {fmt(lim_neg)}$$")
        except Exception:
            pass

    if horiz:
        ha_strs = ", ".join(f"$y = {ha['y']}$" for ha in horiz)
        lines.append(f"**Horizontal asymptote(s): {ha_strs}**")
    else:
        lines.append("**Result: No horizontal asymptotes.**")

    return "\n\n".join(lines)


def _classify(degree: Optional[int], expr, x) -> str:
    if degree == 0:
        return "Constant"
    if degree == 1:
        return "Linear"
    if degree == 2:
        return "Quadratic"
    if degree == 3:
        return "Cubic"
    if degree is not None and degree > 3:
        return f"Polynomial (degree {degree})"
    # check for trig/exp/log
    syms_str = str(expr)
    if any(f in syms_str for f in ["sin", "cos", "tan"]):
        return "Trigonometric"
    if "exp" in syms_str or "E**" in syms_str:
        return "Exponential"
    if "log" in syms_str:
        return "Logarithmic"
    return "Function"


def _compute_inverse(expr_sympy, x, degree) -> Optional[dict]:
    """Solve f(x) = y for x, return {branches: [...latex...], note: str}."""
    # Cubics and above produce unwieldy formulas — skip them
    if degree is not None and degree >= 3:
        return None

    y = symbols('y')
    try:
        sols = solve(expr_sympy - y, x)
    except Exception:
        return None
    if not sols:
        return None

    branches = []
    for s in sols:
        inv = s.subs(y, x)
        tex_str = _latex_expr(simplify(inv))
        # Skip branches with excessively complex LaTeX
        if len(tex_str) > 120:
            continue
        branches.append(tex_str)

    if not branches:
        return None

    note = None
    if degree == 2 or len(branches) > 1:
        note = "Restrict the domain to one branch to make the inverse a function."

    return {"branches": branches, "note": note}


def _end_behavior_text(expr_sympy, degree, poly, x) -> str:
    """Return a LaTeX+text description of end behavior."""
    def fmt(val) -> str:
        if val == oo:
            return "+\\infty"
        if val == -oo:
            return "-\\infty"
        if val == zoo or val is sp.nan:
            return "\\text{undefined}"
        try:
            return _latex_expr(val)
        except Exception:
            return str(val)

    try:
        lim_pos = limit(expr_sympy, x, oo)
        lim_neg = limit(expr_sympy, x, -oo)
    except Exception:
        return ""

    lines = [
        f"$x \\to +\\infty$: $f(x) \\to {fmt(lim_pos)}$",
        f"$x \\to -\\infty$: $f(x) \\to {fmt(lim_neg)}$",
    ]

    if degree is not None and degree >= 1:
        leading = float(poly.nth(degree))
        if degree % 2 == 0:
            desc = "Both ends rise" if leading > 0 else "Both ends fall"
        else:
            desc = "Left end falls, right end rises" if leading > 0 else "Left end rises, right end falls"
        lines.append(f"**End behavior:** {desc} (degree {degree}, leading coefficient ${_latex_expr(sp.nsimplify(leading))}$)")

    return "\n\n".join(lines)


def _poly_factor_steps(poly_sym, x) -> str:
    """Brief self-contained factoring walkthrough for a single polynomial."""
    poly_exp = sp.expand(poly_sym)
    poly_fac = sp.factor(poly_exp)

    if poly_fac == poly_exp:
        return f"Already in factored form: ${_latex_expr(poly_fac)}$"

    try:
        p = sp.Poly(poly_exp, x)
        deg = int(p.degree())
    except Exception:
        return f"$$= {_latex_expr(poly_fac)}$$"

    lines = []
    a_coef = sp.nsimplify(p.nth(deg)) if deg >= 1 else sp.Integer(1)
    a_f = float(a_coef)

    # Factor out negative leading coefficient first
    working_exp = poly_exp
    factored_prefix = ""
    if deg == 2 and a_f < 0:
        if a_coef == -1:
            working_exp = sp.expand(-poly_exp)
            factored_prefix = "-1 \\cdot "
            lines.append(f"Factor out $-1$:\n\n$$-1 \\cdot ({_latex_expr(working_exp)})$$")
        else:
            gcf = sp.nsimplify(-a_coef)
            working_exp = sp.expand(poly_exp / (-gcf))
            factored_prefix = f"{_latex_expr(-gcf)} \\cdot "
            lines.append(f"Factor out ${_latex_expr(-gcf)}$:\n\n$${_latex_expr(-gcf)} \\cdot ({_latex_expr(working_exp)})$$")

    if deg == 2:
        try:
            wp = sp.Poly(working_exp, x)
            wa = sp.nsimplify(wp.nth(2))
            wb = sp.nsimplify(wp.nth(1))
            wc = sp.nsimplify(wp.nth(0))
            wa_f, wb_f, wc_f = float(wa), float(wb), float(wc)
            working_fac = sp.factor(working_exp)

            # Difference of squares: b=0, c<0, a>0
            if wb_f == 0 and wc_f < 0 and wa_f > 0:
                sqrt_a = sp.sqrt(wa)
                sqrt_mc = sp.sqrt(-wc)
                if sqrt_a.is_rational and sqrt_mc.is_rational:
                    A = f"{_latex_expr(sqrt_a)}x" if sqrt_a != 1 else "x"
                    B = _latex_expr(sqrt_mc)
                    lines.append(
                        f"Recognize **difference of squares**: $A^2 - B^2 = (A+B)(A-B)$\n\n"
                        f"$A = {A}$, $B = {B}$\n\n"
                        f"$$({_latex_expr(working_exp)}) = ({A}+{B})({A}-{B}) = {_latex_expr(working_fac)}$$"
                    )

            # Perfect square trinomial: discriminant = 0
            elif wb**2 - 4*wa*wc == 0:
                sqrt_a2 = sp.sqrt(wa)
                sqrt_c2 = sp.sqrt(abs(wc))
                A_str = "x" if sqrt_a2 == 1 else f"{_latex_expr(sqrt_a2)}x"
                sign_str = "+" if wb_f > 0 else "-"
                lines.append(
                    f"Recognize **perfect square trinomial**: $(A \\pm B)^2 = A^2 \\pm 2AB + B^2$\n\n"
                    f"$A = {A_str}$, $B = {_latex_expr(sqrt_c2)}$\n\n"
                    f"$$({_latex_expr(working_exp)}) = ({A_str} {sign_str} {_latex_expr(sqrt_c2)})^2$$"
                )

            # Monic with integer coefficients: find-two-numbers
            elif wa_f == 1 and wb_f == int(wb_f) and wc_f == int(wc_f):
                b_int, c_int = int(wb_f), int(wc_f)
                lines.append(
                    f"**Monic quadratic** ($a=1$): find $p, q$ with "
                    f"$p \\cdot q = {c_int}$ and $p + q = {b_int}$:"
                )
                found, seen = None, set()
                for pv in range(-abs(c_int)-1, abs(c_int)+2):
                    if pv == 0 or c_int % pv != 0:
                        continue
                    qv = c_int // pv
                    key = tuple(sorted((pv, qv)))
                    if key in seen:
                        continue
                    seen.add(key)
                    mark = " ✓" if pv + qv == b_int else ""
                    lines.append(f"$({pv},\\ {qv})$: product $= {pv*qv}$, sum $= {pv+qv}${mark}")
                    if pv + qv == b_int and found is None:
                        found = (pv, qv)
                    if len(seen) >= 6:
                        break
                if found:
                    pv, qv = found
                    lines.append(f"$$({_latex_expr(working_exp)}) = (x {'+' if pv>=0 else ''}{pv})(x {'+' if qv>=0 else ''}{qv})$$")

            # Non-monic: AC method
            else:
                ac = wa * wc
                lines.append(
                    f"**AC method** ($a = {_latex_expr(wa)}$):\n\n"
                    f"$AC = {_latex_expr(wa)} \\times {_latex_expr(wc)} = {_latex_expr(ac)}$\n\n"
                    f"Find $m, n$ with $m \\cdot n = {_latex_expr(ac)}$ and $m + n = {_latex_expr(wb)}$:"
                )
                if float(ac) == int(float(ac)) and wb_f == int(wb_f):
                    ac_int, b_int = int(float(ac)), int(wb_f)
                    found_mn = None
                    for mv in range(-abs(ac_int)-1, abs(ac_int)+2):
                        if mv == 0 or ac_int % mv != 0:
                            continue
                        nv = ac_int // mv
                        if mv + nv == b_int:
                            found_mn = (mv, nv)
                            break
                    if found_mn:
                        mv, nv = found_mn
                        lines.append(
                            f"$m = {mv}$, $n = {nv}$\n\n"
                            f"Split middle term and factor by grouping:\n\n"
                            f"$$({_latex_expr(working_exp)}) = {_latex_expr(working_fac)}$$"
                        )
                    else:
                        lines.append(f"$$({_latex_expr(working_exp)}) = {_latex_expr(working_fac)}$$")
                else:
                    lines.append(f"$$({_latex_expr(working_exp)}) = {_latex_expr(working_fac)}$$")
        except Exception:
            pass

    lines.append(f"**Result:** $${_latex_expr(poly_fac)}$$")
    return "\n\n".join(lines)


def _rational_factoring_detail(expr_sympy, factored, x) -> str:
    """Step-by-step for factoring a rational function: factor num, factor denom, cancel."""
    # Use the ORIGINAL (uncancelled) fraction to show all factors before cancellation
    numer_raw, denom_raw = sp.fraction(expr_sympy)
    numer_exp = sp.expand(numer_raw)
    denom_exp = sp.expand(denom_raw)
    numer_fac = sp.factor(numer_raw)
    denom_fac = sp.factor(denom_raw)

    lines = []
    lines.append(
        f"**Starting expression:**\n\n"
        f"$$f(x) = \\frac{{{_latex_expr(numer_exp)}}}{{{_latex_expr(denom_exp)}}}$$"
    )

    # Step 1: Factor numerator
    num_steps = _poly_factor_steps(numer_raw, x)
    lines.append(f"**Step 1 — Factor the numerator** $({_latex_expr(numer_exp)})$:\n\n{num_steps}")

    # Step 2: Factor denominator
    den_steps = _poly_factor_steps(denom_raw, x)
    lines.append(f"**Step 2 — Factor the denominator** $({_latex_expr(denom_exp)})$:\n\n{den_steps}")

    # Step 3: Rewrite as factored rational
    lines.append(
        f"**Step 3 — Rewrite with factored numerator and denominator:**\n\n"
        f"$$f(x) = \\frac{{{_latex_expr(numer_fac)}}}{{{_latex_expr(denom_fac)}}}$$"
    )

    # Step 4: Cancel common factors
    try:
        common = sp.gcd(numer_fac, denom_fac)
        if not common.is_number:
            common_zeros = solve(common, x)
            restriction = (
                f"$x \\neq {_latex_expr(common_zeros[0])}$" if len(common_zeros) == 1
                else ", ".join(f"$x \\neq {_latex_expr(z)}$" for z in common_zeros)
            )
            numer_rem = sp.cancel(numer_fac / common)
            denom_rem = sp.cancel(denom_fac / common)
            lines.append(
                f"**Step 4 — Cancel the common factor $({_latex_expr(common)})$** "
                f"(valid for {restriction}):\n\n"
                f"$$f(x) = \\frac{{\\cancel{{({_latex_expr(common)})}} \\cdot ({_latex_expr(numer_rem)})}}"
                f"{{\\cancel{{({_latex_expr(common)})}} \\cdot ({_latex_expr(denom_rem)})}}$$"
            )
        else:
            lines.append("**Step 4 —** No common polynomial factors to cancel.")
    except Exception:
        lines.append("**Step 4 —** No common polynomial factors to cancel.")

    lines.append(f"**Final simplified form:**\n\n$$f(x) = {_latex_expr(factored)}$$")
    return "\n\n".join(lines)


def _factoring_detail(expr_sympy, expanded, factored, degree, x, poly) -> str:
    # Route rational functions to the dedicated handler
    if degree is None:
        try:
            _, denom = sp.fraction(sp.cancel(expr_sympy))
            if denom not in (sp.Integer(1), sp.Integer(-1)):
                return _rational_factoring_detail(expr_sympy, factored, x)
        except Exception:
            pass

    lines = []
    lines.append(f"**Starting expression:** $$f(x) = {_latex_expr(expanded)}$$")

    if degree == 2:
        a = sp.nsimplify(poly.nth(2))
        b = sp.nsimplify(poly.nth(1))
        c = sp.nsimplify(poly.nth(0))
        a_f, b_f, c_f = float(a), float(b), float(c)

        # --- GCF first ---
        g = sp.gcd(sp.gcd(abs(a), abs(b)), abs(c))
        if g > 1:
            a2, b2, c2 = a / g, b / g, c / g
            lines.append(
                f"**Factor out the GCF = ${_latex_expr(g)}$:**\n\n"
                f"$$f(x) = {_latex_expr(g)}\\left({_latex_expr(a2)}x^2 {'+' if float(b2)>=0 else ''}{_latex_expr(b2)}x {'+' if float(c2)>=0 else ''}{_latex_expr(c2)}\\right)$$\n\n"
                f"Now factor the trinomial inside."
            )
            a, b, c = a2, b2, c2
            a_f, b_f, c_f = float(a), float(b), float(c)

        # --- Difference of squares: b=0, c<0, a>0 ---
        if b == 0 and c_f < 0 and a_f > 0:
            sqrt_a = sp.sqrt(a)
            sqrt_mc = sp.sqrt(-c)
            if sqrt_a.is_rational and sqrt_mc.is_rational:
                A = f"{_latex_expr(sqrt_a)}x" if sqrt_a != 1 else "x"
                B = _latex_expr(sqrt_mc)
                lines.append(
                    "**Recognize the Difference of Squares pattern:** $A^2 - B^2 = (A+B)(A-B)$\n\n"
                    f"Here $A = {A}$ and $B = {B}$\n\n"
                    f"Verify: $A^2 = {_latex_expr(a)}x^2$, $B^2 = {_latex_expr(-c)}$\n\n"
                    f"$$f(x) = ({A} + {B})({A} - {B}) = {_latex_expr(factored)}$$"
                )
                return "\n\n".join(lines)

        # --- Perfect square trinomial: discriminant = 0 ---
        disc = b**2 - 4 * a * c
        if disc == 0:
            sqrt_a = sp.sqrt(a)
            sqrt_c_abs = sp.sqrt(abs(c))
            A_str = "x" if sqrt_a == 1 else f"{_latex_expr(sqrt_a)}x"
            sign_str = "+" if b_f > 0 else "-"
            lines.append(
                "**Recognize the Perfect Square Trinomial:** $A^2 \\pm 2AB + B^2 = (A \\pm B)^2$\n\n"
                f"$A = {A_str}$, $B = {_latex_expr(sqrt_c_abs)}$\n\n"
                f"Check middle term: $2AB = 2 \\cdot {A_str} \\cdot {_latex_expr(sqrt_c_abs)} = {_latex_expr(abs(b))}x$\n\n"
                f"$$f(x) = \\left({A_str} {sign_str} {_latex_expr(sqrt_c_abs)}\\right)^2 = {_latex_expr(factored)}$$"
            )
            return "\n\n".join(lines)

        # --- Monic quadratic (a=1): "find two numbers" ---
        if a == 1:
            lines.append(
                f"**Monic quadratic** ($a = 1$):\n\n"
                f"Find two numbers $p$ and $q$ such that:\n\n"
                f"$$p + q = b = {_latex_expr(b)} \\quad \\text{{and}} \\quad p \\cdot q = c = {_latex_expr(c)}$$"
            )
            # Find integer factor pairs when possible
            if c_f == int(c_f) and b_f == int(b_f):
                c_int, b_int = int(c_f), int(b_f)
                pairs = []
                seen = set()
                for i in range(1, abs(c_int) + 1):
                    if c_int % i == 0:
                        for p, q in [(i, c_int // i), (-i, -(c_int // i)),
                                     (i, -(abs(c_int) // i)), (-i, abs(c_int) // i)]:
                            if p * q == c_int and (p, q) not in seen and (q, p) not in seen:
                                seen.add((p, q))
                                pairs.append((p, q))
                pairs = sorted(set(pairs), key=lambda t: abs(t[0]))[:6]
                if pairs:
                    pair_lines = []
                    found = None
                    for p, q in pairs:
                        check = "(works)" if p + q == b_int else ""
                        pair_lines.append(f"$({p},\\ {q})$: product $= {p*q}$, sum $= {p+q}$ {check}".strip())
                        if p + q == b_int and found is None:
                            found = (p, q)
                    lines.append("**Check factor pairs of $c = {}$:**\n\n".format(c_int) + "\n\n".join(pair_lines))
                    if found:
                        p, q = found
                        sign_p = "+" if p >= 0 else ""
                        sign_q = "+" if q >= 0 else ""
                        lines.append(
                            f"$p = {p}$, $q = {q}$ satisfies both conditions.\n\n"
                            f"Write as: $$(x {sign_p}{p})(x {sign_q}{q})$$"
                        )
            lines.append(f"$$f(x) = {_latex_expr(factored)}$$")

        # --- Non-monic: AC method ---
        else:
            ac = a * c
            lines.append(
                f"**AC Method** for $f(x) = {_latex_expr(a)}x^2 {'+' if b_f >= 0 else ''}{_latex_expr(b)}x {'+' if c_f >= 0 else ''}{_latex_expr(c)}$"
            )
            lines.append(
                f"**Step 1 — Compute $AC$:**\n\n"
                f"$$A \\cdot C = {_latex_expr(a)} \\cdot ({_latex_expr(c)}) = {_latex_expr(ac)}$$"
            )
            lines.append(
                f"**Step 2 — Find two numbers $m$ and $n$ where $m \\cdot n = {_latex_expr(ac)}$ and $m + n = {_latex_expr(b)}$:**"
            )
            found_mn = None
            if float(ac) == int(float(ac)) and b_f == int(b_f):
                ac_int, b_int = int(float(ac)), int(b_f)
                for i in range(-abs(ac_int), abs(ac_int) + 1):
                    if i != 0 and ac_int % i == 0:
                        j = ac_int // i
                        if i + j == b_int:
                            found_mn = (i, j)
                            break
            if found_mn:
                m, n = found_mn
                lines.append(f"$m = {m}$ and $n = {n}$: ${m} \\cdot {n} = {m*n}$ and ${m} + {n} = {m+n}$")
                lines.append(
                    f"**Step 3 — Split the middle term $({_latex_expr(b)}x)$ into ${m}x + {n}x$:**\n\n"
                    f"$$f(x) = {_latex_expr(a)}x^2 + {m}x + {n}x + ({_latex_expr(c)})$$"
                )
                # Factor by grouping
                g1 = sp.gcd(a, sp.Integer(m))
                inner1a = _latex_expr(a / g1)
                inner1b = _latex_expr(sp.Integer(m) / g1)
                g2_val = sp.gcd(sp.Integer(abs(n)), abs(c))
                # Determine sign for second group
                if (n > 0 and c_f > 0) or (n < 0 and c_f < 0):
                    g2 = g2_val
                else:
                    g2 = -g2_val if c_f < 0 else g2_val
                inner2a = _latex_expr(sp.Integer(n) / g2)
                inner2b = _latex_expr(c / g2)
                lines.append(
                    f"**Step 4 — Factor by grouping:**\n\n"
                    f"$$= \\left({_latex_expr(a)}x^2 + {m}x\\right) + \\left({n}x + {_latex_expr(c)}\\right)$$\n\n"
                    f"$$= {_latex_expr(g1)}x\\left({inner1a}x + {inner1b}\\right) + {_latex_expr(g2)}\\left({inner2a}x + {inner2b}\\right)$$\n\n"
                    f"**Step 5 — Factor out the common binomial:**\n\n"
                    f"$$f(x) = {_latex_expr(factored)}$$"
                )
            else:
                lines.append(f"$$f(x) = {_latex_expr(factored)}$$")

    elif degree is not None and degree >= 3:
        lines.append(
            "**Strategy for higher-degree polynomials:**\n\n"
            "1. Check for a GCF across all terms.\n\n"
            "2. Use the **Rational Root Theorem**: possible rational roots are $\\pm\\dfrac{p}{q}$ "
            "where $p$ divides the constant term and $q$ divides the leading coefficient.\n\n"
            "3. Test candidates with synthetic division or direct substitution.\n\n"
            "4. Divide out confirmed roots and repeat on the reduced polynomial."
        )
        if poly:
            leading = sp.nsimplify(poly.nth(degree))
            const_t = sp.nsimplify(poly.nth(0))
            lines.append(
                f"Here the leading coefficient is ${_latex_expr(leading)}$ and the constant term is ${_latex_expr(const_t)}$."
            )
        lines.append(f"**Factored result:** $$f(x) = {_latex_expr(factored)}$$")

    else:
        lines.append(f"$$f(x) = {_latex_expr(factored)}$$")

    return "\n\n".join(lines)


def _build_steps(expr_sympy, expanded, degree, x, poly) -> list[dict]:
    steps = []

    # Constant — short-circuit with a single descriptive step
    if degree == 0:
        val = _latex_expr(expanded)
        steps.append({
            "title": "Identify the function",
            "content": f"This is a **constant function**: $f(x) = {val}$.\n\nThe output is always ${val}$ regardless of $x$. Its graph is a horizontal line at $y = {val}$."
        })
        return steps

    # Step 1: Identify type + end behavior
    if degree is not None:
        end_beh = _end_behavior_text(expr_sympy, degree, poly, x)
        content = f"This is a **degree-{degree} polynomial**. Expanded standard form: $${_latex_expr(expanded)}$$"
        if end_beh:
            content += f"\n\n**End behavior:**\n\n{end_beh}"
        steps.append({"title": "Identify the function", "content": content})

    # Step 2: Find roots
    try:
        roots = solve(expr_sympy, x)
        if roots:
            root_str = ",\\ ".join(_latex_expr(r) for r in roots)
            steps.append({
                "title": "Find the zeros (x-intercepts)",
                "content": _root_steps(expr_sympy, expanded, degree, x, poly, roots)
            })
    except Exception:
        pass

    # Step 3: Y-intercept
    try:
        y_int = expr_sympy.subs(x, 0)
        steps.append({
            "title": "Find the y-intercept",
            "content": f"Substitute $x=0$:\n$$f(0) = {_latex_expr(simplify(y_int))}$$\nY-intercept: $(0,\\ {_latex_expr(simplify(y_int))})$"
        })
    except Exception:
        pass

    # Step 4: Vertex (quadratic only)
    if degree == 2:
        try:
            a = poly.nth(2)
            b = poly.nth(1)
            c = poly.nth(0)
            a_s = sp.nsimplify(a)
            b_s = sp.nsimplify(b)
            c_s = sp.nsimplify(c)
            h = sp.nsimplify(-b / (2 * a))
            k = simplify(expr_sympy.subs(x, h))
            opens = "upward" if float(a) > 0 else "downward"
            steps.append({
                "title": "Find the vertex and axis of symmetry",
                "content": (
                    f"For $f(x) = ax^2 + bx + c$, where $a={_latex_expr(a_s)},\\ b={_latex_expr(b_s)},\\ c={_latex_expr(c_s)}$\n\n"
                    f"**Axis of symmetry:** $x = -\\dfrac{{b}}{{2a}} = -\\dfrac{{{_latex_expr(b_s)}}}{{2({_latex_expr(a_s)})}} = {_latex_expr(h)}$\n\n"
                    f"**Vertex x-coordinate:** $h = {_latex_expr(h)}$\n\n"
                    f"**Vertex y-coordinate:** $k = f({_latex_expr(h)}) = {_latex_expr(k)}$\n\n"
                    f"**Vertex:** $({_latex_expr(h)},\\ {_latex_expr(k)})$\n\n"
                    f"The parabola opens **{opens}** because $a = {_latex_expr(a_s)} {'> 0' if float(a) > 0 else '< 0'}$."
                )
            })
        except Exception:
            pass

    # Step 5: Factored form (with detailed walkthrough)
    try:
        factored = factor(expr_sympy)
        if factored != expanded:
            content = _factoring_detail(expr_sympy, expanded, factored, degree, x, poly)
            steps.append({
                "title": "Factor the expression",
                "content": content,
            })
    except Exception:
        pass

    # Step 6: Derivative
    try:
        deriv = diff(expr_sympy, x)
        steps.append({
            "title": "Derivative",
            "content": f"$$f'(x) = {_latex_expr(simplify(deriv))}$$"
        })
    except Exception:
        pass

    return steps


def _root_steps(expr_sympy, expanded, degree, x, poly, roots) -> str:
    lines = []
    if degree == 2:
        try:
            a = poly.nth(2)
            b = poly.nth(1)
            c = poly.nth(0)
            a_s = sp.nsimplify(a)
            b_s = sp.nsimplify(b)
            c_s = sp.nsimplify(c)
            disc = b**2 - 4*a*c
            disc_s = sp.nsimplify(disc)
            lines.append(f"Using the quadratic formula for $f(x) = {_latex_expr(expanded)}$:")
            lines.append(f"$$x = \\frac{{-b \\pm \\sqrt{{b^2 - 4ac}}}}{{2a}}$$")
            lines.append(f"$$a = {_latex_expr(a_s)},\\quad b = {_latex_expr(b_s)},\\quad c = {_latex_expr(c_s)}$$")
            lines.append(f"$$\\Delta = b^2 - 4ac = ({_latex_expr(b_s)})^2 - 4({_latex_expr(a_s)})({_latex_expr(c_s)}) = {_latex_expr(disc_s)}$$")
            if float(disc) > 0:
                lines.append(f"$$x = \\frac{{-({_latex_expr(b_s)}) \\pm \\sqrt{{{_latex_expr(disc_s)}}}}}{{2({_latex_expr(a_s)})}}$$")
                root_str = ",\\quad ".join(f"x = {_latex_expr(r)}" for r in roots)
                lines.append(f"$$" + root_str + "$$")
            elif float(disc) == 0:
                lines.append(f"Discriminant $= 0$, so there is one repeated root:")
                lines.append(f"$$x = {_latex_expr(roots[0])}$$")
            else:
                lines.append(f"Discriminant $< 0$: no real roots (complex roots only).")
        except Exception as e:
            lines.append(f"Roots: " + ",\\ ".join(_latex_expr(r) for r in roots))
    else:
        root_str = ",\\quad ".join(f"x = {_latex_expr(r)}" for r in roots)
        lines.append(f"Setting $f(x) = 0$ and solving:")
        lines.append(f"$${root_str}$$")

    return "\n\n".join(lines)


def analyze_piecewise(raw_expr: str) -> dict:
    x = symbols('x')
    try:
        expr_sym = parse_expr(
            normalize_for_sympy(raw_expr),
            transformations=TRANSFORMATIONS,
            local_dict={"x": x, "e": sp.E, "pi": sp.pi},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse '{raw_expr}': {e}")

    pieces = expr_sym.args

    def get_breakpoints(cond):
        bps = set()
        if cond == sp.true or cond == sp.false:
            return bps
        if isinstance(cond, (sp.And, sp.Or)):
            for arg in cond.args:
                bps |= get_breakpoints(arg)
        elif isinstance(cond, sp.core.relational.Relational):
            lhs, rhs = cond.lhs, cond.rhs
            if lhs == x and rhs.is_number:
                bps.add(rhs)
            elif rhs == x and lhs.is_number:
                bps.add(lhs)
        return bps

    all_bps = set()
    for _, c in pieces:
        all_bps |= get_breakpoints(c)
    all_bps = sorted(all_bps, key=float)

    def side_piece(bp, sign):
        """Return the piece expression that applies just before (sign=-1) or after (sign=+1) bp."""
        eps = sp.Rational(1, 1000000)
        test = bp + sign * eps
        for val_sym, cond_sym in pieces:
            if cond_sym == sp.true:
                return val_sym
            try:
                if bool(cond_sym.subs(x, test)):
                    return val_sym
            except Exception:
                pass
        return None

    continuity = []
    for bp in all_bps:
        entry = {"x": latex(bp), "left_lim": None, "right_lim": None,
                 "value": None, "left_deriv": None, "right_deriv": None,
                 "continuous": None, "differentiable": None}
        try:
            lp = side_piece(bp, -1)
            rp = side_piece(bp,  1)
            ll = sp.nsimplify(lp.subs(x, bp)) if lp is not None else None
            rl = sp.nsimplify(rp.subs(x, bp)) if rp is not None else None
            vv = sp.nsimplify(expr_sym.subs(x, bp))
            if ll is not None:
                entry["left_lim"]  = latex(ll)
                entry["right_lim"] = latex(rl) if rl is not None else latex(ll)
                entry["value"]     = latex(vv)
                rl_use = rl if rl is not None else ll
                lims_eq  = bool(sp.Eq(sp.simplify(ll - rl_use), 0))
                val_eq   = bool(sp.Eq(sp.simplify(ll - vv), 0))
                entry["continuous"] = lims_eq and val_eq
        except Exception:
            pass
        if entry["continuous"]:
            try:
                lp = side_piece(bp, -1)
                rp = side_piece(bp,  1)
                ld = sp.nsimplify(sp.diff(lp, x).subs(x, bp)) if lp is not None else None
                rd = sp.nsimplify(sp.diff(rp, x).subs(x, bp)) if rp is not None else None
                if ld is not None and rd is not None:
                    entry["left_deriv"]  = latex(ld)
                    entry["right_deriv"] = latex(rd)
                    entry["differentiable"] = bool(sp.Eq(sp.simplify(ld - rd), 0))
            except Exception:
                pass
        continuity.append(entry)

    # Y-intercept
    y_intercept = None
    try:
        yv = expr_sym.subs(x, 0)
        if yv.is_real:
            y_intercept = _fmt(yv)
    except Exception:
        pass

    # Zeros
    zero_list = []
    seen_zeros = set()
    for val_sym, cond_sym in pieces:
        try:
            roots = solve(val_sym, x)
            for r in roots:
                if not r.is_real:
                    continue
                if cond_sym == sp.true:
                    passes = True
                else:
                    try:
                        passes = bool(cond_sym.subs(x, r))
                    except Exception:
                        passes = False
                if passes:
                    key = str(sp.nsimplify(r))
                    if key not in seen_zeros:
                        seen_zeros.add(key)
                        exact = latex(r)
                        try:
                            dec = f"{float(r):.4f}".rstrip('0').rstrip('.')
                        except Exception:
                            dec = exact
                        zero_list.append({"exact": exact, "decimal": dec})
        except Exception:
            pass

    # Domain
    domain_str = None
    try:
        if any(c == sp.true for _, c in pieces):
            domain_str = r"\mathbb{R}"
        else:
            from sympy.solvers.inequalities import solve_univariate_inequality
            from sympy import Union as SUnion
            parts = []
            for _, cond_sym in pieces:
                try:
                    parts.append(solve_univariate_inequality(cond_sym, x, relational=False))
                except Exception:
                    pass
            if parts:
                domain_str = latex(SUnion(*parts) if len(parts) > 1 else parts[0])
    except Exception:
        pass

    return {
        "expression": raw_expr,
        "type": "piecewise",
        "latex": latex(expr_sym),
        "pieces": [{"expr": latex(v), "cond": latex(c) if c != sp.true else r"\text{otherwise}"} for v, c in pieces],
        "continuity": continuity,
        "y_intercept": y_intercept,
        "roots": zero_list,
        "domain": domain_str,
        "degree": None, "expanded": None, "factored": None, "vertex": None,
        "axis_of_symmetry": None, "range": None, "inverse": None,
        "steps": [], "linear_forms": None,
        "vertical_asymptotes": [], "horizontal_asymptotes": [],
        "vertical_asymptote_steps": "", "horizontal_asymptote_steps": "",
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if 'Piecewise' in req.expression:
        return analyze_piecewise(req.expression)
    return analyze_expression(req.expression)


# ── Linear forms helpers ──────────────────────────────────────────────────────

def _lf_mx(m_sym) -> str:
    """Format m·x as LaTeX: '2x', '-x', '\\frac{1}{2}x', etc."""
    if m_sym == 1:
        return 'x'
    if m_sym == -1:
        return '-x'
    return f'{latex(m_sym)}x'


def _build_linear_forms(m_sym, b_sym) -> dict:
    import math as _math
    m_sym = sp.nsimplify(m_sym)
    b_sym = sp.nsimplify(b_sym)
    m_l = latex(m_sym)
    b_l = latex(b_sym)
    b_abs_l = latex(abs(b_sym))
    mx = _lf_mx(m_sym)

    # Slope-intercept: y = mx + b
    if b_sym == 0:
        si = f"y = {mx}"
    elif b_sym > 0:
        si = f"y = {mx} + {b_l}"
    else:
        si = f"y = {mx} - {b_abs_l}"

    # Point-slope using y-intercept (0, b): y - b = m·x
    if b_sym == 0:
        ps = f"y = {mx}"
    elif b_sym > 0:
        ps = f"y - {b_l} = {mx}"
    else:
        ps = f"y + {b_abs_l} = {mx}"

    # Standard form Ax + By = C (integers, A > 0, gcd reduced)
    m_rat = sp.Rational(m_sym)
    b_rat = sp.Rational(b_sym)
    denom = int(sp.lcm(sp.Integer(m_rat.q), sp.Integer(b_rat.q)))
    A_raw = int(-m_rat * denom)
    B_raw = int(denom)
    C_raw = int(b_rat * denom)
    g = _math.gcd(_math.gcd(abs(A_raw), abs(B_raw)), abs(C_raw)) if C_raw != 0 \
        else _math.gcd(abs(A_raw), abs(B_raw))
    A, B, C = A_raw // max(g, 1), B_raw // max(g, 1), C_raw // max(g, 1)
    if A < 0:
        A, B, C = -A, -B, -C

    def _ax(a):
        if a == 1: return 'x'
        if a == -1: return '-x'
        return f'{a}x'
    def _by(b):
        if b == 0: return ''
        if b == 1: return '+ y'
        if b == -1: return '- y'
        return f'+ {b}y' if b > 0 else f'- {abs(b)}y'

    std = f"{_ax(A)} {_by(B)} = {C}".strip()

    return {
        "slope_intercept": si,
        "point_slope": ps,
        "standard": std,
        "slope": m_l,
        "b": b_l,
        "A": A, "B": B, "C": C,
    }


# ── Conversion step generators ────────────────────────────────────────────────

def _conv_si_to_ps(m, b, f) -> list:
    b_l, mx = f['b'], _lf_mx(m)
    b_abs = latex(abs(b))
    point = f"(0,\\ {b_l})"
    y_minus_b = f"y + {b_abs}" if b < 0 else (f"y - {b_l}" if b != 0 else "y")
    return [
        {"title": "Start with Slope-Intercept Form",
         "content": f"$${f['slope_intercept']}$$"},
        {"title": "Identify the slope and a known point",
         "content": f"The slope is $m = {f['slope']}$.\n\nThe y-intercept gives us a known point directly: $b = {b_l}$, so $(x_1, y_1) = {point}$."},
        {"title": "Substitute into the Point-Slope template",
         "content": f"Point-slope form: $y - y_1 = m(x - x_1)$\n\nSubstitute $m = {f['slope']}$, $x_1 = 0$, $y_1 = {b_l}$:\n\n$$y - ({b_l}) = {f['slope']}(x - 0)$$"},
        {"title": "Simplify",
         "content": f"Since $x - 0 = x$:\n\n$${f['point_slope']}$$"},
    ]


def _conv_si_to_std(m, b, f) -> list:
    import math as _math
    m_sym = sp.nsimplify(m)
    b_sym = sp.nsimplify(b)
    m_rat = sp.Rational(m_sym)
    b_rat = sp.Rational(b_sym)
    mx = _lf_mx(m_sym)
    neg_mx = _lf_mx(-m_sym)
    A, B, C = f['A'], f['B'], f['C']

    steps = [
        {"title": "Start with Slope-Intercept Form",
         "content": f"$${f['slope_intercept']}$$\n\nGoal: reach $Ax + By = C$ with $A, B, C$ integers and $A \\geq 0$."},
        {"title": "Subtract the x-term from both sides",
         "content": f"Subtract ${latex(m_sym)}x$ from both sides:\n\n$$y - {latex(m_sym)}x = {f['b']}$$\n\nRewrite with $x$ first:\n\n$${latex(-m_sym)}x + y = {f['b']}$$"},
    ]

    denom = int(sp.lcm(sp.Integer(m_rat.q), sp.Integer(b_rat.q)))
    if denom > 1:
        A_pre = int(-m_rat * denom)
        C_pre = int(b_rat * denom)
        steps.append({
            "title": f"Multiply through by {denom} to clear fractions",
            "content": f"$$\\cdot {denom}:\\quad {A_pre}x + {denom}y = {C_pre}$$"
        })

    g = _math.gcd(_math.gcd(abs(int(-m_rat*denom)), denom), abs(int(b_rat*denom))) if int(b_rat*denom) != 0 \
        else _math.gcd(abs(int(-m_rat*denom)), denom)
    A_pre_sign = int(-m_rat * denom) // max(g, 1)
    if A_pre_sign < 0:
        steps.append({
            "title": "Multiply by −1 to make A positive",
            "content": f"The coefficient of $x$ is negative. Multiply every term by $-1$:\n\n$${f['standard']}$$"
        })
    if g > 1:
        steps.append({
            "title": f"Divide through by the GCD = {g}",
            "content": f"$\\gcd(|A|, |B|, |C|) = {g}$. Divide every term by ${g}$:\n\n$${f['standard']}$$"
        })

    steps.append({"title": "Standard Form", "content": f"$$\\boxed{{{f['standard']}}}$$"})
    return steps


def _conv_ps_to_si(m, b, f) -> list:
    b_sym = sp.nsimplify(b)
    b_l = f['b']
    b_abs = latex(abs(b_sym))
    lhs = f"y + {b_abs}" if b_sym < 0 else (f"y - {b_l}" if b_sym != 0 else "y")
    b_disp = f"+ {b_l}" if b_sym > 0 else (f"- {b_abs}" if b_sym < 0 else "")
    return [
        {"title": "Start with Point-Slope Form",
         "content": f"$${f['point_slope']}$$\n\nHere the known point is $(x_1, y_1) = (0,\\ {b_l})$."},
        {"title": "Add b to both sides to isolate y",
         "content": f"Add ${b_l}$ to both sides:\n\n$${lhs} + ({b_l}) = {f['slope']}x + ({b_l})$$\n\n$$y = {f['slope']}x {b_disp}$$"},
        {"title": "Slope-Intercept Form",
         "content": f"$$\\boxed{{{f['slope_intercept']}}}$$"},
    ]


def _conv_ps_to_std(m, b, f) -> list:
    si_steps = _conv_ps_to_si(m, b, f)
    std_steps = _conv_si_to_std(m, b, f)
    return si_steps + [
        {"title": "Now convert to Standard Form",
         "content": f"We have ${f['slope_intercept']}$. Apply the Slope-Intercept → Standard conversion:"}
    ] + std_steps[1:]


def _conv_std_to_si(m, b, f) -> list:
    A, B, C = f['A'], f['B'], f['C']
    neg_A = -A
    b_disp = f"+ {f['b']}" if sp.nsimplify(b) > 0 else (f"- {latex(abs(sp.nsimplify(b)))}" if sp.nsimplify(b) < 0 else "")
    return [
        {"title": "Start with Standard Form",
         "content": f"$${f['standard']}$$"},
        {"title": "Subtract Ax from both sides",
         "content": f"$$By = -{A}x + {C}$$"},
        {"title": "Divide every term by B = " + str(B),
         "content": f"$$y = \\frac{{-{A}}}{{{B}}}x + \\frac{{{C}}}{{{B}}}$$\n\nSimplify the fractions:\n\n$$y = {f['slope']}x {b_disp}$$"},
        {"title": "Slope-Intercept Form",
         "content": f"$$\\boxed{{{f['slope_intercept']}}}$$"},
    ]


def _conv_std_to_ps(m, b, f) -> list:
    si_steps = _conv_std_to_si(m, b, f)
    ps_steps = _conv_si_to_ps(m, b, f)
    return si_steps + [
        {"title": "Now convert to Point-Slope Form",
         "content": f"We have ${f['slope_intercept']}$. Apply the Slope-Intercept → Point-Slope conversion:"}
    ] + ps_steps[1:]


_CONV_FNS = {
    ("slope_intercept", "point_slope"):    _conv_si_to_ps,
    ("slope_intercept", "standard"):       _conv_si_to_std,
    ("point_slope",     "slope_intercept"): _conv_ps_to_si,
    ("point_slope",     "standard"):        _conv_ps_to_std,
    ("standard",        "slope_intercept"): _conv_std_to_si,
    ("standard",        "point_slope"):     _conv_std_to_ps,
}


class ConvertFormRequest(BaseModel):
    expression: str
    from_form: str
    to_form: str


@app.post("/convert-form")
def convert_form(req: ConvertFormRequest):
    if req.from_form == req.to_form:
        raise HTTPException(status_code=400, detail="from_form and to_form must differ")
    key = (req.from_form, req.to_form)
    if key not in _CONV_FNS:
        raise HTTPException(status_code=400, detail=f"Unknown conversion: {req.from_form} → {req.to_form}")

    x = symbols('x')
    try:
        expr_sympy = parse_expr(
            normalize_for_sympy(req.expression),
            transformations=TRANSFORMATIONS,
            local_dict={"x": x, "e": sp.E, "pi": sp.pi},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse: {e}")

    poly = sp.Poly(expr_sympy, x) if expr_sympy.is_polynomial(x) else None
    if not poly or int(poly.degree()) != 1:
        raise HTTPException(status_code=400, detail="Only linear (degree-1) functions are supported")

    m_sym = sp.nsimplify(poly.nth(1))
    b_sym = sp.nsimplify(poly.nth(0))
    forms = _build_linear_forms(m_sym, b_sym)
    steps = _CONV_FNS[key](m_sym, b_sym, forms)
    return {"steps": steps}


class SurfaceRequest(BaseModel):
    mode: str = "explicit"
    expression: Optional[str] = None
    x_range: list = [-5.0, 5.0]
    y_range: list = [-5.0, 5.0]
    x_expr: Optional[str] = None
    y_expr: Optional[str] = None
    z_expr: Optional[str] = None
    u_range: list = [0.0, 6.2832]
    v_range: list = [0.0, 6.2832]
    num_points: int = 60


def _eval_surface_expr(expr_str: str, namespace: dict) -> np.ndarray:
    expr_np = normalize_for_numpy(expr_str)
    result = eval(expr_np, {"__builtins__": {}}, namespace)
    return result


@app.post("/surface")
def compute_surface(req: SurfaceRequest):
    try:
        n = min(max(req.num_points, 10), 120)

        if req.mode == "explicit":
            if not req.expression:
                raise HTTPException(status_code=400, detail="expression required")
            x_vals = np.linspace(req.x_range[0], req.x_range[1], n)
            y_vals = np.linspace(req.y_range[0], req.y_range[1], n)
            X, Y = np.meshgrid(x_vals, y_vals)
            ns = {**NUMPY_SAFE, "x": X, "y": Y}
            Z = _eval_surface_expr(req.expression, ns)
            if np.ndim(Z) == 0:
                Z = np.full(X.shape, float(Z))
            Z = np.where(np.isfinite(Z), Z, np.nan)
            return {"X": X.tolist(), "Y": Y.tolist(), "Z": Z.tolist()}

        elif req.mode == "parametric":
            if not (req.x_expr and req.y_expr and req.z_expr):
                raise HTTPException(status_code=400, detail="x_expr, y_expr, z_expr required")
            u_vals = np.linspace(req.u_range[0], req.u_range[1], n)
            v_vals = np.linspace(req.v_range[0], req.v_range[1], n)
            U, V = np.meshgrid(u_vals, v_vals)
            ns = {**NUMPY_SAFE, "u": U, "v": V}
            X = _eval_surface_expr(req.x_expr, ns)
            Y = _eval_surface_expr(req.y_expr, ns)
            Z = _eval_surface_expr(req.z_expr, ns)
            for arr in [X, Y, Z]:
                if np.ndim(arr) == 0:
                    arr = np.full(U.shape, float(arr))
            X = np.where(np.isfinite(X), X, np.nan)
            Y = np.where(np.isfinite(Y), Y, np.nan)
            Z = np.where(np.isfinite(Z), Z, np.nan)
            return {"X": X.tolist(), "Y": Y.tolist(), "Z": Z.tolist()}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CalcRequest(BaseModel):
    expression: str
    order: int = 1
    x0: float = 0.0


class IntegrateRequest(BaseModel):
    expression: str
    a: float
    b: float


@app.post("/differentiate")
def differentiate(req: CalcRequest):
    x = symbols('x')
    try:
        expr_sympy = parse_expr(
            normalize_for_sympy(req.expression),
            transformations=TRANSFORMATIONS,
            local_dict={"x": x, "e": sp.E, "pi": sp.pi},
        )
        d = expr_sympy
        for _ in range(max(1, min(req.order, 5))):
            d = diff(d, x)
        d_simp = simplify(d)
        try:
            f_at_x0 = float(expr_sympy.subs(x, req.x0))
            d_at_x0 = float(d_simp.subs(x, req.x0))
        except Exception:
            f_at_x0 = None
            d_at_x0 = None
        return {
            "derivative": str(d_simp),
            "latex": latex(d_simp),
            "f_at_x0": f_at_x0,
            "derivative_at_x0": d_at_x0,
            "order": req.order,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/integrate")
def integrate_sym(req: IntegrateRequest):
    x = symbols('x')
    try:
        expr_sympy = parse_expr(
            normalize_for_sympy(req.expression),
            transformations=TRANSFORMATIONS,
            local_dict={"x": x, "e": sp.E, "pi": sp.pi},
        )
        indef = sp.integrate(expr_sympy, x)
        def_val = sp.integrate(expr_sympy, (x, req.a, req.b))
        def_simp = simplify(def_val)
        indef_simp = simplify(indef)
        return {
            "antiderivative": str(indef_simp),
            "antiderivative_latex": latex(indef_simp),
            "definite_value": float(def_simp),
            "definite_latex": latex(def_simp),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CalculateRequest(BaseModel):
    expression: str
    variables: dict = {}


@app.post("/calculate")
def calculate(req: CalculateRequest):
    x_sym = symbols('x')
    local = {"x": x_sym, "e": sp.E, "pi": sp.pi}

    # Parse variable definitions
    var_map = {}   # symbol → sympy value
    var_display = {}  # name → latex string
    for name, val_str in req.variables.items():
        if not name.strip() or not val_str.strip():
            continue
        try:
            sym = symbols(name.strip())
            val = parse_expr(normalize_for_sympy(val_str.strip()),
                             transformations=TRANSFORMATIONS,
                             local_dict={**local, name.strip(): sym})
            var_map[sym] = val
            var_display[name.strip()] = latex(val)
            local[name.strip()] = sym
        except Exception:
            pass

    # Detect equation (has = but not ==)
    raw = req.expression.strip()
    is_equation = '=' in raw and '==' not in raw
    steps = []

    try:
        if is_equation:
            lhs_str, rhs_str = raw.split('=', 1)
            lhs = parse_expr(normalize_for_sympy(lhs_str), transformations=TRANSFORMATIONS, local_dict=local)
            rhs = parse_expr(normalize_for_sympy(rhs_str), transformations=TRANSFORMATIONS, local_dict=local)
            expr_sympy = lhs - rhs

            steps.append({"label": "Equation", "expr": f"{latex(lhs)} = {latex(rhs)}"})

            # Substitute variables
            for sym, val in var_map.items():
                new_lhs = lhs.subs(sym, val)
                new_rhs = rhs.subs(sym, val)
                if new_lhs != lhs or new_rhs != rhs:
                    steps.append({
                        "label": f"Substitute ${latex(sym)} = {latex(val)}$",
                        "expr": f"{latex(new_lhs)} = {latex(new_rhs)}"
                    })
                lhs, rhs = new_lhs, new_rhs

            # Free symbols remaining after substitution
            remaining = (lhs - rhs).free_symbols
            if not remaining:
                # Just check if true
                result_val = simplify(lhs - rhs)
                if result_val == 0:
                    result_str = "True (identity)"
                else:
                    result_str = f"False (difference = {latex(result_val)})"
                steps.append({"label": "Result", "expr": result_str})
                return {"result": result_str, "result_latex": result_str, "steps": steps,
                        "numeric": None, "is_equation": True, "solutions": []}
            else:
                solve_for = list(remaining)[0]
                steps.append({"label": f"Solve for ${latex(solve_for)}$",
                               "expr": f"{latex(lhs)} = {latex(rhs)}"})
                sols = solve(lhs - rhs, solve_for)
                sol_latex = [latex(s) for s in sols]
                sol_display = ",\\quad ".join(f"{latex(solve_for)} = {s}" for s in sol_latex) if sol_latex else "No solution"
                steps.append({"label": "Solution", "expr": sol_display})
                try:
                    numerics = [float(s) for s in sols]
                except Exception:
                    numerics = []
                return {"result": sol_display, "result_latex": sol_display,
                        "steps": steps, "numeric": numerics[0] if len(numerics) == 1 else None,
                        "is_equation": True, "solutions": sol_latex}

        else:
            # Expression evaluation
            expr_sympy = parse_expr(normalize_for_sympy(raw),
                                    transformations=TRANSFORMATIONS, local_dict=local)
            steps.append({"label": "Expression", "expr": latex(expr_sympy)})

            # Substitute variables one at a time
            current = expr_sympy
            for sym, val in var_map.items():
                substituted = current.subs(sym, val)
                if substituted != current:
                    steps.append({
                        "label": f"Substitute ${latex(sym)} = {latex(val)}$",
                        "expr": latex(substituted)
                    })
                current = substituted

            # Simplify
            simplified = simplify(current)
            if simplified != current:
                steps.append({"label": "Simplify", "expr": latex(simplified)})
            current = simplified

            # Numeric
            numeric = None
            if current.is_number:
                try:
                    numeric = float(current)
                    approx = f"{numeric:.10g}"
                    exact_str = latex(current)
                    if exact_str != approx:
                        steps.append({"label": "Exact", "expr": exact_str})
                        steps.append({"label": "Decimal", "expr": approx})
                    else:
                        steps.append({"label": "Result", "expr": exact_str})
                except Exception:
                    steps.append({"label": "Result", "expr": latex(current)})
            else:
                steps.append({"label": "Result", "expr": latex(current)})

            return {
                "result": str(current),
                "result_latex": latex(current),
                "steps": steps,
                "numeric": numeric,
                "is_equation": False,
                "solutions": [],
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
