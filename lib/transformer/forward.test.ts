import { describe, it, expect } from 'vitest'
import { forward } from './forward'
import fixtures from '../../public/model/fixtures.json'

const TOL = 1e-4

function flat(x: unknown): number[] {
  if (typeof x === 'number') return [x]
  if (x === null) return [-Infinity]
  if (Array.isArray(x)) return x.flatMap(flat)
  throw new Error('unexpected value in tensor')
}

function expectClose(actual: unknown, expected: unknown, label: string) {
  const a = flat(actual), e = flat(expected)
  expect(a.length, `${label}: shape mismatch`).toBe(e.length)
  a.forEach((v, i) => {
    if (e[i] === -Infinity) {
      expect(v, `${label}[${i}] should be -Infinity`).toBe(-Infinity)
    } else {
      expect(Math.abs(v - e[i]), `${label}[${i}]: ${v} vs ${e[i]}`).toBeLessThan(TOL)
    }
  })
}

describe('TypeScript forward pass matches PyTorch', () => {
  const trace = forward(fixtures.prompt)

  for (const key of ['embedded', 'q', 'k', 'v', 'scores', 'scaled', 'weights', 'output'] as const) {
    it(`${key} matches the Python fixture`, () => {
      expectClose(trace[key], (fixtures.trace as Record<string, unknown>)[key], key)
    })
  }

  it('attention weights sum to 1 across each unmasked row', () => {
    for (const head of trace.weights) {
      head.forEach((row, i) => {
        const s = row.slice(0, i + 1).reduce((a, b) => a + b, 0)
        expect(Math.abs(s - 1)).toBeLessThan(TOL)
      })
    }
  })

  it('without √d_k scaling, softmax is sharper', () => {
    const scaled = forward(fixtures.prompt, { scale: true })
    const unscaled = forward(fixtures.prompt, { scale: false })
    const peak = (t: number[][][]) => Math.max(...t[0][t[0].length - 1])
    expect(peak(unscaled.weights)).toBeGreaterThan(peak(scaled.weights))
  })
})
