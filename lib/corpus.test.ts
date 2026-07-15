import { describe, it, expect } from 'vitest'
import { CORPUS, nextTokenCounts, nextTokenFreqs } from './corpus'

describe('the corpus is the one the model trained on', () => {
  it('has the 18 sentences from train/corpus.py', () => {
    expect(CORPUS).toHaveLength(18)
    expect(CORPUS[0]).toEqual(['the', 'cat', 'drank', 'water', 'so', 'it', 'purred'])
  })
})

describe('nextTokenCounts', () => {
  it('counts what follows "the cat" — the lesson\'s anchor example', () => {
    const { counts, total } = nextTokenCounts(['the', 'cat'])
    expect(counts).toEqual({ quickly: 3, drank: 1, ate: 1, found: 1 })
    expect(total).toBe(6)
  })

  it('turns those counts into the frequencies the lesson shows', () => {
    const freqs = nextTokenFreqs(['the', 'cat'])
    expect(freqs.quickly).toBeCloseTo(0.5, 9)
    expect(freqs.drank).toBeCloseTo(1 / 6, 9)
    expect(freqs.ate).toBeCloseTo(1 / 6, 9)
    expect(freqs.found).toBeCloseTo(1 / 6, 9)
  })

  it('a fully determined context has exactly one continuation', () => {
    const { counts, total } = nextTokenCounts(['the', 'dog', 'drank', 'water', 'so', 'it'])
    expect(counts).toEqual({ barked: 1 })
    expect(total).toBe(1)
  })

  it('"the cat quickly" narrows to the three verbs, evenly', () => {
    const { counts, total } = nextTokenCounts(['the', 'cat', 'quickly'])
    expect(counts).toEqual({ drank: 1, ate: 1, found: 1 })
    expect(total).toBe(3)
  })

  it('a context the corpus never contains has no continuations', () => {
    expect(nextTokenCounts(['the', 'water']).total).toBe(0)
  })

  it('does not count a sentence that ENDS at the context (nothing follows)', () => {
    // "the cat drank water so it purred" — nothing follows "purred"
    expect(nextTokenCounts(CORPUS[0]).total).toBe(0)
  })
})
