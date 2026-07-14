import corpusJson from '../public/model/corpus.json'

/**
 * The 18 sentences the model was trained on — the whole of its universe.
 *
 * Read from public/model/corpus.json, which train/export.py writes from
 * train/corpus.py, the same list train.py trains on. Deliberately NOT
 * transcribed here: the /probability lesson claims the model's output
 * probabilities ARE these sentences' frequencies, and a hand-copied second
 * copy could drift from what the model actually saw, turning that claim into
 * a quiet lie.
 */
export const CORPUS: string[][] = corpusJson.sentences

export interface NextTokenCounts {
  counts: Record<string, number>
  total: number
}

/**
 * How often each word follows `context` in the corpus — by counting, with no
 * model involved. This is the ground truth the lesson holds the network up
 * against.
 *
 * A sentence contributes only if `context` is a prefix of it AND at least one
 * word follows; a sentence that ends exactly at the context predicts nothing.
 */
export function nextTokenCounts(context: string[]): NextTokenCounts {
  const counts: Record<string, number> = {}
  let total = 0

  for (const sentence of CORPUS) {
    if (sentence.length <= context.length) continue
    if (!context.every((w, i) => sentence[i] === w)) continue
    const next = sentence[context.length]
    counts[next] = (counts[next] ?? 0) + 1
    total++
  }

  return { counts, total }
}

/** The same counts as fractions of 1 — directly comparable to the model's softmax. */
export function nextTokenFreqs(context: string[]): Record<string, number> {
  const { counts, total } = nextTokenCounts(context)
  if (total === 0) return {}
  return Object.fromEntries(
    Object.entries(counts).map(([word, n]) => [word, n / total])
  )
}
