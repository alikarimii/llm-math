'use client'
import { useRef, type ReactNode } from 'react'
import { useStageState, type StageState } from './useProgress'

export type { StageState }

export interface ScrollStageProps {
  figure: (state: StageState) => ReactNode
  children: ReactNode
}

/**
 * Pins `figure` while `children` (a sequence of <Step>s) scroll past, and tells
 * the figure which step is on screen and how far through it the reader is.
 *
 * The stage owns the step mapping deliberately. Handing the figure a single
 * global 0→1 scalar and letting it slice that into bands forces the figure to
 * hardcode the step count, which silently desyncs from the prose the moment a
 * step is added or removed — and did: a 7-step figure driven by 6 viewports of
 * scroll ran 7/6 too fast, so every figure led its own prose by a step. Measuring
 * the steps means the step count is a fact about the DOM, not a constant.
 *
 * The trailing spacer is load-bearing. The sticky figure is pinned for
 * (stage height − 100vh) of scrolling, so N steps of 100vh each give only N−1
 * viewports of travel: the last step would arrive exactly as the scroll ran out
 * and its figure would never animate at all. The spacer buys the final step the
 * one viewport of scroll its reveal needs, and the figure unpins the instant that
 * reveal completes.
 *
 * Figures stay pure: they receive numbers and render, never tracking history.
 *
 * Under prefers-reduced-motion the figure still tracks real scroll position
 * (freezing it would desync it from the prose being scrolled through) — instead,
 * CSS in app/globals.css suppresses transition/animation durations globally, so
 * state changes snap instead of animating.
 */
export function ScrollStage({ figure, children }: ScrollStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useStageState(ref)

  return (
    // The two-column layout lives in CSS (`.stage`, `.stage-figure`) rather than
    // in inline styles so a media query can collapse it to one column on a
    // narrow screen — an inline style cannot be overridden by a media query
    // without `!important`, and the figure column has to become a sticky top
    // band on mobile. The scroll-budget heights below (`100vh` on the spacer,
    // `min-height: 100vh` on each Step) stay inline: they are the stage's
    // geometry contract, not its appearance, and both useProgress's step mapping
    // and scrollstage.test.tsx read them from the DOM.
    <div ref={ref} className="stage">
      <div className="stage-figure">
        {figure(state)}
      </div>
      <div>
        {children}
        <div aria-hidden="true" style={{ height: '100vh' }} />
      </div>
    </div>
  )
}
