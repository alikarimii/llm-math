/**
 * How many of the sixteen words the figures on this page draw.
 *
 * Four, because exactly four words can legally follow "the cat" and they hold
 * 99.84% of the mass — plus two of the tail, so the cliff between the legal
 * words and the illegal ones is visible rather than merely asserted. Sixteen
 * bars do not fit beside the prose; four alone would hide the thing the lesson
 * is about.
 */
export const DISPLAY_WORDS = 6

export interface DisplayEntry {
  /** The word, as it is labelled on the bar. */
  word: string
  /** Its index in the FULL vocabulary — the slice back into a 16-long vector. */
  i: number
}

/**
 * The words the figures draw, likeliest first.
 *
 * Both the scrolling lesson figure and the playground draw the same six bars,
 * and they must draw them in the same order: they sit on one page, and bars
 * that disagreed about which word is likeliest would be a visible lie. So the
 * order is computed here, once, rather than twice by hand.
 *
 * The order is derived from the probabilities passed in — callers fix it at
 * T = 1 and hold it — so raising the temperature reshapes the bars in place
 * instead of making them leap over one another under the reader's cursor.
 */
export function displayOrder(vocab: string[], probs: number[]): DisplayEntry[] {
  return vocab
    .map((word, i) => ({ word, i }))
    .sort((a, b) => probs[b.i] - probs[a.i])
    .slice(0, DISPLAY_WORDS)
}
