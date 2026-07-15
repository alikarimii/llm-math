import { describe, it, expect } from 'vitest'
import { forward, loadModel } from './transformer/forward'
import { softmax, entropy, perplexity, crossEntropy, topK } from './transformer/ops'
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
  // Titled by the whole context, not by a template that interpolates only the
  // first two words — three of these six contexts start with "the cat", and a
  // failure in CI has to say WHICH one.
  it.each(CONTEXTS.map(context => [context.join(' '), context] as const))(
    'after "%s" the model matches the corpus counts',
    (_title, context) => {
      expect(kl(context)).toBeLessThan(MAX_KL_NATS)
    }
  )

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

/**
 * Every derived number app/probability/page.mdx prints, recomputed here from
 * the real weights with the very functions the lesson is teaching.
 *
 * The KL threshold above guards a different thing — that the claim holds AT
 * ALL — and at 0.05 nats it is six times looser than the 0.008184 the page
 * prints. A retrain that moved KL to 0.03 would keep this suite green while the
 * page's headline number went silently false. These assertions close that gap:
 * they pin what the reader actually READS.
 *
 * Tolerances are 3-4 decimal places: tight enough that a drift which falsifies
 * the page fails the build, loose enough not to flake on floating-point noise.
 *
 * If one of these fails, the page is what is wrong. Do not adjust the number
 * here to match the code without deciding what the reader should be told.
 */
describe('the numbers the lesson prints, recomputed from the weights', () => {
  const CONTEXT = ['the', 'cat']

  /** The model's full 16-long logit row after "the cat". */
  function modelLogits(context: string[]): Record<string, number> {
    const { logits } = forward(context)
    const row = logits[logits.length - 1]
    return Object.fromEntries(vocab.map((w, i) => [w, row[i]]))
  }

  const p = modelProbs(CONTEXT)
  const probs = vocab.map(w => p[w])
  /** The corpus's own distribution, as a vector in vocabulary order. */
  const truth = nextTokenFreqs(CONTEXT)
  const corpus = vocab.map(w => truth[w] ?? 0)

  /**
   * Cross-entropy of the model's distribution against the corpus's: the average
   * -log P(model, word) over the words the corpus actually produced, weighted by
   * how often it produced them. This is the loss training was minimising.
   */
  const ce = vocab.reduce(
    (sum, _w, i) => (corpus[i] > 0 ? sum + corpus[i] * crossEntropy(probs, i) : sum),
    0
  )
  /** The floor: the corpus distribution's own entropy — the best score possible. */
  const floor = entropy(corpus)

  it('the six logits the lesson prints are the six the model produces', () => {
    const l = modelLogits(CONTEXT)
    expect(l.quickly).toBeCloseTo(3.767, 3)
    expect(l.ate).toBeCloseTo(2.550, 3)
    expect(l.found).toBeCloseTo(2.452, 3)
    expect(l.drank).toBeCloseTo(2.375, 3)
    expect(l.it).toBeCloseTo(-3.164, 3)
    expect(l.food).toBeCloseTo(-7.725, 3)
  })

  it('cross-entropy after "the cat" is 1.2506 nats, a perplexity of 3.49', () => {
    expect(ce).toBeCloseTo(1.2506, 4)
    expect(Math.exp(ce)).toBeCloseTo(3.4926, 3)
    expect(Math.exp(ce)).toBeCloseTo(3.49, 2)
  })

  it('the floor — the best any model could score here — is 1.2425 nats, a perplexity of 3.46', () => {
    expect(floor).toBeCloseTo(1.2425, 4)
    expect(perplexity(corpus)).toBeCloseTo(3.4641, 3)
    expect(perplexity(corpus)).toBeCloseTo(3.46, 2)
    // The model cannot beat the floor. Being below it would mean the corpus
    // after "the cat" is less ambiguous than the six sentences say it is.
    expect(ce).toBeGreaterThanOrEqual(floor)
  })

  it('KL — the gap between those two numbers — is 0.008184 nats', () => {
    expect(ce - floor).toBeCloseTo(0.008184, 5)
    // and it is the same quantity the threshold above guards, arrived at the
    // other way: as a divergence rather than as a difference of two losses.
    expect(ce - floor).toBeCloseTo(kl(CONTEXT), 6)
  })

  it('a model that knows nothing scores 2.7726 nats — a perplexity of 16', () => {
    const uniform = vocab.map(() => 1 / vocab.length)
    expect(entropy(uniform)).toBeCloseTo(2.7726, 4)
    expect(perplexity(uniform)).toBeCloseTo(16.0, 4)
  })

  it('the cliff: four words hold 99.84% of the mass, the other twelve 0.16%', () => {
    const kept = topK(probs, 4)
    const top4 = probs.reduce((sum, q, i) => (kept[i] > 0 ? sum + q : sum), 0)
    expect(top4).toBeCloseTo(0.9984, 4)
    expect(1 - top4).toBeCloseTo(0.0016, 4)
    // The four are the four the corpus allows — the model did not pick a
    // different quartet that happens to add up to the same mass.
    expect(vocab.filter((_w, i) => kept[i] > 0).sort())
      .toEqual(['ate', 'drank', 'found', 'quickly'])
  })
})
