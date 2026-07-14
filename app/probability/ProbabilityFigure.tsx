'use client'
import { useMemo, type ReactNode } from 'react'
import { forward, loadModel } from '../../lib/transformer/forward'
import { softmax, temper, topP } from '../../lib/transformer/ops'
import { nextTokenFreqs } from '../../lib/corpus'
import type { StageState } from '../../components/lesson/ScrollStage'
import { Vector } from '../../components/figures/Vector'
import { Matrix } from '../../components/figures/Matrix'
import { Distribution } from '../../components/figures/Distribution'
import { SoftmaxRow } from '../../components/figures/SoftmaxRow'

const CONTEXT = ['the', 'cat']

/**
 * Fraction of a step's scroll over which its figure completes its reveal; the
 * remainder is dwell time on the finished figure, so every figure is readable,
 * at rest, beside the prose that describes it. Same convention as
 * app/attention/AttentionFigure.tsx.
 */
const REVEAL = 0.85
const reveal = (p: number) => Math.min(1, Math.max(0, p) / REVEAL)

/** Interpolate T across a step, so temperature sweeps as the reader scrolls. */
const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.min(1, Math.max(0, p))

interface Ctx {
  /** The FULL logit row — one score per word in the 16-word vocabulary. */
  logits: number[]
  /** softmax over all sixteen. Sums to 1 across the whole vocabulary. */
  probs: number[]
  /** Indices into the full row of the six words the figures draw, likeliest first. */
  order: number[]
  labels: string[]
  corpus: number[]
  output: number[]
  unembed: number[][]
}

/**
 * Take the six display words out of a full-vocabulary vector, in display order.
 *
 * Every transformation — softmax, temperature, top-p — runs over ALL SIXTEEN
 * words first, and only the result is sliced for display. Slicing first and
 * transforming after would renormalise over six words instead of sixteen, and
 * the numbers Distribution prints would be numbers the model never produced.
 * At T = 4 that error is enormous: `quickly` would read 0.287 where the model
 * actually says 0.224. Slice last, always.
 */
const show = (c: Ctx, full: number[]): number[] => c.order.map(i => full[i])

/**
 * One figure per prose step, in order, mapped POSITIONALLY onto the <Step>
 * elements in page.mdx. Adding or removing a step there without adding or
 * removing one here silently desyncs every figure after it.
 *
 * Each entry is a pure function of (ctx, progress) — no state, no memory of
 * past progress.
 *
 * Note on step 2: the logits include negatives (`it` sits at −3.164), and
 * Distribution draws bar widths as a fraction of the maximum, which would make
 * those bars negative-width — an invalid CSS declaration, dropped by the
 * browser, leaving the row silently empty. Rather than teach Distribution about
 * signed values, the raw scores go to SoftmaxRow, which was built for exactly
 * this (it draws the masked, signed attention scores in /attention): it
 * min-max-normalises the bar HEIGHTS for display and prints no numbers, so the
 * negative logits are shown honestly, as short bars, rather than as fabricated
 * shifted values. It is the one figure handed the six-word slice directly: it
 * prints no probability, so nothing it draws can misstate one.
 */
