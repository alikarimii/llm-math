/**
 * Shared numeric-cell formatting for figures that render raw matrix/vector
 * entries (Matrix, Vector). Causal masking legitimately sets attention
 * scores to -Infinity — that is correct data, not a bug — so it must render
 * as the mathematical symbol it represents rather than as the JS string
 * `(-Infinity).toFixed(2)` produces ("-Infinity"), which reads as broken UI
 * and can blow out a grid layout.
 *
 * NaN, by contrast, never has a legitimate meaning at these call sites. If
 * one ever appears it indicates an actual computation bug, so it is flagged
 * as `invalid` rather than treated like a masked value — callers should
 * render it in a way that stands out (not muted like a mask).
 */
export interface CellDisplay {
  /** Text to render in place of `v.toFixed(2)`. */
  text: string
  /** True for ±Infinity: a legitimate, expected "masked out" value. */
  masked: boolean
  /** True for NaN: never expected: a real bug the reader should notice. */
  invalid: boolean
}

const MINUS_INFINITY = '−∞' // −∞ (U+2212 MINUS SIGN, U+221E INFINITY)
const PLUS_INFINITY = '∞' // ∞

export function formatCell(v: number): CellDisplay {
  if (Number.isNaN(v)) {
    return { text: 'NaN', masked: false, invalid: true }
  }
  if (v === -Infinity) {
    return { text: MINUS_INFINITY, masked: true, invalid: false }
  }
  if (v === Infinity) {
    return { text: PLUS_INFINITY, masked: true, invalid: false }
  }
  return { text: v.toFixed(2), masked: false, invalid: false }
}

/**
 * Formats a value for contexts where the reader needs to read an actual
 * number off the figure, not just perceive its rendered magnitude — e.g.
 * the AttentionGrid cell tooltip. `formatCell`'s fixed `toFixed(2)` is right
 * for a value that only has to fill a grid cell at a glance, but fixed
 * decimals actively destroy information at the extremes attention weights
 * actually take: a self-attention weight of 0.999985 and a true 1.0 both
 * round to "1.000", and every near-zero weight (real values run to ~1e-7)
 * rounds to "0.000". Both collisions erase exactly the distinction a reader
 * is trying to read off the tooltip.
 *
 * Strategy:
 *  - Near zero (|v| < 1e-3): exponential notation, so both the magnitude
 *    and its order of magnitude survive (e.g. 2.70e-7, 3.00e-4).
 *  - Elsewhere in (-1, 1): fixed-decimal, growing the decimal count from 3
 *    until the rounded string stops reading as exactly the nearest integer
 *    (0 or ±1) — so 0.999985 renders as "0.99999", not "1.000", while a
 *    mid-range value like 0.05 still renders as a short "0.050".
 *  - Everywhere else (|v| >= 1): 3 significant figures.
 */
export function formatSignificant(v: number): string {
  if (Number.isNaN(v)) {
    return 'NaN'
  }
  if (v === -Infinity) {
    return MINUS_INFINITY
  }
  if (v === Infinity) {
    return PLUS_INFINITY
  }
  if (v === 0) {
    return '0'
  }

  const abs = Math.abs(v)

  if (abs < 1e-3) {
    return v.toExponential(2)
  }

  if (abs < 1) {
    const nearestInt = Math.round(v)
    for (let digits = 3; digits <= 15; digits++) {
      const fixed = v.toFixed(digits)
      if (Number(fixed) !== nearestInt) return fixed
    }
    return v.toFixed(15)
  }

  return v.toPrecision(3)
}
