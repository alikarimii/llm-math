import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { stageState } from './useProgress'
import { ScrollStage, type StageState } from './ScrollStage'
import { Step } from './Step'

const VH = 500
const step = (top: number, height = VH) => ({ top, height })

describe('stageState maps measured steps to (step, local progress)', () => {
  // Layout under test: N steps of one viewport each, stacked. Step k's top is
  // k*VH - scrolled. A step is "on screen" from the moment its top reaches the
  // viewport top until the next step's does.

  it('is (0, 0) before the stage has been reached', () => {
    expect(stageState([step(VH), step(2 * VH), step(3 * VH)])).toEqual({ step: 0, progress: 0 })
  })

  it('is (k, 0) exactly when step k fills the viewport', () => {
    // scrolled = 2*VH: step 2's top is 0.
    expect(stageState([step(-2 * VH), step(-VH), step(0), step(VH)]))
      .toEqual({ step: 2, progress: 0 })
  })

  it('runs local progress 0 -> 1 across the step that is on screen', () => {
    // Halfway through step 1: its top is -VH/2.
    expect(stageState([step(-1.5 * VH), step(-0.5 * VH), step(0.5 * VH)]))
      .toEqual({ step: 1, progress: 0.5 })
  })

  it('hands off at exactly the moment the next step arrives (no gap, no overlap)', () => {
    const before = stageState([step(-VH + 1), step(1)])   // step 0, almost done
    const after = stageState([step(-VH), step(0)])        // step 1, just arrived
    expect(before.step).toBe(0)
    expect(before.progress).toBeCloseTo(1, 2)
    expect(after).toEqual({ step: 1, progress: 0 })
  })

  it('reaches the LAST step at local progress 1 — the payoff figure genuinely finishes', () => {
    // This is the regression the whole redesign exists for: the final step's
    // figure must be able to reach progress 1, not be frozen mid-reveal (or,
    // as before, be fully revealed a step early).
    expect(stageState([step(-2 * VH), step(-VH)])).toEqual({ step: 1, progress: 1 })
  })

  it('clamps past the end of the stage instead of running past 1', () => {
    expect(stageState([step(-99 * VH), step(-98 * VH)])).toEqual({ step: 1, progress: 1 })
  })

  it('handles a single-step stage', () => {
    expect(stageState([step(0)])).toEqual({ step: 0, progress: 0 })
    expect(stageState([step(-VH / 4)])).toEqual({ step: 0, progress: 0.25 })
    expect(stageState([step(-VH)])).toEqual({ step: 0, progress: 1 })
  })

  it('handles a stage with no steps at all', () => {
    expect(stageState([])).toEqual({ step: 0, progress: 0 })
  })

  it('never produces NaN or Infinity, even for zero-height or short steps', () => {
    const cases = [
      stageState([{ top: 0, height: 0 }]),
      stageState([{ top: 10, height: 0 }]),
      stageState([step(0, 10), step(10, 10)]),       // stage far shorter than viewport
      stageState([step(-5, 10), step(5, 10)]),
    ]
    for (const s of cases) {
      expect(Number.isFinite(s.progress)).toBe(true)
      expect(Number.isInteger(s.step)).toBe(true)
      expect(s.progress).toBeGreaterThanOrEqual(0)
      expect(s.progress).toBeLessThanOrEqual(1)
    }
  })
})

describe('ScrollStage feeds the figure the real, measured stage state', () => {
  // Regression test for two defects at once:
  //  1. The reduced-motion defect: ScrollStage used to do `reduced ? 1 : p`,
  //     freezing the figure at its final frame for prefers-reduced-motion
  //     readers even as they kept scrolling and reading.
  //  2. The off-by-one: the figure used to slice a global scalar into N bands
  //     while the sticky layout only affords N-1 viewports of scroll, so every
  //     figure ran a step ahead of the prose beside it. The stage now measures
  //     the steps, so the step index cannot drift from the prose.

  afterEach(() => vi.restoreAllMocks())

  /** Mocks each rendered <Step>'s rect, in document order. */
  function mockStepRects(rects: { top: number; height: number }[]) {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(VH)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const siblings = [...(this.parentElement?.children ?? [])].filter(el =>
        el.hasAttribute('data-step'))
      const i = siblings.indexOf(this)
      const r = i >= 0 ? rects[i] : { top: 0, height: 0 }
      return {
        top: r.top, height: r.height, bottom: r.top + r.height,
        left: 0, right: 0, width: 0, x: 0, y: r.top, toJSON() {},
      } as DOMRect
    })
  }

  function renderStage(rects: { top: number; height: number }[], n: number) {
    mockStepRects(rects)
    const seen: StageState[] = []
    render(
      <ScrollStage figure={state => { seen.push(state); return <div>{state.step}</div> }}>
        {Array.from({ length: n }, (_, i) => <Step key={i}><p>step {i}</p></Step>)}
      </ScrollStage>
    )
    return seen[seen.length - 1]
  }

  it('reports the step that is actually on screen, not a scaled global scalar', () => {
    // Three steps; the reader is halfway through the middle one.
    expect(renderStage([step(-1.5 * VH), step(-0.5 * VH), step(0.5 * VH)], 3))
      .toEqual({ step: 1, progress: 0.5 })
  })

  it('passes real scroll-derived progress, not a forced 1', () => {
    const state = renderStage([step(-VH / 4), step(0.75 * VH)], 2)
    expect(state.progress).toBeCloseTo(0.25)
    expect(state.progress).not.toBe(1)
  })

  it('agrees exactly with the pure mapping it delegates to', () => {
    const rects = [step(-2 * VH), step(-VH), step(0)]
    expect(renderStage(rects, 3)).toEqual(stageState(rects))
  })
})

