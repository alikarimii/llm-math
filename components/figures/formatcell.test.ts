import { describe, it, expect } from 'vitest'
import { forward } from '../../lib/transformer/forward'
import { formatCell, formatSignificant } from './formatCell'

/**
 * `formatSignificant` is where the page's central promise — that every number
 * shown is the real number, honestly rendered — actually lives. It is also
 * trivially reversible: swap its body for `v.toFixed(3)` and every other test
 * in the suite still passes, while the tooltips quietly start lying.
 *
 * So the values under test are not invented. They are pulled from a real
 * forward pass of the real trained model, through the exact rows the lesson
 * asks the reader to inspect: the `it` row of head 0's attention, for the
 * `dog` sentence the lesson walks through and the `cat` sentence the playground
 * invites the reader to try.
 */
const IT = 5 // the query token the lesson follows
const itRow = (subject: string): number[] =>
  forward(['the', subject, 'drank', 'water', 'so', 'it']).weights[0][IT]

const DOG = itRow('dog')
const CAT = itRow('cat')

describe('formatSignificant preserves what the reader came to read', () => {
  it('renders the real attention row for `dog` without collapsing it', () => {
    // Every weight in the row, formatted. Values verified against the model.
    expect(DOG.map(formatSignificant)).toEqual([
      '2.54e-11', // the
      '0.99999',  // dog   <- the antecedent: near 1, but NOT 1
      '1.37e-11', // drank
      '3.84e-15', // water
      '4.90e-15', // so
      '1.49e-5',  // it    <- the residual self-attention: tiny, but NOT 0
    ])
  })

  it('renders the real attention row for `cat`, where `it` attends to itself', () => {
    expect(CAT.map(formatSignificant)).toEqual([
      '1.70e-6',  // the
      '2.69e-4',  // cat
      '9.17e-7',  // drank
      '2.57e-10', // water
      '3.28e-10', // so
      '0.9997',   // it    <- the freeloading self-attention the lesson calls out
    ])
  })

  it('THE property: values that toFixed(3) fused into one string stay distinct', () => {
    // This is the whole point, and the assertion that fails if anyone reverts
    // formatSignificant to a fixed-decimal format.
    for (const [name, row] of [['dog', DOG], ['cat', CAT]] as const) {
      const old = new Set(row.map(v => v.toFixed(3)))
      const now = new Set(row.map(formatSignificant))

      // The old format destroyed the row: six genuinely different weights,
      // spanning ten orders of magnitude, rendered as two strings.
      expect(old.size, `${name}: toFixed(3) should be lossy`).toBeLessThan(row.length)
      expect(old, `${name}: toFixed(3) collapses to 0.000/1.000`).toEqual(
        new Set(['0.000', '1.000'])
      )

      // The new one keeps all six readable and, crucially, all six different.
      expect(now.size, `${name}: every weight renders distinctly`).toBe(row.length)
    }
  })

  it('never renders a non-zero weight as "0" or a sub-1 weight as "1"', () => {
    // The two specific lies the old format told.
    for (const v of [...DOG, ...CAT]) {
      const s = formatSignificant(v)
      expect(v, 'sanity: these are real, non-degenerate weights').toBeGreaterThan(0)
      expect(v).toBeLessThan(1)
      expect(Number(s), `${v} must not render as an integer`).not.toBe(0)
      expect(Number(s)).not.toBe(1)
    }
  })

  it('keeps enough precision that the rendered string round-trips close to the value', () => {
    for (const v of [...DOG, ...CAT]) {
      const parsed = Number(formatSignificant(v))
      // Within 1% relative — the reader is reading a real measurement, not a
      // rounded-off token standing in for one.
      expect(Math.abs(parsed - v) / v).toBeLessThan(0.01)
    }
  })

  it('stays legible: short strings, no 15-decimal spew', () => {
    for (const v of [...DOG, ...CAT]) {
      expect(formatSignificant(v).length).toBeLessThanOrEqual(9)
    }
  })
})

describe('formatSignificant handles the values figures legitimately produce', () => {
  it('renders a masked score as −∞, not as "-Infinity"', () => {
    // Causal masking really does put -Infinity in the scaled score matrix.
    const scaled = forward(['the', 'dog', 'drank', 'water', 'so', 'it']).scaled[0]
    expect(scaled[0][1]).toBe(-Infinity) // word 0 may not look at word 1
    expect(formatSignificant(-Infinity)).toBe('−∞')
    expect(formatCell(-Infinity)).toEqual({ text: '−∞', masked: true, invalid: false })
  })

  it('flags NaN rather than dressing it up as a number', () => {
    expect(formatSignificant(NaN)).toBe('NaN')
    expect(formatCell(NaN).invalid).toBe(true)
  })

  it('handles exact zero, mid-range and >= 1 values without exponential clutter', () => {
    expect(formatSignificant(0)).toBe('0')
    expect(formatSignificant(0.05)).toBe('0.050')
    expect(formatSignificant(-0.5)).toBe('-0.500')
    expect(formatSignificant(1)).toBe('1.00')
    expect(formatSignificant(-2.5)).toBe('-2.50')
  })
})
