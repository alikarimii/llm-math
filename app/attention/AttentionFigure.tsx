'use client'
import { useMemo, type ReactNode } from 'react'
import { forward } from '../../lib/transformer/forward'
import type { ForwardTrace } from '../../lib/transformer/types'
import type { StageState } from '../../components/lesson/ScrollStage'
import { Matrix } from '../../components/figures/Matrix'
import { MatMul } from '../../components/figures/MatMul'
import { SoftmaxRow } from '../../components/figures/SoftmaxRow'
import { AttentionGrid } from '../../components/figures/AttentionGrid'

const PROMPT = ['the', 'dog', 'drank', 'water', 'so', 'it']
const IT = 5           // index of the query token we follow ('it')
const SUBJECT = 1      // index of its antecedent ('dog')

/**
 * Fraction of a step's scroll over which its figure completes its reveal; the
 * remainder is dwell time on the finished figure.
 *
 * A figure driven by raw local progress only reaches its final frame at the
 * exact scroll position where the next step takes over — so the last row of the
 * attention grid, say, would flash into place on the very pixel it is replaced.
 * Finishing a little early means every figure is fully readable, at rest, beside
 * the prose that describes it.
 */
const REVEAL = 0.85
const reveal = (p: number) => Math.min(1, Math.max(0, p) / REVEAL)

/**
 * One figure per prose step, in order. `progress` is the reader's progress
 * through THAT step alone (0 → 1), handed down by ScrollStage, which derives it
 * from the measured steps rather than from a hardcoded step count. There is no
 * arithmetic here to get wrong.
 *
 * Each entry must be a pure function of (trace, progress) — no memory of past
 * progress values. components/figures/test-utils.tsx#expectPureInProgress
 * enforces this for the figures themselves.
 */
const STEP_FIGURES: ((t: ForwardTrace, p: number) => ReactNode)[] = [
  // 0 — six words become six rows of numbers.
  (t, p) => <Matrix values={t.embedded} progress={reveal(p)} label="token embeddings + position" />,
  // 1 — the same rows, seen through W_Q.
  (t, p) => <Matrix values={t.q[0]} progress={reveal(p)} label="Q = X·Wq (head 0)" />,
  // 2 — one query against one key: the arithmetic you could do by hand.
  (t, p) => (
    <MatMul a={t.q[0][IT]} b={t.k[0][SUBJECT]} progress={reveal(p)} label="q('it') · k('dog')" />
  ),
  // 3 — every query against every key.
  (t, p) => <Matrix values={t.scores[0]} progress={reveal(p)} label="QKᵀ (raw scores)" />,
  // 4 — scaled, and the future masked off.
  (t, p) => <Matrix values={t.scaled[0]} progress={reveal(p)} label="QKᵀ / √dₖ, causally masked" />,
  // 5 — one row of those scores becomes a distribution.
  (t, p) => <SoftmaxRow logits={t.scaled[0][IT]} progress={reveal(p)} labels={PROMPT} />,
  // 6 — the payoff: every row, revealing one at a time, ending on 'it' → 'dog'.
  (t, p) => (
    <AttentionGrid
      weights={t.weights[0]}
      tokens={PROMPT}
      progress={reveal(p)}
      highlightQuery={IT}
    />
  ),
  // 7 — the weighted sum of the value vectors, and the row it produces.
  //
  // Two matrices, revealed one after the other within the step: the values
  // being averaged, then the result of averaging them. Showing both is the only
  // way the prose's actual claim — that the output row is the same shape as the
  // row the lesson started from, which is why blocks stack — is visible rather
  // than asserted. Splitting `p` in half keeps this a pure function of progress.
  (t, p) => {
    const r = reveal(p)
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <Matrix
          values={t.v[0]}
          progress={Math.min(1, r * 2)}
          highlightRow={SUBJECT}
          label="V = X·Wv (head 0) — one value row per word"
        />
        <Matrix
          values={t.output}
          progress={Math.max(0, r * 2 - 1)}
          highlightRow={IT}
          label="output — 6 × 16, exactly the shape we started with"
        />
      </div>
    )
  },
]

/** The number of prose steps this figure can narrate. */
export const ATTENTION_STEP_COUNT = STEP_FIGURES.length

export function AttentionFigure({ step, progress }: StageState) {
  // PROMPT is a module-level constant, so this trace is computed once per
  // mount, not once per scroll frame. The memo key is intentionally empty —
  // the component's only inputs are `step` and `progress`, and it does not
  // track either, so purity is preserved.
  const t = useMemo(() => forward(PROMPT), [])

  const render = STEP_FIGURES[step]
  if (!render) {
    // A step exists in the prose that this figure has no case for: the exact
    // desync this component was restructured to make impossible. Fail loudly in
    // development rather than silently repeating a neighbouring figure.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `AttentionFigure has no figure for step ${step}; the lesson has more <Step>s than the figure has cases (${ATTENTION_STEP_COUNT}).`
      )
    }
    const last = STEP_FIGURES[STEP_FIGURES.length - 1]
    return <>{last(t, step < 0 ? 0 : 1)}</>
  }

  return <>{render(t, progress)}</>
}