const STEP_FIGURES: ((c: Ctx, p: number) => ReactNode)[] = [
  // 0 — where /attention left off: 16 numbers that are not yet an answer.
  (c, p) => (
    <Vector values={c.output} progress={reveal(p)} label="the residual stream — still just numbers" />
  ),
  // 1 — the matrix that has been sitting unused in weights.json all along.
  (c, p) => (
    <Matrix values={c.unembed} progress={reveal(p)} label="unembed — one row per word in the vocabulary" />
  ),
  // 2 — logits: raw scores, meaningless alone. Held at 0: this is the BEFORE.
  c => (
    <SoftmaxRow logits={show(c, c.logits)} labels={c.labels} progress={0} />
  ),
  // 3 — softmax turns them into a distribution that sums to 1. The same bars
  //     morph, in place, from scores into probabilities as the reader scrolls.
  (c, p) => (
    <SoftmaxRow logits={show(c, c.logits)} labels={c.labels} progress={reveal(p)} />
  ),
  // 4 — THE TURN: the same numbers, obtained by counting sentences.
  (c, p) => (
    <Distribution probs={show(c, c.probs)} labels={c.labels} compare={c.corpus} progress={reveal(p)} label="model (colour) vs. corpus counts (grey)" />
  ),
  // 5 — cross-entropy and perplexity: still on the comparison, prose carries it.
  (c, p) => (
    <Distribution probs={show(c, c.probs)} labels={c.labels} compare={c.corpus} progress={reveal(p)} label="model (colour) vs. corpus counts (grey)" />
  ),
  // 6 — the cliff: 12 of 16 words share 0.16% of the mass.
  (c, p) => (
    <Distribution probs={show(c, c.probs)} labels={c.labels} progress={reveal(p)} cutoff={4} label="the cliff — everything past the fourth word is illegal here" />
  ),
  // 7 — temperature sweeps 1.0 → 0.25 as the reader scrolls this step.
  (c, p) => {
    const t = lerp(1, 0.25, reveal(p))
    return (
      <Distribution
        probs={show(c, softmax(temper(c.logits, t)))}
        labels={c.labels}
        progress={1}
        label={`T = ${t.toFixed(2)} — more confident, less truthful`}
      />
    )
  },
  // 8 — and 1.0 → 4.0 the other way. The six bars no longer sum to 1: at T = 4
  //     nearly a third of the mass has moved onto the ten words not drawn here,
  //     which is the point the prose makes and the reason top-p follows.
  (c, p) => {
    const t = lerp(1, 4, reveal(p))
    return (
      <Distribution
        probs={show(c, softmax(temper(c.logits, t)))}
        labels={c.labels}
        progress={1}
        label={`T = ${t.toFixed(2)} — the tail is reopening`}
      />
    )
  },
  // 9 — top-p truncation, applied to the full vocabulary and then sliced.
  (c, p) => (
    <Distribution
      probs={show(c, topP(c.probs, 0.9))}
      labels={c.labels}
      progress={reveal(p)}
      cutoff={4}
      label="top-p = 0.9 — the tail is cut, the rest renormalised"
    />
  ),
]

/** The number of prose steps this figure can narrate. */
export const PROBABILITY_STEP_COUNT = STEP_FIGURES.length

export function ProbabilityFigure({ step, progress }: StageState) {
  // CONTEXT is a module-level constant, so this runs once per mount, not once
  // per scroll frame. The empty memo key is intentional: the component's only
  // inputs are `step` and `progress`, neither of which it tracks.
  const c = useMemo<Ctx>(() => {
    const model = loadModel()
    const trace = forward(CONTEXT)
    const logitRow = trace.logits[trace.logits.length - 1]
    const probs = softmax(logitRow)

    // Fixed display order — likeliest first — computed once, so bars never leap.
    // Six words: the four legal ones, plus two of the tail so the cliff is visible.
    const order = model.vocab
      .map((word, i) => ({ word, i }))
      .sort((a, b) => probs[b.i] - probs[a.i])
      .slice(0, 6)

    const freqs = nextTokenFreqs(CONTEXT)

    return {
      // The full rows are kept whole. `order` says which six to draw, and
      // `show` applies that slice AFTER every transformation, never before.
      logits: logitRow,
      probs,
      order: order.map(({ i }) => i),
      labels: order.map(({ word }) => word),
      corpus: order.map(({ word }) => freqs[word] ?? 0),
      output: trace.output[trace.output.length - 1],
      unembed: model.unembed,
    }
  }, [])

  const render = STEP_FIGURES[step]
  if (!render) {
    // A step exists in the prose that this figure has no case for: the exact
    // desync the positional mapping makes easy to introduce. Fail loudly in
    // development rather than silently repeating a neighbouring figure.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `ProbabilityFigure has no figure for step ${step}; the lesson has more <Step>s than the figure has cases (${PROBABILITY_STEP_COUNT}).`
      )
    }
    const last = STEP_FIGURES[STEP_FIGURES.length - 1]
    return <>{last(c, step < 0 ? 0 : 1)}</>
  }

  return <>{render(c, progress)}</>
}
