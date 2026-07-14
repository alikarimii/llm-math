import type { Matrix, Vector } from './types'

export const dot = (a: Vector, b: Vector): number =>
  a.reduce((s, x, i) => s + x * b[i], 0)

/** PyTorch nn.Linear stores weight as [out, in], so y = x @ W^T. */
export const linear = (x: Matrix, w: Matrix): Matrix =>
  x.map(row => w.map(wRow => dot(row, wRow)))

export const softmax = (row: Vector): Vector => {
  const finite = row.filter(Number.isFinite)
  const max = finite.length ? Math.max(...finite) : 0
  const exps = row.map(v => (Number.isFinite(v) ? Math.exp(v - max) : 0))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => (sum === 0 ? 0 : e / sum))
}

/**
 * Temperature is a division, and nothing more. Dividing the logits by T < 1
 * widens the gaps between them, and softmax — being an exponential — turns
 * wider gaps into a sharper distribution. T > 1 squashes the gaps and flattens
 * it. T = 1 leaves the model's honest belief alone.
 */
export const temper = (logits: Vector, t: number): Vector => {
  if (!(t > 0)) throw new Error(`temperature must be > 0, got ${t}`)
  return logits.map(v => v / t)
}

/** Indices of `probs`, largest first. */
const ranked = (probs: Vector): number[] =>
  probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])

/** Zero every entry outside `keep`, then rescale what remains to sum to 1. */
const renormalise = (probs: Vector, keep: Set<number>): Vector => {
  const total = probs.reduce((s, p, i) => (keep.has(i) ? s + p : s), 0)
  return probs.map((p, i) => (keep.has(i) && total > 0 ? p / total : 0))
}

/** Keep only the k likeliest words; renormalise. k >= length is a no-op. */
export const topK = (probs: Vector, k: number): Vector => {
  if (!(k >= 1)) throw new Error(`k must be >= 1, got ${k}`)
  return k >= probs.length ? [...probs] : renormalise(probs, new Set(ranked(probs).slice(0, k)))
}

/**
 * Nucleus sampling: keep the smallest set of words whose probabilities add up
 * to `p`, discard the tail, renormalise. Unlike top-k this adapts — a confident
 * distribution keeps one word, an uncertain one keeps many.
 */
export const topP = (probs: Vector, p: number): Vector => {
  const keep = new Set<number>()
  let cum = 0
  for (const i of ranked(probs)) {
    keep.add(i)            // add first: at least one word always survives
    cum += probs[i]
    if (cum >= p) break
  }
  return renormalise(probs, keep)
}

/**
 * Draw a word from the distribution. `u` — a uniform random number in [0, 1) —
 * is passed IN rather than generated here, which is what keeps this function
 * pure and exactly testable. Callers do `sampleFrom(probs, Math.random())`.
 *
 * Walk the words, accumulating probability, and take the one whose interval
 * contains u. A word with probability 0.5 owns half the interval, so it comes
 * up half the time. That is all sampling is.
 */
export const sampleFrom = (probs: Vector, u: number): number => {
  let cum = 0
  let last = -1
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 0) last = i
    cum += probs[i]
    if (u < cum && probs[i] > 0) return i
  }
  // Only reachable when floating-point error leaves cum a hair below u.
  // Fall back to the last word with real probability, never a zeroed one.
  return last
}

/**
 * How uncertain the model is, in nats. Zero means it is certain. The maximum,
 * log(n), means it is choosing uniformly among n words.
 */
export const entropy = (probs: Vector): number =>
  -probs.reduce((s, p) => (p > 0 ? s + p * Math.log(p) : s), 0)

/**
 * Entropy, re-expressed as a word count: "the model is effectively choosing
 * between this many words." A perplexity of 1 means it is certain; a perplexity
 * of 16, on a 16-word vocabulary, means it knows nothing at all.
 */
export const perplexity = (probs: Vector): number => Math.exp(entropy(probs))

/**
 * The training signal: how surprised the model was by the correct answer.
 * -log(p) is large when p is small, so being confidently wrong is expensive and
 * being humbly wrong is cheap. Gradient descent spent 6000 steps pushing this
 * number down.
 */
export const crossEntropy = (probs: Vector, target: number): number =>
  -Math.log(probs[target])
