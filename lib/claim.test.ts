import { describe, it, expect } from 'vitest'
import { forward, loadModel } from './transformer/forward'
import { softmax } from './transformer/ops'
import { nextTokenFreqs } from './corpus'

/**
 * The /probability lesson claims: the model's next-word probabilities ARE the
 * frequencies of the training corpus. That claim is checked here against the
 * real weights, on every context the lesson puts on screen.
 *
 * KL divergence measures how far the model's distribution sits from the
 * corpus's — 0 means identical. The threshold is set against the measured worst
 * case ("the bird", 0.0332 nats), leaving ~1.5x headroom: tight enough that a
 * retrain which genuinely broke the claim would trip it, loose enough to
 * survive ordinary seed-to-seed variation. A threshold below ~0.04 fails today.
 *
 * If this test starts failing, DO NOT relax the threshold. The lesson's central
 * claim has stopped being true, and the lesson — not the test — is what needs
 * to change.
 */
const MAX_KL_NATS = 0.05

const vocab = loadModel().vocab

/** Probability the model assigns to each next word, given a context. */
function modelProbs(context: string[]): Record<string, number> {
  const { logits } = forward(context)
  const probs = softmax(logits[logits.length - 1])
  return Object.fromEntries(vocab.map((w, i) => [w, probs[i]]))
}

/** How much worse than the corpus the model's distribution is, in nats. */
function kl(context: string[]): number {
  const truth = nextTokenFreqs(context)
  const model = modelProbs(context)
  return Object.entries(truth).reduce(
    (sum, [word, q]) => sum + q * Math.log(q / model[word]),
    0
  )
}

const CONTEXTS: string[][] = [
  ['the', 'cat'],
  ['the', 'dog'],
  ['the', 'bird'],
  ['the', 'cat', 'quickly'],
  ['the', 'cat', 'drank', 'water', 'so', 'it'],
  ['the', 'dog', 'drank', 'water', 'so', 'it'],
]

describe('THE CLAIM: the model learned the corpus frequencies', () => {
  it.each(CONTEXTS)('"%s" — model matches the corpus within %s nats', (...context) => {
    const divergence = kl(context as string[])
    expect(divergence).toBeLessThan(MAX_KL_NATS)
  })

  it('the anchor example is exactly what the lesson prints', () => {
    const p = modelProbs(['the', 'cat'])
    expect(p.quickly).toBeCloseTo(0.5506, 3)
    expect(p.ate).toBeCloseTo(0.1630, 3)
    expect(p.found).toBeCloseTo(0.1479, 3)
    expect(p.drank).toBeCloseTo(0.1369, 3)
  })

  it('the model learned which words are even legal: 12 of 16 share 0.2% of the mass', () => {
    const p = modelProbs(['the', 'cat'])
    const legal = ['quickly', 'ate', 'found', 'drank']
    const tail = Object.entries(p)
      .filter(([w]) => !legal.includes(w))
      .reduce((s, [, v]) => s + v, 0)
    expect(tail).toBeLessThan(0.005)
  })
})
