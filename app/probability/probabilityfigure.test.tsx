import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { expectPureInProgress } from '../../components/figures/test-utils'
import { ProbabilityFigure, PROBABILITY_STEP_COUNT } from './ProbabilityFigure'

// vitest runs from the repo root (see vitest.config.ts).
const lessonSource = readFileSync(join(process.cwd(), 'app/probability/page.mdx'), 'utf8')
// Matches an opening <Step> tag with or without attributes (each step carries a
// `label` — the operation it performs), and never the closing </Step>.
const proseSteps = lessonSource.match(/<Step[\s>]/g)?.length ?? 0

/** The numbers Distribution prints, in the order it prints them. */
const values = (step: number, progress: number): string[] =>
  [...render(<ProbabilityFigure step={step} progress={progress} />)
    .container.querySelectorAll('.distribution-value')]
    .map(n => n.textContent ?? '')

/** The words Distribution labels its bars with, in display order. */
const labels = (step: number, progress: number): string[] =>
  [...render(<ProbabilityFigure step={step} progress={progress} />)
    .container.querySelectorAll('.distribution-label')]
    .map(n => n.textContent ?? '')

describe('the figure and the prose cannot desync', () => {
  // STEP_FIGURES maps POSITIONALLY onto the <Step>s in page.mdx: figure n
  // narrates prose step n. Add or remove a <Step> without adding or removing a
  // figure and every figure after it slides silently under the wrong prose.

  it('the lesson has exactly as many prose steps as the figure has cases', () => {
    expect(proseSteps).toBeGreaterThan(0)
    expect(proseSteps).toBe(PROBABILITY_STEP_COUNT)
  })

  it('every prose step has a figure that renders at the start, middle, and end of that step', () => {
    for (let step = 0; step < proseSteps; step++) {
      for (const progress of [0, 0.5, 1]) {
        expect(() => render(<ProbabilityFigure step={step} progress={progress} />)).not.toThrow()
      }
    }
  })

  it('is loud, not silently wrong, if the lesson ever gains a step the figure lacks', () => {
    expect(() => render(<ProbabilityFigure step={PROBABILITY_STEP_COUNT} progress={0} />)).toThrow()
  })
})

describe('ProbabilityFigure', () => {
  it('is a pure function of (step, progress) — scrubbing back reproduces a fresh mount', () => {
    for (let step = 0; step < PROBABILITY_STEP_COUNT; step++) {
      expectPureInProgress(progress => <ProbabilityFigure step={step} progress={progress} />)
    }
  })

  it('draws the six display words likeliest-first, four legal ones then two of the tail', () => {
    expect(labels(4, 1)).toEqual(['quickly', 'ate', 'found', 'drank', 'it', 'bird'])
  })

  it('prints the model\'s honest T = 1 distribution — the numbers the prose counts', () => {
    // page.mdx: `quickly` 0.551 · `ate` 0.163 · `found` 0.148 · `drank` 0.137
    expect(values(4, 1)).toEqual(['0.551', '0.163', '0.148', '0.137', '0.001', '0.000'])
  })
})

describe('temperature is applied to all sixteen logits, and only then sliced', () => {
  // THE BUG THIS BLOCK EXISTS TO PREVENT.
  //
  // Every transformation must run over the FULL 16-word vocabulary and be
  // sliced to six for display afterwards. Slicing first —
  // `softmax(temper(show(c, c.logits), t))` — renormalises over six words
  // instead of sixteen and prints numbers the model never produced. That bug
  // shipped once: at T = 4 it printed `quickly` 0.287 where the real model says
  // 0.224, and 0.287 is the fabrication. It is invisible to every other test in
  // this repo, because every other test calls the ops directly rather than
  // rendering the figure.
  //
  // The values below are the real model's, computed from forward(['the','cat'])
  // over all sixteen logits. If someone reintroduces the slice-first bug these
  // assertions fail; sliced-first at T = 4 reads
  // 0.287 / 0.211 / 0.206 / 0.202 / 0.051 / 0.042.
  //
  // On `progress`: step 7 sweeps T 1.0 -> 0.25 and step 8 sweeps T 1.0 -> 4.0,
  // but through reveal(), which is progress / 0.85 clamped to 1 — so the sweep
  // COMPLETES at progress 0.85 and the remaining scroll dwells on the finished
  // figure. Both 0.85 and 1 therefore land exactly on the endpoint temperature,
  // which is what these assert.

  it('step 8 reaches T = 4.00 and prints the FULL-vocabulary probabilities there', () => {
    for (const progress of [0.85, 1]) {
      // page.mdx: `quickly` 0.224 · `ate` 0.165 · `found` 0.161 · `drank` 0.158,
      // with `it` at 0.040 and `bird` at 0.033.
      expect(values(8, progress)).toEqual(['0.224', '0.165', '0.161', '0.158', '0.040', '0.033'])
    }
  })

  it('step 8 says on its face which temperature it is drawing', () => {
    const { container } = render(<ProbabilityFigure step={8} progress={1} />)
    expect(container.querySelector('figcaption')?.textContent).toContain('T = 4.00')
  })

  it('step 7 reaches T = 0.25 and prints the FULL-vocabulary probabilities there', () => {
    // page.mdx: at T = 0.25, `quickly` climbs to 0.984 — confident, and wrong.
    expect(values(7, 1)).toEqual(['0.984', '0.008', '0.005', '0.004', '0.000', '0.000'])
    const { container } = render(<ProbabilityFigure step={7} progress={1} />)
    expect(container.querySelector('figcaption')?.textContent).toContain('T = 0.25')
  })

  it('both temperature steps begin at T = 1.00, the model\'s honest distribution', () => {
    for (const step of [7, 8]) {
      expect(values(step, 0)).toEqual(['0.551', '0.163', '0.148', '0.137', '0.001', '0.000'])
    }
  })

  it('step 9 truncates the tail with top-p over the full vocabulary, then slices', () => {
    // p = 0.9 keeps four words; the two tail bars are zeroed, and the four that
    // survive are renormalised over sixteen — so they read as they did at T = 1.
    expect(values(9, 1)).toEqual(['0.551', '0.163', '0.148', '0.137', '0.000', '0.000'])
  })
})
