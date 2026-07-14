import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Step } from '../../components/lesson/Step'
import { expectPureInProgress } from '../../components/figures/test-utils'
import { AttentionFigure, ATTENTION_STEP_COUNT } from './AttentionFigure'
import { AttentionScrollStage } from './AttentionScrollStage'

// vitest runs from the repo root (see vitest.config.ts).
const lessonSource = readFileSync(join(process.cwd(), 'app/attention/page.mdx'), 'utf8')
// Matches an opening <Step> tag with or without attributes (each step now
// carries a `label` — the operation it performs), and never the closing
// </Step>. The invariant asserted below is unchanged.
const proseSteps = lessonSource.match(/<Step[\s>]/g)?.length ?? 0

describe('the figure and the prose cannot desync', () => {
  // The bug this file exists to prevent: the figure sliced scroll progress into
  // its own hardcoded number of bands, independent of how many <Step>s the
  // lesson actually contained. Add or remove a step and every figure silently
  // slid out from under its prose. ScrollStage now derives the step index from
  // the measured <Step>s, so the only way to desync is for the lesson to have a
  // step the figure has no case for — which this asserts it does not.

  it('the lesson has exactly as many prose steps as the figure has cases', () => {
    expect(proseSteps).toBeGreaterThan(0)
    expect(proseSteps).toBe(ATTENTION_STEP_COUNT)
  })

  it('every prose step has a figure that renders at the start, middle, and end of that step', () => {
    for (let step = 0; step < proseSteps; step++) {
      for (const progress of [0, 0.5, 1]) {
        expect(() => render(<AttentionFigure step={step} progress={progress} />)).not.toThrow()
      }
    }
  })

  it('is loud, not silently wrong, if the lesson ever gains a step the figure lacks', () => {
    expect(() => render(<AttentionFigure step={ATTENTION_STEP_COUNT} progress={0} />)).toThrow()
  })
})

describe('AttentionFigure', () => {
  it('is a pure function of (step, progress) — scrubbing back reproduces a fresh mount', () => {
    for (const step of [0, 2, 5, 6, 7]) {
      expectPureInProgress(progress => <AttentionFigure step={step} progress={progress} />)
    }
  })

  it('shows the attention grid on the step whose prose is about the attention grid', () => {
    const cells = (step: number, progress: number) =>
      render(<AttentionFigure step={step} progress={progress} />)
        .container.querySelectorAll('[data-role="att-cell"]')

    // Not one step early (the defect: the grid played out under step 5's prose).
    expect(cells(5, 1)).toHaveLength(0)
    expect(cells(6, 1).length).toBeGreaterThan(0)
  })

  it('reveals the grid across step 6 rather than arriving pre-revealed', () => {
    const revealed = (progress: number) => {
      const { container } = render(<AttentionFigure step={6} progress={progress} />)
      return [...container.querySelectorAll('[data-role="att-cell"]')]
        .filter(c => Number(getComputedStyle(c).opacity) === 1).length
    }
    expect(revealed(0)).toBe(0)
    expect(revealed(0.5)).toBeGreaterThan(0)
    expect(revealed(0.5)).toBeLessThan(36)
    expect(revealed(1)).toBe(36) // 6 queries x 6 keys, every row revealed
    // ...and it is complete with scroll left over, so the final row ('it' -> 'dog')
    // is readable at rest rather than flashing in on the pixel step 7 takes over.
    expect(revealed(0.9)).toBe(36)
  })

  it('step 7 shows the value vectors and the output row that comes out the same shape', () => {
    const { container } = render(<AttentionFigure step={7} progress={1} />)
    const labels = [...container.querySelectorAll('figcaption')].map(f => f.textContent ?? '')
    expect(labels.some(l => l.includes('V = X·Wv'))).toBe(true)
    expect(labels.some(l => l.includes('output'))).toBe(true)
  })
})

describe('the lesson stage, end to end', () => {
  // Renders the real stage with the real number of steps and mocked geometry,
  // and checks the figure the reader sees while a given step fills the viewport.
  afterEach(() => vi.restoreAllMocks())

  const VH = 800

  function renderAtScroll(scrolledViewports: number) {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(VH)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const siblings = [...(this.parentElement?.children ?? [])].filter(el =>
        el.hasAttribute('data-step'))
      const i = siblings.indexOf(this)
      const top = i >= 0 ? (i - scrolledViewports) * VH : 0
      const height = i >= 0 ? VH : 0
      return {
        top, height, bottom: top + height,
        left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {},
      } as DOMRect
    })

    return render(
      <AttentionScrollStage>
        {Array.from({ length: ATTENTION_STEP_COUNT }, (_, i) => (
          <Step key={i}><p>step {i}</p></Step>
        ))}
      </AttentionScrollStage>
    ).container
  }

  it('shows no attention grid while the reader is on step 5 (softmax), the step before it', () => {
    expect(renderAtScroll(5).querySelectorAll('[data-role="att-cell"]')).toHaveLength(0)
  })

  it('starts the grid empty exactly when step 6 fills the viewport', () => {
    const cells = [...renderAtScroll(6).querySelectorAll('[data-role="att-cell"]')]
    expect(cells).toHaveLength(36)
    expect(cells.filter(c => Number(getComputedStyle(c).opacity) === 1)).toHaveLength(0)
  })

  it('finishes the grid exactly as step 7 arrives — the reveal happens under step 6', () => {
    const cells = [...renderAtScroll(6.99).querySelectorAll('[data-role="att-cell"]')]
    expect(cells.filter(c => Number(getComputedStyle(c).opacity) === 1)).toHaveLength(36)
  })
})