describe('the stage affords one viewport of scroll per step — including the last', () => {
  /**
   * The trailing spacer ScrollStage renders is load-bearing, and nothing else
   * in the suite notices if it disappears.
   *
   * The figure is `position: sticky` inside the stage, so it is pinned for
   * (stage height − 1 viewport) of scrolling. N steps of 100vh therefore afford
   * only N−1 viewports of pinned travel: the last step's top would reach the
   * viewport top at exactly the scroll position where the stage runs out, and
   * its figure would sit at progress 0 forever — the payoff figure, the one the
   * whole lesson builds toward, would never animate at all. The spacer buys the
   * final step the one viewport of scroll its reveal needs.
   *
   * jsdom does no layout, so the invariant is checked by reading the heights the
   * components actually declare and simulating the geometry they imply, rather
   * than by trusting a rect the environment never computes. That keeps the test
   * honest about what it is asserting: not "a spacer div exists" (which any
   * refactor could satisfy while breaking the invariant) but "the scrollable
   * extent exceeds the steps' combined extent by one viewport, so the final step
   * reaches progress 1."
   */

  /** The height an element declares, in px, resolving `Nvh` against VH. */
  const declaredHeightPx = (el: HTMLElement): number => {
    const raw = el.style.height || el.style.minHeight
    return raw.endsWith('vh') ? (parseFloat(raw) / 100) * VH : 0
  }

  /**
   * Renders a stage of `n` steps and returns the state its figure would see at
   * the very bottom of the page.
   *
   * Geometry: the document is the stage, of height H = (sum of the scroll
   * column's children). The viewport is VH, so the furthest the reader can
   * scroll is y = H − VH. Step k's document top is the sum of the heights above
   * it, and its viewport top at that scroll is (document top − y).
   */
  const stateAtMaxScroll = (n: number): StageState => {
    const { container } = render(
      <ScrollStage figure={() => null}>
        {Array.from({ length: n }, (_, i) => <Step key={i}><p>step {i}</p></Step>)}
      </ScrollStage>
    )
    const column = container.firstElementChild!.children[1] as HTMLElement
    const children = [...column.children] as HTMLElement[]

    // Document tops, accumulated in flow order over everything in the column
    // (the steps AND whatever follows them — the spacer is what makes the
    // difference here, by adding height below the last step).
    let y = 0
    const rects: { top: number; height: number; isStep: boolean }[] = []
    for (const el of children) {
      const height = declaredHeightPx(el)
      rects.push({ top: y, height, isStep: el.hasAttribute('data-step') })
      y += height
    }
    const stageHeight = y
    const maxScroll = stageHeight - VH

    const stepRects = rects
      .filter(r => r.isStep)
      .map(r => ({ top: r.top - maxScroll, height: r.height }))

    return stageState(stepRects)
  }

  it('scrolls one full viewport past the last step, so its figure reaches progress 1', () => {
    // THE regression guard: delete the 100vh spacer from ScrollStage and the
    // last step's figure is stranded at progress 0 — this assertion is what
    // catches that. (Verified by removing it: progress comes back 0, not 1.)
    for (const n of [1, 2, 5, 8]) {
      expect(stateAtMaxScroll(n), `${n}-step stage`).toEqual({ step: n - 1, progress: 1 })
    }
  })

  it('gives the steps N viewports of scroll, not N−1', () => {
    // Same invariant, stated as the extent it comes from: the stage must be
    // taller than its steps by exactly one viewport.
    const { container } = render(
      <ScrollStage figure={() => null}>
        {Array.from({ length: 4 }, (_, i) => <Step key={i}><p>step {i}</p></Step>)}
      </ScrollStage>
    )
    const column = container.firstElementChild!.children[1] as HTMLElement
    const children = [...column.children] as HTMLElement[]
    const total = children.reduce((s, el) => s + declaredHeightPx(el), 0)
    const steps = children
      .filter(el => el.hasAttribute('data-step'))
      .reduce((s, el) => s + declaredHeightPx(el), 0)

    expect(steps).toBe(4 * VH)
    expect(total - steps).toBe(VH)
  })

  it('keeps the extra extent out of the accessibility tree', () => {
    // The spacer is empty scroll runway, not content. It must not announce
    // itself, and it must not be mistaken for a step by the stage's own query.
    const { container } = render(
      <ScrollStage figure={() => null}>
        <Step><p>only step</p></Step>
      </ScrollStage>
    )
    const column = container.firstElementChild!.children[1] as HTMLElement
    const spacers = [...column.children].filter(el => !el.hasAttribute('data-step'))
    expect(spacers).toHaveLength(1)
    expect(spacers[0].getAttribute('aria-hidden')).toBe('true')
    expect(column.querySelectorAll('[data-step]')).toHaveLength(1)
  })
})
