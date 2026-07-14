import { describe, it, expect } from 'vitest'
import {
  softmax, temper, topK, topP, sampleFrom, entropy, perplexity, crossEntropy,
} from './ops'

const TOL = 1e-9
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('temper', () => {
  it('divides every logit by T', () => {
    expect(temper([2, 4, 8], 2)).toEqual([1, 2, 4])
  })

  it('T = 1 is the identity', () => {
    expect(temper([1.5, -3, 0], 1)).toEqual([1.5, -3, 0])
  })

  it('low T sharpens the distribution, high T flattens it', () => {
    const logits = [3, 1, 0]
    const sharp = softmax(temper(logits, 0.25))
    const flat = softmax(temper(logits, 4))
    expect(sharp[0]).toBeGreaterThan(softmax(logits)[0])
    expect(flat[0]).toBeLessThan(softmax(logits)[0])
  })

  it('rejects T <= 0, which would divide by zero', () => {
    expect(() => temper([1, 2], 0)).toThrow(/temperature/i)
    expect(() => temper([1, 2], -1)).toThrow(/temperature/i)
  })
})

describe('topK', () => {
  it('keeps the k largest and renormalises to sum 1', () => {
    const out = topK([0.5, 0.3, 0.15, 0.05], 2)
    expect(out[2]).toBe(0)
    expect(out[3]).toBe(0)
    expect(out[0]).toBeCloseTo(0.5 / 0.8, 9)
    expect(out[1]).toBeCloseTo(0.3 / 0.8, 9)
    expect(sum(out)).toBeCloseTo(1, 9)
  })

  it('k = 1 is greedy: all mass on the argmax', () => {
    expect(topK([0.2, 0.7, 0.1], 1)).toEqual([0, 1, 0])
  })

  it('k >= length leaves the distribution untouched', () => {
    const probs = [0.6, 0.4]
    expect(topK(probs, 5)).toEqual(probs)
  })
})

describe('topP', () => {
  it('keeps the smallest set of tokens whose mass reaches p, then renormalises', () => {
    // cumulative: .5, .8 — two tokens are needed to reach 0.75
    const out = topP([0.5, 0.3, 0.15, 0.05], 0.75)
    expect(out[2]).toBe(0)
    expect(out[3]).toBe(0)
    expect(sum(out)).toBeCloseTo(1, 9)
  })

  it('always keeps at least one token, even when p is below the top probability', () => {
    expect(topP([0.9, 0.1], 0.5)).toEqual([1, 0])
  })

  it('p = 1 keeps everything', () => {
    const probs = [0.5, 0.3, 0.2]
    const out = topP(probs, 1)
    out.forEach((v, i) => expect(v).toBeCloseTo(probs[i], 9))
  })
})

describe('sampleFrom', () => {
  const probs = [0.5, 0.3, 0.2] // cumulative edges at .5 and .8

  it('u = 0 picks the first token', () => {
    expect(sampleFrom(probs, 0)).toBe(0)
  })

  it('picks by cumulative interval', () => {
    expect(sampleFrom(probs, 0.49)).toBe(0)
    expect(sampleFrom(probs, 0.5)).toBe(1)   // edges belong to the token above
    expect(sampleFrom(probs, 0.79)).toBe(1)
    expect(sampleFrom(probs, 0.8)).toBe(2)
    expect(sampleFrom(probs, 0.999)).toBe(2)
  })

  it('never returns a zero-probability token, even at the very top of the range', () => {
    // floating-point sums can fall a hair short of 1; the last nonzero token
    // must absorb the remainder rather than the function returning a masked one.
    expect(sampleFrom([0.5, 0.5, 0], 0.9999999999)).toBe(1)
  })

  it('is deterministic given u — the randomness lives at the call site', () => {
    expect(sampleFrom(probs, 0.6)).toBe(sampleFrom(probs, 0.6))
  })
})

describe('entropy, perplexity, crossEntropy', () => {
  it('a certain distribution has zero entropy and perplexity 1', () => {
    expect(entropy([1, 0, 0])).toBeCloseTo(0, 9)
    expect(perplexity([1, 0, 0])).toBeCloseTo(1, 9)
  })

  it('a uniform distribution over n has perplexity n', () => {
    expect(perplexity([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(4, 9)
    expect(entropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(Math.log(4), 9)
  })

  it('cross-entropy is the surprise at the correct answer', () => {
    expect(crossEntropy([0.5, 0.5], 0)).toBeCloseTo(Math.log(2), 9)
    expect(crossEntropy([1, 0], 0)).toBeCloseTo(0, 9)
  })

  it('being confidently wrong is expensive', () => {
    const confidentlyWrong = crossEntropy([0.999, 0.001], 1)
    const humble = crossEntropy([0.5, 0.5], 1)
    expect(confidentlyWrong).toBeGreaterThan(humble)
  })
})
